// NASCAR-style banked ovals: left turns only. The inside edge of the road sits at ground level and the
// outside edge climbs, as on a real speedway.
import { rad, smooth } from './util.js';

function makeOval({ id, name, blurb, straight, radius, bank, straightBank, width, ramp, speedScale, size, cell, grass }) {
  const hw = width / 2;
  const control = [];
  const add = (x, z, b) => control.push({ x, z, y: hw * Math.tan(rad(Math.abs(b))), bank: b });
  const step = straight / 10;
  const turn = (cx, cz, from) => {
    const steps = 24;
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const a = rad(from - 180 * t);
      const into = smooth(0, ramp, t) * (1 - smooth(1 - ramp, 1, t));
      add(cx + radius * Math.cos(a), cz + radius * Math.sin(a), -(straightBank + (bank - straightBank) * into));
    }
  };
  for (let x = -straight / 2; x < straight / 2; x += step) add(x, 0, -straightBank);
  turn(straight / 2, -radius, 90);
  for (let x = straight / 2; x > -straight / 2; x -= step) add(x, -2 * radius, -straightBank);
  turn(-straight / 2, -radius, -90);

  return {
    id,
    name,
    blurb,
    control,
    options: { spacing: 3, width, checkpointEvery: 250 },
    base: () => 0,
    botSpeedScale: speedScale,
    center: { x: 0, z: -radius },
    theme: { kind: 'oval', sky: [0x3f7fd6, 0xcfe6f7], fog: [0xcfe6f7, 500, 3000], terrainSize: size, terrainCell: cell, ground: grass, trees: 0 },
    shortcuts: [],
  };
}

const GRASS = { low: 0x3d7a34, high: 0x5c9a3c, rock: 0x6b7a60 };

export const buildOval = () =>
  makeOval({ id: 'oval', name: 'Thunder Speedway', blurb: 'Superspeedway with 31 degree banking, like Daytona. Flat out, but the wall is right there.', straight: 760, radius: 300, bank: 31, straightBank: 3, width: 22, ramp: 0.12, speedScale: 1.5, size: 1900, cell: 8, grass: GRASS });

export const buildBowl = () =>
  makeOval({ id: 'bowl', name: 'Thunder Bowl', blurb: 'Half-mile short track with 36 degree banking, like Bristol. Tight, steep and fast.', straight: 230, radius: 80, bank: 36, straightBank: 8, width: 16, ramp: 0.15, speedScale: 1.0, size: 900, cell: 5, grass: GRASS });

export default buildOval;
