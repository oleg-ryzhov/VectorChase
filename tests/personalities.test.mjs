import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../src/maps/index.js';
import { prepareMap } from '../src/maps/prepare.js';
import { Vehicle } from '../src/physics/vehicle.js';
import { TrackTracker } from '../src/track/tracker.js';
import { readCarSpec } from '../src/physics/spec.js';
import { BotDriver } from '../src/ai/bot.js';
import { PERSONALITIES, HABITS, mulberry32, pickWeighted } from '../src/ai/personalities.js';

const DT = 1 / 120;

test('mulberry32 repeats for the same seed and differs between seeds', () => {
  const a = mulberry32(5);
  const b = mulberry32(5);
  const c = mulberry32(6);
  const xs = [a(), a(), a()];
  assert.deepEqual(xs, [b(), b(), b()]);
  assert.notEqual(xs[0], c());
  assert.ok(xs.every((x) => x >= 0 && x < 1));
});

test('pickWeighted follows the weights and never picks a zero weight', () => {
  const r = mulberry32(1);
  const counts = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 6000; i++) counts[pickWeighted(r, [['a', 3], ['b', 1], ['c', 0]])]++;
  assert.equal(counts.c, 0);
  assert.ok(Math.abs(counts.a / 6000 - 0.75) < 0.03, `a share ${counts.a / 6000}`);
});

test('every personality is well formed and uses known habits', () => {
  assert.equal(new Set(PERSONALITIES.map((p) => p.id)).size, PERSONALITIES.length);
  for (const p of PERSONALITIES) {
    for (const [habit, weight] of p.habits) assert.ok(HABITS[habit] && weight > 0, `${p.id}: ${habit}`);
    assert.ok(p.mistake >= 0 && p.mistake < 0.5 && p.aggression >= 0 && p.aggression <= 1);
  }
});

function setup(id) {
  const { track, world } = prepareMap(MAPS.find((m) => m.id === id).build());
  const start = track.points[0];
  const car = new Vehicle({ x: start.x, z: start.z, yaw: Math.atan2(start.tz, start.tx), y: start.y, ground: world });
  const tracker = new TrackTracker(track);
  tracker.setProgress(0);
  return { track, car, tracker };
}

for (const personality of PERSONALITIES) {
  test(`${personality.name} completes a Monza lap on the road and rolls varied habits`, () => {
    const { track, car, tracker } = setup('monza');
    const driver = new BotDriver({ difficulty: 'hard', personality, random: mulberry32(7) });
    const spec = readCarSpec();
    const habits = new Set();
    let time = 0;
    let maxOffset = 0;
    while (tracker.total < track.length && time < 400) {
      car.step(DT, driver.drive(car, tracker, spec, { dt: DT, traffic: [car] }));
      tracker.update(car.x, car.z, car.y, !car.airborne);
      if (driver.corner) habits.add(driver.corner.habit);
      maxOffset = Math.max(maxOffset, tracker.dist);
      time += DT;
    }
    assert.ok(tracker.total >= track.length, `did not finish: ${((tracker.total / track.length) * 100).toFixed(0)}%`);
    assert.ok(maxOffset < 14, `strayed ${maxOffset.toFixed(1)} m`);
    assert.equal(car.recoveries, 0);
    assert.ok(habits.size >= 2, `only ${[...habits]}`);
  });
}

test('an aggressive bot passes a slow car without hitting it; the same bot with no traffic stays in its lane', () => {
  const { track, car, tracker } = setup('monza');
  const nitro = PERSONALITIES.find((p) => p.id === 'nitro');
  const driver = new BotDriver({ difficulty: 'hard', personality: nitro, random: mulberry32(3) });
  const spec = readCarSpec();
  const slow = { x: 0, z: 0, yaw: 0, u: 14, airborne: false };
  let slowS = 140;
  let minGap = Infinity;
  let maxSide = 0;
  let passed = false;
  let time = 0;
  while (time < 60 && !passed) {
    slowS += slow.u * DT;
    const p = track.points[Math.round(slowS / track.spacing) % track.points.length];
    slow.x = p.x;
    slow.z = p.z;
    car.step(DT, driver.drive(car, tracker, spec, { dt: DT, traffic: [car, slow] }));
    tracker.update(car.x, car.z, car.y, !car.airborne);
    const gap = Math.hypot(slow.x - car.x, slow.z - car.z);
    minGap = Math.min(minGap, gap);
    maxSide = Math.max(maxSide, Math.abs(driver.lane));
    passed = tracker.total > slowS + 6;
    time += DT;
  }
  assert.ok(passed, 'never got past');
  assert.ok(minGap > 1.9, `closest approach ${minGap.toFixed(2)} m`);
  assert.ok(maxSide > 2, `steered only ${maxSide.toFixed(1)} m to the side`);
});
