'use strict';
/* Threshold alerts. The hard part is not raising one, it is not raising the
   same one thirty times an hour, which is how people learn to ignore them. */

const assert = require('assert');
const { due } = require('../src/alerts');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };

const WINDOW = '2026-09-02T09:59:59Z';
const gauge = (percent, resetsAt = WINDOW) => ({ id: 'session', kind: 'session', percent, resetsAt });

test('crossing a threshold raises one alert', () => {
  const { raise } = due([gauge(83)], [80, 95], {});
  assert.strictEqual(raise.length, 1);
  assert.strictEqual(raise[0].level, 80);
});

test('staying above the threshold stays quiet', () => {
  const first = due([gauge(83)], [80, 95], {});
  const second = due([gauge(88)], [80, 95], first.ledger);
  assert.strictEqual(second.raise.length, 0, 'it repeated itself');
});

test('crossing the next threshold up speaks again', () => {
  const first = due([gauge(83)], [80, 95], {});
  const second = due([gauge(96)], [80, 95], first.ledger);
  assert.strictEqual(second.raise.length, 1);
  assert.strictEqual(second.raise[0].level, 95);
});

test('a new reset window arms the alert again', () => {
  const first = due([gauge(83)], [80, 95], {});
  const second = due([gauge(83, '2026-09-09T09:59:59Z')], [80, 95], first.ledger);
  assert.strictEqual(second.raise.length, 1, 'the new week said nothing');
});

test('below every threshold, nothing is raised', () => {
  assert.strictEqual(due([gauge(12)], [80, 95], {}).raise.length, 0);
});

test('no thresholds configured means no alerts', () => {
  assert.strictEqual(due([gauge(99)], [], {}).raise.length, 0);
});

test('the ledger forgets quotas the account no longer exposes', () => {
  const { ledger } = due([gauge(83)], [80], {});
  const after = due([{ id: 'weekly', kind: 'weekly', percent: 5, resetsAt: WINDOW }], [80], ledger);
  assert.deepStrictEqual(Object.keys(after.ledger), [], 'the ledger would grow forever');
});

test('a jump straight past both thresholds reports the higher one', () => {
  const { raise } = due([gauge(99)], [80, 95], {});
  assert.strictEqual(raise.length, 1);
  assert.strictEqual(raise[0].level, 95, 'it should not warn about 80 when already past 95');
});

console.log(`\n${passed} alert tests passed`);
