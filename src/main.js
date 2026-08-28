'use strict';
/**
 * Fenetre-widget collee au bord droit de l'ecran.
 *
 * Principe : la fenetre est TOUJOURS transparente aux clics
 * (setIgnoreMouseEvents). Elle ne vole jamais le focus ni un clic. Le survol
 * est deduit d'un echantillonnage de la position du curseur cote processus
 * principal, puis envoye au rendu qui fait lui-meme son hit-test. C'est la
 * seule methode qui se comporte pareil sur macOS et sur X11.
 */

const { app, BrowserWindow, screen, Tray, Menu, nativeImage, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { fetchUsage } = require('./usage');
const {
  G, layout, boundsForDisplay: computeBounds,
  isOuterRightEdge, inHotZone, insideKeepAlive
} = require('./geometry');

// Le nombre d'anneaux depend du compte : chaque modele a son propre quota.
// Toute la geometrie en decoule, et la fenetre se redimensionne si l'API en
// renvoie un de plus.
let rows = 3;
const DEMO = process.env.CLAUDE_USAGE_DEMO === '1' || process.argv.includes('--demo');

const CONFIG_PATH = path.join(os.homedir(), '.config', 'claude-usage', 'config.json');
const DEFAULTS = {
  verticalAnchor: 0.45,   // 0 = haut de l'ecran, 1 = bas
  refreshSeconds: 60,
  followCursorDisplay: true
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
let ready = false; // la page a fini de charger et ecoute les messages
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

// --- Fenetre ----------------------------------------------------------------

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
  win.setIgnoreMouseEvents(true); // jamais de clic vole, jamais de focus pris

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.on('did-finish-load', () => {
    ready = true;
    sendGeometry();
    win.webContents.send('usage', lastData);
    // Un survol peut arriver avant la fin du chargement : on rejoue l'etat
    // courant, sinon la pilule reste invisible jusqu'au survol suivant.
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

/** Reajuste la hauteur quand le nombre de quotas exposes par le compte change. */
function setRows(n) {
  const next = Math.max(1, n);
  if (next === rows) return;
  rows = next;
  if (win && !win.isDestroyed()) win.setBounds(boundsForDisplay(activeDisplay()));
  sendGeometry();
}

// --- Apparition / disparition ----------------------------------------------

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
    // On laisse l'animation de sortie se jouer avant de masquer la fenetre.
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

// --- Donnees ----------------------------------------------------------------

async function refresh() {
  const data = await fetchUsage();
  lastData = data;
  if (data.ok && data.gauges.length) setRows(data.gauges.length);
  if (win && !win.isDestroyed()) win.webContents.send('usage', data);
  updateTrayTitle();
}

function updateTrayTitle() {
  if (!tray) return;
  const session = (lastData.gauges || []).find((g) => g.id === 'session');
  const label = lastData.ok && session ? `Claude ${session.percent} %` : 'Claude Usage';
  tray.setToolTip(label);
  if (process.platform === 'darwin' && lastData.ok && session) {
    tray.setTitle(` ${session.percent}%`);
  }
}

// --- Icone de barre d'etat --------------------------------------------------

function createTray() {
  const iconPath = path.join(__dirname, 'renderer', 'tray.png');
  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) image = nativeImage.createEmpty();
  if (process.platform === 'darwin') image.setTemplateImage(true);
  try {
    tray = new Tray(image);
  } catch (_) {
    return; // pas d'indicateur systeme sur cette session : on continue sans
  }
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Rafraichir maintenant', click: () => refresh() },
    { label: 'Afficher 3 secondes', click: () => { show(); setTimeout(scheduleHide, 3000); } },
    { type: 'separator' },
    { label: 'Ouvrir la configuration', click: () => shell.showItemInFolder(CONFIG_PATH) },
    { label: 'Recharger la configuration', click: () => { config = loadConfig(); placeOn(activeDisplay()); } },
    { type: 'separator' },
    { label: 'Quitter', click: () => { app.isQuitting = true; app.quit(); } }
  ]));
  updateTrayTitle();
}

// --- Cycle de vie -----------------------------------------------------------

if (!app.requestSingleInstanceLock()) app.quit();

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  createWindow();
  createTray();
  refresh();
  pollTimer = setInterval(poll, 45);
  if (DEMO) show(); // mode vitrine : le widget reste ouvert, sans le curseur
  refreshTimer = setInterval(refresh, Math.max(20, config.refreshSeconds) * 1000);
});

ipcMain.on('request-refresh', () => refresh());

// Capture de controle : rend la fenetre hors ecran et quitte. Sert a verifier
// le rendu reel sur une machine sans compositeur, ou en integration continue.
if (process.env.CLAUDE_USAGE_CAPTURE) {
  app.whenReady().then(() => {
    setTimeout(async () => {
      try {
        const image = await win.webContents.capturePage();
        fs.writeFileSync(process.env.CLAUDE_USAGE_CAPTURE, image.toPNG());
        console.log('capture ecrite:', process.env.CLAUDE_USAGE_CAPTURE,
          image.getSize().width + 'x' + image.getSize().height);
      } catch (err) {
        console.error('capture impossible:', err.message);
      }
      app.exit(0);
    }, 4000);
  });
}

// Le widget n'a pas de fenetre principale a fermer : on ne quitte jamais tout seul.
app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  clearInterval(pollTimer);
  clearInterval(refreshTimer);
});
