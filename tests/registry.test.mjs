import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARAMS, getParam, setParam, resetParam, resetAll, subscribe } from '../src/config/registry.js';

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

test('non-number, non-string input is rejected', () => {
  resetAll();
  assert.equal(setParam('engine.power', null), 250);
  assert.equal(setParam('engine.power', undefined), 250);
  assert.equal(setParam('engine.power', true), 250);
  assert.equal(setParam('engine.power', []), 250);
});

test('every parameter has a valid definition', () => {
  const ids = new Set();
  for (const p of PARAMS) {
    assert.ok(!ids.has(p.id), `duplicate ${p.id}`);
    ids.add(p.id);
    assert.ok(p.min < p.max, p.id);
    assert.ok(p.default >= p.min && p.default <= p.max, p.id);
    assert.ok(p.step > 0, p.id);
    assert.ok(p.group && p.label && p.description, p.id);
  }
});

test('subscribers hear about real changes only', () => {
  resetAll();
  const calls = [];
  const off = subscribe((ids) => calls.push(ids));
  setParam('tire.friction', 1.5);
  setParam('tire.friction', 1.5); // unchanged
  setParam('tire.friction', NaN); // rejected
  resetAll();
  off();
  setParam('tire.friction', 0.5); // after unsubscribe
  assert.deepEqual(calls, [['tire.friction'], ['tire.friction']]);
  resetAll();
});
