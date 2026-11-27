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

test('a long drift builds a multiplier, is banked when it ends', () => {
  const t = new StyleTracker();
  drift(t, 2.5);
  assert.ok(t.driftPoints > 0 && t.multiplier >= 3);
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


test('free look offsets start at the chase pose, drag naturally, clamp, zoom and ease back', () => {
  const look = new FreeLook();
  look.drag(100, 100); // ignored: not held
  assert.equal(look.yaw, 0);
  const still = look.orbit(1, 0.2, 8);
  assert.deepEqual(still, { angle: 1, pitch: 0.2, radius: 8 }); // no offset: exactly the chase pose
  look.start();
  look.drag(100, 0);
  assert.ok(look.yaw > 0.5, 'dragging right moves the camera left around the car (angle grows)');
  look.drag(0, 10000);
  const high = look.orbit(0, 0.2, 8).pitch;
  assert.ok(high > 1.3 && high <= 1.4, 'pitch is limited');
  look.zoom(10000);
  assert.equal(look.zoomScale, 2);
  look.end();
  assert.ok(look.engaged);
  for (let i = 0; i < 300; i++) look.update(1 / 60);
  assert.ok(!look.engaged && look.yaw === 0 && look.pitch === 0 && look.zoomScale === 1);
  look.zoom(500); // ignored while not engaged
  assert.equal(look.zoomScale, 1);
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
