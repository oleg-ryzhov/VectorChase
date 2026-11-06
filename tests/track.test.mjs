import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/track/track.js';
import { CONTROL_POINTS, TRACK_OPTIONS } from '../src/track/trackData.js';

function circle(radius, count) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    pts.push({ x: radius * Math.cos(a), z: radius * Math.sin(a) });
  }
  return pts;
}

test('fewer than 4 control points throws', () => {
  assert.throws(() => buildTrack(circle(100, 3)), /at least 4/);
});

test('circle length is close to 2*pi*r', () => {
  const t = buildTrack(circle(100, 12));
  assert.ok(Math.abs(t.length - 2 * Math.PI * 100) < 6.3);
});

test('points are evenly spaced and the loop closes', () => {
  const t = buildTrack(circle(100, 12), { spacing: 2 });
  const n = t.points.length;
  for (let i = 0; i < n; i++) {
    const a = t.points[i];
    const b = t.points[(i + 1) % n];
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    assert.ok(Math.abs(d - t.spacing) < t.spacing * 0.1, `gap at ${i}: ${d}`);
  }
});

test('distance along track increases strictly', () => {
  const t = buildTrack(CONTROL_POINTS, TRACK_OPTIONS);
  for (let i = 1; i < t.points.length; i++) {
    assert.ok(t.points[i].s > t.points[i - 1].s);
  }
});

test('tangents are unit length and normals are perpendicular', () => {
  const t = buildTrack(CONTROL_POINTS, TRACK_OPTIONS);
  for (const p of t.points) {
    assert.ok(Math.abs(Math.hypot(p.tx, p.tz) - 1) < 1e-9);
    assert.ok(Math.abs(p.tx * p.nx + p.tz * p.nz) < 1e-9);
  }
});

test('a circle driven toward +z has positive (right-turn) curvature near 1/r', () => {
  const t = buildTrack(circle(100, 12));
  for (const p of t.points) {
    assert.ok(Math.abs(p.curvature - 0.01) < 0.001, `curvature ${p.curvature}`);
  }
});

test('checkpoints start at index 0 and increase', () => {
  const t = buildTrack(CONTROL_POINTS, TRACK_OPTIONS);
  assert.equal(t.checkpoints[0].index, 0);
  assert.equal(t.checkpoints.length, Math.max(1, Math.round(t.length / TRACK_OPTIONS.checkpointEvery)));
  for (let i = 1; i < t.checkpoints.length; i++) {
    assert.ok(t.checkpoints[i].index > t.checkpoints[i - 1].index);
  }
});

test('no corner is tighter than twice the half-width (road would fold)', () => {
  const t = buildTrack(CONTROL_POINTS, TRACK_OPTIONS);
  const halfWidth = TRACK_OPTIONS.width / 2;
  for (const p of t.points) {
    assert.ok(Math.abs(p.curvature) * halfWidth < 0.5, `curvature ${p.curvature} at s=${p.s}`);
  }
});