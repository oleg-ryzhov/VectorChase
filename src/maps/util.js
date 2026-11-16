// Helpers for authoring maps. Pure logic: no DOM or Three.js imports.

export const rad = (d) => (d * Math.PI) / 180;

export function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function hash(ix, iz) {
  const s = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Smooth value noise, 0..1.
export function noise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, z, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * f, z * f);
    amp *= 0.5;
    f *= 2;
  }
  return sum;
}

// A waypoint for route(): x, z, height and optional { r (corner radius), mode, gl, gr, bank }.
export const P = (x, z, y = 0, o = {}) => ({ x, z, y, ...o });

const COPY = ['mode', 'gl', 'gr', 'bank'];
const flagsOf = (p) => Object.fromEntries(COPY.filter((k) => p[k] !== undefined).map((k) => [k, p[k]]));

// Turns a closed list of waypoints into control points: corners are rounded and long gaps are filled in.
export function route(wps, defaultRadius = 60, maxGap = 50) {
  const n = wps.length;
  const rounded = [];
  for (let i = 0; i < n; i++) {
    const a = wps[(i - 1 + n) % n];
    const b = wps[i];
    const c = wps[(i + 1) % n];
    const l1 = Math.hypot(b.x - a.x, b.z - a.z);
    const l2 = Math.hypot(c.x - b.x, c.z - b.z);
    const d1 = [(b.x - a.x) / l1, (b.z - a.z) / l1];
    const d2 = [(c.x - b.x) / l2, (c.z - b.z) / l2];
    const cross = d1[0] * d2[1] - d1[1] * d2[0];
    const dot = d1[0] * d2[0] + d1[1] * d2[1];
    if (Math.abs(cross) < 0.03 && dot > 0) {
      rounded.push({ ...b });
      continue;
    }
    const cut = Math.min(b.r ?? defaultRadius, l1 / 2.2, l2 / 2.2);
    const p0 = [b.x - d1[0] * cut, b.z - d1[1] * cut];
    const p2 = [b.x + d2[0] * cut, b.z + d2[1] * cut];
    const y0 = a.y + (b.y - a.y) * (1 - cut / l1); // height keeps changing smoothly through the corner
    const y2 = b.y + (c.y - b.y) * (cut / l2);
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      const w0 = (1 - t) * (1 - t);
      const w1 = 2 * (1 - t) * t;
      const w2 = t * t;
      rounded.push({ x: w0 * p0[0] + w1 * b.x + w2 * p2[0], z: w0 * p0[1] + w1 * b.z + w2 * p2[1], y: w0 * y0 + w1 * b.y + w2 * y2, ...flagsOf(b) });
    }
  }
  const out = [];
  for (let i = 0; i < rounded.length; i++) {
    const a = rounded[i];
    const b = rounded[(i + 1) % rounded.length];
    out.push(a);
    const gap = Math.hypot(b.x - a.x, b.z - a.z);
    const parts = Math.floor(gap / maxGap);
    for (let k = 1; k <= parts; k++) {
      const t = k / (parts + 1);
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t, ...flagsOf(a) });
    }
  }
  return out;
}

// Terrain features: each returns metres to add at (x, z).
// A rectangle with soft edges, rotated by heading (rad), centred at (x, z); height may be negative.
export function slab({ x, z, heading = 0, length, width, height, edge = 6 }) {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  return (px, pz) => {
    const u = (px - x) * c + (pz - z) * s;
    const v = -(px - x) * s + (pz - z) * c;
    const eu = 1 - smooth(length / 2 - edge, length / 2 + edge, Math.abs(u));
    const ev = 1 - smooth(width / 2 - edge, width / 2 + edge, Math.abs(v));
    return height * eu * ev;
  };
}

// A launch ramp: rises from 0 to height along its length (heading = direction of travel).
export function ramp({ x, z, heading, length, width, height }) {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  return (px, pz) => {
    const u = (px - x) * c + (pz - z) * s;
    const v = -(px - x) * s + (pz - z) * c;
    if (u < 0 || u > length + 4) return 0;
    const lip = u > length ? 1 - (u - length) / 4 : 1; // drops away right after the lip
    return height * (u / length) * lip * (1 - smooth(width / 2 - 1.5, width / 2 + 1.5, Math.abs(v)));
  };
}

// A round hill or mountain.
export const mound = ({ x, z, radius, height, power = 2 }) => (px, pz) =>
  height * Math.max(0, 1 - Math.hypot(px - x, pz - z) / radius) ** power;
