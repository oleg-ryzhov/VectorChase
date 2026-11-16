// Thunder Speedway: a NASCAR-style banked oval. Left turns only, steep banking in the turns.
import { rad, smooth } from './util.js';

const STRAIGHT = 700; // m
const RADIUS = 260; // m
const BANK = 26; // degrees in the middle of the turns

export default function buildOval() {
  const control = [];
  for (let x = -STRAIGHT / 2; x < STRAIGHT / 2; x += 70) control.push({ x, z: 0, y: 0, bank: 0 });
  const turn = (cx, cz, from) => {
    const steps = 18;
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const a = rad(from - 180 * t);
      const bank = -BANK * smooth(0, 0.3, t) * (1 - smooth(0.7, 1, t)); // negative: left side lower
      control.push({ x: cx + RADIUS * Math.cos(a), z: cz + RADIUS * Math.sin(a), y: 0, bank });
    }
  };
  turn(STRAIGHT / 2, -RADIUS, 90);
  for (let x = STRAIGHT / 2; x > -STRAIGHT / 2; x -= 70) control.push({ x, z: -2 * RADIUS, y: 0, bank: 0 });
  turn(-STRAIGHT / 2, -RADIUS, -90);

  return {
    id: 'oval',
    name: 'Thunder Speedway',
    blurb: 'NASCAR-style banked oval. Flat out, but the wall is right there.',
    control,
    options: { spacing: 3, width: 24, checkpointEvery: 250 },
    base: () => 0,
    botSpeedScale: 1.35,
    theme: { kind: 'oval', sky: [0x3f7fd6, 0xcfe6f7], fog: [0xcfe6f7, 600, 3200], terrainSize: 1700, terrainCell: 8, ground: { low: 0x3d7a34, high: 0x5c9a3c, rock: 0x6b7a60 }, trees: 0 },
    center: { x: 0, z: -RADIUS },
    shortcuts: [],
  };
}
