import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ParticlePool } from '../src/effects/particlePool.js';
import { SkidBuffer } from '../src/effects/skidBuffer.js';

const close = (a, b, tol = 1e-4) => Math.abs(a - b) < tol;
const puff = { x: 0, y: 0, z: 0, vx: 2, life: 1, startSize: 1, endSize: 3, alpha: 0.8 };

test('a particle grows, fades and moves, then expires', () => {
  const pool = new ParticlePool(4);
  pool.emit({ ...puff, lift: -10 });
  assert.equal(pool.activeCount, 1);
  pool.update(0.5);
  assert.ok(close(pool.size[0], 2));
  assert.ok(close(pool.alpha[0], 0.4));
  assert.ok(close(pool.position[0], 1)); // 2 m/s for 0.5 s
  assert.ok(close(pool.position[1], -2.5)); // lift of -10 m/s^2 for 0.5 s
  pool.update(0.6);
  assert.equal(pool.activeCount, 0);
  assert.equal(pool.alpha[0], 0);
  assert.equal(pool.size[0], 0);
});

test('a full pool overwrites its oldest particle', () => {
  const pool = new ParticlePool(2);
  pool.emit({ ...puff, x: 1 });
  pool.emit({ ...puff, x: 2 });
  pool.emit({ ...puff, x: 3 });
  assert.equal(pool.activeCount, 2);
  assert.ok(close(pool.position[0], 3)); // slot 0 was reused
  assert.ok(close(pool.position[3], 2));
  pool.clear();
  assert.equal(pool.activeCount, 0);
});

test('skid marks need two points and are drawn across the direction of travel', () => {
  const skid = new SkidBuffer(10, 0.22);
  skid.add('a', 0, 1, 0);
  assert.equal(skid.count, 0);
  skid.add('a', 1, 1, 0);
  assert.equal(skid.count, 1);
  const p = skid.positions;
  assert.ok(close(p[2], 0.11) && close(p[5], -0.11)); // start edge, either side of the line
  assert.ok(close(p[6], 1) && close(p[8], 0.11)); // end edge
  assert.ok(close(p[1], 1)); // height is kept
});

test('tiny moves are skipped and long jumps start a new line', () => {
  const skid = new SkidBuffer(10);
  skid.add('a', 0, 0, 0);
  skid.add('a', 0.1, 0, 0);
  assert.equal(skid.count, 0);
  skid.add('a', 0.5, 0, 0);
  assert.equal(skid.count, 1);
  skid.add('a', 50, 0, 0); // a respawn, not a skid
  assert.equal(skid.count, 1);
  skid.add('a', 50.5, 0, 0);
  assert.equal(skid.count, 2);
});

test('ending a line stops the next mark from joining it', () => {
  const skid = new SkidBuffer(10);
  skid.add('a', 0, 0, 0);
  skid.add('a', 1, 0, 0);
  skid.end('a');
  skid.add('a', 2, 0, 0);
  assert.equal(skid.count, 1);
  skid.add('a', 3, 0, 0);
  assert.equal(skid.count, 2);
});

test('wheels have separate lines and the buffer wraps', () => {
  const skid = new SkidBuffer(2);
  skid.add('a', 0, 0, 0);
  skid.add('b', 0, 0, 5);
  skid.add('a', 1, 0, 0);
  skid.add('b', 1, 0, 5);
  assert.equal(skid.count, 2);
  skid.add('a', 2, 0, 0);
  assert.equal(skid.count, 2);
  assert.equal(skid.next, 1);
  skid.clear();
  assert.equal(skid.count, 0);
});
