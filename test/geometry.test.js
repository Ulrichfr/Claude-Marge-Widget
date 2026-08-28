'use strict';
/* Tests des regles de survol. Sans pointeur reel, c'est ici que se verifie le
   comportement "apparait au bord droit, disparait quand on s'en va". */

const assert = require('assert');
const g = require('../src/geometry');

const screen1080 = { x: 0, y: 0, width: 1920, height: 1080 };
const ANCHOR = 0.45;
const ROWS = 3;
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };

test('la fenetre est collee au bord droit', () => {
  const b = g.boundsForDisplay(screen1080, ROWS, ANCHOR);
  assert.strictEqual(b.x + b.width, screen1080.width);
  assert.strictEqual(b.width, g.G.windowWidth);
});

test('la fenetre reste entierement dans l ecran, meme tres haute', () => {
  const small = { x: 0, y: 0, width: 1280, height: 620 };
  for (const rows of [1, 2, 3, 4, 5, 6, 8]) {
    for (const anchor of [0, 0.45, 1]) {
      const b = g.boundsForDisplay(small, rows, anchor);
      assert.ok(b.y >= small.y, `depasse en haut (${rows} anneaux, ancre ${anchor})`);
      assert.ok(b.y + b.height <= small.y + small.height,
        `depasse en bas (${rows} anneaux, ancre ${anchor})`);
    }
  }
});

test('la hauteur suit le nombre de modeles', () => {
  const a = g.layout(screen1080, 3);
  const b = g.layout(screen1080, 4);
  assert.ok(b.pillHeight > a.pillHeight);
  assert.strictEqual(b.pillHeight - a.pillHeight, a.ring + g.G.ringToLabel + a.label + a.rowGap);
});

test('la disposition se resserre plutot que de deborder', () => {
  const petit = { x: 0, y: 0, width: 1280, height: 620 };
  const large = g.layout(screen1080, 3);
  const serre = g.layout(petit, 6);
  assert.ok(serre.windowHeight <= petit.height, 'ne tient pas dans l ecran');
  assert.ok(serre.ring < large.ring || serre.rowGap < large.rowGap, 'aucun resserrement');
});

test('six quotas tiennent sur un 1080p sans se resserrer', () => {
  const m = g.layout(screen1080, 6);
  assert.strictEqual(m.ring, 60);
  assert.ok(m.windowHeight <= screen1080.height);
});

test('le curseur colle au bord droit, a hauteur de pilule, declenche', () => {
  const band = g.pillBand(screen1080, ROWS, ANCHOR);
  const middle = { x: 1919, y: Math.round((band.top + band.bottom) / 2) };
  assert.ok(g.inHotZone(middle, screen1080, ROWS, ANCHOR));
});

test('le meme curseur 30 px plus a gauche ne declenche pas', () => {
  const band = g.pillBand(screen1080, ROWS, ANCHOR);
  const near = { x: 1920 - 30, y: Math.round((band.top + band.bottom) / 2) };
  assert.strictEqual(g.inHotZone(near, screen1080, ROWS, ANCHOR), false);
});

test('le bord droit en haut ou en bas de l ecran ne declenche pas', () => {
  assert.strictEqual(g.inHotZone({ x: 1919, y: 4 }, screen1080, ROWS, ANCHOR), false);
  assert.strictEqual(g.inHotZone({ x: 1919, y: 1076 }, screen1080, ROWS, ANCHOR), false);
});

test('un ecran a droite d un autre n est pas un bord declencheur', () => {
  const left = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } };
  const right = { id: 2, bounds: { x: 1920, y: 0, width: 1920, height: 1080 } };
  const all = [left, right];
  assert.strictEqual(g.isOuterRightEdge(left, all), false, 'le bord interieur declenche a tort');
  assert.strictEqual(g.isOuterRightEdge(right, all), true, 'le vrai bord droit ne declenche pas');
});

test('deux ecrans empiles verticalement gardent chacun leur bord droit', () => {
  const top = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } };
  const bottom = { id: 2, bounds: { x: 0, y: 1080, width: 1920, height: 1080 } };
  const all = [top, bottom];
  assert.strictEqual(g.isOuterRightEdge(top, all), true);
  assert.strictEqual(g.isOuterRightEdge(bottom, all), true);
});

test('le widget ouvert survit au trajet du curseur vers la bulle', () => {
  const b = g.boundsForDisplay(screen1080, ROWS, ANCHOR);
  const band = g.pillBand(screen1080, ROWS, ANCHOR);
  const y = Math.round((band.top + band.bottom) / 2);
  assert.ok(g.insideKeepAlive({ x: 1918, y }, b, ROWS, screen1080), 'sur la pilule');
  assert.ok(g.insideKeepAlive({ x: 1500, y }, b, ROWS, screen1080), 'sur la bulle');
});

test('le widget se referme quand le curseur part vraiment', () => {
  const b = g.boundsForDisplay(screen1080, ROWS, ANCHOR);
  const band = g.pillBand(screen1080, ROWS, ANCHOR);
  const y = Math.round((band.top + band.bottom) / 2);
  assert.strictEqual(g.insideKeepAlive({ x: 900, y }, b, ROWS, screen1080), false, 'trop a gauche');
  assert.strictEqual(g.insideKeepAlive({ x: 1900, y: band.top - 120 }, b, ROWS, screen1080), false, 'trop haut');
  assert.strictEqual(g.insideKeepAlive({ x: 1900, y: band.bottom + 120 }, b, ROWS, screen1080), false, 'trop bas');
});

test('la zone de survie englobe la zone declencheuse', () => {
  const b = g.boundsForDisplay(screen1080, ROWS, ANCHOR);
  const band = g.pillBand(screen1080, ROWS, ANCHOR);
  for (let y = band.top; y <= band.bottom; y += 7) {
    const c = { x: 1919, y };
    if (g.inHotZone(c, screen1080, ROWS, ANCHOR)) {
      assert.ok(g.insideKeepAlive(c, b, ROWS, screen1080), `clignoterait a y=${y}`);
    }
  }
});

test('la zone de survie englobe la zone declencheuse, quel que soit le nombre d anneaux', () => {
  for (const rows of [1, 3, 5, 6]) {
    const b = g.boundsForDisplay(screen1080, rows, ANCHOR);
    const band = g.pillBand(screen1080, rows, ANCHOR);
    for (let y = band.top; y <= band.bottom; y += 5) {
      const c = { x: 1919, y };
      if (g.inHotZone(c, screen1080, rows, ANCHOR)) {
        assert.ok(g.insideKeepAlive(c, b, rows, screen1080), `clignoterait a ${rows} anneaux, y=${y}`);
      }
    }
  }
});

console.log(`\n${passed} tests de geometrie passes`);
