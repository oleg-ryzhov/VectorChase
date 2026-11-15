import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/track/track.js';
import { CONTROL_POINTS, TRACK_OPTIONS } from '../src/track/trackData.js';
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
