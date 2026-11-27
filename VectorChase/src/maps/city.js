// Neon Metropolis: a night-time city figure-eight. The highway crosses over the boulevard, one stretch
// runs through the base of a tower, and a canal inlet can be jumped to skip a detour.
import { P, route, ramp, slab } from './util.js';

function hash(a, b) {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export default function buildCity() {
  const wps = [
    P(-300, 0, 0), // start line, boulevard heading east
    P(190, 0, 0, { gl: true }),
    P(250, 0, 0, { r: 60, gl: true }), // the road turns right here; straight on is the canal
    P(250, 150, 0, { r: 60 }),
    P(380, 150, 0, { r: 60, gl: true }),
    P(380, 0, 0, { r: 60 }),
    P(480, 0, 0, { r: 100 }),
    P(480, 300, 0, { r: 80 }),
    P(390, 300, 0, { r: 40 }), // chicane
    P(350, 245, 0, { r: 40 }),
    P(285, 245, 0, { r: 40 }),
    P(255, 300, 0, { r: 40 }),
    P(210, 300, 0, { mode: 't' }), // tunnel through the tower base
    P(60, 300, 0, { mode: 'g' }),
    P(-100, 300, 0, { r: 100 }),
    P(-100, 260, 0),
    P(-100, 200, 2, { mode: 'b' }), // highway over the boulevard
    P(-100, 40, 16, { mode: 'b' }),
    P(-100, -40, 16, { mode: 'b' }),
    P(-100, -200, 2, { mode: 'b' }),
    P(-100, -260, 0, { mode: 'g' }),
    P(-100, -320, 0, { r: 80 }),
    P(-190, -320, 0, { r: 50 }), // hairpin pair
    P(-230, -255, 0, { r: 40 }),
    P(-330, -255, 0, { r: 40 }),
    P(-370, -320, 0, { r: 50 }),
    P(-480, -320, 0, { r: 80 }),
    P(-480, -215, 0, { r: 50, gr: true }), // west blocks: the road bends round them; straight on is a hidden alley
    P(-420, -160, 0, { r: 50 }),
    P(-420, -95, 0, { r: 50, gl: true, gr: true }),
    P(-480, -40, 0, { r: 50, gl: true, gr: true }),
    P(-480, 0, 0, { r: 80 }),
  ];
  const control = route(wps).map((c) => ({ ...c, mode: c.mode ?? 'g' }));

  // The tower over the tunnel: two side blocks and a roof, leaving the road open.
  const tower = { x0: 40, x1: 230, top: 150 };
  const obstacles = [
    { ...tower, z0: 250, z1: 288 },
    { ...tower, z0: 312, z1: 350 },
    { ...tower, z0: 288, z1: 312, bottom: 8 },
  ];

  return {
    id: 'city',
    name: 'Neon Metropolis',
    blurb: 'Night city. Highway over the boulevard, a tunnel through a tower, and a canal you can jump.',
    control,
    options: { spacing: 3, width: 15, checkpointEvery: 200 },
    base: () => 0,
    features: [
      slab({ x: 310, z: 37, heading: 0, length: 44, width: 165, height: -12, edge: 5 }), // canal inlet
      ramp({ x: 256, z: 0, heading: 0, length: 26, width: 14, height: 4 }),
      slab({ x: -480, z: -128, heading: 0, length: 40, width: 40, height: -12, edge: 4 }), // the ditch
      ramp({ x: -480, z: -178, heading: Math.PI / 2, length: 24, width: 10, height: 2.5 }),
    ],
    waterLevel: -3,
    terrainGrip: 0.8,
    obstacles,
    shortcuts: [
      { fromAt: [250, 0], toAt: [380, 0], bot: { aim: [345, 0], speed: 41 } },
      // Hidden: straight on at the first west-side bend, over a ditch, back onto the road.
      { fromAt: [-480, -215], toAt: [-480, -30], bot: { aim: [-480, -60], speed: 45 } },
    ],
    theme: {
      kind: 'city', night: true, sky: [0x050816, 0x1b1f45], fog: [0x0c1030, 120, 1400], terrainSize: 1700, terrainCell: 8,
      ground: { low: 0x232733, high: 0x2c3140, rock: 0x232733 }, water: 0x0b2a55, tower,
    },
    populate(track, world) {
      const buildings = [];
      const out = [];
      for (let cx = -760; cx <= 760; cx += 100) {
        for (let cz = -640; cz <= 560; cz += 100) {
          const h = hash(cx, cz);
          const w = 44 + hash(cz, cx) * 36;
          const d = 44 + hash(cx + 7, cz + 3) * 36;
          const b = { x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 };
          // Keep roads, the plaza and the tower clear.
          const corners = [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1], [cx, cz]];
          if (corners.some(([x, z]) => world.roadDistance(x, z) < 16)) continue;
          if (b.x1 > 120 && b.x0 < 520 && b.z1 > -90 && b.z0 < 340) continue; // plaza, canal and tower
          const centrality = 1 - Math.min(1, Math.hypot(cx, cz) / 900);
          b.top = 25 + h * 60 + centrality * 90;
          b.seed = h;
          buildings.push(b);
          out.push(b);
        }
      }
      return { buildings, obstacles: out };
    },
  };
}
