import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Race, pointsFor, formatTime } from '../src/race/race.js';

const entrant = (name, isPlayer) => ({ name, isPlayer, tracker: { total: -10 } });

test('time is formatted as m:ss.mmm', () => {
  assert.equal(formatTime(83.456), '1:23.456');
  assert.equal(formatTime(5), '0:05.000');
  assert.equal(formatTime(NaN), '--:--.---');
});

test('points go to the first eight positions', () => {
  assert.equal(pointsFor(1), 10);
  assert.equal(pointsFor(8), 1);
  assert.equal(pointsFor(9), 0);
});

test('the countdown runs, then the race starts', () => {
  const race = new Race({ laps: 2, entrants: [entrant('You', true), entrant('Bot', false)], trackLength: 1000 });
  race.update(1);
  assert.equal(race.phase, 'countdown');
  assert.ok(Math.abs(race.countdown - 2) < 1e-9);
  race.update(2.1);
  assert.equal(race.phase, 'racing');
  assert.equal(race.time, 0);
});

test('laps, finishing and standings', () => {
  const you = entrant('You', true);
  const bot = entrant('Bot', false);
  const race = new Race({ laps: 2, entrants: [you, bot], trackLength: 1000 });
  race.update(3.1);

  you.tracker.total = 500;
  bot.tracker.total = 800;
  race.update(0.1);
  assert.deepEqual(race.standings().map((e) => e.name), ['Bot', 'You']);
  assert.equal(you.lapsDone, 0);

  you.tracker.total = 1000;
  race.update(60);
  assert.equal(you.lapsDone, 1);
  assert.ok(you.bestLap > 60 && you.bestLap < 61);

  bot.tracker.total = 2000;
  race.update(1);
  assert.equal(bot.finished, true);
  assert.equal(race.phase, 'racing');

  you.tracker.total = 2000;
  race.update(1);
  assert.equal(you.finished, true);
  assert.equal(race.phase, 'finished');
  assert.deepEqual(race.standings().map((e) => e.name), ['Bot', 'You']);
});

test('a driver that has not finished ranks behind finished drivers', () => {
  const you = entrant('You', true);
  const bot = entrant('Bot', false);
  const race = new Race({ laps: 1, entrants: [you, bot], trackLength: 1000 });
  race.update(3.1);
  you.tracker.total = 1000;
  bot.tracker.total = 900;
  race.update(1);
  assert.equal(race.phase, 'finished');
  assert.deepEqual(race.standings().map((e) => e.name), ['You', 'Bot']);
  assert.equal(bot.finished, false);
});
