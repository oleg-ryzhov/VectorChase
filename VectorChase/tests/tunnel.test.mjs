import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../src/maps/index.js';
import { prepareMap } from '../src/maps/prepare.js';
import { createTunnelCutter, cullTunnelTriangles } from '../src/track/tunnelCut.js';
import { WALL_GAP } from '../src/track/world.js';

for (const id of ['canyon', 'alpine']) {
  test(`${id}: no terrain triangle remains inside a tunnel bore`, () => {
    const { track, world } = prepareMap(MAPS.find((m) => m.id === id).build());
    const pts = track.points;
    const tun = pts.filter((p) => p.mode === 't');
    assert.ok(tun.length > 20);
    const inTube = createTunnelCutter(pts, { halfWidth: track.width / 2 + WALL_GAP + 0.4, wallH: 3.4 });
    // The middle of the bore is inside, the road outside the tunnel is not.
    const mid = tun[Math.floor(tun.length / 2)];
    assert.ok(inTube(mid.x, mid.y + 1.5, mid.z), 'bore centre');
    assert.ok(!inTube(mid.x, mid.y + 40, mid.z), 'mountain above the bore');
    const out = pts.find((p) => p.mode === 'g');
    assert.ok(!inTube(out.x, out.y + 1.5, out.z), 'open road');

    // A terrain grid around the tunnel, 8 m cells like the game's.
    const xs = tun.map((p) => p.x);
    const zs = tun.map((p) => p.z);
    const x0 = Math.floor((Math.min(...xs) - 60) / 8) * 8;
    const z0 = Math.floor((Math.min(...zs) - 60) / 8) * 8;
    const nx = Math.ceil((Math.max(...xs) + 60 - x0) / 8) + 1;
    const nz = Math.ceil((Math.max(...zs) + 60 - z0) / 8) + 1;
    const pos = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) pos.push(x0 + i * 8, world.terrainHeight(x0 + i * 8, z0 + j * 8), z0 + j * 8);
    const idx = [];
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      idx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1);
    }
    const kept = cullTunnelTriangles(pos, idx, inTube);
    assert.ok(kept.length < idx.length, 'portal triangles are cut');
    assert.ok(idx.length - kept.length < idx.length * 0.05, 'only a few triangles are cut');
    for (const k of kept) assert.ok(!inTube(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]), 'a kept vertex is in the bore');
  });
}
