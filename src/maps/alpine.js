// Eiger Pass: a mountain road with a tunnel through the peak, a bridge over a ravine and switchbacks down
// a cliff. Driving off the cliff-top ledge at speed lands you on the road far below.
import { P, route, slab, mound, fbm, smooth } from './util.js';

export default function buildAlpine() {
  const wps = [
    P(-300, 0, 2), // start line in the valley
    P(300, 0, 8),
    P(420, 0, 10, { r: 90 }),
    P(420, -150, 24),
    P(420, -290, 42),
    P(420, -330, 46, { mode: 't' }), // tunnel through the mountain
    P(420, -600, 50, { mode: 't' }),
    P(420, -650, 50, { mode: 'g' }),
    P(420, -740, 52, { r: 90 }),
    P(330, -740, 52, { mode: 'b' }), // bridge over the ravine
    P(60, -740, 52, { mode: 'b' }),
    P(10, -740, 54, { mode: 'g' }),
    P(-380, -740, 60, { r: 80, mode: 'b' }),
    P(-480, -740, 60, { r: 80, mode: 'b' }), // cliff-top ledge, heading south
    P(-480, -458, 60, { r: 25, mode: 'b', gr: true }), // the road turns here; straight on is the drop
    P(-250, -458, 54, { r: 30, mode: 'b' }),
    P(-250, -380, 46, { r: 30, mode: 'b' }),
    P(-480, -380, 24, { r: 25, mode: 'g' }),
    P(-480, 0, 2, { r: 90, mode: 'g' }),
  ];
  const control = route(wps).map((c) => ({ ...c, mode: c.mode ?? 'g' }));

  const peak = mound({ x: 420, z: -460, radius: 260, height: 150, power: 1.3 });
  const base = (x, z) => {
    const lift = 38 * smooth(-40, -700, z);
    const rough = (fbm(x / 170, z / 170) - 0.5) * 16 * smooth(-30, -250, z) + (fbm(x / 60, z / 60) - 0.5) * 3;
    const ring = 190 * smooth(1000, 1450, Math.hypot(x + 40, z + 350));
    return 2 + lift + rough + peak(x, z) + ring;
  };

  return {
    id: 'alpine',
    name: 'Eiger Pass',
    blurb: 'Mountain tunnel, a bridge over a ravine, and a cliff-top ledge: drive off it fast enough and skip the switchbacks.',
    control,
    options: { spacing: 3, width: 13, checkpointEvery: 220 },
    base,
    features: [
      slab({ x: 195, z: -740, heading: 0, length: 250, width: 46, height: -95, edge: 12 }), // ravine
      slab({ x: -493, z: -429, heading: 0, length: 44, width: 82, height: -45, edge: 6 }), // the drop
    ],
    waterLevel: -6,
    shortcuts: [{ fromAt: [-480, -458], toAt: [-480, -380] }],
    theme: {
      kind: 'alpine', sky: [0x2f6fc2, 0xcfe3f2], fog: [0xcfe3f2, 400, 2600], terrainSize: 3100, terrainCell: 10,
      ground: { low: 0x3a6a30, high: 0x6f8a4a, rock: 0x77716a, snow: 0xf2f6fa, snowLine: 150 }, water: 0x1d5a8c, trees: 2800,
    },
  };
}
