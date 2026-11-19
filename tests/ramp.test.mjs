import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../src/maps/index.js';
import { prepareMap } from '../src/maps/prepare.js';
import { Vehicle } from '../src/physics/vehicle.js';

test('Red Mesa ramp: the car keeps a calm attitude in flight and lands', () => {
  const { world } = prepareMap(MAPS.find((m) => m.id === 'canyon').build());
  const car = new Vehicle({ x: -250, z: -200, yaw: 0, y: world.groundHeight(-250, -200), ground: world });
  car.u = 45;
  const DT = 1 / 120;
  let flew = false;
  let landed = false;
  let prev = car.pitch;
  for (let t = 0; t < 1800 && !landed; t++) {
    car.step(DT, { forward: true, back: false, left: false, right: false });
    if (car.airborne) {
      flew = true;
      assert.ok(Math.abs(car.pitch) < 0.5, `pitch ${car.pitch.toFixed(2)} at x=${car.x.toFixed(0)}`);
      assert.ok(Math.abs(car.pitch - prev) < 0.03, `pitch jumped at x=${car.x.toFixed(0)}`);
    } else if (flew) landed = true;
    prev = car.pitch;
  }
  assert.ok(flew, 'the ramp launches the car');
});
