'use strict';
/**
 * The widget window, flush against the right edge of the screen.
 *
 * Core idea: the window is ALWAYS click-through (setIgnoreMouseEvents). It
 * never steals focus and never swallows a click. Hover is derived from
 * sampling the cursor position in the main process, then handed to the
 * renderer which does its own hit-testing. It is the only approach that
 * behaves the same on macOS and on X11.
 */

const {
  app, BrowserWindow, screen, Tray, Menu, nativeImage, ipcMain, shell,
  Notification, globalShortcut, powerMonitor
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { fetchUsage } = require('./usage');
const I18N = require('./i18n');
const { nextDelay, shouldRefreshOnReveal, adjustFloor, initialDelay } = require('./schedule');
const autostart = require('./autostart');
const store = require('./state');
const alerts = require('./alerts');
const updater = require('./updater');
const {
  G, layout, boundsForDisplay: computeBounds,
  isOuterRightEdge, inHotZone, insideKeepAlive, pickDisplay, sameBounds
} = require('./geometry');

// The number of rings depends on the account: every model carries its own
// quota. The whole layout follows from it, and the window resizes if the API
// returns one more.
let rows = 3;
const DEMO = process.env.MARGE_DEMO === '1' || process.argv.includes('--demo');

const CONFIG_PATH = path.join(os.homedir(), '.config', 'claude-marge', 'config.json');
const DEFAULTS = {
  verticalAnchor: 0.45,   // 0 = top of the screen, 1 = bottom
  refreshSeconds: 300,
  followCursorDisplay: true, // show up on whichever display holds the cursor
  displayId: 'primary',      // used when the widget does not follow the mouse
  language: 'auto',          // 'auto', or one of the codes in src/i18n.js
  checkUpdates: true,        // look for a new commit once a day, and say so
  theme: 'midnight',         // see src/themes.js
  timeFormat: 'auto',        // 'auto', '12' or '24'
  alertAt: [80, 95],         // notify once when a quota crosses these marks
  shortcut: 'CommandOrControl+Shift+M' // toggle pinned mode; '' disables it
};

function loadConfig() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
  } catch (_) {
    return { ...DEFAULTS };
  }
}
let config = loadConfig();

/** Reveal needs something to reveal: write the defaults on first use. */
function ensureConfigFile() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
    }
    return true;
  } catch (_) {
    return false;
  }
}

async function revealConfig() {
  if (!ensureConfigFile()) return;
  // openPath hands it to the default editor; if nothing is associated with
  // .json it returns a message, and revealing the folder is the fallback.
  const problem = await shell.openPath(CONFIG_PATH);
  if (problem) shell.showItemInFolder(CONFIG_PATH);
}

function saveConfig(next) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2) + '\n');
    return true;
  } catch (_) {
    return false;
  }
}

let win = null;
let tray = null;
let visible = false;
let hideTimer = null;
let pollTimer = null;
let refreshTimer = null;
let lastData = { ok: false, reason: 'loading', gauges: [] };
let lastGood = store.restoreLastGood();  // survives a restart, so no blank pill
let failures = store.restoreFailures();  // survives a restart, so no lost backoff
let inFlight = false;
let pinned = false;       // pill stays out; the panel still follows the cursor
let panelOpen = false;
let alertLedger = store.read().alerts || {};
// Starts at the configured interval rather than zero, or the first refresh
// logs a pace change from nothing to the value it already had.
let floorSeconds = store.read().floorSeconds || 0;
let cleanReads = 0;
if (lastGood) lastData = { ...lastGood, stale: true, reason: 'loading' };
let ready = false; // the page finished loading and is listening
let currentDisplayId = null;

// --- Placement --------------------------------------------------------------

function boundsForDisplay(display) {
  return computeBounds(display.workArea, rows, config.verticalAnchor);
}

function activeDisplay() {
  return screen.getAllDisplays().find((d) => d.id === currentDisplayId)
    || screen.getPrimaryDisplay();
}

/** The display the settings say the widget belongs on, right now. */
function preferredDisplay() {
  return pickDisplay({
    displays: screen.getAllDisplays(),
    primaryId: screen.getPrimaryDisplay().id,
    cursorPoint: null,
    follow: false,
    preferredId: config.displayId
  }) || screen.getPrimaryDisplay();
}

/**
 * Screens come and go: a laptop lid closes, a dock is unplugged, a resolution
 * changes. Without this the widget keeps its old coordinates and ends up drawn
 * outside every desktop, which looks exactly like a crash.
 */
let displayTimer = null;
/** Screens announce themselves in bursts; act once, when they settle. */
function onDisplaysChanged() {
  clearTimeout(displayTimer);
  displayTimer = setTimeout(applyDisplayChange, 400);
}

function applyDisplayChange() {
  const displays = screen.getAllDisplays();
  const stillThere = displays.some((d) => d.id === currentDisplayId);
  const target = stillThere && config.followCursorDisplay
    ? activeDisplay()
    : preferredDisplay();
  trace(`displays changed: ${displays.length} present, moving to ${target.id}`);
  placeOn(target);
  if (visible) setPanel(panelOpen);
}

function placeOn(display) {
  if (!win || win.isDestroyed()) return;
  currentDisplayId = display.id;
  const next = boundsForDisplay(display);
  // Moving the window emits display-metrics-changed, which moves the window.
  // Skipping a move that changes nothing is what stops the two feeding each
  // other several times a second.
  if (sameBounds(win.getBounds(), next)) return;
  win.setBounds(next);
}

// --- Window -----------------------------------------------------------------

function createWindow() {
  const display = preferredDisplay();
  win = new BrowserWindow({
    ...boundsForDisplay(display),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    show: false,
    acceptFirstMouse: false,
    type: process.platform === 'linux' ? 'toolbar' : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Throttled while hidden, full speed while shown: setBackgroundThrottling
      // is flipped on reveal, so the entry animation never stutters.
      backgroundThrottling: true
    }
  });
  currentDisplayId = display.id;

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true); // never steal a click, never take focus

  win.on('closed', () => {
    trace('window closed');
    // Teardown order matters: the cursor poll keeps firing between the window
    // being destroyed and the quit handler running, and touching a destroyed
    // window throws.
    win = null;
    ready = false;
    clearInterval(pollTimer);
    clearTimeout(refreshTimer);
  });
  win.webContents.on('render-process-gone', (_e, d) => trace(`renderer gone: ${d.reason}`));
  win.webContents.on('unresponsive', () => trace('renderer unresponsive'));
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.on('did-finish-load', () => {
    ready = true;
    sendGeometry();
    win.webContents.send('usage', lastData);
    // A hover can happen before loading finishes: replay the current state,
    // otherwise the pill stays invisible until the next hover.
    if (visible) {
      win.webContents.send('reveal', true);
      win.webContents.send('panel', panelOpen);
    }
  });
}

function sendGeometry() {
  if (!win || win.isDestroyed()) return;
  const m = layout(activeDisplay().workArea, rows);
  win.webContents.send('geometry', {
    pillWidth: G.pillWidth,
    ringToLabel: G.ringToLabel,
    ring: m.ring,
    ringLabel: m.label,
    rowGap: m.rowGap,
    pillPadding: m.pillPadding,
    locale: activeLocale(),
    theme: config.theme || 'midnight',
    timeFormat: config.timeFormat || 'auto',
    rows
  });
}

/** Resize when the number of quotas the account exposes changes. */
function setRows(n) {
  const next = Math.max(1, n);
  if (next === rows) return;
  rows = next;
  if (win && !win.isDestroyed()) win.setBounds(boundsForDisplay(activeDisplay()));
  sendGeometry();
}

// --- Reveal and hide --------------------------------------------------------

/**
 * The panel is the expensive half: pinned, it would sit across the screen all
 * day. So pinning keeps the pill out and lets the panel follow the pointer,
 * the same way it does on a normal hover.
 */
function setPanel(open) {
  if (open === panelOpen) return;
  panelOpen = open;
  if (ready && win && !win.isDestroyed()) win.webContents.send('panel', open);
}

function show() {
  if (!win || win.isDestroyed() || visible) return;
  visible = true;
  clearTimeout(hideTimer);
  win.webContents.setBackgroundThrottling(false);
  win.showInactive();
  if (ready) win.webContents.send('reveal', true);
  if (!pinned) setPanel(true);
  if (shouldRefreshOnReveal(lastGood && lastGood.fetchedAt, failures, Date.now())) refresh();
}

function scheduleHide() {
  if (!visible || hideTimer) return;
  hideTimer = setTimeout(() => {
    hideTimer = null;
    if (!visible || !win || win.isDestroyed()) return;
    visible = false;
    setPanel(false);
    if (ready) win.webContents.send('reveal', false);
    // Let the exit animation play before hiding the window.
    setTimeout(() => {
      if (visible || !win || win.isDestroyed()) return;
      win.hide();
      win.webContents.setBackgroundThrottling(true);
    }, 320);
  }, G.hideGrace);
}

function cancelHide() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
}

/** Only cross the process boundary when the pointer actually moved. */
let sentCursor = { x: -999, y: -999 };
function sendCursor(cursor) {
  if (!win || win.isDestroyed()) return;
  const b = win.getBounds();
  const p = { x: cursor.x - b.x, y: cursor.y - b.y };
  if (Math.abs(p.x - sentCursor.x) < 3 && Math.abs(p.y - sentCursor.y) < 3) return;
  sentCursor = p;
  win.webContents.send('cursor', p);
}

/**
 * Sampling the cursor is the only thing this process does continuously, so it
 * runs at two speeds: lazily while nothing is on screen, and smoothly once the
 * widget is out. Same behaviour, a third of the wake-ups.
 */
const POLL_FAR = 320;    // the pointer is nowhere near the edge
const POLL_NEAR = 45;    // approaching: sample as finely as when it is open,
                         // or a fast hand could cross the 4 px strip unseen
const POLL_LIVE = 40;    // the widget is out, the hover has to feel smooth
const NEAR_EDGE = 220;   // how close counts as approaching
let pollRate = POLL_FAR;
function setPollRate(ms) {
  if (ms === pollRate) return;
  pollRate = ms;
  clearInterval(pollTimer);
  pollTimer = setInterval(poll, pollRate);
}

function poll() {
  if (!win || win.isDestroyed()) return;
  const cursor = screen.getCursorScreenPoint();
  const all = screen.getAllDisplays();

  // Sampling the pointer is the only thing this process does all day. Three
  // speeds: barely, while the mouse is off in the middle of the screen; more
  // attentively as it approaches the edge; and smoothly once the widget is out.
  if (visible || pinned) {
    setPollRate(POLL_LIVE);
  } else {
    const display = screen.getDisplayNearestPoint(cursor);
    const edge = display.workArea.x + display.workArea.width;
    setPollRate(edge - cursor.x <= NEAR_EDGE ? POLL_NEAR : POLL_FAR);
  }

  if (pinned) {
    cancelHide();
    if (!visible) show();
    setPanel(insideKeepAlive(cursor, win.getBounds(), rows, activeDisplay().workArea));
    sendCursor(cursor);
    return;
  }

  if (!visible) {
    const display = screen.getDisplayNearestPoint(cursor);
    if (!isOuterRightEdge(display, all)) return;
    if (inHotZone(cursor, display.workArea, rows, config.verticalAnchor)) {
      if (config.followCursorDisplay && display.id !== currentDisplayId) placeOn(display);
      show();
    }
    return;
  }

  const b = win.getBounds();
  if (DEMO || insideKeepAlive(cursor, b, rows, activeDisplay().workArea)) cancelHide();
  else scheduleHide();
  sendCursor(cursor);
}

// --- Data -------------------------------------------------------------------

/** Nobody at the keyboard means the numbers can wait. */
function idleSeconds() {
  try { return powerMonitor.getSystemIdleTime(); } catch (_) { return 0; }
}

function pacing() {
  return { idleSeconds: idleSeconds(), floorSeconds };
}

/** One log line per state change, never one per minute. */
let lastLogged = null;
function logState(data) {
  const describe = (g) => `${g.model || g.kind} ${g.percent}%`;
  const state = data.ok
    ? `ok ${(data.gauges || []).map(describe).join(', ')}`
    : `failed ${data.reason} (attempt ${failures}, next try in ` +
      `${Math.round(nextDelay(data, failures, config.refreshSeconds, pacing()) / 1000)}s)`;
  if (state === lastLogged) return;
  lastLogged = state;
  console.log(`[${new Date().toISOString()}] ${state}`);
  if (!data.ok && data.detail) console.log(`  server said: ${data.detail}`);
}

/**
 * Ask once, then schedule the next call. A failure never wipes the display:
 * the last real numbers stay on screen, marked stale, because a blank widget
 * teaches less than slightly old figures plus the reason they are old.
 */
async function refresh() {
  if (inFlight) return;
  inFlight = true;
  let data;
  try {
    data = await fetchUsage();
  } finally {
    inFlight = false;
  }

  if (data.ok) {
    failures = 0;
    cleanReads += 1;
    lastGood = data;
    lastData = data;
    raiseAlerts(data.gauges);
  } else {
    cleanReads = 0;
    failures += 1;
    lastData = lastGood
      ? { ...lastGood, stale: true, reason: data.reason, checkedAt: data.fetchedAt }
      : data;
  }

  const previousFloor = floorSeconds || config.refreshSeconds;
  floorSeconds = adjustFloor(floorSeconds, data, config.refreshSeconds, cleanReads);
  if (floorSeconds !== previousFloor) {
    trace(`pace now one call every ${floorSeconds}s (was ${previousFloor}s)`);
    if (floorSeconds < previousFloor) cleanReads = 0;
  }
  store.save({
    failures,
    floorSeconds,
    alerts: alertLedger,
    ...(data.ok ? { lastGood: data } : {})
  });

  logState(data);
  if (data.ok && data.gauges.length) setRows(data.gauges.length);
  if (win && !win.isDestroyed()) win.webContents.send('usage', lastData);
  updateTrayTitle();

  clearTimeout(refreshTimer);
  const wait = nextDelay(data, failures, config.refreshSeconds, pacing());
  // Remembered so a restart cannot skip the wait we just promised.
  store.save({ nextAllowedAt: data.ok ? 0 : Date.now() + wait });
  refreshTimer = setTimeout(refresh, wait);
}

function updateTrayTitle() {
  if (!tray || tray.isDestroyed()) return;
  const session = (lastData.gauges || []).find((g) => g.id === 'session');
  const label = lastData.ok && session ? `Claude ${session.percent} %` : IDLE_LABEL;
  tray.setToolTip(label);
  if (process.platform === 'darwin' && lastData.ok && session) {
    tray.setTitle(` ${session.percent}%`);
  }
}

/**
 * Warn before the ceiling, once per level and per reset window. The ledger
 * lives on disk so a restart does not replay every alert you already saw.
 */
function raiseAlerts(gauges) {
  const thresholds = Array.isArray(config.alertAt) ? config.alertAt : [];
  if (!thresholds.length || !Notification.isSupported()) return;

  const { raise, ledger } = alerts.due(gauges, thresholds, alertLedger);
  alertLedger = ledger;

  for (const { gauge, level } of raise) {
    const name = gauge.model || (gauge.kind === 'session' ? T.session : T.allModels);
    new Notification({
      title: T.notifyTitle(level),
      body: T.notifyBody(name, gauge.percent),
      silent: level < 90
    }).show();
  }
}

// --- Status bar icon --------------------------------------------------------

// The tray menu speaks the same language as the window.
/** The language the user pinned, or the system's. */
function activeLocale() {
  return config.language && config.language !== 'auto' ? config.language : app.getLocale();
}
// Electron only knows the system locale after the ready event: called before
// that, app.getLocale() returns an empty string, which silently fell back to
// English and left the tray menu untranslated while the widget was not.
let T = I18N.pick('en');
let MENU = T.menu;

function refreshLanguage() {
  T = I18N.pick(activeLocale());
  MENU = T.menu;
}
const IDLE_LABEL = 'Claude Marge';

/** Rebuilt on every change so the checkbox always shows the real state. */
function buildMenu() {
  if (!tray || tray.isDestroyed()) return;
  const atLogin = autostart.isEnabled();
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: MENU.refresh, click: () => refresh() },
    { label: MENU.peek, click: () => { show(); setTimeout(scheduleHide, 3000); } },
    { type: 'separator' },
    {
      label: MENU.startAtLogin,
      type: 'checkbox',
      checked: atLogin === true,
      // Unknown state means no service is registered: nothing to toggle.
      enabled: atLogin !== null,
      click: (item) => { autostart.setEnabled(item.checked); buildMenu(); }
    },
    {
      label: MENU.pin,
      type: 'checkbox',
      checked: pinned,
      click: (item) => setPinned(item.checked)
    },
    { label: MENU.restartNow, click: () => autostart.restartNow() },
    { label: MENU.update, click: () => { openSettings(); checkForUpdates({ notify: true }); } },
    { type: 'separator' },
    { label: MENU.open, click: () => openSettings() },
    { label: MENU.reveal, click: () => revealConfig() },
    { type: 'separator' },
    { label: MENU.quit, click: () => { app.isQuitting = true; app.quit(); } }
  ]));
}

function createTray() {
  // macOS reads tray.png as 16 points and picks up tray@2x.png on its own.
  // Linux panels want a bigger bitmap, so they get their own file.
  const iconFile = process.platform === 'darwin' ? 'tray.png' : 'tray-linux.png';
  let image = nativeImage.createFromPath(path.join(__dirname, 'renderer', iconFile));
  if (image.isEmpty()) image = nativeImage.createEmpty();
  if (process.platform === 'darwin') image.setTemplateImage(true);
  try {
    tray = new Tray(image);
  } catch (_) {
    return; // no system tray on this session: carry on without one
  }
  buildMenu();
  updateTrayTitle();
}

/** Pinned mode: the widget stays open until you unpin it. */
function setPinned(on) {
  pinned = on;
  if (pinned) { show(); setPanel(false); } else scheduleHide();
  buildMenu();
}

function registerShortcut() {
  const accelerator = (config.shortcut || '').trim();
  if (!accelerator) return;
  try {
    globalShortcut.register(accelerator, () => setPinned(!pinned));
  } catch (_) {
    // An invalid or already taken accelerator must not stop the widget.
  }
}

// --- Updates -----------------------------------------------------------------

const APP_DIR = path.join(__dirname, '..');
const DAY_MS = 24 * 60 * 60 * 1000;
let updateTimer = null;

/**
 * The daily look. It only ever notifies, never installs: pulling code onto
 * someone's machine without them asking is not an update, it is a surprise.
 * Each version is announced once, so a widget left running for a week does not
 * repeat itself every day.
 */
async function checkForUpdates({ notify }) {
  const result = await updater.check(APP_DIR);
  if (notify && result.state === 'available') {
    const announced = store.read().announcedUpdate;
    if (announced !== result.remote.sha && Notification.isSupported()) {
      new Notification({
        title: T.updateTitle,
        body: T.updateBody(result.remote.short)
      }).show();
      store.save({ announcedUpdate: result.remote.sha });
    }
  }
  return result;
}

function scheduleUpdateCheck() {
  clearTimeout(updateTimer);
  if (config.checkUpdates === false) return;
  updateTimer = setTimeout(() => {
    checkForUpdates({ notify: true }).finally(scheduleUpdateCheck);
  }, DAY_MS);
}

// --- Settings window ---------------------------------------------------------

let settingsWin = null;

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 520,
    height: 820,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: T.settings.title,
    backgroundColor: '#0A0A0B',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  settingsWin.loadFile(path.join(__dirname, 'settings', 'index.html'));
  settingsWin.once('ready-to-show', () => settingsWin.show());
  settingsWin.on('closed', () => { settingsWin = null; });
}

/**
 * Apply a saved config without restarting: reposition, re-language, re-bind the
 * shortcut, and reschedule the next call. Restarting to see a slider move would
 * be the kind of detail that makes a tool feel cheap.
 */
function applyConfig(next) {
  const before = {
    shortcut: config.shortcut, language: config.language,
    theme: config.theme, timeFormat: config.timeFormat
  };
  config = { ...config, ...next };

  if (typeof next.startAtLogin === 'boolean') autostart.setEnabled(next.startAtLogin);

  if (before.language !== config.language) refreshLanguage();
  if (before.language !== config.language || before.theme !== config.theme ||
      before.timeFormat !== config.timeFormat) {
    sendGeometry();
  }
  if (before.shortcut !== config.shortcut) {
    globalShortcut.unregisterAll();
    registerShortcut();
  }

  placeOn(config.followCursorDisplay ? activeDisplay() : preferredDisplay());
  buildMenu();
  scheduleUpdateCheck();
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh,
    nextDelay({ ok: failures === 0 }, failures, config.refreshSeconds, pacing()));
}

// --- Lifecycle --------------------------------------------------------------

if (!app.requestSingleInstanceLock()) app.quit();

// Why did it stop? A widget that exits silently and is restarted by the system
// loses its backoff each time, which is how a rate limit becomes permanent.
// These lines cost nothing and turn a mystery into a fact.
function trace(event) {
  console.log(`[${new Date().toISOString()}] lifecycle: ${event}`);
}
app.on('before-quit', () => trace('before-quit'));
app.on('will-quit', () => trace('will-quit'));
app.on('quit', (_e, code) => trace(`quit code=${code}`));
process.on('exit', (code) => trace(`process exit code=${code}`));
process.on('uncaughtException', (err) => trace(`uncaught: ${err && err.stack}`));
process.on('unhandledRejection', (err) => trace(`unhandled rejection: ${err}`));

app.whenReady().then(() => {
  refreshLanguage();
  trace(`started pid=${process.pid} locale=${app.getLocale()} using=${activeLocale()} menu="${MENU.quit}"`);
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  createWindow();
  createTray();

  const owed = initialDelay(store.read().nextAllowedAt);
  if (owed > 0) {
    trace(`still owed ${Math.round(owed / 1000)}s of backoff from the last run`);
    refreshTimer = setTimeout(refresh, owed);
    if (lastGood) sendGeometry();
  } else {
    refresh();
  }
  pollTimer = setInterval(poll, pollRate);
  registerShortcut();
  // Waking from sleep with hours-old numbers is worse than one extra call.
  // Asleep or locked, there is nobody to read the widget and the account is
  // shared with every other machine: stop asking entirely.
  for (const event of ['suspend', 'lock-screen']) {
    powerMonitor.on(event, () => { trace(`${event}: pausing`); clearTimeout(refreshTimer); });
  }
  for (const event of ['resume', 'unlock-screen']) {
    powerMonitor.on(event, () => { trace(`${event}: resuming`); failures = 0; refresh(); });
  }
  for (const event of ['display-added', 'display-removed', 'display-metrics-changed']) {
    screen.on(event, onDisplaysChanged);
  }
  scheduleUpdateCheck();
  // One look shortly after start, once the widget has settled.
  setTimeout(() => { if (config.checkUpdates !== false) checkForUpdates({ notify: true }); }, 30000);
  if (DEMO) show(); // showcase mode: stays open, no cursor needed

});

ipcMain.on('request-refresh', () => refresh());
ipcMain.on('settings:reveal', () => revealConfig());
ipcMain.handle('settings:load', () => ({ ...config, startAtLogin: autostart.isEnabled() === true }));
ipcMain.handle('settings:save', (_e, next) => {
  const { startAtLogin, ...stored } = next || {};
  saveConfig(stored);
  applyConfig({ ...stored, startAtLogin });
  return true;
});
ipcMain.handle('settings:displays', () => {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d) => ({
    id: String(d.id),
    primary: d.id === primaryId,
    width: d.bounds.width,
    height: d.bounds.height,
    outerRight: isOuterRightEdge(d, screen.getAllDisplays())
  }));
});
ipcMain.handle('updates:check', () => checkForUpdates({ notify: false }));
ipcMain.handle('updates:apply', async () => {
  const send = (step) => {
    if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('updates:step', step);
  };
  const result = await updater.apply(APP_DIR, process.execPath, send);
  if (!result.ok) trace(`update failed: ${result.reason} ${result.detail || ''}`.trim());
  if (result.ok && result.changed) {
    trace(`updated to ${result.short}`);
    store.save({ announcedUpdate: result.sha });
    // Give the window a moment to show the result before we go down with it.
    setTimeout(() => autostart.restartNow(), 1200);
  }
  return result;
});

ipcMain.handle('settings:reset', () => {
  saveConfig(DEFAULTS);
  applyConfig(DEFAULTS);
  return { ...DEFAULTS, startAtLogin: autostart.isEnabled() === true };
});

// Control capture: render the window off screen and quit. Used to check the
// real rendering on a machine with no compositor, or in CI.
if (process.env.MARGE_CAPTURE) {
  app.whenReady().then(() => {
    setTimeout(async () => {
      try {
        // MARGE_CAPTURE_SETTINGS shoots the settings window instead.
        let target = win;
        if (process.env.MARGE_CAPTURE_SETTINGS) {
          openSettings();
          await new Promise((r) => setTimeout(r, 2500));
          target = settingsWin;
        }
        const image = await target.webContents.capturePage();
        fs.writeFileSync(process.env.MARGE_CAPTURE, image.toPNG());
        console.log('capture written:', process.env.MARGE_CAPTURE,
          image.getSize().width + 'x' + image.getSize().height);
      } catch (err) {
        console.error('capture failed:', err.message);
      }
      app.exit(0);
    }, 4000);
  });
}

// The widget has no main window to close: it never quits on its own.
app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  clearInterval(pollTimer);
  clearTimeout(refreshTimer);
  clearTimeout(updateTimer);
  globalShortcut.unregisterAll();
});
