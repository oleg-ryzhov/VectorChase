import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detailPixels } from '../src/track/detailNoise.js';
import { rolling, ridged } from '../src/maps/util.js';
import { MAPS } from '../src/maps/index.js';
import { prepareMap } from '../src/maps/prepare.js';

test('ground grain is tileable, bounded and repeatable', () => {
  const n = 128;
  const px = detailPixels(n, 1);
  assert.deepEqual(px, detailPixels(n, 1));
  assert.ok(px.every((v) => v >= 215 && v <= 255));
  assert.ok(new Set(px).size > 20, 'has real variation');
  // The seam (last column next to the first) is no rougher than any other neighbouring columns.
  const diff = (x0, x1) => {
    let s = 0;
    for (let y = 0; y < n; y++) s += Math.abs(px[y * n + x0] - px[y * n + x1]);
    return s / n;
  };
  let typical = 0;
  for (let x = 0; x < n - 1; x++) typical += diff(x, x + 1) / (n - 1);
  assert.ok(diff(n - 1, 0) < typical * 2 + 1, `seam ${diff(n - 1, 0).toFixed(2)} vs typical ${typical.toFixed(2)}`);
});

test('rolling and ridged noise stay in range and are smooth', () => {
  let lo = 1;
  let hi = 0;
  for (let i = 0; i < 4000; i++) {
    const x = i * 37.3;
    const z = i * -11.9;
    for (const v of [rolling(x, z, 300), ridged(x / 100, z / 100)]) {
      assert.ok(v >= 0 && v <= 1, `out of range ${v}`);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    assert.ok(Math.abs(rolling(x, z, 300) - rolling(x + 1, z, 300)) < 0.05, 'jumps over one metre');
  }
  assert.ok(hi - lo > 0.4, 'varies');
});

for (const id of ['suzuka', 'monza']) {
  test(`${id}: hills never cover the road and the map has higher ground at its edge`, () => {
    const { track, world } = prepareMap(MAPS.find((m) => m.id === id).build());
    // Right beside the road the ground never rises above the road surface (it can fall away on a bridge).
    for (let i = 0; i < track.points.length; i += 40) {
      const p = track.points[i];
      const side = track.width / 2 + 3;
      for (const s of [-1, 1]) {
        const h = world.terrainHeight(p.x + p.nx * side * s, p.z + p.nz * side * s);
        assert.ok(h - p.y < 3, `ground ${h.toFixed(1)} m vs road ${p.y.toFixed(1)} m at point ${i}`);
      }
    }
    let far = -Infinity;
    for (let x = -1400; x <= 1400; x += 100) for (let z = -1400; z <= 1400; z += 100) far = Math.max(far, world.terrainHeight(x, z));
    assert.ok(far > 8, `highest ground only ${far.toFixed(1)} m`);
  });
}
