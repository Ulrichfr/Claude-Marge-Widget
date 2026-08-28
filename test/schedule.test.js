'use strict';
/* Backoff. Getting this wrong is what earns an HTTP 429, and the widget then
   keeps asking at the same pace, which is how a small problem stays. */

const assert = require('assert');
const { nextDelay, shouldRefreshOnReveal, adjustFloor, MAX_DELAY_MS } = require('../src/schedule');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };

test('a success keeps the configured pace', () => {
  assert.strictEqual(nextDelay({ ok: true }, 0, 120, { jitter: 0 }), 120000);
});

test('by default the pace is jittered, so two machines drift apart', () => {
  const values = new Set();
  for (let i = 0; i < 40; i++) values.add(nextDelay({ ok: true }, 0, 120));
  assert.ok(values.size > 30, 'identical delays would keep machines in lockstep');
  for (const v of values) {
    assert.ok(v > 100000 && v < 140000, `${v} strayed too far from the setting`);
  }
});

test('a floor protects the endpoint from an over-eager config', () => {
  assert.strictEqual(nextDelay({ ok: true }, 0, 1, { jitter: 0 }), 30000);
});

test('failures back off until the cap, then hold there', () => {
  const delays = [1, 2, 3, 4, 5, 6].map((f) => nextDelay({ ok: false }, f, 60, { jitter: 0 }));
  assert.ok(delays[0] > 60000, 'the first failure already waits longer than the base');
  for (let i = 1; i < delays.length; i++) {
    assert.ok(delays[i] >= delays[i - 1], `attempt ${i + 1} waited less than the previous one`);
  }
  assert.strictEqual(delays[delays.length - 1], MAX_DELAY_MS, 'the tail should sit at the cap');
  assert.ok(delays.some((d) => d < MAX_DELAY_MS), 'it should climb, not jump straight to the cap');
});

test('the backoff is capped, it never waits forever', () => {
  assert.strictEqual(nextDelay({ ok: false }, 99, 120, { jitter: 0 }), MAX_DELAY_MS);
  assert.ok(nextDelay({ ok: false }, 6, 600, { jitter: 0 }) <= MAX_DELAY_MS);
});

test('Retry-After from the server wins over our own guess', () => {
  assert.strictEqual(nextDelay({ ok: false, retryAfter: 300 }, 1, 60), 300000);
});

test('Retry-After never makes us ask sooner than the base interval', () => {
  assert.strictEqual(nextDelay({ ok: false, retryAfter: 1 }, 1, 120), 120000);
});

test('hovering does not refresh while backing off', () => {
  const now = Date.now();
  assert.strictEqual(shouldRefreshOnReveal(now - 3600000, 1, now), false);
});

test('hovering refreshes stale data, not fresh data', () => {
  const now = Date.now();
  assert.strictEqual(shouldRefreshOnReveal(now - 5000, 0, now), false);
  assert.strictEqual(shouldRefreshOnReveal(now - 120000, 0, now), true);
  assert.strictEqual(shouldRefreshOnReveal(null, 0, now), true, 'first reveal must fetch');
});


// --- Pacing ------------------------------------------------------------------

const FIXED = { jitter: 0 };

test('nobody at the keyboard means asking far less often', () => {
  const active = nextDelay({ ok: true }, 0, 120, FIXED);
  const away = nextDelay({ ok: true }, 0, 120, { ...FIXED, idleSeconds: 600 });
  assert.strictEqual(active, 120000);
  assert.strictEqual(away, 480000, 'an idle machine should not poll at working pace');
});

test('a brief pause is not an absence', () => {
  assert.strictEqual(nextDelay({ ok: true }, 0, 120, { ...FIXED, idleSeconds: 60 }), 120000);
});

test('a refusal raises the sustainable pace, and it stays raised', () => {
  const refused = { ok: false, reason: 'rate-limited' };
  let floor = adjustFloor(0, refused, 120, 0);
  assert.strictEqual(floor, 240);
  floor = adjustFloor(floor, refused, 120, 0);
  assert.strictEqual(floor, 480);
  floor = adjustFloor(floor, { ok: true }, 120, 1);
  assert.strictEqual(floor, 480, 'one clean read should not undo what we learned');
});

test('the pace eases back only after a run of clean reads', () => {
  const floor = adjustFloor(480, { ok: true }, 120, 5);
  assert.strictEqual(floor, 240);
  assert.strictEqual(adjustFloor(240, { ok: true }, 120, 5), 120);
  assert.strictEqual(adjustFloor(120, { ok: true }, 120, 99), 120, 'it never goes below the setting');
});

test('the learned pace is capped, and other failures do not raise it', () => {
  assert.strictEqual(adjustFloor(900, { ok: false, reason: 'rate-limited' }, 120, 0), 900);
  assert.strictEqual(adjustFloor(120, { ok: false, reason: 'network' }, 120, 0), 120,
    'a dropped connection is not the account telling us to slow down');
});

test('the learned pace is what the next delay is built on', () => {
  assert.strictEqual(nextDelay({ ok: true }, 0, 120, { ...FIXED, floorSeconds: 480 }), 480000);
});

test('jitter spreads machines apart without ever inverting the order', () => {
  const low = nextDelay({ ok: true }, 0, 120, { jitter: 0.12, random: () => 0 });
  const high = nextDelay({ ok: true }, 0, 120, { jitter: 0.12, random: () => 1 });
  assert.ok(low < 120000 && high > 120000, 'jitter should move the value both ways');
  assert.ok(low >= 105000 && high <= 135000, 'and stay within a tenth of the setting');
});

console.log(`\n${passed} schedule tests passed`);
