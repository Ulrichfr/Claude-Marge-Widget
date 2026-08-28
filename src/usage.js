'use strict';
/**
 * Data layer: find the Claude OAuth token wherever the OS keeps it, ask the
 * official usage endpoint, and turn the answer into gauges ready to display.
 *
 * The token is never copied, never cached on disk, and never sent anywhere
 * other than api.anthropic.com.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');

const API_HOST = 'api.anthropic.com';
const API_PATH = '/api/oauth/usage';
const CRED_FILE = path.join(os.homedir(), '.claude', '.credentials.json');

// The Keychain service name changed between Claude Code releases. Try the
// current one, then the older one, rather than assuming which is installed.
const KEYCHAIN_SERVICES = ['Claude Code-credentials', 'Claude Code'];

/** Read Claude Code's credentials. Keychain on macOS, file everywhere else. */
function readCredentials() {
  if (process.platform === 'darwin') {
    for (const service of KEYCHAIN_SERVICES) {
      try {
        const raw = execFileSync('security', [
          'find-generic-password', '-a', os.userInfo().username, '-w', '-s', service
        ], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] });
        const parsed = JSON.parse(raw.trim());
        if (parsed && parsed.claudeAiOauth) return parsed.claudeAiOauth;
      } catch (_) {
        // No entry under this name, locked Keychain, or a read refused outside
        // a GUI session. Try the next name, then the file. The `security`
        // message is swallowed: it teaches nothing and floods the log.
      }
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
        'User-Agent': 'claude-marge-widget'
      },
      timeout: 10000
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

/** One {utilization, resets_at} block to a whole percentage, or null if absent. */
function pct(block) {
  if (!block || block.utilization === null || block.utilization === undefined) return null;
  return Math.max(0, Math.min(100, Math.round(block.utilization)));
}

/** Letter shown at the centre of a model's ring. */
function monogram(name) {
  const clean = String(name || '').trim();
  return clean ? clean[0].toUpperCase() : '?';
}

/**
 * Build the gauge list, in display order:
 *   1. the rolling 5 hour window, the one that cuts you off mid-task
 *   2. the weekly quota across all models
 *   3+. one ring PER MODEL, because the quotas are not the same: Opus,
 *       Sonnet, Fable each carry their own weekly limit.
 *
 * The list is dynamic. An account exposing two limits shows two rings, and a
 * missing limit is never rendered as a misleading zero.
 *
 * Gauges carry structure, not wording: labels are the interface's business,
 * so the same data can be shown in any language.
 */
function normalize(raw) {
  const gauges = [];

  if (pct(raw.five_hour) !== null) {
    gauges.push({
      id: 'session',
      kind: 'session',
      icon: 'claude',
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
      percent: pct(raw.seven_day),
      resetsAt: raw.seven_day.resets_at,
      resetStyle: 'absolute',
      active: false
    });
  }

  // One ring per model, from either of the two shapes the API uses depending
  // on the account: seven_day_<model> blocks, and weekly_scoped entries.
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

  // Which limit is biting right now: worth pointing out, it is the one that
  // will cut you off first.
  const activeLimit = (raw.limits || []).find((l) => l.is_active === true);
  if (activeLimit) {
    const group = activeLimit.kind === 'session' ? 'session'
      : activeLimit.kind === 'weekly_all' ? 'weekly' : null;
    const g = group && gauges.find((x) => x.id === group);
    if (g) g.active = true;
  }

  return {
    ok: true,
    fetchedAt: Date.now(),
    gauges,
    extraUsageEnabled: (raw.extra_usage || {}).is_enabled === true
  };
}

async function fetchUsage() {
  const cred = readCredentials();
  if (!cred || !cred.accessToken) {
    return { ok: false, reason: 'no-credentials', fetchedAt: Date.now(), gauges: [] };
  }
  if (cred.expiresAt && cred.expiresAt < Date.now()) {
    // Claude Code refreshes this token on its own. We deliberately do not do it
    // for them: rotating the refresh token would invalidate their session.
    return { ok: false, reason: 'token-expired', fetchedAt: Date.now(), gauges: [] };
  }
  try {
    return normalize(await httpsGetJson(cred.accessToken));
  } catch (err) {
    const reason = /HTTP 401|HTTP 403/.test(err.message) ? 'unauthorized' : 'network';
    return { ok: false, reason, detail: err.message, fetchedAt: Date.now(), gauges: [] };
  }
}

module.exports = { fetchUsage, readCredentials, normalize };

if (require.main === module) {
  fetchUsage().then((r) => console.log(JSON.stringify(r, null, 2)));
}
