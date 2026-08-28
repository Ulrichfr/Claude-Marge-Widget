'use strict';
/* Rendu du widget. Le processus principal n'envoie que trois choses :
   la geometrie, les donnees, et la position du curseur. Tout le reste, y
   compris le hit-test du survol, se decide ici. */

const stage = document.getElementById('stage');
const pill = document.getElementById('pill');
const panel = document.getElementById('panel');
const panelRows = document.getElementById('panelRows');
const panelMark = document.getElementById('panelMark');
const panelNote = document.getElementById('panelNote');
const panelTail = document.getElementById('panelTail');

const ICONS = {
  claude: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
    <path d="M12 3.2v17.6M3.2 12h17.6M5.8 5.8l12.4 12.4M18.2 5.8L5.8 18.2"/>
    <path d="M12 4.9 12 19.1M4.9 12h14.2" opacity="0"/>
  </svg>`,
  week: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
      stroke-linecap="round" stroke-linejoin="round">
    <rect x="3.5" y="5.2" width="17" height="15" rx="3.2"/>
    <path d="M3.5 10.1h17"/>
    <path d="M8.3 3.6v3.2M15.7 3.6v3.2"/>
    <circle cx="8.6" cy="14.4" r="1.15" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="14.4" r="1.15" fill="currentColor" stroke="none"/>
    <circle cx="15.4" cy="14.4" r="1.15" fill="currentColor" stroke="none"/>
  </svg>`
};

let geo = { pillWidth: 92, ring: 60, ringLabel: 22, ringToLabel: 10, rowGap: 26, pillPadding: 22 };
let data = { ok: false, reason: 'loading', gauges: [] };
let revealed = false;
let items = [];        // { el, ring, pct, valueArc, gauge, shown }
let hotIndex = 0;
let tickTimer = null;

// --- Petits utilitaires ------------------------------------------------------

function tone(percent) {
  if (percent >= 90) return 'var(--crit)';
  if (percent >= 70) return 'var(--hot)';
  if (percent >= 35) return 'var(--warm)';
  return 'var(--ok)';
}

function formatReset(iso, style) {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const mins = Math.round((at.getTime() - Date.now()) / 60000);
  if (mins <= 0) return 'Reset imminent';
  if (style === 'relative' || mins < 90) {
    if (mins < 60) return `Reset dans ${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `Reset dans ${h} h ${String(m).padStart(2, '0')}` : `Reset dans ${h} h`;
  }
  const sameDay = at.toDateString() === new Date().toDateString();
  const day = sameDay ? "aujourd'hui" : at.toLocaleDateString('fr-FR', { weekday: 'short' });
  const time = at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `Reset ${day} ${time}`;
}

function rowLabel(g) {
  if (g.kind === 'model') return `${g.model}, cette semaine`;
  if (g.kind === 'session') return 'Session en cours';
  return 'Tous modèles';
}

/** Compteur anime, pour que le chiffre arrive en meme temps que l'arc. */
function countTo(el, from, to, duration) {
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = `${Math.round(from + (to - from) * eased)}%`;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// --- Construction ------------------------------------------------------------

function applyGeometry() {
  document.documentElement.style.setProperty('--pill-w', `${geo.pillWidth}px`);
  document.documentElement.style.setProperty('--ring', `${geo.ring}px`);
  document.documentElement.style.setProperty('--row-gap', `${geo.rowGap}px`);
  document.documentElement.style.setProperty('--pill-pad', `${geo.pillPadding}px`);
  document.documentElement.style.setProperty('--ring-gap', `${geo.ringToLabel}px`);
  document.documentElement.style.setProperty('--label-h', `${geo.ringLabel}px`);
}

function buildRing(g, index) {
  const r = (geo.ring - 5) / 2;
  const c = 2 * Math.PI * r;
  const el = document.createElement('div');
  el.className = 'item';
  el.style.setProperty('--enter-delay', `${90 + index * 70}ms`);
  el.style.setProperty('--tone', tone(g.percent));
  el.innerHTML = `
    <div class="ring">
      <svg viewBox="0 0 ${geo.ring} ${geo.ring}">
        <circle class="track" cx="${geo.ring / 2}" cy="${geo.ring / 2}" r="${r}"
          fill="none" stroke-width="4"/>
        <circle class="value" cx="${geo.ring / 2}" cy="${geo.ring / 2}" r="${r}"
          fill="none" stroke-width="4"
          stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${c.toFixed(2)}"/>
      </svg>
      <div class="ring-face">${
        g.kind === 'model'
          ? `<span class="mono">${g.monogram || '?'}</span>`
          : `<span class="glyph">${ICONS[g.icon] || ICONS.claude}</span>`
      }</div>
    </div>
    <div class="pct">0%</div>`;
  return { el, circumference: c, gauge: g };
}

function buildPanelRow(g) {
  const row = document.createElement('div');
  row.className = 'row';
  row.style.setProperty('--tone', tone(g.percent));
  row.innerHTML = `
    <div class="row-head">
      <span class="row-name"></span>
      ${g.active ? '<span class="row-badge">limite active</span>' : ''}
      <span class="row-reset"></span>
    </div>
    <div class="bar"><span></span></div>
    <div class="row-foot">${g.percent}% utilisés</div>`;
  row.querySelector('.row-name').textContent = rowLabel(g);
  row.querySelector('.row-reset').textContent = formatReset(g.resetsAt, g.resetStyle);
  return row;
}

function render() {
  panelMark.innerHTML = ICONS.claude;
  pill.innerHTML = '';
  panelRows.innerHTML = '';
  items = [];

  if (!data.ok) {
    const messages = {
      loading: 'Lecture de la consommation en cours.',
      'no-credentials': 'Aucune session Claude trouvée sur cette machine. Lance <b>claude</b> une fois pour te connecter.',
      'token-expired': 'Le jeton Claude a expiré. Ouvre Claude Code une fois, il le renouvelle tout seul.',
      unauthorized: "Le compte a refusé la lecture de la consommation.",
      network: 'Connexion à api.anthropic.com impossible.'
    };
    panelRows.innerHTML = `<div class="panel-error">${messages[data.reason] || 'État inconnu.'}</div>`;
    const dot = document.createElement('div');
    dot.className = 'item';
    dot.style.setProperty('--enter-delay', '90ms');
    dot.style.setProperty('--tone', 'rgba(255,255,255,0.28)');
    dot.innerHTML = `<div class="ring">
        <svg viewBox="0 0 ${geo.ring} ${geo.ring}">
          <circle class="track" cx="${geo.ring / 2}" cy="${geo.ring / 2}" r="${(geo.ring - 5) / 2}"
            fill="none" stroke-width="4"/>
        </svg>
        <div class="ring-face"><span class="mono">?</span></div>
      </div><div class="pct">--</div>`;
    pill.appendChild(dot);
    panelNote.textContent = '';
    return;
  }

  data.gauges.forEach((g, i) => {
    const built = buildRing(g, i);
    pill.appendChild(built.el);
    items.push({
      ...built,
      pctEl: built.el.querySelector('.pct'),
      valueArc: built.el.querySelector('.value')
    });
    panelRows.appendChild(buildPanelRow(g));
  });

  panelNote.textContent = new Date(data.fetchedAt)
    .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  if (revealed) animateIn();
}

/** Remplit les arcs et les barres. Rejoue a chaque apparition. */
function animateIn() {
  items.forEach((it, i) => {
    const target = it.circumference * (1 - it.gauge.percent / 100);
    it.valueArc.style.transitionDelay = `${180 + i * 90}ms`;
    it.valueArc.style.strokeDashoffset = target.toFixed(2);
    setTimeout(() => countTo(it.pctEl, 0, it.gauge.percent, 780), 180 + i * 90);
  });
  panelRows.querySelectorAll('.bar span').forEach((bar, i) => {
    const g = data.gauges[i];
    if (!g) return;
    bar.style.transitionDelay = `${220 + i * 90}ms`;
    bar.style.width = `${Math.max(g.percent, 1.5)}%`;
  });
}

function resetAnimation() {
  items.forEach((it) => {
    it.valueArc.style.transitionDelay = '0ms';
    it.valueArc.style.strokeDashoffset = it.circumference.toFixed(2);
    it.pctEl.textContent = '0%';
  });
  panelRows.querySelectorAll('.bar span').forEach((bar) => {
    bar.style.transitionDelay = '0ms';
    bar.style.width = '0';
  });
}

// --- Survol ------------------------------------------------------------------

function placeTail(index) {
  const it = items[index];
  if (!it) return;
  const box = it.el.querySelector('.ring').getBoundingClientRect();
  const panelBox = panel.getBoundingClientRect();
  const y = box.top + box.height / 2 - panelBox.top - 13;
  panelTail.style.top = `${Math.max(16, Math.min(panelBox.height - 42, y))}px`;
}

function setHot(index) {
  if (index === hotIndex) return;
  hotIndex = index;
  items.forEach((it, i) => it.el.classList.toggle('hot', i === index));
  panelRows.querySelectorAll('.row').forEach((r, i) => r.classList.toggle('muted', i !== index));
  placeTail(index);
}

function onCursor(p) {
  if (!revealed || !items.length) return;
  let best = 0;
  let bestDist = Infinity;
  items.forEach((it, i) => {
    const b = it.el.getBoundingClientRect();
    const mid = b.top + b.height / 2;
    const d = Math.abs(p.y - mid);
    if (d < bestDist) { bestDist = d; best = i; }
  });
  setHot(best);
}

// --- Apparition --------------------------------------------------------------

function reveal(on) {
  revealed = on;
  stage.classList.toggle('revealed', on);
  if (on) {
    resetAnimation();
    requestAnimationFrame(() => requestAnimationFrame(animateIn));
    setTimeout(() => {
      panel.classList.add('open');
      panel.setAttribute('aria-hidden', 'false');
      placeTail(hotIndex);
    }, 150);
    tickTimer = setInterval(refreshResetLabels, 20000);
  } else {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    clearInterval(tickTimer);
  }
}

function refreshResetLabels() {
  panelRows.querySelectorAll('.row').forEach((row, i) => {
    const g = data.gauges[i];
    if (!g) return;
    const el = row.querySelector('.row-reset');
    if (el) el.textContent = formatReset(g.resetsAt, g.resetStyle);
  });
}

// --- Branchement -------------------------------------------------------------

window.widget.onGeometry((g) => { geo = { ...geo, ...g }; applyGeometry(); render(); });
window.widget.onUsage((d) => { data = d; hotIndex = -1; render(); setHot(0); });
window.widget.onReveal(reveal);
window.widget.onCursor(onCursor);

applyGeometry();
render();
