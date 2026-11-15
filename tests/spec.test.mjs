import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCarSpec, WHEELBASE } from '../src/physics/spec.js';
import { resetAll, setParam } from '../src/config/registry.js';

const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

test('default spec matches the original hard-coded car', () => {
  resetAll();
  const s = readCarSpec();
  assert.ok(close(s.cgToFront + s.cgToRear, WHEELBASE));
  assert.ok(close(s.cgToFront, 1.296, 1e-6));
  assert.ok(close(s.wheelInertia, 0.7 * 18 * 0.33 * 0.33));
  assert.ok(close(2 * (s.frontBrakeTorque + s.rearBrakeTorque), 4600, 1e-6));
  assert.ok(close(s.enginePower, 250000));
});

test('more front weight moves the centre of gravity forward', () => {
  resetAll();
  const before = readCarSpec();
  setParam('chassis.frontWeight', 58);
  const after = readCarSpec();
  assert.ok(after.cgToFront < before.cgToFront);
  assert.ok(close(after.cgToFront + after.cgToRear, WHEELBASE));
  resetAll();
});

test('wheel inertia follows wheel mass and radius', () => {
  resetAll();
  const base = readCarSpec().wheelInertia;
  setParam('wheel.mass', 30);
  assert.ok(readCarSpec().wheelInertia > base);
  resetAll();
  setParam('wheel.radius', 0.37);
  assert.ok(readCarSpec().wheelInertia > base);
  resetAll();
});

test('brake bias changes the split but not the total', () => {
  resetAll();
  setParam('brakes.bias', 50);
  const s = readCarSpec();
  assert.ok(close(s.frontBrakeTorque, s.rearBrakeTorque));
  assert.ok(close(2 * (s.frontBrakeTorque + s.rearBrakeTorque), 4600, 1e-6));
  resetAll();
});

test('upshift point is capped just below the redline', () => {
  resetAll();
  setParam('engine.redline', 6000);
  setParam('drivetrain.shiftRpm', 8800);
  assert.equal(readCarSpec().shiftRpm, 5800);
  resetAll();
});
