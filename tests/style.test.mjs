import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StyleTracker } from '../src/game/style.js';
import { FreeLook } from '../src/camera/freeLook.js';
import { BUILTIN_PRESETS } from '../src/config/presets.js';
import { PARAMS } from '../src/config/registry.js';

const drifting = { u: 20, v: -6, wheelSlip: [1.5, 1.5, 1.5, 1.5] }; // sideways at about 17 degrees
const gripping = { u: 20, v: 0, wheelSlip: [0.3, 0.3, 0.3, 0.3] };

function drift(t, seconds, car = drifting) {
  for (let i = 0; i < Math.round(seconds * 60); i++) t.update(1 / 60, car);
}

test('a long drift builds a multiplier, fills boost and is banked when it ends', () => {
  const t = new StyleTracker();
  drift(t, 2.5);
  assert.ok(t.driftPoints > 0 && t.multiplier >= 3 && t.meter > 0.2);
  drift(t, 1, gripping);
  assert.equal(t.driftPoints, 0);
  assert.ok(t.total > 0 && t.best === t.total && t.popupText === `+${t.total}`);
});

test('a short drift is not banked and a crash cancels the drift', () => {
  const a = new StyleTracker();
  drift(a, 0.5);
  drift(a, 1, gripping);
  assert.equal(a.total, 0);
  const b = new StyleTracker();
  drift(b, 2);
  b.update(1 / 60, drifting, { crashed: true });
  assert.equal(b.driftPoints, 0);
  drift(b, 1, gripping);
  assert.equal(b.total, 0);
});

test('boost drains the meter and stops when it is empty', () => {
  const t = new StyleTracker();
  drift(t, 8);
  const full = t.meter;
  assert.ok(full > 0.9);
  for (let i = 0; i < 60; i++) t.update(1 / 60, gripping, { boostHeld: true });
  assert.ok(t.boosting && t.meter < full - 0.25);
  for (let i = 0; i < 400; i++) t.update(1 / 60, gripping, { boostHeld: true });
  assert.ok(!t.boosting && t.meter === 0);
});

test('free look orbits while held, clamps, zooms and eases back', () => {
  const look = new FreeLook();
  look.drag(100, 100); // ignored: not held
  assert.equal(look.yaw, 0);
  look.start();
  look.drag(200, 400);
  assert.ok(look.yaw < -1 && look.pitch === 1.4);
  look.zoom(10000);
  assert.equal(look.radius, 16);
  look.end();
  assert.ok(look.engaged);
  for (let i = 0; i < 300; i++) look.update(1 / 60);
  assert.ok(!look.engaged && look.yaw === 0 && look.pitch === 0.25);
  const p = look.position({ x: 0, y: 1.7, z: 0 }, 0); // car heading +x: the camera sits behind it
  assert.ok(p.x < -5 && Math.abs(p.z) < 1e-9 && p.y > 1.7);
});

test('built-in presets only name real settings within range', () => {
  for (const preset of BUILTIN_PRESETS) {
    for (const [id, value] of Object.entries(preset.values)) {
      const def = PARAMS.find((p) => p.id === id);
      assert.ok(def, `${preset.name}: unknown ${id}`);
      assert.ok(value >= def.min && value <= def.max, `${preset.name}: ${id}=${value} out of range`);
    }
  }
});
