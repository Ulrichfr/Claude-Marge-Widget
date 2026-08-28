'use strict';
/**
 * Pull updates from the repository the widget was installed from.
 *
 * The rule that matters: an update that breaks the tests is undone. Fetching
 * and restarting is easy; leaving someone with a dead widget and no way back
 * is the failure mode worth engineering against, so the previous commit is
 * recorded, the suite is run before the restart, and a failure rolls back.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const REPO = 'Ulrichfr/Claude-Marge-Widget';
const BRANCH = 'main';
const API = `https://api.github.com/repos/${REPO}/commits/${BRANCH}`;

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 180000, maxBuffer: 8 * 1024 * 1024, ...opts },
      (err, stdout, stderr) => {
        if (err) { err.stdout = stdout; err.stderr = stderr; return reject(err); }
        resolve(String(stdout).trim());
      });
  });
}

// --- Pure helpers, so the interesting decisions are testable ------------------

/** What GitHub answered, reduced to what we display. */
function parseRemote(json) {
  if (!json || !json.sha) return null;
  const commit = json.commit || {};
  return {
    sha: json.sha,
    short: json.sha.slice(0, 7),
    date: (commit.author && commit.author.date) || null,
    message: String(commit.message || '').split('\n')[0]
  };
}

/**
 * @returns {'up-to-date'|'available'|'unknown'} plus what to show.
 * An unknown local revision is not an update: it is a checkout we cannot read,
 * and offering to overwrite it would be worse than saying nothing.
 */
function compare(localSha, remote) {
  if (!remote || !remote.sha) return { state: 'unknown', remote: null };
  if (!localSha) return { state: 'unknown', remote };
  if (localSha === remote.sha) return { state: 'up-to-date', remote };
  return { state: 'available', remote };
}

// --- Git side ----------------------------------------------------------------

const isGitCheckout = (dir) => fs.existsSync(path.join(dir, '.git'));

async function localSha(dir) {
  try { return await run('git', ['-C', dir, 'rev-parse', 'HEAD']); } catch (_) { return null; }
}

/** Uncommitted work means someone is editing this copy: never overwrite it. */
async function isDirty(dir) {
  try { return (await run('git', ['-C', dir, 'status', '--porcelain'])).length > 0; }
  catch (_) { return true; }
}

function fetchRemote() {
  return new Promise((resolve) => {
    const https = require('https');
    const req = https.request({
      host: 'api.github.com',
      path: `/repos/${REPO}/commits/${BRANCH}`,
      headers: { 'User-Agent': 'claude-marge-widget', Accept: 'application/vnd.github+json' },
      timeout: 12000
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return resolve(null);
        try { resolve(parseRemote(JSON.parse(body))); } catch (_) { resolve(null); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.end();
  });
}

async function check(dir) {
  if (!isGitCheckout(dir)) return { state: 'not-a-checkout', remote: null };
  const [local, remote] = await Promise.all([localSha(dir), fetchRemote()]);
  const result = compare(local, remote);
  return { ...result, local, localShort: local ? local.slice(0, 7) : null };
}

// --- Applying ----------------------------------------------------------------

/** npm lives outside a launchd PATH, so ask a login shell where it is. */
async function findNpm() {
  try {
    const found = await run('/bin/sh', ['-lc', 'command -v npm'], { timeout: 20000 });
    return found || null;
  } catch (_) {
    return null;
  }
}

/**
 * Run the test suite with whatever runtime we have. Electron doubles as Node
 * when told to, which keeps this working on a machine where node itself is not
 * on the service's PATH.
 */
async function runTests(dir, execPath) {
  const files = fs.readdirSync(path.join(dir, 'test')).filter((f) => f.endsWith('.test.js'));
  for (const file of files) {
    await run(execPath, [path.join('test', file)], {
      cwd: dir,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', MARGE_STATE_FILE: '' }
    });
  }
  return files.length;
}

/**
 * Fetch, install, test, and report. Rolls back to the previous commit if the
 * suite fails, so a bad push can never leave a broken widget behind.
 * @param {(step: string) => void} onStep
 */
async function apply(dir, execPath, onStep = () => {}) {
  if (!isGitCheckout(dir)) return { ok: false, reason: 'not-a-checkout' };
  if (await isDirty(dir)) return { ok: false, reason: 'dirty' };

  const previous = await localSha(dir);
  try {
    onStep('fetching');
    await run('git', ['-C', dir, 'fetch', '--quiet', 'origin', BRANCH]);
    await run('git', ['-C', dir, 'reset', '--quiet', '--hard', `origin/${BRANCH}`]);

    const updated = await localSha(dir);
    if (updated === previous) return { ok: true, changed: false, sha: updated };

    onStep('installing');
    const npm = await findNpm();
    if (npm) {
      await run(npm, ['install', '--no-audit', '--no-fund', '--silent'], { cwd: dir });
    }

    onStep('testing');
    await runTests(dir, execPath);

    return { ok: true, changed: true, sha: updated, short: updated.slice(0, 7), npmMissing: !npm };
  } catch (err) {
    onStep('rolling-back');
    try {
      if (previous) await run('git', ['-C', dir, 'reset', '--quiet', '--hard', previous]);
    } catch (_) {
      // Nothing left to try; the caller reports the failure rather than pretend.
    }
    return { ok: false, reason: 'failed', detail: String(err.stderr || err.message).slice(0, 400) };
  }
}

module.exports = {
  REPO, BRANCH, API,
  parseRemote, compare, isGitCheckout, localSha, isDirty,
  fetchRemote, check, apply, runTests, findNpm
};
