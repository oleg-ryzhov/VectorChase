import { test } from 'node:test';
import assert from 'node:assert/strict';
import { padSteer } from '../src/ui/touchControls.js';
import { MAPS } from '../src/maps/index.js';
import { prepareMap } from '../src/maps/prepare.js';
import { Vehicle } from '../src/physics/vehicle.js';

test('padSteer: centre is straight, edges are full lock, and it is symmetric and monotonic', () => {
  assert.equal(padSteer(200, 100, 200), 0); // centre of a pad at x 100..300
  assert.equal(padSteer(100, 100, 200), -1);
  assert.equal(padSteer(300, 100, 200), 1);
  assert.equal(padSteer(-50, 100, 200), -1); // beyond the pad still clamps
  assert.ok(Math.abs(padSteer(230, 100, 200) + padSteer(170, 100, 200)) < 1e-12);
  let last = -2;
  for (let x = 100; x <= 300; x += 5) {
    const v = padSteer(x, 100, 200);
    assert.ok(v >= last, `not monotonic at ${x}`);
    last = v;
  }
});

test('a car follows the exact steering value together with key throttle', () => {
  const { world } = prepareMap(MAPS.find((m) => m.id === 'monza').build());
  const make = () => new Vehicle({ x: 0, z: 0, yaw: 0, y: world.groundHeight(0, 0), ground: world });
  const half = make();
  const full = make();
  const keys = make();
  for (let i = 0; i < 360; i++) {
    half.step(1 / 120, { forward: true, back: false, left: false, right: false, steer: 0.4 });
    full.step(1 / 120, { forward: true, back: false, left: false, right: false, steer: 1 });
    keys.step(1 / 120, { forward: true, back: false, left: false, right: true, steer: undefined });
  }
  assert.ok(half.steerInput > 0.35 && half.steerInput < 0.45, `half ${half.steerInput}`);
  assert.ok(full.steerInput > 0.95);
  assert.ok(keys.steerInput > 0.95, 'keys still steer when no touch value is given');
  assert.ok(half.u > 1, 'digital throttle still drives the car');
});
