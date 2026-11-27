import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, TABS, defaultValues, sanitize, isVisible, visibleItems, createGameSettings, pixelRatioFor, fovFor, speedInUnits, SETTINGS_KEY } from '../src/config/gameSettings.js';
import { ICONS } from '../src/ui/icons.js';

const memory = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
};

test('every setting has a unique id, a known tab, a valid default and requires that point at real settings', () => {
  const ids = new Set(ITEMS.map((i) => i.id));
  assert.equal(ids.size, ITEMS.length);
  const tabs = new Set(TABS.map((t) => t[0]));
  for (const item of ITEMS) {
    assert.ok(tabs.has(item.tab), item.id);
    for (const [id, op] of item.requires ?? []) {
      assert.ok(ids.has(id) && (op === 'eq' || op === 'ne'), `${item.id} requires ${id}`);
    }
    if (item.type === 'slider') assert.ok(item.default >= item.min && item.default <= item.max, item.id);
    if (item.type === 'choice') assert.ok(item.options.some((o) => o[0] === item.default), item.id);
    if (item.icon) assert.ok(ICONS[item.icon], item.icon);
  }
  for (const t of TABS) assert.ok(ICONS[t[2]], t[2]);
});

test('no tab ever shows more than six settings at once, so no tab needs scrolling', () => {
  for (const [tab] of TABS) assert.ok(ITEMS.filter((i) => i.tab === tab).length <= 6, tab);
});

test('dependent settings appear only while the setting they need has the right value', () => {
  const v = defaultValues();
  const shown = (tab) => visibleItems(tab, v).map((i) => i.id);
  assert.ok(shown('audio').includes('audio.musicVolume'));
  v['audio.music'] = false;
  assert.ok(!shown('audio').includes('audio.musicVolume'));
  v['audio.sfx'] = false;
  assert.ok(!shown('audio').includes('audio.sfxVolume'));
  v['controls.touchMode'] = 'off';
  assert.deepEqual(shown('controls'), ['controls.touchMode']);
  v['controls.touchMode'] = 'on';
  v['controls.scheme'] = 'arrows';
  assert.ok(shown('controls').includes('controls.scheme') && !shown('controls').includes('controls.sensitivity'));
  assert.ok(isVisible(ITEMS.find((i) => i.id === 'controls.editLayout'), v));
});

test('damaged stored data is repaired, sliders snap to their step and stay in range', () => {
  const d = defaultValues();
  const s = sanitize({ 'audio.master': 'loud', 'audio.sfx': 'yes', 'video.quality': 'ultra', 'video.fov': 500, 'audio.musicVolume': 33 }, d);
  assert.equal(s['audio.master'], d['audio.master']);
  assert.equal(s['audio.sfx'], true);
  assert.equal(s['video.quality'], 'high');
  assert.equal(s['video.fov'], 110);
  assert.equal(s['audio.musicVolume'], 35);
  assert.deepEqual(sanitize(null, d), d);
  assert.deepEqual(sanitize([1, 2], d), d);
});

test('settings are saved, restored, reset and announced', () => {
  const store = memory();
  const a = createGameSettings(store, { touch: true });
  assert.equal(a.get('video.quality'), 'medium');
  const seen = [];
  const stop = a.subscribe((ids) => seen.push(ids.join()));
  a.set('audio.master', 40);
  a.set('audio.master', 40); // no change, no event
  a.set('audio.music', false);
  a.setLayout({ gas: { x: 0.5 } });
  assert.deepEqual(seen, ['audio.master', 'audio.music', 'controls.layout']);
  stop();
  const b = createGameSettings(store, { touch: true });
  assert.equal(b.get('audio.master'), 40);
  assert.equal(b.get('audio.music'), false);
  assert.deepEqual(b.getLayout(), { gas: { x: 0.5 } });
  b.reset('audio');
  assert.equal(b.get('audio.master'), 70);
  assert.ok(JSON.parse(store.getItem(SETTINGS_KEY)).values['audio.master'] === 70);
  assert.doesNotThrow(() => createGameSettings({ getItem: () => '{broken', setItem() { throw new Error('full'); } }).set('audio.master', 10));
});

test('quality, field of view and speed units convert sensibly', () => {
  assert.equal(pixelRatioFor('low', 3), 1);
  assert.equal(pixelRatioFor('medium', 3), 1.5);
  assert.equal(pixelRatioFor('high', 3), 2);
  assert.equal(pixelRatioFor('high', 1), 1);
  assert.equal(fovFor('first', 80), 80);
  assert.equal(fovFor('chase', 80), 70);
  assert.ok(Math.abs(speedInUnits(10, 'kph') - 36) < 1e-9);
  assert.ok(Math.abs(speedInUnits(10, 'mph') - 22.36936) < 1e-6);
});

test('tuner keys: defaults are the number row, and a stored key that cannot be bound falls back', () => {
  const d = defaultValues();
  assert.equal(d['tuner.key1'], 'Digit1');
  assert.equal(d['tuner.key10'], 'Digit0');
  const v = sanitize({ 'tuner.key1': 'KeyQ', 'tuner.key2': 'KeyE', 'tuner.key3': 'Escape', 'tuner.key4': 7 }, d);
  assert.deepEqual([v['tuner.key1'], v['tuner.key2'], v['tuner.key3'], v['tuner.key4']], ['KeyQ', 'Digit2', 'Digit3', 'Digit4']);
});
