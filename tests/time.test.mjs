import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FixedStepper } from '../src/core/time.js';

test('60 fps frame at 120 Hz step gives 2 steps', () => {
  const s = new FixedStepper(1 / 120, 8);
  const { steps } = s.update(1 / 60);
  assert.equal(steps, 2);
});

test('timeScale 0.25 gives fewer steps', () => {
  const s = new FixedStepper(1 / 120, 8);
  s.timeScale = 0.25;
  const { steps, alpha } = s.update(1 / 60);
  assert.equal(steps, 0);
  assert.ok(Math.abs(alpha - 0.5) < 1e-9);
});

test('timeScale 0 pauses simulation', () => {
  const s = new FixedStepper(1 / 120, 8);
  s.timeScale = 0;
  assert.equal(s.update(1 / 60).steps, 0);
  assert.equal(s.update(1 / 60).steps, 0);
});

test('huge frame gaps are clamped and capped', () => {
  const s = new FixedStepper(1 / 120, 8);
  const { steps } = s.update(10);
  assert.equal(steps, 8);
  assert.equal(s.accumulator, 0);
});

test('negative time scale is treated as 0', () => {
  const s = new FixedStepper(1 / 120, 8);
  s.timeScale = -1;
  assert.equal(s.update(1 / 60).steps, 0);
});