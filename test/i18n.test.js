'use strict';
/* The seven languages must stay structurally identical. A missing key does not
   crash, it silently prints "undefined" in someone's interface. */

const assert = require('assert');
const I18N = require('../src/i18n');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };

const shape = (o) => Object.keys(o).sort().join(',');

test('every language exposes exactly the same keys', () => {
  const ref = shape(I18N.STRINGS.en);
  for (const lang of I18N.languages) {
    assert.strictEqual(shape(I18N.STRINGS[lang]), ref, `${lang} differs at the top level`);
    for (const group of ['errors', 'menu', 'settings']) {
      assert.strictEqual(shape(I18N.STRINGS[lang][group]), shape(I18N.STRINGS.en[group]),
        `${lang}.${group} differs`);
    }
  }
});

test('no string is empty, and every function returns something', () => {
  for (const lang of I18N.languages) {
    const t = I18N.STRINGS[lang];
    for (const [key, value] of Object.entries(t)) {
      if (typeof value === 'string') assert.ok(value.trim(), `${lang}.${key} is empty`);
    }
    assert.ok(t.used(73).includes('73'), `${lang}.used lost the number`);
    assert.ok(t.modelWeek('Opus').includes('Opus'), `${lang}.modelWeek lost the model`);
    assert.ok(t.notifyBody('Opus', 94).includes('94'), `${lang}.notifyBody lost the percentage`);
    assert.ok(t.hours(4, 8).length > 1, `${lang}.hours is empty`);
    assert.ok(t.minutes(12).includes('12'), `${lang}.minutes lost the number`);
  }
});

test('an unknown or malformed locale falls back to English', () => {
  assert.strictEqual(I18N.pick('pt-BR'), I18N.STRINGS.en);
  assert.strictEqual(I18N.pick(''), I18N.STRINGS.en);
  assert.strictEqual(I18N.pick(null), I18N.STRINGS.en);
  assert.strictEqual(I18N.pick('FR_ca'), I18N.STRINGS.fr, 'case and underscore should still match');
});

console.log(`\n${passed} i18n tests passed`);
