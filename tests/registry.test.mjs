import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getParam, setParam, resetParam, resetAll } from '../src/config/registry.js';

test('defaults are returned', () => {
  resetAll();
  assert.equal(getParam('chassis.mass'), 1200);
});

test('values are clamped to max and min', () => {
  resetAll();
  assert.equal(setParam('chassis.mass', 99999), 3000);
  assert.equal(setParam('chassis.mass', -5), 500);
});

test('NaN and blank input are rejected', () => {
  resetAll();
  assert.equal(setParam('engine.power', NaN), 250);
  assert.equal(setParam('engine.power', ''), 250);
  assert.equal(setParam('engine.power', '   '), 250);
  assert.equal(setParam('engine.power', 'abc'), 250);
});

test('numeric strings are accepted', () => {
  resetAll();
  assert.equal(setParam('tire.friction', '1.25'), 1.25);
});

test('unknown parameter throws', () => {
  assert.throws(() => getParam('nope'), /Unknown parameter/);
  assert.throws(() => setParam('nope', 1), /Unknown parameter/);
});

test('resetParam and resetAll restore defaults', () => {
  setParam('tire.friction', 0.5);
  assert.equal(resetParam('tire.friction'), 1.0);
  setParam('engine.power', 600);
  resetAll();
  assert.equal(getParam('engine.power'), 250);
});