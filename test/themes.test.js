'use strict';
/* Themes. A missing colour does not throw, it renders as an unstyled element
   in the middle of someone's desktop, so the shape is what gets tested. */

const assert = require('assert');
const THEMES = require('../src/themes');
const FORMAT = require('../src/format');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };

const NEEDED = ['name', 'dark', 'pill', 'panel', 'face', 'faceHot', 'ink', 'inkDim',
  'track', 'shadow', 'ok', 'warm', 'hot', 'crit', 'ui'];

test('every theme defines every surface and tone', () => {
  for (const id of THEMES.ids) {
    const t = THEMES.get(id);
    for (const key of NEEDED) {
      assert.ok(t[key] !== undefined && t[key] !== '', `${id} is missing ${key}`);
    }
    for (const key of ['bg', 'sheet', 'accent']) {
      assert.ok(t.ui[key], `${id}.ui is missing ${key}`);
    }
  }
});

test('the widget variables are complete for every theme', () => {
  const ref = Object.keys(THEMES.widgetVars(THEMES.DEFAULT)).sort();
  for (const id of THEMES.ids) {
    assert.deepStrictEqual(Object.keys(THEMES.widgetVars(id)).sort(), ref, `${id} differs`);
    for (const [name, value] of Object.entries(THEMES.widgetVars(id))) {
      assert.ok(value, `${id} left ${name} empty`);
    }
  }
});

test('an unknown theme falls back rather than painting nothing', () => {
  assert.strictEqual(THEMES.get('does-not-exist'), THEMES.get(THEMES.DEFAULT));
  assert.strictEqual(THEMES.get(undefined), THEMES.get(THEMES.DEFAULT));
  assert.ok(THEMES.widgetVars('nope')['--pill-bg']);
});

test('there is at least one light theme and one dark theme', () => {
  const dark = THEMES.ids.filter((id) => THEMES.get(id).dark);
  const light = THEMES.ids.filter((id) => !THEMES.get(id).dark);
  assert.ok(dark.length, 'no dark theme');
  assert.ok(light.length, 'no light theme');
});

test('the four tones stay distinct inside a theme', () => {
  for (const id of THEMES.ids) {
    const t = THEMES.get(id);
    const tones = new Set([t.ok, t.warm, t.hot, t.crit].map((c) => c.toLowerCase()));
    assert.strictEqual(tones.size, 4, `${id} reuses a tone, the gauges would lie`);
  }
});

test('a light theme uses dark ink, and a dark theme light ink', () => {
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const id of THEMES.ids) {
    const t = THEMES.get(id);
    const ink = luminance(t.ink);
    const surface = luminance(t.panel);
    assert.ok(Math.abs(ink - surface) > 0.4,
      `${id} puts ${t.ink} on ${t.panel}, which would be unreadable`);
    assert.strictEqual(ink > surface, t.dark === true, `${id} has its ink the wrong way round`);
  }
});

test('auto lets the locale decide, the other two do not', () => {
  assert.strictEqual(FORMAT.timeOptions('auto').hour12, undefined,
    'auto must not force a cycle, that is the whole point of auto');
  assert.strictEqual(FORMAT.timeOptions('12').hour12, true);
  assert.strictEqual(FORMAT.timeOptions('24').hour12, false);
});

test('a 24 hour setting shows 18:05 even in a 12 hour locale', () => {
  const at = new Date('2026-08-28T18:05:00');
  assert.ok(FORMAT.formatTime(at, 'en-US', '24').startsWith('18'));
  assert.ok(/PM/i.test(FORMAT.formatTime(at, 'fr-FR', '12')), 'AM/PM should win over the locale');
});

console.log(`\n${passed} theme and format tests passed`);
