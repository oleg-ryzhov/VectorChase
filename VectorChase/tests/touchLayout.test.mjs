import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTROLS, LIMITS, MIN_TOUCH, controlsFor, defaultLayout, sanitizeLayout, boxFor, mirrorLayout, boxesOverlap, positionFromPixels } from '../src/ui/touchLayout.js';
import { ICONS } from '../src/ui/icons.js';

const SCREENS = [[640, 360], [844, 390], [932, 430], [1024, 768], [1280, 720]];

test('every control has a real icon and the schemes share the gas, brake and buttons', () => {
  for (const c of Object.values(CONTROLS)) assert.ok(ICONS[c.icon], c.icon);
  assert.deepEqual(controlsFor('pad').filter((i) => i === 'left' || i === 'right'), []);
  assert.ok(controlsFor('arrows').includes('left') && !controlsFor('arrows').includes('steer'));
  for (const s of ['pad', 'arrows']) for (const id of ['gas', 'brake', 'handbrake', 'pause', 'tune', 'camera']) assert.ok(controlsFor(s).includes(id));
});

test('the default layout fits every common screen and no two touch areas overlap', () => {
  for (const scheme of ['pad', 'arrows']) {
    for (const [vw, vh] of SCREENS) {
      const layout = defaultLayout();
      const boxes = controlsFor(scheme).map((id) => [id, boxFor(id, layout[id], vw, vh)]);
      for (const [id, b] of boxes) {
        assert.ok(b.hitLeft >= -0.01 && b.hitTop >= -0.01 && b.hitLeft + b.hw <= vw + 0.01 && b.hitTop + b.hh <= vh + 0.01, `${id} off screen at ${vw}x${vh}`);
        assert.ok(b.hw >= MIN_TOUCH && b.hh >= MIN_TOUCH, `${id} too small to touch`);
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          assert.ok(!boxesOverlap(boxes[i][1], boxes[j][1]), `${boxes[i][0]} overlaps ${boxes[j][0]} at ${vw}x${vh} (${scheme})`);
        }
      }
    }
  }
});

test('damaged layouts are repaired and all numbers stay inside their limits', () => {
  const l = sanitizeLayout({ gas: { x: 5, y: -2, scale: 'big', hit: 99, opacity: 0 }, brake: 'no', extra: 1 });
  assert.equal(l.gas.x, 1);
  assert.equal(l.gas.y, 0);
  assert.equal(l.gas.scale, 1);
  assert.equal(l.gas.hit, LIMITS.hit[1]);
  assert.equal(l.gas.opacity, LIMITS.opacity[0]);
  assert.deepEqual(l.brake, defaultLayout().brake);
  assert.ok(!('extra' in l));
  assert.deepEqual(sanitizeLayout(null), defaultLayout());
});

test('a control dragged to a corner or enlarged stays fully on screen', () => {
  for (const [vw, vh] of SCREENS) {
    for (const [x, y] of [[0, 0], [1, 1], [0, 1], [1, 0]]) {
      const b = boxFor('steer', { x, y, scale: 1.8, hit: 2.2, opacity: 1 }, vw, vh);
      assert.ok(b.hitLeft >= -0.01 && b.hitTop >= -0.01 && b.hitLeft + b.hw <= vw + 0.01 && b.hitTop + b.hh <= vh + 0.01);
    }
  }
  assert.ok(boxFor('pause', { x: 0.5, y: 0.5, scale: 0.6, hit: 1, opacity: 1 }, 640, 360).hw >= MIN_TOUCH);
});

test('the touch area is separate from the drawn size', () => {
  const small = boxFor('gas', { x: 0.5, y: 0.5, scale: 1, hit: 1, opacity: 1 }, 800, 400);
  const big = boxFor('gas', { x: 0.5, y: 0.5, scale: 1, hit: 2, opacity: 1 }, 800, 400);
  assert.equal(small.w, big.w);
  assert.ok(big.hw > small.hw * 1.9);
});

test('mirroring flips left and right and twice gives the original back', () => {
  const l = defaultLayout();
  const m = mirrorLayout(l);
  assert.ok(Math.abs(m.gas.x - (1 - l.gas.x)) < 1e-9);
  assert.equal(m.gas.y, l.gas.y);
  const back = mirrorLayout(m);
  for (const id of Object.keys(l)) assert.ok(Math.abs(back[id].x - l[id].x) < 0.002);
});

test('dragging maps pixels to fractions, with optional snapping, inside the screen', () => {
  assert.deepEqual(positionFromPixels(320, 180, 640, 360), { x: 0.5, y: 0.5 });
  const s = positionFromPixels(331, 187, 640, 360, true);
  assert.ok(Math.abs(s.x * 40 - Math.round(s.x * 40)) < 1e-9);
  const out = positionFromPixels(-50, 999, 640, 360);
  assert.deepEqual(out, { x: 0, y: 1 });
});
