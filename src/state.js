'use strict';
/**
 * The little that must survive a restart.
 *
 * Two things, and both were bugs before this file existed. The failure count,
 * because a widget restarted while rate limited would otherwise start over at
 * full speed and keep the limit alive. And the last real reading, so a fresh
 * start shows numbers immediately instead of an empty pill while the first
 * request travels.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

// The override exists so the tests can exercise a real file without touching
// the user's own state.
const FILE = process.env.MARGE_STATE_FILE ||
  path.join(os.homedir(), '.config', 'claude-marge', 'state.json');
const DIR = path.dirname(FILE);
const MAX_AGE_MS = 24 * 60 * 60 * 1000;   // older readings are not worth showing

function read() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch (_) {
    return {};
  }
}

function write(state) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
    return true;
  } catch (_) {
    return false;    // a read-only home must not take the widget down
  }
}

/** The stored reading, only if it is recent enough to be worth showing. */
function restoreLastGood(now = Date.now()) {
  const { lastGood } = read();
  if (!lastGood || !lastGood.fetchedAt) return null;
  if (now - lastGood.fetchedAt > MAX_AGE_MS) return null;
  if (!Array.isArray(lastGood.gauges) || !lastGood.gauges.length) return null;
  return lastGood;
}

/** Failures carry over, so a restart does not undo the backoff. */
function restoreFailures() {
  const { failures } = read();
  return Number.isInteger(failures) && failures > 0 ? failures : 0;
}

function save(patch) {
  return write({ ...read(), ...patch });
}

module.exports = { read, write, save, restoreLastGood, restoreFailures, FILE, MAX_AGE_MS };
