import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../src/maps/index.js';
import { prepareMap } from '../src/maps/prepare.js';
import { Vehicle } from '../src/physics/vehicle.js';
import { TrackTracker } from '../src/track/tracker.js';
import { readCarSpec } from '../src/physics/spec.js';
import { BotDriver } from '../src/ai/bot.js';
import { resolveCollisions } from '../src/physics/collisions.js';

test('the road through the city tower is open, and the building beside it is still solid', () => {
  const { world } = prepareMap(MAPS.find((m) => m.id === 'city').build());
  assert.equal(world.solid(150, 300, 0, 0.95), null, 'the archway at ground level');
  assert.ok(world.solid(150, 270, 0, 0.95), 'the tower beside the road');
  assert.ok(world.solid(150, 330, 0, 0.95), 'the tower on the other side');
  assert.ok(world.solid(150, 300, 9, 0.95), 'the part of the tower above the arch');
});

test('a bot drives a whole city lap with collisions on, through the tower and without getting stuck', () => {
  const { track, world } = prepareMap(MAPS.find((m) => m.id === 'city').build());
  const start = track.points[0];
  const car = new Vehicle({ x: start.x, z: start.z, yaw: Math.atan2(start.tz, start.tx), y: start.y, ground: world });
  const tracker = new TrackTracker(track);
  tracker.setProgress(0);
  const driver = new BotDriver({ difficulty: 'hard' });
  const spec = readCarSpec();
  let time = 0;
  let still = 0;
  while (tracker.total < track.length && time < 300) {
    car.step(1 / 120, driver.drive(car, tracker, spec));
    resolveCollisions([car], world, spec);
    tracker.update(car.x, car.z, car.y, !car.airborne);
    still = car.u < 0.5 && time > 10 ? still + 1 / 120 : 0;
    assert.ok(still < 5, `stuck at ${tracker.s.toFixed(0)} m, position ${car.x.toFixed(0)}, ${car.z.toFixed(0)}`);
    time += 1 / 120;
  }
  assert.ok(tracker.total >= track.length, `only reached ${((tracker.total / track.length) * 100).toFixed(0)}%`);
});
