// Red Mesa Canyon: desert plateau cut by gorges. A tunnel runs through a mesa and a bridge crosses a gorge.
// The road detours around a deep side gorge; hit the ramp fast and you can jump straight across it.
import { P, route, slab, ramp, mound, fbm } from './util.js';

export default function buildCanyon() {
  const wps = [
    P(-560, -200, 58, { r: 90 }),
    P(-400, -200, 58), // start line
    P(-60, -200, 58, { r: 40, gl: true }), // the road turns right here; straight on is the gorge
    P(-60, 50, 57, { r: 40 }),
    P(60, 50, 56, { r: 40 }),
    P(60, -200, 55, { r: 40, gl: true }),
    P(170, -200, 55, { r: 40 }),
    P(215, -145, 56, { r: 40 }), // S-bends
    P(290, -145, 56, { r: 40 }),
    P(335, -200, 56, { r: 40 }),
    P(350, -200, 56),
    P(380, -200, 56, { mode: 't' }), // tunnel through the mesa
    P(610, -200, 56, { mode: 'g' }),
    P(700, -200, 56, { r: 90 }),
    P(700, -80, 57, { r: 40, gl: true }), // the road loops west; straight on is a hidden slot
    P(580, -80, 58, { r: 40 }),
    P(580, 120, 58, { r: 40 }),
    P(700, 120, 58, { r: 40, gl: true }),
    P(700, 300, 58, { r: 90 }),
    P(300, 300, 59, { mode: 'b' }), // bridge over the second gorge
    P(170, 300, 59, { mode: 'g' }),
    P(-560, 300, 58, { r: 90 }),
  ];
  const control = route(wps).map((c) => ({ ...c, mode: c.mode ?? 'g' }));

  const mesa = mound({ x: 495, z: -200, radius: 170, height: 130, power: 0.6 });
  const base = (x, z) => 56 + (fbm(x / 140, z / 140) - 0.5) * 3 + mesa(x, z);

  return {
    id: 'canyon',
    name: 'Red Mesa Canyon',
    blurb: 'Desert gorges, a mesa tunnel and a bridge. The gorge jump is 40 m: you need real speed.',
    control,
    options: { spacing: 3, width: 14, checkpointEvery: 220 },
    base,
    features: [
      slab({ x: 0, z: -105, heading: 0, length: 40, width: 250, height: -85, edge: 6 }), // the jump gorge
      slab({ x: 235, z: 300, heading: 0, length: 60, width: 150, height: -70, edge: 8 }), // the bridged gorge
      ramp({ x: -54, z: -200, heading: 0, length: 24, width: 14, height: 3.5 }),
      slab({ x: 700, z: 10, heading: 0, length: 30, width: 44, height: -90, edge: 5 }), // the slot
      ramp({ x: 700, z: -52, heading: Math.PI / 2, length: 22, width: 10, height: 3.5 }),
    ],
    waterLevel: -14,
    shortcuts: [
      { fromAt: [-60, -200], toAt: [60, -200], bot: { aim: [20, -200], speed: 36 } },
      // Hidden: across the hairpin's inner slot canyon.
      { fromAt: [700, -80], toAt: [700, 170], bot: { aim: [700, 100], speed: 35 } },
    ],
    theme: {
      kind: 'canyon', sky: [0x3a7bd0, 0xf0d9b8], fog: [0xf0d9b8, 500, 2800], terrainSize: 2400, terrainCell: 8,
      ground: { low: 0xb0623a, high: 0xd08a52, rock: 0x8f4a2c }, water: 0x2a6f8f, trees: 0, cactus: 500,
    },
  };
}
