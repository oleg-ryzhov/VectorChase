import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESETS_KEY,
  snapshotValues,
  applyValues,
  listPresets,
  readPreset,
  savePreset,
  deletePreset,
} from '../src/config/presets.js';
import { getParam, setParam, resetAll } from '../src/config/registry.js';

function fakeStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
}

const blockedStorage = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};

test('saved presets are listed alphabetically and can be read back', () => {
  resetAll();
  const store = fakeStorage();
  assert.equal(savePreset(store, 'zeta', { 'tire.friction': 1.5 }), true);
  assert.equal(savePreset(store, 'alpha', { 'tire.friction': 0.5 }), true);
  assert.deepEqual(listPresets(store), ['alpha', 'zeta']);
  assert.deepEqual(readPreset(store, 'zeta'), { 'tire.friction': 1.5 });
  assert.equal(readPreset(store, 'missing'), null);
});

test('saving under an existing name replaces it', () => {
  const store = fakeStorage();
  savePreset(store, 'a', { 'tire.friction': 1 });
  savePreset(store, 'a', { 'tire.friction': 2 });
  assert.deepEqual(listPresets(store), ['a']);
  assert.deepEqual(readPreset(store, 'a'), { 'tire.friction': 2 });
});

test('names are trimmed and empty names are refused', () => {
  const store = fakeStorage();
  assert.equal(savePreset(store, '   ', {}), false);
  assert.equal(savePreset(store, '  grip  ', {}), true);
  assert.deepEqual(listPresets(store), ['grip']);
});

test('odd names such as __proto__ are stored like any other', () => {
  const store = fakeStorage();
  assert.equal(savePreset(store, '__proto__', { 'tire.friction': 1.2 }), true);
  assert.deepEqual(readPreset(store, '__proto__'), { 'tire.friction': 1.2 });
});

test('delete removes only the named preset', () => {
  const store = fakeStorage();
  savePreset(store, 'a', {});
  savePreset(store, 'b', {});
  assert.equal(deletePreset(store, 'a'), true);
  assert.equal(deletePreset(store, 'a'), false);
  assert.deepEqual(listPresets(store), ['b']);
});

test('blocked or corrupt storage fails safely', () => {
  assert.deepEqual(listPresets(blockedStorage), []);
  assert.equal(savePreset(blockedStorage, 'a', {}), false);
  const store = fakeStorage();
  store.setItem(PRESETS_KEY, '{oops');
  assert.deepEqual(listPresets(store), []);
  store.setItem(PRESETS_KEY, '{"not":"a list"}');
  assert.deepEqual(listPresets(store), []);
});

test('applying a preset resets values it does not mention', () => {
  resetAll();
  setParam('engine.power', 400);
  setParam('tire.friction', 0.5);
  applyValues({ 'tire.friction': 1.4, 'no.such.id': 3 });
  assert.equal(getParam('tire.friction'), 1.4);
  assert.equal(getParam('engine.power'), 250);
  resetAll();
});

test('a snapshot can be applied to restore the same values', () => {
  resetAll();
  setParam('engine.power', 333);
  setParam('wheel.radius', 0.35);
  const snapshot = snapshotValues();
  resetAll();
  applyValues(snapshot);
  assert.equal(getParam('engine.power'), 333);
  assert.equal(getParam('wheel.radius'), 0.35);
  resetAll();
});
