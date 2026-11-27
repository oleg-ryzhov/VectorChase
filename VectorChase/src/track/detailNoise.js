// A small tileable noise image used as ground texture, so the terrain has grain up close.
// Pure logic: no DOM or Three.js imports.

function hash(ix, iy, seed) {
  const s = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

// Value noise that repeats every `period` cells, so the image tiles without seams.
function tileNoise(x, y, period, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = (n) => ((n % period) + period) % period;
  const a = hash(w(ix), w(iy), seed);
  const b = hash(w(ix + 1), w(iy), seed);
  const c = hash(w(ix), w(iy + 1), seed);
  const d = hash(w(ix + 1), w(iy + 1), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// size x size grey levels (0..255), mostly bright with soft dark flecks: it is multiplied onto the ground colour.
export function detailPixels(size = 256, seed = 1) {
  const out = new Uint8Array(size * size);
  const octaves = [[4, 0.3], [8, 0.25], [16, 0.2], [32, 0.15], [64, 0.1]]; // [cells across the image, weight]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (const [cells, weight] of octaves) sum += weight * tileNoise((x / size) * cells, (y / size) * cells, cells, seed);
      out[y * size + x] = Math.round(215 + 40 * Math.min(1, Math.max(0, sum))); // 215..255, mean about 238
    }
  }
  return out;
}
