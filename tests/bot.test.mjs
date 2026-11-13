import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/track/track.js';
import { CONTROL_POINTS, TRACK_OPTIONS, baseHeight } from '../src/track/trackData.js';
import { createWorld } from '../src/track/world.js';
import { TrackTracker } from '../src/track/tracker.js';
import { Vehicle } from '../src/physics/vehicle.js';
import { readCarSpec } from '../src/physics/spec.js';
import { BotDriver } from '../src/ai/bot.js';
import { resetAll, setParam } from '../src/config/registry.js';

const DT = 1 / 120;
const track = buildTrack(CONTROL_POINTS, TRACK_OPTIONS);
const world = createWorld(track, baseHeight);

// Drives one lap from a standing start on the line.
function driveLap(friction, difficulty = 'medium') {
  resetAll();
  setParam('tire.friction', friction);
  const start = track.points[0];
  const car = new Vehicle({ x: start.x, z: start.z, yaw: Math.atan2(start.tz, start.tx), ground: world });
  const tracker = new TrackTracker(track);
  tracker.setProgress(0);
  const driver = new BotDriver({ difficulty });

  let time = 0;
  let maxOffset = 0;
  while (tracker.total < track.length && time < 500) {
    car.step(DT, driver.drive(car, tracker, readCarSpec()));
    tracker.update(car.x, car.z);
    maxOffset = Math.max(maxOffset, tracker.dist);
    time += DT;
  }
  resetAll();
  return { finished: tracker.total >= track.length, time, maxOffset, recoveries: car.recoveries };
}

for (const [difficulty, friction] of [
  ['easy', 1.0],
  ['medium', 1.0],
  ['hard', 1.0],
  ['medium', 0.5],
  ['medium', 1.5],
]) {
  test(`a ${difficulty} bot completes a lap and stays on the road with friction ${friction}`, () => {
    const r = driveLap(friction, difficulty);
    assert.ok(r.finished, `did not finish a lap in ${r.time.toFixed(0)} s`);
    assert.ok(r.maxOffset < 14, `strayed ${r.maxOffset.toFixed(1)} m from the centre line`);
    assert.equal(r.recoveries, 0);
  });
}
