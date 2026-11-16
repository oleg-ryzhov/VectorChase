// Real circuits from surveyed centre lines (see data/*.js for the source and licence).
import suzuka from './data/suzuka.js';
import monza from './data/monza.js';
import { fbm } from './util.js';

function control(data) {
  return data.points.map(([x, z, y, bridge]) => ({ x, z, y, mode: bridge ? 'b' : 'g' }));
}

const hills = (amount, scale) => (x, z) => 4 + amount * (fbm(x / scale, z / scale, 3) - 0.5);

export function buildSuzuka() {
  return {
    id: 'suzuka',
    name: 'Suzuka Circuit',
    blurb: 'Japanese Grand Prix. The only F1 figure-eight: the back straight crosses over the Degner curves.',
    control: control(suzuka),
    options: { spacing: 3, width: 13, checkpointEvery: 250 },
    base: hills(16, 300),
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
    base: hills(10, 400),
    theme: { kind: 'circuit', sky: [0x5a99e6, 0xdcebf7], fog: [0xdcebf7, 500, 2800], terrainSize: 2900, terrainCell: 10, ground: { low: 0x376f33, high: 0x70a04a, rock: 0x7b7468 }, trees: 3200, stands: true },
    shortcuts: [],
  };
}
