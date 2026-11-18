import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GhostRecorder, ghostPose, ghostTimeAt, loadGhost, saveGhost, deleteGhost, GHOSTS_KEY, GHOST_STEP } from '../src/race/ghost.js';

function fakeStorage() {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) };
}
const st = (x, yaw = 0) => ({ x, y: 1, z: 2, yaw, pitch: 0, roll: 0 });

test('recorder keeps one frame per step and closes the lap', () => {
  const r = new GhostRecorder();
  for (let i = 0; i <= 250; i++) r.sample(i / 120, st(i)); // 0..2.083 s
  const g = r.finish(2.1, st(999));
  assert.equal(g.ms, 2100);
  assert.equal(g.frames.length / 6, 22 + 0); // frames at 0.0..2.0 (21) plus the closing frame
  assert.equal(g.frames[g.frames.length - 6], 999);
});

test('pose interpolates, holds at the ends and turns the short way', () => {
  const g = { ms: 1000, step: GHOST_STEP, frames: [0, 0, 0, 3.1, 0, 0, 10, 0, 0, -3.1, 0, 0] };
  assert.equal(ghostPose(g, -5).x, 0);
  assert.equal(ghostPose(g, 99).x, 10);
  const mid = ghostPose(g, GHOST_STEP / 2);
  assert.equal(mid.x, 5);
  assert.ok(Math.abs(Math.abs(mid.yaw) - Math.PI) < 0.1); // through pi, not through 0
  assert.equal(ghostPose({ ms: 1, step: GHOST_STEP, frames: [0, 0, 0, 0, 0, 0] }, 0), null);
});

test('storage round trip per user and map, and bad data is ignored', () => {
  const store = fakeStorage();
  const g = { ms: 5000, step: GHOST_STEP, frames: new Array(12).fill(1) };
  assert.equal(loadGhost(store, 'Oleg', 'oval'), null);
  assert.equal(saveGhost(store, 'Oleg', 'oval', g), true);
  assert.deepEqual(loadGhost(store, 'oleg', 'oval'), g);
  assert.equal(loadGhost(store, 'Oleg', 'monza'), null);
  assert.equal(loadGhost(store, 'Other', 'oval'), null);
  store.setItem(GHOSTS_KEY, '{oops');
  assert.equal(loadGhost(store, 'Oleg', 'oval'), null);
  assert.equal(saveGhost(store, 'Oleg', 'oval', g), true); // recovers from corrupt data
  store.setItem(GHOSTS_KEY, JSON.stringify({ 'oleg|oval': { ms: 1, step: GHOST_STEP, frames: [1, 'x', 3, 4, 5, 6, 1, 2, 3, 4, 5, 6] } }));
  assert.equal(loadGhost(store, 'Oleg', 'oval'), null);
  const blocked = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(loadGhost(blocked, 'a', 'b'), null);
  assert.equal(saveGhost(blocked, 'a', 'b', g), false);
});

// Drives a lap at constant speed and records it: distance = 50 m/s * time.
function recordLap(speed, seconds, startDist = 0) {
  const r = new GhostRecorder();
  for (let t = 0; t <= seconds; t += 1 / 120) r.sample(t, st(speed * t), startDist + speed * t);
  return r.finish(seconds, st(speed * seconds), startDist + speed * seconds);
}

test('time at distance gives the live difference against the ghost', () => {
  const g = recordLap(50, 20);
  assert.equal(g.dist.length, g.frames.length / 6);
  assert.ok(Math.abs(ghostTimeAt(g, 500) - 10) < 0.1); // ghost reached 500 m after 10 s
  assert.equal(ghostTimeAt(g, -5), 0);
  assert.ok(Math.abs(ghostTimeAt(g, 99999) - (g.dist.length - 1) * g.step) < 1e-9);
  // A player at 50 m/s who is at 500 m after 10.5 s is 0.5 s behind; one at 11 s of 55 m/s... is ahead.
  assert.ok(Math.abs(10.5 - ghostTimeAt(g, 500) - 0.5) < 0.1);
  assert.ok(Math.abs(9 - ghostTimeAt(g, 500) + 1) < 0.1);
});

test('distances can start behind the line (grid start) and never go backwards', () => {
  const r = new GhostRecorder();
  const dists = [-8, -7, -7.5, -3, 0];
  dists.forEach((d, i) => r.sample(i * GHOST_STEP, st(i), d));
  const g = r.finish(1, st(9), 2);
  assert.deepEqual(g.dist, [-8, -7, -7, -3, 0, 2]);
  assert.ok(ghostTimeAt(g, -5) > GHOST_STEP && ghostTimeAt(g, -5) < 4 * GHOST_STEP);
});

test('ghosts without distances still load, and bad distances are dropped', () => {
  const store = fakeStorage();
  const old = { ms: 5000, step: GHOST_STEP, frames: new Array(12).fill(1) };
  saveGhost(store, 'Oleg', 'oval', old);
  const loaded = loadGhost(store, 'Oleg', 'oval');
  assert.equal(loaded.ms, 5000);
  assert.equal(ghostTimeAt(loaded, 10), null);
  saveGhost(store, 'Oleg', 'oval', { ...old, dist: [1, 'x'] });
  assert.equal(loadGhost(store, 'Oleg', 'oval').dist, undefined);
  saveGhost(store, 'Oleg', 'oval', { ...old, dist: [1, 2, 3] }); // wrong length
  assert.equal(loadGhost(store, 'Oleg', 'oval').dist, undefined);
});

test('start and fly slots are separate and delete removes both', () => {
  const store = fakeStorage();
  const a = recordLap(50, 5);
  const b = recordLap(40, 6);
  saveGhost(store, 'Oleg', 'oval', a, 'fly');
  saveGhost(store, 'Oleg', 'oval', b, 'start');
  assert.equal(loadGhost(store, 'Oleg', 'oval', 'fly').ms, 5000);
  assert.equal(loadGhost(store, 'Oleg', 'oval', 'start').ms, 6000);
  assert.equal(loadGhost(store, 'Oleg', 'oval').ms, 5000); // default slot is the original key
  saveGhost(store, 'Oleg', 'monza', a, 'fly');
  assert.equal(deleteGhost(store, 'oleg', 'oval'), true);
  assert.equal(loadGhost(store, 'Oleg', 'oval', 'fly'), null);
  assert.equal(loadGhost(store, 'Oleg', 'oval', 'start'), null);
  assert.equal(loadGhost(store, 'Oleg', 'monza', 'fly').ms, 5000);
  const blocked = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(deleteGhost(blocked, 'a', 'b'), false);
});
