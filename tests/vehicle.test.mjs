import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vehicle } from '../src/physics/vehicle.js';
import { readCarSpec } from '../src/physics/spec.js';
import { PARAMS, resetAll, setParam } from '../src/config/registry.js';

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
  car.wheelSpeed.fill(speed / readCarSpec().wheelRadius);
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

test('a parameter changed mid-run takes effect on the next step (friction)', () => {
  function drive(changeFriction) {
    resetAll();
    const car = rolling(20, 3);
    run(car, 1, FORWARD);
    if (changeFriction) setParam('tire.friction', 0.4);
    run(car, 2, { ...FORWARD, right: true });
    resetAll();
    return car;
  }
  const grippy = drive(false);
  const slippery = drive(true);
  // A slippery car spins as much or more, but its direction of travel turns far less.
  const course = (c) => c.yaw + Math.atan2(c.v, c.u);
  assert.ok(course(slippery) < course(grippy) - 0.1, `slippery ${course(slippery)} grippy ${course(grippy)}`);
});

test('lower engine power gives slower acceleration', () => {
  resetAll();
  const strong = new Vehicle();
  run(strong, 8, FORWARD);
  setParam('engine.power', 100);
  const weak = new Vehicle();
  run(weak, 8, FORWARD);
  resetAll();
  assert.ok(weak.u < strong.u, `weak ${weak.u} strong ${strong.u}`);
});

function randomDrive(car, seconds, seed) {
  let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  let controls = NONE;
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    if (i % 24 === 0) {
      controls = { forward: rnd() < 0.6, back: rnd() < 0.2, left: rnd() < 0.3, right: rnd() < 0.3 };
    }
    car.step(DT, controls);
  }
}

for (const [name, pick] of [
  ['all minimum', (p) => p.min],
  ['all maximum', (p) => p.max],
  ['alternating', (p, i) => (i % 2 ? p.min : p.max)],
]) {
  test(`physics stays stable with ${name} parameter values`, () => {
    resetAll();
    PARAMS.forEach((p, i) => setParam(p.id, pick(p, i)));
    const car = rolling(10, 2);
    randomDrive(car, 20, 777);
    resetAll();
    assert.equal(car.recoveries, 0);
    assert.ok(Number.isFinite(car.x + car.z + car.yaw + car.u + car.v + car.r));
    assert.ok(Math.abs(car.u) < 300, `speed ${car.u}`);
  });
}

test('gravity slows the car uphill and speeds it up downhill', () => {
  resetAll();
  const drive = (grade) => {
    const car = new Vehicle({ ground: { groundHeight: (x) => grade * x } });
    run(car, 5, FORWARD);
    return car.u;
  };
  const flat = drive(0);
  const up = drive(0.1);
  const down = drive(-0.1);
  assert.ok(up < flat && flat < down, `up ${up} flat ${flat} down ${down}`);
});

test('the car reads height, pitch and roll from the ground', () => {
  resetAll();
  const spec = readCarSpec();
  const ramp = new Vehicle({ ground: { groundHeight: (x) => 0.1 * x } });
  assert.ok(Math.abs(ramp.pitch - Math.atan(0.1)) < 1e-9);
  assert.ok(Math.abs(ramp.y - 0.05 * (spec.cgToFront - spec.cgToRear)) < 1e-9);

  // Ground rising to the right: the right side is higher, so roll is negative.
  const camber = new Vehicle({ ground: { groundHeight: (x, z) => 0.05 * z } });
  assert.ok(Math.abs(camber.roll + Math.atan(0.05)) < 1e-9);
  assert.ok(Math.abs(camber.pitch) < 1e-9);
});

test('analog controls work like pedals and a steering wheel', () => {
  resetAll();
  const car = new Vehicle();
  run(car, 3, { analog: true, throttle: 1, brake: 0, steer: 0 });
  assert.ok(car.u > 8, `speed ${car.u}`);
  const fast = car.u;
  run(car, 1, { analog: true, throttle: 0, brake: 1, steer: 0 });
  assert.ok(car.u < fast);

  const turning = rolling(15, 3);
  run(turning, 2, { analog: true, throttle: 0.3, brake: 0, steer: 1 });
  assert.ok(turning.yaw > 0.2, `yaw ${turning.yaw}`);
});

test('reset puts the car at a new place, standing still', () => {
  resetAll();
  const car = rolling(20, 3);
  run(car, 0.5, FORWARD);
  car.reset(100, 200, 1.5);
  assert.equal(car.x, 100);
  assert.equal(car.z, 200);
  assert.equal(car.yaw, 1.5);
  assert.equal(car.u, 0);
  assert.ok(car.wheelSpeed.every((w) => w === 0));
  assert.equal(car.prev.x, 100);
  assert.equal(car.gear, 1);
});

test('grass gives less grip and more drag than tarmac', () => {
  resetAll();
  const grass = { groundHeight: () => 0, sample: () => ({ height: 0, grip: 0.55, drag: 4 }) };
  const road = new Vehicle();
  const onGrass = new Vehicle({ ground: grass });
  run(road, 5, FORWARD);
  run(onGrass, 5, FORWARD);
  assert.ok(onGrass.u < road.u, `grass ${onGrass.u} road ${road.u}`);

  const turnRoad = rolling(20, 3);
  const turnGrass = new Vehicle({ ground: grass });
  turnGrass.u = 20;
  turnGrass.gear = 3;
  turnGrass.wheelSpeed.fill(20 / readCarSpec().wheelRadius);
  run(turnRoad, 2, { ...FORWARD, right: true });
  run(turnGrass, 2, { ...FORWARD, right: true });
  assert.ok(turnGrass.yaw < turnRoad.yaw, `grass ${turnGrass.yaw} road ${turnRoad.yaw}`);
});

test('tire slip is low when cruising and high when sliding sideways', () => {
  resetAll();
  const cruising = rolling(20, 3);
  run(cruising, 0.5, NONE);
  assert.ok(cruising.wheelSlip.every((s) => Number.isFinite(s) && s < 0.5), `slip ${cruising.wheelSlip}`);

  const sliding = rolling(20, 3);
  sliding.v = 6; // moving sideways at 6 m/s
  run(sliding, 0.1, NONE);
  assert.ok(Math.max(...sliding.wheelSlip) > 0.8, `slip ${sliding.wheelSlip}`);
});
