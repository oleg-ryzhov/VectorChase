import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/track/track.js';
import { CONTROL_POINTS, TRACK_OPTIONS } from './fixtureTrack.js';
import { TrackTracker } from '../src/track/tracker.js';

const track = buildTrack(CONTROL_POINTS, TRACK_OPTIONS);

// The track point at a distance along the lap (wraps around).
function at(s) {
  const m = ((s % track.length) + track.length) % track.length;
  return track.points[Math.round(m / track.spacing) % track.points.length];
}

test('driving a lap from behind the line adds up to the lap length', () => {
  const t = new TrackTracker(track);
  t.setProgress(-12);
  assert.equal(t.lap, -1);
  for (let s = -12; s <= track.length + 12; s += 2) {
    const p = at(s);
    t.update(p.x, p.z);
    assert.ok(Math.abs(t.total - s) < 3, `at ${s} the tracker says ${t.total}`);
  }
  assert.equal(t.lap, 1);
});

test('driving backwards over the line takes a lap off', () => {
  const t = new TrackTracker(track);
  t.setProgress(10);
  for (let s = 10; s >= -10; s -= 2) {
    const p = at(s);
    t.update(p.x, p.z);
  }
  assert.equal(t.lap, -1);
  assert.ok(Math.abs(t.total + 10) < 3);
});

test('progress stops counting when far from the road and resumes on return', () => {
  const t = new TrackTracker(track);
  t.setProgress(500);
  const p = at(500);
  t.update(p.x, p.z);
  const before = t.total;
  t.update(p.x + p.nx * 60, p.z + p.nz * 60);
  assert.equal(t.offTrack, true);
  assert.equal(t.total, before);
  t.update(p.x + p.nx * 3, p.z + p.nz * 3);
  assert.equal(t.offTrack, false);
});

test('a shortcut gives the far end progress only to a grounded car that left the road near its start', () => {
  const control = Array.from({ length: 24 }, (_, i) => ({ x: 200 * Math.cos((i / 24) * 2 * Math.PI), y: 0, z: 200 * Math.sin((i / 24) * 2 * Math.PI) }));
  const track = buildTrack(control, { spacing: 3, width: 12, checkpointEvery: 100 });
  const to = track.points[Math.round(track.points.length / 2)];
  track.shortcuts = [{ fromS: 100, toS: to.s, toIndex: Math.round(track.points.length / 2), armBefore: 40, armAfter: 80, reach: 9, window: 12 }];
  const near = (i) => track.points[i];

  const armed = new TrackTracker(track);
  armed.setProgress(110);
  armed.update(to.x, to.z, to.y, false); // still flying
  assert.ok(Math.abs(armed.s - 110) < 1);
  armed.update(to.x, to.z, to.y, true);
  assert.ok(Math.abs(armed.s - to.s) < 1e-6);

  const early = new TrackTracker(track); // never went near the takeoff
  early.setProgress(1000);
  early.update(to.x, to.z, to.y, true);
  assert.ok(Math.abs(early.s - 1000) < 1e-6, 'unarmed: no jump');

  const off = new TrackTracker(track);
  off.setProgress(110);
  off.update(near(0).x + 80, near(0).z, 0, true); // landed somewhere else
  assert.ok(Math.abs(off.s - 110) < 1);
});
