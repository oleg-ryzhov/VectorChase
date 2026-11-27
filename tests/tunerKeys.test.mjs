import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SLOT_KEYS, SLOT_COUNT, isBindable, keyLabel, keyStep, stepValue } from '../src/config/tunerKeys.js';
import { PARAMS } from '../src/config/registry.js';

test('default slot keys are the number row, all bindable and distinct', () => {
  assert.equal(DEFAULT_SLOT_KEYS.length, SLOT_COUNT);
  assert.equal(new Set(DEFAULT_SLOT_KEYS).size, SLOT_COUNT);
  for (const k of DEFAULT_SLOT_KEYS) assert.ok(isBindable(k), k);
  assert.deepEqual(DEFAULT_SLOT_KEYS.map(keyLabel), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
});

test('only letters and number keys can be bound, and not the tuner key', () => {
  for (const ok of ['Digit3', 'Numpad7', 'KeyQ']) assert.ok(isBindable(ok), ok);
  for (const bad of ['KeyE', 'Escape', 'Space', 'Tab', 'ArrowUp', 'ShiftLeft', 'F5', '', null, undefined, 5]) assert.ok(!isBindable(bad), String(bad));
  assert.equal(keyLabel('Numpad4'), 'Num 4');
  assert.equal(keyLabel('KeyQ'), 'Q');
});

test('key steps are whole slider steps and cross every slider in a sensible number of presses', () => {
  for (const def of PARAMS) {
    const k = keyStep(def);
    const ratio = k / def.step;
    assert.ok(Math.abs(ratio - Math.round(ratio)) < 1e-6 && k >= def.step, def.id);
    const presses = (def.max - def.min) / k;
    assert.ok(presses >= 2 && presses <= 100, `${def.id}: ${presses}`);
  }
  const by = (id) => PARAMS.find((p) => p.id === id);
  assert.equal(keyStep(by('chassis.mass')), 60);
  assert.equal(keyStep(by('engine.power')), 20);
  assert.equal(keyStep(by('tire.friction')), 0.05);
});

test('stepValue moves by the key step, snaps to the grid, fine uses the small step, and stays in range', () => {
  const mass = PARAMS.find((p) => p.id === 'chassis.mass');
  assert.equal(stepValue(mass, 1200, 1), 1260);
  assert.equal(stepValue(mass, 1200, -1), 1140);
  assert.equal(stepValue(mass, 1200, 1, true), 1210);
  assert.equal(stepValue(mass, 3000, 1), 3000);
  assert.equal(stepValue(mass, 500, -1), 500);
  const mu = PARAMS.find((p) => p.id === 'tire.friction');
  assert.equal(stepValue(mu, 1.35, 1), 1.4);
  assert.equal(stepValue(mu, 1.35, -1, true), 1.34);
});
