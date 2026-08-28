'use strict';
/**
 * Couche donnees : recupere le jeton OAuth Claude Max la ou l'OS le range,
 * interroge l'endpoint officiel de consommation, et normalise la reponse
 * en trois jauges pretes a afficher.
 *
 * Aucun jeton n'est ecrit, mis en cache sur disque ni envoye ailleurs
 * qu'a api.anthropic.com.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');

const API_HOST = 'api.anthropic.com';
const API_PATH = '/api/oauth/usage';
const CRED_FILE = path.join(os.homedir(), '.claude', '.credentials.json');
const KEYCHAIN_SERVICE = 'Claude Code';

/** Lit les identifiants Claude Code. macOS : Trousseau. Ailleurs : fichier. */
function readCredentials() {
  if (process.platform === 'darwin') {
    try {
      const raw = execFileSync('security', [
        'find-generic-password', '-a', os.userInfo().username, '-w', '-s', KEYCHAIN_SERVICE
      ], { encoding: 'utf8', timeout: 5000 });
      const parsed = JSON.parse(raw.trim());
      if (parsed && parsed.claudeAiOauth) return parsed.claudeAiOauth;
    } catch (_) {
      // Trousseau vide ou verrouille : on retombe sur le fichier.
    }
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(CRED_FILE, 'utf8'));
    return parsed.claudeAiOauth || null;
  } catch (_) {
    return null;
  }
}

function httpsGetJson(token) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      host: API_HOST,
      path: API_PATH,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'anthropic-beta': 'oauth-2025-04-20',
        'User-Agent': 'claude-usage-widget/0.1'
      },
      timeout: 10000
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

/** Un bloc {utilization, resets_at} -> pourcentage entier, ou null si absent. */
function pct(block) {
  if (!block || block.utilization === null || block.utilization === undefined) return null;
  return Math.max(0, Math.min(100, Math.round(block.utilization)));
}

/** Monogramme affiche au centre de l'anneau d'un modele. */
function monogram(name) {
  const clean = String(name || '').trim();
  if (!clean) return '?';
  return clean[0].toUpperCase();
}

/**
 * Construit la liste des jauges, dans l'ordre d'affichage :
 *   1. la fenetre glissante de 5 h, celle qui coupe en pleine tache
 *   2. le quota hebdomadaire tous modeles confondus
 *   3+. un anneau PAR MODELE, parce que les quotas ne sont pas les memes :
 *       Opus, Sonnet, Fable... chacun a sa propre limite hebdo.
 *
 * La liste est dynamique : un compte qui n'expose que deux limites affiche
 * deux anneaux. Une limite absente n'est jamais rendue en zero trompeur.
 */
function normalize(raw) {
  const gauges = [];

  if (pct(raw.five_hour) !== null) {
    gauges.push({
      id: 'session',
      kind: 'session',
      icon: 'claude',
      title: 'Session en cours',
      subtitle: 'Tous modèles, fenêtre de 5 h',
      percent: pct(raw.five_hour),
      resetsAt: raw.five_hour.resets_at,
      resetStyle: 'relative',
      active: false
    });
  }

  if (pct(raw.seven_day) !== null) {
    gauges.push({
      id: 'weekly',
      kind: 'weekly',
      icon: 'week',
      title: 'Tous modèles',
      subtitle: 'Quota hebdomadaire commun',
      percent: pct(raw.seven_day),
      resetsAt: raw.seven_day.resets_at,
      resetStyle: 'absolute',
      active: false
    });
  }

  // Un anneau par modele. Deux sources possibles selon les comptes : les blocs
  // nommes seven_day_<modele>, et les entrees weekly_scoped du tableau limits.
  const seen = new Set();
  const addModel = (name, percent, resetsAt, active) => {
    const key = String(name).toLowerCase();
    if (percent === null || seen.has(key)) return;
    seen.add(key);
    gauges.push({
      id: `model-${key}`,
      kind: 'model',
      icon: 'model',
      monogram: monogram(name),
      model: name,
      title: name,
      subtitle: 'Quota hebdomadaire propre à ce modèle',
      percent,
      resetsAt,
      resetStyle: 'absolute',
      active: active === true
    });
  };

  for (const [key, name] of [['seven_day_opus', 'Opus'], ['seven_day_sonnet', 'Sonnet']]) {
    if (raw[key]) addModel(name, pct(raw[key]), raw[key].resets_at, false);
  }
  for (const limit of raw.limits || []) {
    const name = limit && limit.kind === 'weekly_scoped' && limit.scope && limit.scope.model
      ? limit.scope.model.display_name
      : null;
    if (name) addModel(name, pct({ utilization: limit.percent }), limit.resets_at, limit.is_active);
  }

  // Quelle limite mord en ce moment : utile pour la mettre en avant.
  const activeLimit = (raw.limits || []).find((l) => l.is_active === true);
  if (activeLimit) {
    const group = activeLimit.kind === 'session' ? 'session'
      : activeLimit.kind === 'weekly_all' ? 'weekly' : null;
    if (group) {
      const g = gauges.find((x) => x.id === group);
      if (g) g.active = true;
    }
  }

  const extra = raw.extra_usage || {};
  return {
    ok: true,
    fetchedAt: Date.now(),
    gauges,
    extraUsageEnabled: extra.is_enabled === true
  };
}

async function fetchUsage() {
  const cred = readCredentials();
  if (!cred || !cred.accessToken) {
    return { ok: false, reason: 'no-credentials', fetchedAt: Date.now(), gauges: [] };
  }
  if (cred.expiresAt && cred.expiresAt < Date.now()) {
    // Claude Code renouvelle ce jeton tout seul. On ne le fait surtout pas a sa
    // place : faire tourner le refresh token invaliderait sa session.
    return { ok: false, reason: 'token-expired', fetchedAt: Date.now(), gauges: [] };
  }
  try {
    const raw = await httpsGetJson(cred.accessToken);
    return normalize(raw);
  } catch (err) {
    const reason = /HTTP 401|HTTP 403/.test(err.message) ? 'unauthorized' : 'network';
    return { ok: false, reason, detail: err.message, fetchedAt: Date.now(), gauges: [] };
  }
}

module.exports = { fetchUsage, readCredentials, normalize };

if (require.main === module) {
  fetchUsage().then((r) => console.log(JSON.stringify(r, null, 2)));
}
