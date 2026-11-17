// Ground, surface and wall queries for a track that can bank, bridge and tunnel over itself.
// Several road layers can sit above the same (x, z); queries take the car's height (y) to pick one.
// Pure logic: no DOM or Three.js imports.

export const WALL_GAP = 0.3; // m between the road edge and the wall
export const WALL_HEIGHT = 1.2; // m

const SHOULDER = 14; // m of flat ground beside the road edge
const BLEND = 50; // m over which the terrain eases from road height to its natural height
const ROAD_DEPTH = 0.3; // terrain sits this far under the road so the road mesh never flickers
const LIP = 1.5; // m over which the driving surface drops to the terrain at the road edge
const SURFACE_FADE = 1.5; // m over which tarmac turns into grass at the road edge
const GRASS_GRIP = 0.55; // tire grip on grass compared with tarmac
const GRASS_DRAG = 4; // rolling resistance on grass compared with tarmac
const STEP_UP = 0.9; // m a car can climb in one go; anything taller is a wall
const SOLID_STEP = 0.6; // terrain this far above the car blocks it
const LAYER_CELL = 30;
const LAYER_GAP = 40; // track points apart that count as a different stretch of road

const smooth01 = (t) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

// Closest point to (x, z) on segment a-b. offset is positive to the right of the direction of travel.
function closestOnSegment(a, b, x, z) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((x - a.x) * dx + (z - a.z) * dz) / len2 : 0;
  t = Math.min(1, Math.max(0, t));
  const px = a.x + dx * t;
  const pz = a.z + dz * t;
  const len = Math.sqrt(len2) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  return {
    dist: Math.hypot(x - px, z - pz),
    y: a.y + (b.y - a.y) * t,
    tanBank: Math.tan(a.bank + (b.bank - a.bank) * t),
    offset: (x - px) * nx + (z - pz) * nz,
    nx,
    nz,
    mode: t < 0.5 ? a.mode : b.mode,
    gl: a.gl,
    gr: a.gr,
  };
}

function buildGrid(points, cell, include) {
  const grid = new Map();
  points.forEach((p, i) => {
    if (!include(p)) return;
    const key = Math.floor(p.x / cell) * 100003 + Math.floor(p.z / cell);
    const list = grid.get(key);
    if (list) list.push(i);
    else grid.set(key, [i]);
  });
  return grid;
}

// opts: { features: [(x, z) => metres added to the terrain], obstacles: [{ x0, x1, z0, z1, top }],
//         waterLevel, killY, terrainGrip }
export function createWorld(track, baseHeight = () => 0, opts = {}) {
  const { points } = track;
  const n = points.length;
  const half = track.width / 2;
  const { features = [], obstacles = [], waterLevel = -Infinity, killY = -Infinity, terrainGrip = GRASS_GRIP } = opts;
  const flatEdge = half + SHOULDER;
  const reach = flatEdge + BLEND;
  const wrap = (i) => ((i % n) + n) % n;

  // ---- Road layers: every stretch of road within reach of a point, with its own height ----
  const layerGrid = buildGrid(points, LAYER_CELL, () => true);
  const maxLateral = half + 6;

  function hitAt(i, x, z) {
    const p = points[i];
    const s1 = closestOnSegment(points[wrap(i - 1)], p, x, z);
    const s2 = closestOnSegment(p, points[wrap(i + 1)], x, z);
    return s1.dist < s2.dist ? s1 : s2;
  }

  function layerHits(x, z) {
    const cx = Math.floor(x / LAYER_CELL);
    const cz = Math.floor(z / LAYER_CELL);
    const found = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = layerGrid.get((cx + dx) * 100003 + (cz + dz));
        if (!list) continue;
        for (const i of list) {
          const d2 = (points[i].x - x) ** 2 + (points[i].z - z) ** 2;
          if (d2 <= maxLateral * maxLateral) found.push([i, d2]);
        }
      }
    }
    if (found.length === 0) return found;
    found.sort((a, b) => a[0] - b[0]);
    const clusters = [[found[0]]];
    for (let k = 1; k < found.length; k++) {
      if (found[k][0] - found[k - 1][0] > LAYER_GAP) clusters.push([]);
      clusters[clusters.length - 1].push(found[k]);
    }
    if (clusters.length > 1 && found[0][0] + n - found[found.length - 1][0] <= LAYER_GAP) {
      clusters[0] = clusters.pop().concat(clusters[0]);
    }
    return clusters.map((c) => hitAt(c.reduce((best, f) => (f[1] < best[1] ? f : best))[0], x, z));
  }

  const roadHeight = (hit) => hit.y - hit.offset * hit.tanBank;

  // ---- Terrain: natural ground, flattened beside ground-level road, plus features ----
  const groundGrid = buildGrid(points, reach, (p) => p.mode === 'g');
  const bridgeGrid = buildGrid(points, LAYER_CELL, (p) => p.mode === 'b');

  // Terrain never rises into a bridge deck: it is cut away just under it.
  function bridgeLimit(x, z) {
    const cx = Math.floor(x / LAYER_CELL);
    const cz = Math.floor(z / LAYER_CELL);
    let best = null;
    let bestD = half + 8;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (const i of bridgeGrid.get((cx + dx) * 100003 + (cz + dz)) ?? []) {
          const d = Math.hypot(points[i].x - x, points[i].z - z);
          if (d < bestD) {
            bestD = d;
            best = points[i];
          }
        }
      }
    }
    return best && { limit: best.y - 1.9, d: bestD };
  }
  const featureHeight = (x, z) => {
    let h = 0;
    for (const f of features) h += f(x, z);
    return h;
  };

  // Closest ground-level road point, or null when none is within reach.
  function carveHit(x, z) {
    const cx = Math.floor(x / reach);
    const cz = Math.floor(z / reach);
    let best = -1;
    let bestD2 = reach * reach;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = groundGrid.get((cx + dx) * 100003 + (cz + dz));
        if (!list) continue;
        for (const i of list) {
          const d2 = (points[i].x - x) ** 2 + (points[i].z - z) ** 2;
          if (d2 < bestD2) {
            bestD2 = d2;
            best = i;
          }
        }
      }
    }
    return best < 0 ? null : hitAt(best, x, z);
  }

  function terrainAt(x, z, hit, withLip) {
    const base = baseHeight(x, z);
    let h = base;
    if (hit) {
      const edge = Math.max(-half, Math.min(half, hit.offset));
      const level = hit.y - edge * hit.tanBank - ROAD_DEPTH;
      const t = smooth01((hit.dist - flatEdge) / BLEND);
      h = level + (base - level) * t;
      if (withLip) h += ROAD_DEPTH * (1 - smooth01((hit.dist - half) / LIP));
    }
    const bridge = bridgeLimit(x, z);
    if (bridge && h > bridge.limit) h = bridge.limit + (h - bridge.limit) * smooth01((bridge.d - half - 2) / 6);
    return h + featureHeight(x, z);
  }

  // ---- Choosing the surface under a car ----
  // Returns { height, road (hit or null), grass (0..1) }.
  function surface(x, z, y) {
    const hit = carveHit(x, z);
    const terrain = terrainAt(x, z, hit, true);
    let best = null;
    let bestH = -Infinity;
    for (const l of layerHits(x, z)) {
      if (Math.abs(l.offset) > half) continue;
      const h = roadHeight(l);
      const usable = y === undefined || h <= y + STEP_UP;
      if (usable && h > bestH) {
        best = l;
        bestH = h;
      }
    }
    if (best) return { height: bestH, road: best, grass: 0 }; // on a road: the road is the surface
    const grass = hit ? smooth01((hit.dist - half) / SURFACE_FADE) : 1;
    return { height: terrain, road: null, grass };
  }

  // ---- Obstacles (buildings, stands) ----
  const OB_CELL = 64;
  const obGrid = new Map();
  obstacles.forEach((o, i) => {
    for (let cx = Math.floor(o.x0 / OB_CELL); cx <= Math.floor(o.x1 / OB_CELL); cx++) {
      for (let cz = Math.floor(o.z0 / OB_CELL); cz <= Math.floor(o.z1 / OB_CELL); cz++) {
        const key = cx * 100003 + cz;
        if (obGrid.has(key)) obGrid.get(key).push(i);
        else obGrid.set(key, [i]);
      }
    }
  });

  // A solid thing at (x, z) for a circle of radius r at height y, as { nx, nz, depth } with the
  // normal pointing from the car into the thing, or null.
  function solid(x, z, y, r = 0.95) {
    const list = obGrid.get(Math.floor(x / OB_CELL) * 100003 + Math.floor(z / OB_CELL));
    if (list) {
      for (const i of list) {
        const o = obstacles[i];
        if (o.top < y + 0.5) continue;
        const px = Math.min(o.x1, Math.max(o.x0, x));
        const pz = Math.min(o.z1, Math.max(o.z0, z));
        const d = Math.hypot(x - px, z - pz);
        if (d >= r) continue;
        if (d > 1e-6) return { nx: (px - x) / d, nz: (pz - z) / d, depth: r - d };
        // Centre inside the box: leave by the nearest face.
        const out = [x - o.x0, o.x1 - x, z - o.z0, o.z1 - z];
        const k = out.indexOf(Math.min(...out));
        return { nx: [1, -1, 0, 0][k], nz: [0, 0, 1, -1][k], depth: out[k] + r };
      }
    }
    if (surface(x, z, y).road) return null;
    // Terrain too high to climb is a wall. Look uphill from the centre for where it starts.
    const gx = terrainAt(x + 1, z, null, false) - terrainAt(x - 1, z, null, false);
    const gz = terrainAt(x, z + 1, null, false) - terrainAt(x, z - 1, null, false);
    const g = Math.hypot(gx, gz) / 2;
    if (g < 0.3) return null; // too gentle to be a wall
    const ux = gx / 2 / g;
    const uz = gz / 2 / g;
    for (let d = 0; d < r; d += r / 4) {
      if (terrainAt(x + ux * d, z + uz * d, null, true) - y > SOLID_STEP) return { nx: ux, nz: uz, depth: r - d };
    }
    return null;
  }

  return {
    // Height of the surface a car at height y drives on. Without y, the highest surface.
    groundHeight: (x, z, y) => surface(x, z, y).height,
    // Height of the terrain mesh (0.1 m under ground-level road).
    terrainHeight: (x, z) => terrainAt(x, z, carveHit(x, z), false),
    sample(x, z, y) {
      const s = surface(x, z, y);
      return {
        height: s.height,
        grip: 1 + (terrainGrip - 1) * s.grass,
        drag: 1 + (GRASS_DRAG - 1) * s.grass,
      };
    },
    // Distance across the road (positive = right), its normal, and whether a wall stands there.
    lateral(x, z, y) {
      let best = null;
      let bestGap = Infinity;
      for (const l of layerHits(x, z)) {
        const gap = y === undefined ? -roadHeight(l) : Math.abs(roadHeight(l) - y);
        if (gap < bestGap && (y === undefined || gap < 4)) {
          best = l;
          bestGap = gap;
        }
      }
      if (!best) return null;
      return { offset: best.offset, nx: best.nx, nz: best.nz, mode: best.mode, wall: !(best.offset > 0 ? best.gr : best.gl) };
    },
    // Highest surface at or just above height y (null if there is none): where a camera can rest.
    floorHeight(x, z, y) {
      const t = terrainAt(x, z, carveHit(x, z), false);
      let best = t <= y + 1 ? t : null;
      for (const l of layerHits(x, z)) {
        const h = roadHeight(l);
        if (Math.abs(l.offset) <= half + 3 && h <= y + 1 && (best === null || h > best)) best = h;
      }
      return best;
    },
    // True when another road passes under (x, z) at least 2 m below height y (for placing bridge pillars).
    roadBelow(x, z, y, margin = 2) {
      return layerHits(x, z).some((l) => Math.abs(l.offset) < half + margin && roadHeight(l) < y - 2);
    },
    solid,
    hazard: (x, z, y) => y < waterLevel + 0.3 || y < killY,
    // Horizontal distance to the nearest road of any layer (for placing scenery).
    roadDistance(x, z) {
      let best = Infinity;
      const cx = Math.floor(x / LAYER_CELL);
      const cz = Math.floor(z / LAYER_CELL);
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          for (const i of layerGrid.get((cx + dx) * 100003 + (cz + dz)) ?? []) {
            best = Math.min(best, Math.hypot(points[i].x - x, points[i].z - z));
          }
        }
      }
      return best - half;
    },
    wallOffset: half + WALL_GAP, // distance from the centre line to the inner face of the walls
    waterLevel,
  };
}
