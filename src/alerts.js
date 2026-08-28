'use strict';
/**
 * Threshold alerts: say something before the ceiling, not after it.
 *
 * The rule is "once per level, per gauge, per reset window". Crossing 80%
 * notifies once; staying above it says nothing more; the window resetting
 * arms it again. Without that bookkeeping a widget polling every two minutes
 * would notify thirty times an hour, which teaches people to ignore it.
 */

/** @returns {{gauge, level}[]} the alerts to raise now, and the new ledger. */
function due(gauges, thresholds, ledger) {
  const levels = [...(thresholds || [])].sort((a, b) => b - a);
  const next = { ...(ledger || {}) };
  const raise = [];

  for (const gauge of gauges || []) {
    const crossed = levels.find((l) => gauge.percent >= l);
    if (crossed === undefined) continue;

    const seen = next[gauge.id];
    const sameWindow = seen && seen.window === (gauge.resetsAt || null);
    if (sameWindow && seen.level >= crossed) continue;   // already said, stay quiet

    next[gauge.id] = { window: gauge.resetsAt || null, level: crossed };
    raise.push({ gauge, level: crossed });
  }

  // Forget gauges the account no longer exposes, so the ledger cannot grow forever.
  const alive = new Set((gauges || []).map((g) => g.id));
  for (const id of Object.keys(next)) if (!alive.has(id)) delete next[id];

  return { raise, ledger: next };
}

module.exports = { due };
