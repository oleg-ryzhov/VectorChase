import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vehicle, CAR } from '../src/physics/vehicle.js';
import { resetAll, setParam } from '../src/config/registry.js';

const DT = 1 / 120;
const NONE = { forward: false, back: false, left: false, right: false };
const FORWARD = { ...NONE, forward: true };

function run(car, seconds, controls) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) car.step(DT, controls);
}

function rolling(speed, gear) {
  const car = new Vehicle();
  car.u = speed;
  car.gear = gear;
  car.wheelSpeed.fill(speed / CAR.wheelRadius);
  return car;
}

test('car at rest with no input stays at rest', () => {
  resetAll();
  const car = new Vehicle({ x: 5, z: 7, yaw: 1 });
  run(car, 2, NONE);
  assert.ok(Math.abs(car.u) < 1e-9 && Math.abs(car.v) < 1e-9 && Math.abs(car.r) < 1e-9);
  assert.equal(car.x, 5);
  assert.equal(car.z, 7);
});

test('full throttle accelerates in a straight line and shifts up', () => {
  resetAll();
  const car = new Vehicle();
  run(car, 5, FORWARD);
  assert.ok(car.u > 18 && car.u < 45, `speed ${car.u}`);
  assert.ok(car.gear > 1);
  assert.ok(Math.abs(car.v) < 0.05 && Math.abs(car.yaw) < 1e-3);
  assert.ok(car.x > 40);
});

test('braking from 30 m/s stops in a realistic time and distance', () => {
  resetAll();
  const car = rolling(30, 4);
  let t = 0;
  while (car.u > 1 && t < 8) {
    car.step(DT, { ...NONE, back: true });
    t += DT;
  }
  assert.ok(t > 2 && t < 5, `time ${t}`);
  assert.ok(car.x > 35 && car.x < 75, `distance ${car.x}`);
});

test('steering right turns right, and left mirrors it exactly', () => {
  resetAll();
  const right = rolling(20, 3);
  const left = rolling(20, 3);
  run(right, 2, { ...FORWARD, right: true });
  run(left, 2, { ...FORWARD, left: true });
  assert.ok(right.yaw > 0.3 && right.yaw < 2.2, `yaw ${right.yaw}`);
  assert.ok(Math.abs(right.yaw + left.yaw) < 1e-6);
  assert.ok(Math.abs(right.z + left.z) < 1e-6);
  assert.ok(right.z > 0);
});

test('a heavier car accelerates more slowly', () => {
  resetAll();
  const light = new Vehicle();
  run(light, 8, FORWARD);
  setParam('chassis.mass', 2000);
  const heavy = new Vehicle();
  run(heavy, 8, FORWARD);
  resetAll();
  assert.ok(heavy.u < light.u, `heavy ${heavy.u} light ${light.u}`);
});

test('physics stays finite under random input', () => {
  resetAll();
  const car = new Vehicle();
  let seed = 12345;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  let controls = NONE;
  for (let i = 0; i < 120 * 30; i++) {
    if (i % 24 === 0) {
      controls = { forward: rnd() < 0.6, back: rnd() < 0.2, left: rnd() < 0.3, right: rnd() < 0.3 };
    }
    car.step(DT, controls);
    assert.ok(Number.isFinite(car.x + car.z + car.yaw + car.u + car.v + car.r));
  }
  assert.ok(Math.abs(car.u) < 100);
});