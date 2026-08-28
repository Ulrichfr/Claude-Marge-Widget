'use strict';
/* Settings window. Reads the config, edits a copy, writes it back on save.
   Nothing is applied behind the user's back except Start at login, which is a
   system registration rather than a value in the file. */

const INTERVALS = [1, 2, 5, 10];          // minutes
const THRESHOLDS = [50, 70, 80, 90, 95];  // offered marks

const ASTERISK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.7" stroke-linecap="round">
  <path d="M12 3.2v17.6M3.2 12h17.6M5.8 5.8l12.4 12.4M18.2 5.8L5.8 18.2"/></svg>`;

let T;
let draft = {};
let recording = false;

const $ = (id) => document.getElementById(id);
const text = (id, value) => { $(id).textContent = value; };

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

function paint() {
  $('vertical').value = Math.round((draft.verticalAnchor ?? 0.45) * 100);
  paintSwitch('follow', draft.followCursorDisplay !== false);

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
  text('lblUpdates', s.updates);
  text('lblInstalled', s.installed);
  text('lblAutoCheck', s.autoCheck);
  text('checkNow', s.checkNow);
  text('updateNow', s.updateNow);
  text('save', s.save);
  text('savedFlag', s.saved);
  text('reset', s.reset);
  text('reveal', s.revealShort);
  text('lblFile', s.file);
}

function buildControls() {
  $('interval').innerHTML = '';
  for (const m of INTERVALS) {
    const b = document.createElement('button');
    b.dataset.value = m;
    b.textContent = `${m} ${T.settings.minutes}`;
    b.onclick = () => { draft.refreshSeconds = m * 60; paint(); };
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
      paint();
    };
    $('thresholds').appendChild(b);
  }

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
    paint();
  };
}

// --- Wiring -------------------------------------------------------------------

$('vertical').oninput = (e) => { draft.verticalAnchor = Number(e.target.value) / 100; };
$('follow').onclick = () => {
  draft.followCursorDisplay = !(draft.followCursorDisplay !== false);
  paint();
};
$('alertsOn').onclick = () => {
  const on = Array.isArray(draft.alertAt) && draft.alertAt.length > 0;
  draft.alertAt = on ? [] : [80, 95];
  paint();
};
$('startAtLogin').onclick = () => { draft.startAtLogin = !draft.startAtLogin; paint(); };
$('autoCheck').onclick = () => { draft.checkUpdates = !(draft.checkUpdates !== false); paint(); };

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
    return paintShortcut();
  }
  if (e.key === 'Escape') { recording = false; return paintShortcut(); }
  const accelerator = toAccelerator(e);
  if (!accelerator) return;             // modifiers alone: keep waiting
  draft.shortcut = accelerator;
  recording = false;
  paintShortcut();
});

$('save').onclick = async () => {
  await window.settings.save(draft);
  const flag = $('savedFlag');
  flag.classList.add('on');
  setTimeout(() => flag.classList.remove('on'), 1600);
};
$('reset').onclick = async () => { draft = await window.settings.reset(); paint(); };
$('reveal').onclick = () => window.settings.reveal();

window.settings.load().then((cfg) => {
  draft = { ...cfg };
  T = I18N.pick(draft.language && draft.language !== 'auto' ? draft.language : navigator.language);
  labels();
  buildControls();
  paint();
  checkUpdate();     // the version you have is the first thing worth knowing
});
