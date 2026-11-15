import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROFILES_KEY,
  SETTINGS_KEY,
  validateUsername,
  registerUser,
  signIn,
  findUser,
  setUserSkin,
  recordRace,
  leaderboard,
  loadSettings,
  saveSettings,
} from '../src/profile/profiles.js';

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

test('usernames are 3 to 16 letters, numbers, _ or -', () => {
  assert.equal(validateUsername('Oleg').ok, true);
  assert.equal(validateUsername('  Oleg_99  ').name, 'Oleg_99');
  for (const bad of ['', 'ab', 'a'.repeat(17), 'has space', 'semi;colon', '<b>x</b>', null]) {
    assert.equal(validateUsername(bad).ok, false, String(bad));
  }
});

test('registering a taken name is refused, in any letter case', () => {
  const store = fakeStorage();
  assert.equal(registerUser(store, 'Oleg').ok, true);
  assert.equal(registerUser(store, 'oleg').ok, false);
  assert.equal(registerUser(store, 'Other').ok, true);
});

test('sign in finds an existing player and rejects unknown names', () => {
  const store = fakeStorage();
  registerUser(store, 'Oleg', 'blue');
  const ok = signIn(store, 'OLEG');
  assert.equal(ok.ok, true);
  assert.equal(ok.user.name, 'Oleg');
  assert.equal(ok.user.skin, 'blue');
  assert.equal(signIn(store, 'Nobody').ok, false);
});

test('skin choice is saved per player', () => {
  const store = fakeStorage();
  registerUser(store, 'Oleg');
  setUserSkin(store, 'Oleg', 'green');
  assert.equal(findUser(store, 'Oleg').skin, 'green');
});

test('race results update the stats', () => {
  const store = fakeStorage();
  registerUser(store, 'Oleg');
  recordRace(store, 'Oleg', { position: 1, points: 10, bestLapMs: 90000 });
  recordRace(store, 'Oleg', { position: 3, points: 6, bestLapMs: 85000 });
  recordRace(store, 'Oleg', { position: 4, points: 5, bestLapMs: null });
  const u = findUser(store, 'Oleg');
  assert.deepEqual(
    [u.races, u.wins, u.podiums, u.points, u.bestLapMs],
    [3, 1, 2, 21, 85000]
  );
  assert.equal(recordRace(store, 'Nobody', { position: 1, points: 10, bestLapMs: 1 }), null);
});

test('the leaderboard sorts by points, then wins, then best lap', () => {
  const store = fakeStorage();
  for (const name of ['Cat', 'Ann', 'Bob', 'Dan']) registerUser(store, name);
  recordRace(store, 'Cat', { position: 2, points: 8, bestLapMs: 80000 });
  recordRace(store, 'Ann', { position: 2, points: 8, bestLapMs: 70000 });
  recordRace(store, 'Bob', { position: 1, points: 10, bestLapMs: 90000 });
  assert.deepEqual(
    leaderboard(store).map((u) => u.name),
    ['Bob', 'Ann', 'Cat', 'Dan']
  );
  assert.equal(leaderboard(store, 2).length, 2);
});

test('data is stored as readable plain text', () => {
  const store = fakeStorage();
  registerUser(store, 'Oleg');
  assert.ok(store.getItem(PROFILES_KEY).includes('"name":"Oleg"'));
});

test('settings are validated when loaded', () => {
  const store = fakeStorage();
  assert.deepEqual(loadSettings(store), { user: null, skin: 'red', laps: 3, bots: 3, difficulty: 'medium' });
  store.setItem(SETTINGS_KEY, JSON.stringify({ user: 'Oleg', skin: 'blue', laps: 99, bots: 0, difficulty: 'x' }));
  assert.deepEqual(loadSettings(store), { user: 'Oleg', skin: 'blue', laps: 5, bots: 1, difficulty: 'medium' });
  store.setItem(SETTINGS_KEY, '{oops');
  assert.equal(loadSettings(store).laps, 3);
  assert.equal(saveSettings(store, { user: null, skin: 'red', laps: 2, bots: 2, difficulty: 'hard' }), true);
  assert.equal(loadSettings(store).difficulty, 'hard');
});

test('blocked storage fails safely', () => {
  assert.equal(registerUser(blockedStorage, 'Oleg').ok, false);
  assert.equal(signIn(blockedStorage, 'Oleg').ok, false);
  assert.deepEqual(leaderboard(blockedStorage), []);
  assert.equal(saveSettings(blockedStorage, {}), false);
  assert.equal(loadSettings(null).laps, 3);
});
