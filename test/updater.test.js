'use strict';
/* Updating. The dangerous part is not fetching, it is what happens when the
   fetched code is broken, so the decisions worth testing are the refusals. */

const assert = require('assert');
const u = require('../src/updater');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };

const commit = (sha, message = 'A real settings window') => ({
  sha, commit: { message: message + '\n\nbody', author: { date: '2026-08-28T10:05:18Z' } }
});

test('a GitHub answer is reduced to what we display', () => {
  const r = u.parseRemote(commit('194c4ddc67d8ea5d4070db144764a290c7f00695'));
  assert.strictEqual(r.short, '194c4dd');
  assert.strictEqual(r.message, 'A real settings window', 'only the subject line should survive');
  assert.strictEqual(r.date, '2026-08-28T10:05:18Z');
});

test('a malformed answer produces nothing rather than a half object', () => {
  assert.strictEqual(u.parseRemote(null), null);
  assert.strictEqual(u.parseRemote({}), null);
  assert.strictEqual(u.parseRemote({ commit: {} }), null);
});

test('the same commit on both sides is up to date', () => {
  const remote = u.parseRemote(commit('a'.repeat(40)));
  assert.strictEqual(u.compare('a'.repeat(40), remote).state, 'up-to-date');
});

test('a different commit upstream is an available update', () => {
  const remote = u.parseRemote(commit('b'.repeat(40)));
  const result = u.compare('a'.repeat(40), remote);
  assert.strictEqual(result.state, 'available');
  assert.strictEqual(result.remote.short, 'bbbbbbb');
});

test('an unreadable local revision is unknown, never an update', () => {
  const remote = u.parseRemote(commit('b'.repeat(40)));
  assert.strictEqual(u.compare(null, remote).state, 'unknown',
    'offering to overwrite a checkout we cannot read would be worse than silence');
});

test('no answer from GitHub is unknown, not up to date', () => {
  assert.strictEqual(u.compare('a'.repeat(40), null).state, 'unknown');
});

test('a directory without git cannot update itself', () => {
  assert.strictEqual(u.isGitCheckout('/tmp'), false);
});


test('running npm needs node on the PATH, not just npm', () => {
  const built = u.pathWith('/opt/homebrew/bin/npm', '/opt/homebrew/bin/node', '/usr/bin:/bin');
  assert.strictEqual(built, '/opt/homebrew/bin:/usr/bin:/bin',
    'npm is a script with a #!/usr/bin/env node line: without node it cannot run at all');
});

test('npm and node in different places both make it onto the PATH', () => {
  const built = u.pathWith('/usr/local/bin/npm', '/home/u/.nvm/versions/node/v22/bin/node', '/usr/bin');
  assert.strictEqual(built, '/usr/local/bin:/home/u/.nvm/versions/node/v22/bin:/usr/bin');
});

test('a directory already on the PATH is not added twice', () => {
  assert.strictEqual(u.pathWith('/usr/bin/npm', '/usr/bin/node', '/usr/bin:/bin'), '/usr/bin:/bin');
});

test('a missing node still leaves a usable PATH', () => {
  assert.strictEqual(u.pathWith('/opt/homebrew/bin/npm', null, '/usr/bin'),
    '/opt/homebrew/bin:/usr/bin');
});

console.log(`\n${passed} updater tests passed`);
