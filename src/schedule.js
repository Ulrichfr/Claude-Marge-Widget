'use strict';
/**
 * When to ask again. Kept apart from Electron so the backoff can be tested:
 * getting this wrong is what earns an HTTP 429 in the first place.
 */

const MIN_SECONDS = 30;
const MAX_DELAY_MS = 15 * 60 * 1000;
const MAX_FAILURES = 6;
const IDLE_AFTER = 300;      // seconds without input before nobody is looking
const IDLE_FACTOR = 4;       // how much further apart to ask while away
const FLOOR_CEILING = 900;   // the learned pace never grows past this
const DECAY_AFTER = 5;       // clean reads before easing the pace back

/**
 * Spread identical machines apart. Two widgets on one account, started by the
 * same login, would otherwise ask in lockstep for ever and trip the limit
 * together.
 */
function jittered(ms, context) {
  const spread = context.jitter === undefined ? 0.12 : context.jitter;
  if (!spread) return Math.round(ms);
  const random = context.random || Math.random;
  return Math.round(ms * (1 + (random() * 2 - 1) * spread));
}

/**
 * @param {{ok: boolean, retryAfter?: number}} result  the last answer
 * @param {number} failures  consecutive failures, this one included
 * @param {number} baseSeconds  the configured interval
 * @param {{idleSeconds?: number, floorSeconds?: number,
 *          jitter?: number, random?: function}} context
 * @returns {number} milliseconds to wait before asking again
 */
function nextDelay(result, failures, baseSeconds, context = {}) {
  const configured = Math.max(MIN_SECONDS, baseSeconds || 60) * 1000;
  // The learned pace can only ever be slower than the configured one.
  const base = Math.max(configured, (context.floorSeconds || 0) * 1000);

  if (result && result.ok) {
    // Nobody is at the keyboard: the numbers can wait, and the account is
    // shared with every other machine signed into the same session.
    const away = (context.idleSeconds || 0) >= IDLE_AFTER;
    return jittered(Math.min(MAX_DELAY_MS, away ? base * IDLE_FACTOR : base), context);
  }

  // The server told us how long to wait: obey it, never ask sooner.
  if (result && Number.isFinite(result.retryAfter) && result.retryAfter > 0) {
    return Math.min(MAX_DELAY_MS, Math.max(base, result.retryAfter * 1000));
  }

  const steps = Math.min(Math.max(1, failures), MAX_FAILURES);
  return jittered(Math.min(MAX_DELAY_MS, base * Math.pow(2, steps)), context);
}

/**
 * The pace this account can actually sustain, learned from its refusals.
 *
 * Backing off for one request and then returning to the same rhythm is how a
 * rate limit becomes permanent when several machines share an account. So a
 * refusal raises the floor and it stays raised, easing back only after a run
 * of clean reads.
 *
 * @returns {number} the new floor, in seconds
 */
function adjustFloor(floorSeconds, result, baseSeconds, cleanReads) {
  const base = Math.max(MIN_SECONDS, baseSeconds || 60);
  const floor = Math.max(base, floorSeconds || base);

  if (result && !result.ok && result.reason === 'rate-limited') {
    return Math.min(FLOOR_CEILING, Math.max(base * 2, floor * 2));
  }
  if (result && result.ok && cleanReads >= DECAY_AFTER && floor > base) {
    return Math.max(base, Math.round(floor / 2));
  }
  return floor;
}

/** Should a reveal trigger a fresh call, or is the last read good enough? */
function shouldRefreshOnReveal(lastGoodAt, failures, now) {
  if (failures > 0) return false;        // already backing off, do not pile on
  if (!lastGoodAt) return true;
  return (now - lastGoodAt) > 60000;
}

module.exports = {
  nextDelay, shouldRefreshOnReveal, adjustFloor,
  MIN_SECONDS, MAX_DELAY_MS, MAX_FAILURES, IDLE_AFTER, IDLE_FACTOR,
  FLOOR_CEILING, DECAY_AFTER
};
