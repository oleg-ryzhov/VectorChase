import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../src/maps/index.js';
import { prepareMap } from '../src/maps/prepare.js';
import { TrackTracker } from '../src/track/tracker.js';
import { Vehicle } from '../src/physics/vehicle.js';
import { readCarSpec } from '../src/physics/spec.js';
import { BotDriver } from '../src/ai/bot.js';
import { resetAll } from '../src/config/registry.js';

const DT = 1 / 120;
const maps = Object.fromEntries(MAPS.map((m) => [m.id, prepareMap(m.build())]));

for (const m of MAPS) {
  const { track, config } = maps[m.id];

  test(`${m.name}: a long closed track with no unintended crossings`, () => {
    const pts = track.points;
    const n = pts.length;
    assert.ok(track.length > 800 && track.length < 8000, `length ${track.length}`);
    for (let i = 0; i < n; i += 2) {
      for (let j = i + 2; j < n; j += 2) {
        if (Math.min(j - i, n - (j - i)) < 40) continue; // neighbours along the road
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z);
        if (d < track.width * 1.2) assert.ok(Math.abs(pts[i].y - pts[j].y) >= 7, `points ${i} and ${j} overlap at the same height`);
      }
    }
    for (const p of pts) assert.ok(Number.isFinite(p.curvature) && Math.abs(p.grade) < 0.2, 'smooth road');
  });

  test(`${m.name}: a hard bot finishes a lap without falling or leaving the road`, () => {
    resetAll();
    const { world } = maps[m.id];
    const s = track.points[0];
    const car = new Vehicle({ x: s.x, z: s.z, yaw: Math.atan2(s.tz, s.tx), y: s.y, ground: world });
    const tracker = new TrackTracker(track);
    tracker.setProgress(0);
    const driver = new BotDriver({ difficulty: 'hard', speedScale: config.botSpeedScale ?? 1 });
    let time = 0;
    let maxOffset = 0;
    while (tracker.total < track.length && time < 400) {
      car.step(DT, driver.drive(car, tracker, readCarSpec()));
      tracker.update(car.x, car.z, car.y, !car.airborne);
      maxOffset = Math.max(maxOffset, tracker.dist);
      assert.ok(!world.hazard(car.x, car.z, car.y), `fell at s=${tracker.s.toFixed(0)}`);
      time += DT;
    }
    assert.ok(tracker.total >= track.length, `lap not finished in ${time.toFixed(0)} s`);
    assert.ok(maxOffset < 14, `strayed ${maxOffset.toFixed(1)} m`);
  });
}

test('Thunder Speedway is banked: the outside edge of a turn is much higher than the inside', () => {
  const { track, world } = maps.oval;
  const p = track.points.find((q) => Math.abs(q.curvature) > 0.0025 && Math.abs(q.bank) > 0.4);
  assert.ok(p, 'a banked turn');
  const outside = world.groundHeight(p.x + p.nx * 10.9, p.z + p.nz * 10.9, 99);
  const inside = world.groundHeight(p.x - p.nx * 10.9, p.z - p.nz * 10.9, 99);
  assert.ok(Math.abs(outside - inside) > 8, `${outside} vs ${inside}`);
  // Left turns: the left side is the low side.
  assert.ok(inside < outside);
});

test('Suzuka: the crossover has two road layers and the car picks the one it is on', () => {
  const { track, world } = maps.suzuka;
  const pts = track.points;
  let found = null;
  for (let i = 0; i < pts.length && !found; i += 2) {
    for (let j = i + 40; j < pts.length - 40; j += 2) {
      if (Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z) < 3 && Math.abs(pts[i].y - pts[j].y) > 7) {
        found = pts[i].y < pts[j].y ? [pts[i], pts[j]] : [pts[j], pts[i]];
        break;
      }
    }
  }
  assert.ok(found, 'a crossover');
  const [low, high] = found;
  assert.ok(Math.abs(world.groundHeight(low.x, low.z, low.y + 0.5) - low.y) < 0.3, 'underpass');
  assert.ok(Math.abs(world.groundHeight(low.x, low.z, high.y + 0.5) - high.y) < 1, 'overpass');
});

// Launches a coasting car from a point on the road and reports how it ends.
function launch(id, x, z, yawDeg, speed) {
  resetAll();
  const { track, world } = maps[id];
  const yaw = (yawDeg * Math.PI) / 180;
  const car = new Vehicle({ x, z, yaw, ground: world });
  car.reset(x, z, yaw, world.groundHeight(x, z));
  car.u = speed;
  car.wheelSpeed.fill(speed / 0.33);
  const tracker = new TrackTracker(track);
  tracker.setProgress(track.shortcuts[0].fromS);
  for (let t = 0; t < 12; t += DT) {
    car.step(DT, {});
    tracker.update(car.x, car.z, car.y, !car.airborne);
    if (world.hazard(car.x, car.z, car.y)) return 'fell';
    if (Math.abs(tracker.s - track.shortcuts[0].toS) < 1) return 'linked';
  }
  return 'neither';
}

for (const [id, x, z, yaw, slow, fast] of [
  ['alpine', -480, -540, 90, 20, 38],
  ['canyon', -150, -200, 0, 28, 34],
  ['city', 100, 0, 0, 34, 44],
]) {
  test(`${id}: the shortcut jump needs speed (${slow} m/s falls, ${fast} m/s lands on the road)`, () => {
    assert.equal(launch(id, x, z, yaw, slow), 'fell');
    assert.equal(launch(id, x, z, yaw, fast), 'linked');
  });
}
