// Finds terrain that would poke into a tunnel bore. Pure logic: no DOM or Three.js imports.

const CELL = 16; // m, hash grid cell

// points: track points; dims: { halfWidth (to the liner wall), wallH (straight wall height) }.
// Returns inTube(x, y, z): true when the position is inside the tunnel's arched bore.
export function createTunnelCutter(points, { halfWidth, wallH }) {
  const grid = new Map();
  points.forEach((p, i) => {
    if (p.mode !== 't') return;
    const key = Math.floor(p.x / CELL) * 100003 + Math.floor(p.z / CELL);
    if (grid.has(key)) grid.get(key).push(i);
    else grid.set(key, [i]);
  });
  const archH = halfWidth * 0.5;
  const reach = halfWidth + 3;
  return function inTube(x, y, z) {
    if (grid.size === 0) return false;
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    let best = null;
    let bestD = reach * reach;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (const i of grid.get((cx + dx) * 100003 + (cz + dz)) ?? []) {
          const p = points[i];
          const d = (p.x - x) ** 2 + (p.z - z) ** 2;
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }
      }
    }
    if (!best) return false;
    const o = (x - best.x) * best.nx + (z - best.z) * best.nz;
    const a = (x - best.x) * best.tx + (z - best.z) * best.tz;
    if (Math.abs(o) >= halfWidth || Math.abs(a) > 4) return false; // beside the point, or at a portal plane's far side
    const floor = best.y - o * Math.tan(best.bank) - 1.5;
    const roof = floor + 1.5 + wallH + archH * Math.sqrt(1 - (o / halfWidth) ** 2) + 0.25;
    return y > floor && y < roof;
  };
}

// Drops every triangle that has a sample point (a 5 x 5 barycentric grid) inside the bore.
// positions: x, y, z triples; indices: triangle corner indices. Returns a new index array.
export function cullTunnelTriangles(positions, indices, inTube) {
  const out = [];
  const N = 4;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    let hit = false;
    for (let u = 0; u <= N && !hit; u++) {
      for (let v = 0; v <= N - u && !hit; v++) {
        const w = N - u - v;
        const q = (k) => (u * positions[a + k] + v * positions[b + k] + w * positions[c + k]) / N;
        hit = inTube(q(0), q(1), q(2));
      }
    }
    if (!hit) out.push(indices[t], indices[t + 1], indices[t + 2]);
  }
  return out;
}
