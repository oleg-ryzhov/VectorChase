// Real circuits from surveyed centre lines (see data/*.js for the source and licence).
import suzuka from './data/suzuka.js';
import monza from './data/monza.js';
import { rolling, ridged, smooth } from './util.js';

function control(data) {
  return data.points.map(([x, z, y, bridge]) => ({ x, z, y, mode: bridge ? 'b' : 'g' }));
}

// Rolling hills around the circuit, and (far = metres of rise) a rim of higher ground towards the edge of the map.
// The road flattens the ground near it, so none of this reaches the track itself.
function hills(data, amount, scale, far) {
  const cx = data.points.reduce((s, p) => s + p[0], 0) / data.points.length;
  const cz = data.points.reduce((s, p) => s + p[1], 0) / data.points.length;
  const reach = Math.max(...data.points.map((p) => Math.hypot(p[0] - cx, p[1] - cz)));
  return (x, z) => {
    const rim = smooth(reach + 100, reach + 800, Math.hypot(x - cx, z - cz));
    return 4 + amount * 1.1 * (rolling(x, z, scale) - 0.5) + far * rim * (0.35 + 0.65 * ridged(x / 420 + 5, z / 420, 4));
  };
}

export function buildSuzuka() {
  return {
    id: 'suzuka',
    name: 'Suzuka Circuit',
    blurb: 'Japanese Grand Prix. The only F1 figure-eight: the back straight crosses over the Degner curves.',
    control: control(suzuka),
    options: { spacing: 3, width: 13, checkpointEvery: 250 },
    base: hills(suzuka, 16, 300, 70),
    theme: { kind: 'circuit', sky: [0x4d8fe0, 0xd6e8f5], fog: [0xd6e8f5, 500, 2600], terrainSize: 2900, terrainCell: 10, ground: { low: 0x2f6b2e, high: 0x6f9b45, rock: 0x7b7468 }, trees: 2600, stands: true },
    shortcuts: [],
  };
}

export function buildMonza() {
  return {
    id: 'monza',
    name: 'Monza',
    blurb: 'The Temple of Speed. Long straights, heavy braking, through the royal park.',
    control: control(monza),
    options: { spacing: 3, width: 13, checkpointEvery: 250 },
    base: hills(monza, 10, 400, 14),
    theme: { kind: 'circuit', sky: [0x5a99e6, 0xdcebf7], fog: [0xdcebf7, 500, 2800], terrainSize: 2900, terrainCell: 10, ground: { low: 0x376f33, high: 0x70a04a, rock: 0x7b7468 }, trees: 3200, stands: true },
    shortcuts: [],
  };
}
