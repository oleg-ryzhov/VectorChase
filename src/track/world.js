// Ground height, surface grip and wall queries for the road and the terrain around it.
// Pure logic: no DOM or Three.js imports.

export const WALL_GAP = 0.3; // m between the road edge and the wall
export const WALL_HEIGHT = 1.2; // m

const SHOULDER = 14; // m of flat ground beside the road edge
const BLEND = 50; // m over which the terrain eases from road height to its natural height
const ROAD_DEPTH = 0.1; // terrain sits this far under the road so the road mesh never flickers
const LIP = 1.5; // m over which the driving surface drops to the terrain at the road edge
const SURFACE_FADE = 1.5; // m over which tarmac turns into grass at the road edge
const GRASS_GRIP = 0.55; // tire grip on grass compared with tarmac
const GRASS_DRAG = 4; // rolling resistance on grass compared with tarmac

function smoothstep01(t) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

// Closest point to (x, z) on the segment a-b, as { dist, y, offset, nx, nz }.
// offset is the signed distance across the segment (positive to the right of the direction of
// travel) and (nx, nz) is the segment's right-hand unit normal.
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
    offset: (x - px) * nx + (z - pz) * nz,
    nx,
    nz,
  };
}

// baseHeight(x, z) is the natural ground height away from the road.
export function createWorld(track, baseHeight = () => 0) {
  const { points } = track;
  const n = points.length;
  const half = track.width / 2;
  const flatEdge = half + SHOULDER;
  const reach = flatEdge + BLEND;
  const cell = reach; // the 3x3 block of cells around a query covers every point within `reach`
  const cellKey = (cx, cz) => (cx + 4096) * 8192 + (cz + 4096);

  const grid = new Map();
  for (let i = 0; i < n; i++) {
    const key = cellKey(Math.floor(points[i].x / cell), Math.floor(points[i].z / cell));
    const list = grid.get(key);
    if (list) list.push(i);
    else grid.set(key, [i]);
  }

  // Closest point on the centre line, or null if the road is farther than `reach`.
  function nearest(x, z) {
    const cx = Math.floor(x / cell);
    const cz = Math.floor(z / cell);
    let best = -1;
    let bestD2 = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = grid.get(cellKey(cx + dx, cz + dz));
        if (!list) continue;
        for (const i of list) {
          const p = points[i];
          const d2 = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
          if (d2 < bestD2) {
            bestD2 = d2;
            best = i;
          }
        }
      }
    }
    if (best < 0) return null;

    // Project onto the two segments next to the nearest point, so heights are exact on slopes.
    const p = points[best];
    const s1 = closestOnSegment(points[(best - 1 + n) % n], p, x, z);
    const s2 = closestOnSegment(p, points[(best + 1) % n], x, z);
    const hit = s1.dist < s2.dist ? s1 : s2;
    return hit.dist <= reach ? hit : null;
  }

  function height(x, z, withLip, hit) {
    const base = baseHeight(x, z);
    if (!hit) return base;
    const roadLevel = hit.y - ROAD_DEPTH;
    const t = smoothstep01((hit.dist - flatEdge) / BLEND);
    let h = roadLevel + (base - roadLevel) * t;
    if (withLip) h += ROAD_DEPTH * (1 - smoothstep01((hit.dist - half) / LIP));
    return h;
  }

  // Everything the car physics needs about one spot: driving height and the surface under it.
  function sample(x, z) {
    const hit = nearest(x, z);
    const grass = hit ? smoothstep01((hit.dist - half) / SURFACE_FADE) : 1; // 0 on the road, 1 on grass
    return {
      height: height(x, z, true, hit),
      grip: 1 + (GRASS_GRIP - 1) * grass,
      drag: 1 + (GRASS_DRAG - 1) * grass,
    };
  }

  return {
    // Height of the surface a car drives on: the road itself, or the terrain.
    groundHeight: (x, z) => height(x, z, true, nearest(x, z)),
    // Height of the terrain mesh (0.1 m under the road).
    terrainHeight: (x, z) => height(x, z, false, nearest(x, z)),
    sample,
    // Signed distance from the centre line (positive = right) and the right-hand normal, or null.
    lateral(x, z) {
      const hit = nearest(x, z);
      return hit ? { offset: hit.offset, nx: hit.nx, nz: hit.nz } : null;
    },
    wallOffset: half + WALL_GAP, // distance from the centre line to the inner face of the walls
    nearest,
  };
}
