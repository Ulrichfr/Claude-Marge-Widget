'use strict';
/* Tests de la normalisation. La reponse de l'API varie selon les comptes :
   ce qui compte est qu'un quota absent ne devienne jamais un zero affiche. */

const assert = require('assert');
const { normalize } = require('../src/usage');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };

const base = {
  five_hour: { utilization: 73.4, resets_at: '2026-08-28T13:39:59Z' },
  seven_day: { utilization: 12, resets_at: '2026-09-02T09:59:59Z' },
  seven_day_opus: null,
  seven_day_sonnet: null,
  limits: [],
  extra_usage: { is_enabled: false }
};

test('les pourcentages sont arrondis et bornes', () => {
  const r = normalize({ ...base, five_hour: { utilization: 73.4, resets_at: null } });
  assert.strictEqual(r.gauges[0].percent, 73);
  const over = normalize({ ...base, five_hour: { utilization: 140, resets_at: null } });
  assert.strictEqual(over.gauges[0].percent, 100);
});

test('un quota absent ne produit pas d anneau', () => {
  const r = normalize({ ...base, seven_day: null });
  assert.strictEqual(r.gauges.filter((x) => x.id === 'weekly').length, 0);
  assert.ok(r.gauges.every((x) => x.percent !== null));
});

test('chaque modele a son propre anneau', () => {
  const r = normalize({
    ...base,
    seven_day_opus: { utilization: 94, resets_at: '2026-09-02T09:59:59Z' },
    seven_day_sonnet: { utilization: 30, resets_at: '2026-09-02T09:59:59Z' }
  });
  const models = r.gauges.filter((x) => x.kind === 'model').map((x) => x.model);
  assert.deepStrictEqual(models, ['Opus', 'Sonnet']);
  assert.deepStrictEqual(r.gauges.filter((x) => x.kind === 'model').map((x) => x.monogram), ['O', 'S']);
});

test('un modele expose par limits[] est repris', () => {
  const r = normalize({
    ...base,
    limits: [{ kind: 'weekly_scoped', percent: 6, resets_at: '2026-09-02T09:59:59Z',
      is_active: false, scope: { model: { display_name: 'Fable' } } }]
  });
  const fable = r.gauges.find((x) => x.model === 'Fable');
  assert.ok(fable, 'Fable manquant');
  assert.strictEqual(fable.percent, 6);
});

test('un modele present des deux cotes n apparait qu une fois', () => {
  const r = normalize({
    ...base,
    seven_day_opus: { utilization: 94, resets_at: null },
    limits: [{ kind: 'weekly_scoped', percent: 94, resets_at: null, is_active: true,
      scope: { model: { display_name: 'Opus' } } }]
  });
  assert.strictEqual(r.gauges.filter((x) => x.model === 'Opus').length, 1);
});

test('la limite qui mord est signalee', () => {
  const r = normalize({
    ...base,
    limits: [{ kind: 'weekly_all', percent: 12, is_active: true, resets_at: null, scope: null }]
  });
  assert.strictEqual(r.gauges.find((x) => x.id === 'weekly').active, true);
  assert.strictEqual(r.gauges.find((x) => x.id === 'session').active, false);
});

test('une reponse vide ne fait pas tomber la normalisation', () => {
  const r = normalize({});
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.gauges, []);
});
console.log(`\n${passed} tests de normalisation passes`);
