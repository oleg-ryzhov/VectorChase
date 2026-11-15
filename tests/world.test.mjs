import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/track/track.js';
import { CONTROL_POINTS, TRACK_OPTIONS, baseHeight } from '../src/track/trackData.js';
import { createWorld } from '../src/track/world.js';

const track = buildTrack(CONTROL_POINTS, TRACK_OPTIONS);
const world = createWorld(track, baseHeight);

test('driving height on the centre line equals the road height', () => {
  for (let i = 0; i < track.points.length; i += 17) {
    const p = track.points[i];
    assert.ok(Math.abs(world.groundHeight(p.x, p.z) - p.y) < 1e-6, `point ${i}`);
  }
});

test('the whole road width is flat across', () => {
  for (let i = 0; i < track.points.length; i += 23) {
    const p = track.points[i];
    for (const side of [-7.5, 7.5]) {
      const h = world.groundHeight(p.x + p.nx * side, p.z + p.nz * side);
      assert.ok(Math.abs(h - p.y) < 0.05, `point ${i} offset ${side}: ${h} vs ${p.y}`);
    }
  }
});

test('the terrain mesh sits 0.1 m under the road', () => {
  const p = track.points[100];
  assert.ok(Math.abs(world.terrainHeight(p.x, p.z) - (p.y - 0.1)) < 1e-6);
});

test('far from the road the ground is the natural height', () => {
  const flat = createWorld(track, () => 12);
  assert.equal(flat.groundHeight(100000, 100000), 12);
  assert.equal(flat.terrainHeight(-100000, 5000), 12);
});

test('height changes smoothly when moving away from the road', () => {
  for (let i = 0; i < track.points.length; i += 150) {
    const p = track.points[i];
    for (const dir of [-1, 1]) {
      let last = world.groundHeight(p.x, p.z);
      for (let d = 0.05; d <= 100; d += 0.05) {
        const h = world.groundHeight(p.x + p.nx * d * dir, p.z + p.nz * d * dir);
        assert.ok(Math.abs(h - last) < 0.1, `jump of ${h - last} at point ${i}, ${d} m out`);
        last = h;
      }
    }
  }
});

test('grass is less grippy than the road', () => {
  const p = track.points[200];
  assert.equal(world.sample(p.x, p.z).grip, 1);
  const off = world.sample(p.x + p.nx * 20, p.z + p.nz * 20);
  assert.ok(Math.abs(off.grip - 0.55) < 1e-9);
  assert.ok(off.drag > 1);
  assert.ok(Math.abs(world.sample(1e5, 1e5).grip - 0.55) < 1e-9);
});

test('lateral gives the signed distance from the centre line and the wall position', () => {
  const p = track.points[300];
  assert.ok(Math.abs(world.wallOffset - 8.3) < 1e-9);
  const right = world.lateral(p.x + p.nx * 5, p.z + p.nz * 5);
  const left = world.lateral(p.x - p.nx * 5, p.z - p.nz * 5);
  assert.ok(Math.abs(right.offset - 5) < 0.05, `right offset ${right.offset}`);
  assert.ok(Math.abs(left.offset + 5) < 0.05, `left offset ${left.offset}`);
  assert.ok(Math.abs(right.nx - p.nx) < 0.02 && Math.abs(right.nz - p.nz) < 0.02);
  assert.equal(world.lateral(1e5, 1e5), null);
});
