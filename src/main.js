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

const { app, BrowserWindow, screen, Tray, Menu, nativeImage, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { fetchUsage } = require('./usage');
const I18N = require('./i18n');
const {
  G, layout, boundsForDisplay: computeBounds,
  isOuterRightEdge, inHotZone, insideKeepAlive
} = require('./geometry');

// The number of rings depends on the account: every model carries its own
// quota. The whole layout follows from it, and the window resizes if the API
// returns one more.
let rows = 3;
const DEMO = process.env.MARGE_DEMO === '1' || process.argv.includes('--demo');

const CONFIG_PATH = path.join(os.homedir(), '.config', 'claude-marge', 'config.json');
const DEFAULTS = {
  verticalAnchor: 0.45,   // 0 = top of the screen, 1 = bottom
  refreshSeconds: 60,
  followCursorDisplay: true  // show up on whichever display holds the cursor
};

function loadConfig() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
  } catch (_) {
    return { ...DEFAULTS };
  }
}
let config = loadConfig();

let win = null;
let tray = null;
let visible = false;
let hideTimer = null;
let pollTimer = null;
let refreshTimer = null;
let lastData = { ok: false, reason: 'loading', gauges: [] };
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

function placeOn(display) {
  if (!win) return;
  currentDisplayId = display.id;
  win.setBounds(boundsForDisplay(display));
}

// --- Window -----------------------------------------------------------------

function createWindow() {
  const display = screen.getPrimaryDisplay();
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
      backgroundThrottling: false
    }
  });
  currentDisplayId = display.id;

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true); // never steal a click, never take focus

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.on('did-finish-load', () => {
    ready = true;
    sendGeometry();
    win.webContents.send('usage', lastData);
    // A hover can happen before loading finishes: replay the current state,
    // otherwise the pill stays invisible until the next hover.
    if (visible) win.webContents.send('reveal', true);
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

function show() {
  if (!win || visible) return;
  visible = true;
  clearTimeout(hideTimer);
  win.showInactive();
  if (ready) win.webContents.send('reveal', true);
  if (Date.now() - (lastData.fetchedAt || 0) > 20000) refresh();
}

function scheduleHide() {
  if (!visible || hideTimer) return;
  hideTimer = setTimeout(() => {
    hideTimer = null;
    if (!visible || !win) return;
    visible = false;
    if (ready) win.webContents.send('reveal', false);
    // Let the exit animation play before hiding the window.
    setTimeout(() => { if (!visible && win) win.hide(); }, 320);
  }, G.hideGrace);
}

function cancelHide() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
}

function poll() {
  if (!win) return;
  const cursor = screen.getCursorScreenPoint();
  const all = screen.getAllDisplays();

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
  win.webContents.send('cursor', { x: cursor.x - b.x, y: cursor.y - b.y });
}

// --- Data -------------------------------------------------------------------

/** One log line per state change, never one per minute. */
let lastLogged = null;
function logState(data) {
  const describe = (g) => `${g.model || g.kind} ${g.percent}%`;
  const state = data.ok
    ? `ok ${(data.gauges || []).map(describe).join(', ')}`
    : `failed ${data.reason}`;
  if (state === lastLogged) return;
  lastLogged = state;
  console.log(`[${new Date().toISOString()}] ${state}`);
}

async function refresh() {
  const data = await fetchUsage();
  lastData = data;
  logState(data);
  if (data.ok && data.gauges.length) setRows(data.gauges.length);
  if (win && !win.isDestroyed()) win.webContents.send('usage', data);
  updateTrayTitle();
}

function updateTrayTitle() {
  if (!tray) return;
  const session = (lastData.gauges || []).find((g) => g.id === 'session');
  const label = lastData.ok && session ? `Claude ${session.percent} %` : IDLE_LABEL;
  tray.setToolTip(label);
  if (process.platform === 'darwin' && lastData.ok && session) {
    tray.setTitle(` ${session.percent}%`);
  }
}

// --- Status bar icon --------------------------------------------------------

// The tray menu speaks the same language as the window.
const MENU = I18N.pick(app.getLocale()).menu;
const IDLE_LABEL = 'Claude Marge';

function createTray() {
  const iconPath = path.join(__dirname, 'renderer', 'tray.png');
  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) image = nativeImage.createEmpty();
  if (process.platform === 'darwin') image.setTemplateImage(true);
  try {
    tray = new Tray(image);
  } catch (_) {
    return; // no system tray on this session: carry on without one
  }
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: MENU.refresh, click: () => refresh() },
    { label: MENU.peek, click: () => { show(); setTimeout(scheduleHide, 3000); } },
    { type: 'separator' },
    { label: MENU.open, click: () => shell.showItemInFolder(CONFIG_PATH) },
    { label: MENU.reload, click: () => { config = loadConfig(); placeOn(activeDisplay()); } },
    { type: 'separator' },
    { label: MENU.quit, click: () => { app.isQuitting = true; app.quit(); } }
  ]));
  updateTrayTitle();
}

// --- Lifecycle --------------------------------------------------------------

if (!app.requestSingleInstanceLock()) app.quit();

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  createWindow();
  createTray();
  refresh();
  pollTimer = setInterval(poll, 45);
  if (DEMO) show(); // showcase mode: stays open, no cursor needed
  refreshTimer = setInterval(refresh, Math.max(20, config.refreshSeconds) * 1000);
});

ipcMain.on('request-refresh', () => refresh());

// Control capture: render the window off screen and quit. Used to check the
// real rendering on a machine with no compositor, or in CI.
if (process.env.MARGE_CAPTURE) {
  app.whenReady().then(() => {
    setTimeout(async () => {
      try {
        const image = await win.webContents.capturePage();
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
  clearInterval(refreshTimer);
});
