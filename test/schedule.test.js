'use strict';
/* Backoff. Getting this wrong is what earns an HTTP 429, and the widget then
   keeps asking at the same pace, which is how a small problem stays. */

const assert = require('assert');
const { nextDelay, shouldRefreshOnReveal, MAX_DELAY_MS } = require('../src/schedule');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };

test('a success keeps the configured pace', () => {
  assert.strictEqual(nextDelay({ ok: true }, 0, 120), 120000);
});

test('a floor protects the endpoint from an over-eager config', () => {
  assert.strictEqual(nextDelay({ ok: true }, 0, 1), 30000);
});

test('failures back off until the cap, then hold there', () => {
  const delays = [1, 2, 3, 4, 5, 6].map((f) => nextDelay({ ok: false }, f, 60));
  assert.ok(delays[0] > 60000, 'the first failure already waits longer than the base');
  for (let i = 1; i < delays.length; i++) {
    assert.ok(delays[i] >= delays[i - 1], `attempt ${i + 1} waited less than the previous one`);
  }
  assert.strictEqual(delays[delays.length - 1], MAX_DELAY_MS, 'the tail should sit at the cap');
  assert.ok(delays.some((d) => d < MAX_DELAY_MS), 'it should climb, not jump straight to the cap');
});

test('the backoff is capped, it never waits forever', () => {
  assert.strictEqual(nextDelay({ ok: false }, 99, 120), MAX_DELAY_MS);
  assert.ok(nextDelay({ ok: false }, 6, 600) <= MAX_DELAY_MS);
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

console.log(`\n${passed} schedule tests passed`);
