'use strict';
/**
 * When to ask again. Kept apart from Electron so the backoff can be tested:
 * getting this wrong is what earns an HTTP 429 in the first place.
 */

const MIN_SECONDS = 30;
const MAX_DELAY_MS = 15 * 60 * 1000;
const MAX_FAILURES = 6;

/**
 * @param {{ok: boolean, retryAfter?: number}} result  the last answer
 * @param {number} failures  consecutive failures, this one included
 * @param {number} baseSeconds  the configured interval
 * @returns {number} milliseconds to wait before asking again
 */
function nextDelay(result, failures, baseSeconds) {
  const base = Math.max(MIN_SECONDS, baseSeconds || 60) * 1000;
  if (result && result.ok) return base;

  // The server told us how long to wait: obey it, never ask sooner.
  if (result && Number.isFinite(result.retryAfter) && result.retryAfter > 0) {
    return Math.min(MAX_DELAY_MS, Math.max(base, result.retryAfter * 1000));
  }

  const steps = Math.min(Math.max(1, failures), MAX_FAILURES);
  return Math.min(MAX_DELAY_MS, base * Math.pow(2, steps));
}

/** Should a reveal trigger a fresh call, or is the last read good enough? */
function shouldRefreshOnReveal(lastGoodAt, failures, now) {
  if (failures > 0) return false;        // already backing off, do not pile on
  if (!lastGoodAt) return true;
  return (now - lastGoodAt) > 60000;
}

module.exports = { nextDelay, shouldRefreshOnReveal, MIN_SECONDS, MAX_DELAY_MS, MAX_FAILURES };
