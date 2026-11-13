import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listChanges, formatValue } from '../src/config/changes.js';
import { setParam, resetAll } from '../src/config/registry.js';

test('nothing is listed when every setting is at its default', () => {
  resetAll();
  assert.deepEqual(listChanges(), []);
});

test('changed settings are listed with their old and new values', () => {
  resetAll();
  setParam('tire.friction', 1.4);
  setParam('engine.power', 400);
  const list = listChanges();
  assert.deepEqual(list.map((c) => c.id), ['engine.power', 'tire.friction']);
  const friction = list.find((c) => c.id === 'tire.friction');
  assert.equal(friction.value, 1.4);
  assert.equal(friction.default, 1);
  assert.equal(friction.label, 'Friction coefficient');
  resetAll();
  assert.deepEqual(listChanges(), []);
});

test('values are shown without float noise', () => {
  assert.equal(formatValue(0.30000000000000004), '0.3');
  assert.equal(formatValue(250), '250');
});
