'use strict';
/* Hover rules. With no real pointer to drive, this is where "appears at the
   right edge, disappears when you leave" is actually verified. */

const assert = require('assert');
const g = require('../src/geometry');

const screen1080 = { x: 0, y: 0, width: 1920, height: 1080 };
const ANCHOR = 0.45;
const ROWS = 3;
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };

test('the window sits flush against the right edge', () => {
  const b = g.boundsForDisplay(screen1080, ROWS, ANCHOR);
  assert.strictEqual(b.x + b.width, screen1080.width);
  assert.strictEqual(b.width, g.G.windowWidth);
});

test('the window always stays on screen, however tall', () => {
  const small = { x: 0, y: 0, width: 1280, height: 620 };
  for (const rows of [1, 2, 3, 4, 5, 6, 8]) {
    for (const anchor of [0, 0.45, 1]) {
      const b = g.boundsForDisplay(small, rows, anchor);
      assert.ok(b.y >= small.y, `off the top (${rows} rings, anchor ${anchor})`);
      assert.ok(b.y + b.height <= small.y + small.height,
        `off the bottom (${rows} rings, anchor ${anchor})`);
    }
  }
});

test('height follows the number of models', () => {
  const a = g.layout(screen1080, 3);
  const b = g.layout(screen1080, 4);
  assert.ok(b.pillHeight > a.pillHeight);
  assert.strictEqual(b.pillHeight - a.pillHeight, a.ring + g.G.ringToLabel + a.label + a.rowGap);
});

test('the layout tightens rather than overflowing', () => {
  const petit = { x: 0, y: 0, width: 1280, height: 620 };
  const large = g.layout(screen1080, 3);
  const serre = g.layout(petit, 6);
  assert.ok(serre.windowHeight <= petit.height, 'does not fit the screen');
  assert.ok(serre.ring < large.ring || serre.rowGap < large.rowGap, 'no tightening happened');
});

test('six quotas fit a 1080p screen at full size', () => {
  const m = g.layout(screen1080, 6);
  assert.strictEqual(m.ring, 60);
  assert.ok(m.windowHeight <= screen1080.height);
});

test('a cursor on the right edge, level with the pill, triggers', () => {
  const band = g.pillBand(screen1080, ROWS, ANCHOR);
  const middle = { x: 1919, y: Math.round((band.top + band.bottom) / 2) };
  assert.ok(g.inHotZone(middle, screen1080, ROWS, ANCHOR));
});

test('the same cursor 30 px to the left does not', () => {
  const band = g.pillBand(screen1080, ROWS, ANCHOR);
  const near = { x: 1920 - 30, y: Math.round((band.top + band.bottom) / 2) };
  assert.strictEqual(g.inHotZone(near, screen1080, ROWS, ANCHOR), false);
});

test('the right edge, above or below the pill, does not trigger', () => {
  assert.strictEqual(g.inHotZone({ x: 1919, y: 4 }, screen1080, ROWS, ANCHOR), false);
  assert.strictEqual(g.inHotZone({ x: 1919, y: 1076 }, screen1080, ROWS, ANCHOR), false);
});

test('a display with another to its right has no trigger edge', () => {
  const left = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } };
  const right = { id: 2, bounds: { x: 1920, y: 0, width: 1920, height: 1080 } };
  const all = [left, right];
  assert.strictEqual(g.isOuterRightEdge(left, all), false, 'the inner seam triggers, it must not');
  assert.strictEqual(g.isOuterRightEdge(right, all), true, 'the real right edge does not trigger');
});

test('vertically stacked displays each keep their right edge', () => {
  const top = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } };
  const bottom = { id: 2, bounds: { x: 0, y: 1080, width: 1920, height: 1080 } };
  const all = [top, bottom];
  assert.strictEqual(g.isOuterRightEdge(top, all), true);
  assert.strictEqual(g.isOuterRightEdge(bottom, all), true);
});

test('an open widget survives the trip from pill to panel', () => {
  const b = g.boundsForDisplay(screen1080, ROWS, ANCHOR);
  const band = g.pillBand(screen1080, ROWS, ANCHOR);
  const y = Math.round((band.top + band.bottom) / 2);
  assert.ok(g.insideKeepAlive({ x: 1918, y }, b, ROWS, screen1080), 'over the pill');
  assert.ok(g.insideKeepAlive({ x: 1500, y }, b, ROWS, screen1080), 'over the panel');
});

test('the widget closes when the cursor really leaves', () => {
  const b = g.boundsForDisplay(screen1080, ROWS, ANCHOR);
  const band = g.pillBand(screen1080, ROWS, ANCHOR);
  const y = Math.round((band.top + band.bottom) / 2);
  assert.strictEqual(g.insideKeepAlive({ x: 900, y }, b, ROWS, screen1080), false, 'too far left');
  assert.strictEqual(g.insideKeepAlive({ x: 1900, y: band.top - 120 }, b, ROWS, screen1080), false, 'too high');
  assert.strictEqual(g.insideKeepAlive({ x: 1900, y: band.bottom + 120 }, b, ROWS, screen1080), false, 'too low');
});

test('the keep-alive area contains the trigger strip', () => {
  const b = g.boundsForDisplay(screen1080, ROWS, ANCHOR);
  const band = g.pillBand(screen1080, ROWS, ANCHOR);
  for (let y = band.top; y <= band.bottom; y += 7) {
    const c = { x: 1919, y };
    if (g.inHotZone(c, screen1080, ROWS, ANCHOR)) {
      assert.ok(g.insideKeepAlive(c, b, ROWS, screen1080), `would flicker at y=${y}`);
    }
  }
});

test('the keep-alive area contains the trigger strip, at any ring count', () => {
  for (const rows of [1, 3, 5, 6]) {
    const b = g.boundsForDisplay(screen1080, rows, ANCHOR);
    const band = g.pillBand(screen1080, rows, ANCHOR);
    for (let y = band.top; y <= band.bottom; y += 5) {
      const c = { x: 1919, y };
      if (g.inHotZone(c, screen1080, rows, ANCHOR)) {
        assert.ok(g.insideKeepAlive(c, b, rows, screen1080), `would flicker with ${rows} rings, y=${y}`);
      }
    }
  }
});


// --- Multi-monitor -----------------------------------------------------------

const D = (id, x, width = 1920, height = 1080) =>
  ({ id, bounds: { x, y: 0, width, height } });

test('following the mouse picks the screen under the pointer', () => {
  const displays = [D(1, 0), D(2, 1920)];
  const chosen = g.pickDisplay({
    displays, primaryId: 1, cursorPoint: { x: 2500, y: 400 }, follow: true
  });
  assert.strictEqual(chosen.id, 2);
});

test('following the mouse ignores a screen whose right edge is a seam', () => {
  const displays = [D(1, 0), D(2, 1920)];
  const chosen = g.pickDisplay({
    displays, primaryId: 1, cursorPoint: { x: 900, y: 400 }, follow: true
  });
  assert.strictEqual(chosen, null, 'moving there would put the pill mid-desktop');
});

test('a chosen display is honoured when it is plugged in', () => {
  const displays = [D(1, 0), D(2, 1920)];
  const chosen = g.pickDisplay({
    displays, primaryId: 1, cursorPoint: null, follow: false, preferredId: '2'
  });
  assert.strictEqual(chosen.id, 2);
});

test('a chosen display that was unplugged falls back to the primary', () => {
  const displays = [D(1, 0)];
  const chosen = g.pickDisplay({
    displays, primaryId: 1, cursorPoint: null, follow: false, preferredId: '99'
  });
  assert.strictEqual(chosen.id, 1,
    'a widget pinned to a missing screen would be drawn off the desktop');
});

test('primary means primary, whatever order the screens come in', () => {
  const displays = [D(7, 1920), D(3, 0)];
  const chosen = g.pickDisplay({
    displays, primaryId: 3, cursorPoint: null, follow: false, preferredId: 'primary'
  });
  assert.strictEqual(chosen.id, 3);
});

test('no displays at all returns nothing rather than throwing', () => {
  assert.strictEqual(g.pickDisplay({ displays: [], primaryId: 1, follow: false }), null);
});

test('a vertically stacked pair both count as outer right edges', () => {
  const top = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } };
  const bottom = { id: 2, bounds: { x: 0, y: 1080, width: 1920, height: 1080 } };
  for (const d of [top, bottom]) {
    const chosen = g.pickDisplay({
      displays: [top, bottom], primaryId: 1, follow: true,
      cursorPoint: { x: 1900, y: d.bounds.y + 500 }
    });
    assert.strictEqual(chosen.id, d.id);
  }
});

test('screens of different resolutions each get their own layout', () => {
  const big = { x: 0, y: 0, width: 3840, height: 2160 };
  const small = { x: 0, y: 0, width: 1280, height: 800 };
  const a = g.boundsForDisplay(big, 5, 0.45);
  const b = g.boundsForDisplay(small, 5, 0.45);
  assert.strictEqual(a.x + a.width, big.width);
  assert.strictEqual(b.x + b.width, small.width);
  assert.ok(b.y + b.height <= small.height, 'the small screen would overflow');
});

console.log(`\n${passed} geometry tests passed`);
