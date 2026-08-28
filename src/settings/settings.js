'use strict';
/* Settings window. Reads the config, edits a copy, writes it back on save.
   Nothing is applied behind the user's back except Start at login, which is a
   system registration rather than a value in the file. */

const INTERVALS = [1, 2, 5, 10];          // minutes
const TIME_FORMATS = ['auto', '24', '12'];
const THRESHOLDS = [50, 70, 80, 90, 95];  // offered marks

const ASTERISK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.7" stroke-linecap="round">
  <path d="M12 3.2v17.6M3.2 12h17.6M5.8 5.8l12.4 12.4M18.2 5.8L5.8 18.2"/></svg>`;

let T;
let draft = {};
let recording = false;
let displays = [];

const $ = (id) => document.getElementById(id);
const text = (id, value) => { $(id).textContent = value; };

/**
 * Every control writes through the moment it is touched.
 *
 * The previous design previewed a theme in this window and only pushed it to
 * the widget on Save, which made picking a theme look like it did nothing.
 * A settings window that has to be confirmed is a settings window that lies
 * about what you are looking at.
 */
let commitTimer = null;
let flagTimer = null;

function commit(delay = 0) {
  clearTimeout(commitTimer);
  commitTimer = setTimeout(async () => {
    await window.settings.save(draft);
    const flag = $('savedFlag');
    flag.classList.add('on');
    clearTimeout(flagTimer);
    flagTimer = setTimeout(() => flag.classList.remove('on'), 1400);
  }, delay);
}

/** Repaint this window, then push the change everywhere else. */
function change(delay = 0) {
  paint();
  commit(delay);
}

// --- Shortcut capture ---------------------------------------------------------

const NAMED = {
  ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Escape: 'Esc', Enter: 'Return', Tab: 'Tab'
};

/** Turn a keydown into an Electron accelerator, or null if it is not one yet. */
function toAccelerator(e) {
  const parts = [];
  if (e.metaKey) parts.push('Command');
  if (e.ctrlKey) parts.push('Control');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  const key = NAMED[e.key] ||
    (e.key.length === 1 ? e.key.toUpperCase() : (/^F\d{1,2}$/.test(e.key) ? e.key : null));
  if (!key) return null;
  // A bare letter would fire while typing anywhere: demand a modifier.
  if (!parts.length && !/^F\d{1,2}$/.test(key)) return null;
  parts.push(key);
  return parts.join('+');
}

function prettyAccelerator(acc) {
  if (!acc) return '';
  const mac = navigator.platform.toLowerCase().includes('mac');
  return acc
    .replace('CommandOrControl', mac ? 'Command' : 'Control')
    .replace('Command', mac ? '⌘' : 'Win')
    .replace('Control', mac ? '⌃' : 'Ctrl')
    .replace('Alt', mac ? '⌥' : 'Alt')
    .replace('Shift', mac ? '⇧' : 'Shift')
    .split('+').join(mac ? ' ' : ' + ');
}

function paintShortcut() {
  const el = $('shortcut');
  el.classList.toggle('recording', recording);
  el.classList.toggle('empty', !recording && !draft.shortcut);
  el.textContent = recording
    ? T.settings.recording
    : (prettyAccelerator(draft.shortcut) || T.settings.shortcutEmpty);
}

// --- Painting -----------------------------------------------------------------

function paintSwitch(id, on) { $(id).setAttribute('aria-checked', on ? 'true' : 'false'); }

/** The settings window wears the theme too, so the choice is its own preview. */
function applyTheme() {
  const id = draft.theme || THEMES.DEFAULT;
  const root = document.documentElement;
  for (const [name, value] of Object.entries(THEMES.uiVars(id))) {
    root.style.setProperty(name, value);
  }
  root.dataset.light = THEMES.get(id).dark ? 'false' : 'true';
}

function paint() {
  applyTheme();
  [...$('themes').children].forEach((b) =>
    b.setAttribute('aria-pressed', b.dataset.value === (draft.theme || THEMES.DEFAULT)));
  [...$('timeFormat').children].forEach((b) =>
    b.setAttribute('aria-pressed', b.dataset.value === (draft.timeFormat || 'auto')));
  $('vertical').value = Math.round((draft.verticalAnchor ?? 0.45) * 100);
  const follows = draft.followCursorDisplay !== false;
  paintSwitch('follow', follows);
  // Choosing a screen only means something when the widget is not chasing the
  // mouse, and only when there is more than one screen to choose from.
  $('displayRow').hidden = follows || displays.length < 2;
  $('displayId').value = draft.displayId || 'primary';

  const minutes = Math.round((draft.refreshSeconds || 120) / 60);
  [...$('interval').children].forEach((b) =>
    b.setAttribute('aria-pressed', Number(b.dataset.value) === minutes ? 'true' : 'false'));

  const on = Array.isArray(draft.alertAt) && draft.alertAt.length > 0;
  paintSwitch('alertsOn', on);
  $('thresholdRow').classList.toggle('off', !on);
  [...$('thresholds').children].forEach((b) =>
    b.setAttribute('aria-pressed',
      (draft.alertAt || []).includes(Number(b.dataset.value)) ? 'true' : 'false'));

  paintSwitch('startAtLogin', draft.startAtLogin === true);
  paintSwitch('autoCheck', draft.checkUpdates !== false);
  $('language').value = draft.language || 'auto';
  paintShortcut();
}

function labels() {
  const s = T.settings;
  $('mark').innerHTML = ASTERISK;
  document.title = `${s.title} · ${s.subtitle}`;
  text('title', s.title);
  text('subtitle', s.subtitle);
  text('lblPlacement', s.placement);
  text('lblVertical', s.vertical);
  text('hintVertical', s.verticalHint);
  text('lblTop', s.top);
  text('lblBottom', s.bottom);
  text('lblFollow', s.follow);
  text('hintFollow', s.followHint);
  text('lblDisplay', s.display);
  text('hintDisplay', s.displayHint);
  text('lblData', s.data);
  text('lblInterval', s.interval);
  text('hintInterval', s.intervalHint);
  text('lblAlerts', s.alerts);
  text('lblAlertsOn', s.alertsOn);
  text('hintAlerts', s.alertsHint);
  text('lblThresholds', s.thresholds);
  text('lblSystem', s.system);
  text('lblLogin', s.startAtLogin);
  text('lblShortcut', s.shortcut);
  text('hintShortcut', s.shortcutHint);
  text('lblLanguage', s.language);
  text('lblAppearance', s.appearance);
  text('lblTheme', s.theme);
  text('lblTimeFormat', s.timeFormat);
  text('lblUpdates', s.updates);
  text('lblInstalled', s.installed);
  text('lblAutoCheck', s.autoCheck);
  text('checkNow', s.checkNow);
  text('updateNow', s.updateNow);
  text('save', s.close);
  text('savedFlag', s.saved);
  text('reset', s.reset);
  text('reveal', s.revealShort);
  text('lblFile', s.file);
}

function buildControls() {
  $('themes').innerHTML = '';
  for (const id of THEMES.ids) {
    const t = THEMES.get(id);
    // A translucent theme shown over a flat square shows nothing at all, so its
    // preview gets something worth seeing through.
    const translucent = !t.panel.startsWith('#');
    const behind = translucent
      ? 'linear-gradient(135deg, #ff5f6d 0%, #ffc371 28%, #24c6dc 62%, #514a9d 100%)'
      : t.ui.bg;
    const b = document.createElement('button');
    b.className = 'swatch';
    b.dataset.value = id;
    b.title = t.name;
    b.innerHTML = `
      <span class="preview" style="background:${behind}">
        <span class="sheetlet" style="background:${t.panel}"></span>
        <span class="tones">
          <i style="background:${t.ok}"></i><i style="background:${t.warm}"></i>
          <i style="background:${t.hot}"></i><i style="background:${t.crit}"></i>
        </span>
        <span class="pilllet" style="background:${t.pill}"></span>
      </span>
      <span class="name">${t.name}</span>`;
    b.onclick = () => { draft.theme = id; change(); };
    $('themes').appendChild(b);
  }

  $('timeFormat').innerHTML = '';
  for (const value of TIME_FORMATS) {
    const b = document.createElement('button');
    b.dataset.value = value;
    b.textContent = value === 'auto' ? T.settings.auto
      : value === '24' ? T.settings.hour24 : T.settings.hour12;
    b.onclick = () => { draft.timeFormat = value; change(); };
    $('timeFormat').appendChild(b);
  }

  $('interval').innerHTML = '';
  for (const m of INTERVALS) {
    const b = document.createElement('button');
    b.dataset.value = m;
    b.textContent = `${m} ${T.settings.minutes}`;
    b.onclick = () => { draft.refreshSeconds = m * 60; change(); };
    $('interval').appendChild(b);
  }

  $('thresholds').innerHTML = '';
  for (const level of THRESHOLDS) {
    const b = document.createElement('button');
    b.dataset.value = level;
    b.textContent = `${level}%`;
    b.onclick = () => {
      const set = new Set(draft.alertAt || []);
      if (set.has(level)) set.delete(level); else set.add(level);
      draft.alertAt = [...set].sort((x, y) => x - y);
      change();
    };
    $('thresholds').appendChild(b);
  }

  const screens = $('displayId');
  screens.innerHTML = '';
  const primary = document.createElement('option');
  primary.value = 'primary';
  primary.textContent = T.settings.primaryDisplay;
  screens.appendChild(primary);
  displays.forEach((d, index) => {
    if (d.primary) return;
    const o = document.createElement('option');
    o.value = d.id;
    o.textContent = `${T.settings.screen} ${index + 1} · ${d.width}×${d.height}`;
    screens.appendChild(o);
  });
  screens.onchange = () => { draft.displayId = screens.value; change(); };

  const select = $('language');
  select.innerHTML = '';
  const auto = document.createElement('option');
  auto.value = 'auto';
  auto.textContent = T.settings.auto;
  select.appendChild(auto);
  for (const code of I18N.languages) {
    const o = document.createElement('option');
    o.value = code;
    o.textContent = new Intl.DisplayNames([code], { type: 'language' }).of(code);
    select.appendChild(o);
  }
  select.onchange = () => {
    draft.language = select.value;
    T = I18N.pick(draft.language === 'auto' ? navigator.language : draft.language);
    labels();
    buildControls();
    change();
  };
}

// --- Wiring -------------------------------------------------------------------

// Dragging fires continuously: repaint at once, write through once it settles.
$('vertical').oninput = (e) => {
  draft.verticalAnchor = Number(e.target.value) / 100;
  commit(280);
};
$('follow').onclick = () => {
  draft.followCursorDisplay = !(draft.followCursorDisplay !== false);
  change();
};
$('alertsOn').onclick = () => {
  const on = Array.isArray(draft.alertAt) && draft.alertAt.length > 0;
  draft.alertAt = on ? [] : [80, 95];
  change();
};
$('startAtLogin').onclick = () => { draft.startAtLogin = !draft.startAtLogin; change(); };
$('autoCheck').onclick = () => { draft.checkUpdates = !(draft.checkUpdates !== false); change(); };

// --- Updates ------------------------------------------------------------------

function note(html, tone) {
  const el = $('updateNote');
  el.className = 'update-note' + (tone ? ' ' + tone : '');
  el.innerHTML = html;
  $('updateRow').hidden = false;
}

async function checkUpdate() {
  const s = T.settings;
  $('checkNow').textContent = s.checking;
  $('checkNow').disabled = true;
  const result = await window.settings.checkUpdate();
  $('checkNow').textContent = s.checkNow;
  $('checkNow').disabled = false;

  $('installedSha').textContent = result.localShort ? result.localShort : '';
  $('updateNow').hidden = true;

  if (result.state === 'available') {
    note(`<b>${s.updateAvailable}</b><br><code>${result.remote.short}</code> ${escapeHtml(result.remote.message)}`);
    $('updateNow').hidden = false;
  } else if (result.state === 'up-to-date') {
    note(s.upToDate, 'good');
  } else if (result.state === 'not-a-checkout') {
    note(s.notCheckout, 'bad');
  } else {
    note(s.updateFailed, 'bad');
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

$('checkNow').onclick = checkUpdate;

$('updateNow').onclick = async () => {
  const s = T.settings;
  $('updateNow').disabled = true;
  note(s.updating);
  const result = await window.settings.applyUpdate();
  if (result.ok && result.changed) {
    note(s.updateOk, 'good');           // the widget restarts itself from here
  } else if (result.ok) {
    note(s.upToDate, 'good');
    $('updateNow').hidden = true;
    $('updateNow').disabled = false;
  } else {
    const why = result.reason === 'dirty' ? s.updateDirty
      : result.reason === 'not-a-checkout' ? s.notCheckout
      : s.updateFailed;
    note(why, 'bad');
    $('updateNow').disabled = false;
  }
};

window.settings.onUpdateStep((step) => {
  const s = T.settings;
  note(step === 'rolling-back' ? s.updateFailed : s.updating,
    step === 'rolling-back' ? 'bad' : null);
});

$('shortcut').onclick = () => { recording = !recording; paintShortcut(); };
window.addEventListener('keydown', (e) => {
  if (!recording) return;
  e.preventDefault();
  if (e.key === 'Backspace' || e.key === 'Delete') {
    draft.shortcut = '';
    recording = false;
    paintShortcut();
    return commit();
  }
  if (e.key === 'Escape') { recording = false; return paintShortcut(); }
  const accelerator = toAccelerator(e);
  if (!accelerator) return;             // modifiers alone: keep waiting
  draft.shortcut = accelerator;
  recording = false;
  paintShortcut();
  commit();
});

$('save').onclick = () => window.close();
$('reset').onclick = async () => { draft = await window.settings.reset(); paint(); };
$('reveal').onclick = () => window.settings.reveal();

Promise.all([window.settings.load(), window.settings.displays()]).then(([cfg, screens]) => {
  draft = { ...cfg };
  displays = screens || [];
  T = I18N.pick(draft.language && draft.language !== 'auto' ? draft.language : navigator.language);
  labels();
  buildControls();
  paint();
  checkUpdate();     // the version you have is the first thing worth knowing
});
