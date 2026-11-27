// Ghost car: records the player's best lap and plays it back. Pure logic: no DOM or Three.js imports.
// A ghost is { ms, step, frames, dist }: lap time in ms, seconds between frames, a flat list of numbers
// (x, y, z, yaw, pitch, roll per frame) and, optionally, the distance driven along the track at each frame
// (used for the live time difference; ghosts saved before it existed have none).
// There are two slots per user and map: 'fly' (a lap that starts at the line) and 'start' (lap 1, from the grid).
// The storage object is passed in, as in profiles.js.

export const GHOSTS_KEY = 'vectorchase.ghosts';
export const GHOST_STEP = 0.1;
const FIELDS = 6;
const round = (v, k) => Math.round(v * k) / k;

export class GhostRecorder {
  constructor() {
    this.reset();
  }

  reset() {
    this.frames = [];
    this.dist = [];
  }

  // t: seconds since the lap began. state: { x, y, z, yaw, pitch, roll }. dist: metres driven along the track.
  // Keeps one frame per GHOST_STEP.
  sample(t, state, dist = 0) {
    if (t < (this.frames.length / FIELDS) * GHOST_STEP) return;
    this._push(state, dist);
  }

  // Closes the lap with a last frame and returns the ghost. seconds: the lap time.
  finish(seconds, state, dist = 0) {
    this._push(state, dist);
    return { ms: Math.round(seconds * 1000), step: GHOST_STEP, frames: this.frames.slice(), dist: this.dist.slice() };
  }

  _push(s, dist) {
    // Never goes backwards, so the distances can be searched.
    this.dist.push(Math.max(round(dist, 10), this.dist.length ? this.dist[this.dist.length - 1] : -Infinity));
    this.frames.push(round(s.x, 100), round(s.y, 100), round(s.z, 100), round(s.yaw, 1000), round(s.pitch, 1000), round(s.roll, 1000));
  }
}

// Where the ghost is t seconds into its lap (held at the ends), or null if it has too few frames.
export function ghostPose(ghost, t) {
  const F = ghost.frames;
  const n = F.length / FIELDS;
  if (n < 2) return null;
  const f = Math.min(Math.max(t / ghost.step, 0), n - 1);
  const i = Math.min(Math.floor(f), n - 2);
  const k = f - i;
  const a = i * FIELDS;
  const b = a + FIELDS;
  const lerp = (j) => F[a + j] + (F[b + j] - F[a + j]) * k;
  const turn = F[b + 3] - F[a + 3];
  return { x: lerp(0), y: lerp(1), z: lerp(2), yaw: F[a + 3] + Math.atan2(Math.sin(turn), Math.cos(turn)) * k, pitch: lerp(4), roll: lerp(5) };
}

// Seconds into the ghost's lap at which it had driven `distance` metres, or null if it has no distances.
export function ghostTimeAt(ghost, distance) {
  const d = ghost.dist;
  if (!d || d.length < 2 || d.length !== ghost.frames.length / FIELDS) return null;
  if (distance <= d[0]) return 0;
  const last = d.length - 1;
  if (distance >= d[last]) return last * ghost.step;
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (d[mid] <= distance) lo = mid;
    else hi = mid;
  }
  const span = d[hi] - d[lo];
  return (lo + (span > 0 ? (distance - d[lo]) / span : 0)) * ghost.step;
}

function isValid(g) {
  return (
    g !== null &&
    typeof g === 'object' &&
    Number.isFinite(g.ms) &&
    g.step === GHOST_STEP &&
    Array.isArray(g.frames) &&
    g.frames.length >= 2 * FIELDS &&
    g.frames.length % FIELDS === 0 &&
    g.frames.every(Number.isFinite)
  );
}

// 'fly' keeps the original key, so ghosts saved earlier still load.
const keyOf = (user, map, slot = 'fly') => `${String(user).toLowerCase()}|${map}${slot === 'fly' ? '' : `|${slot}`}`;

function readAll(storage) {
  const raw = storage.getItem(GHOSTS_KEY);
  const all = raw ? JSON.parse(raw) : {};
  return all && typeof all === 'object' && !Array.isArray(all) ? all : {};
}

export function loadGhost(storage, user, map, slot = 'fly') {
  try {
    const g = readAll(storage)[keyOf(user, map, slot)];
    if (!isValid(g)) return null;
    const n = g.frames.length / FIELDS;
    const goodDist = Array.isArray(g.dist) && g.dist.length === n && g.dist.every(Number.isFinite);
    if (goodDist) return g;
    const { dist, ...withoutDist } = g;
    return withoutDist;
  } catch {
    return null;
  }
}

// Returns true if saved.
export function saveGhost(storage, user, map, ghost, slot = 'fly') {
  try {
    let all;
    try {
      all = readAll(storage);
    } catch {
      all = {};
    }
    all[keyOf(user, map, slot)] = ghost;
    storage.setItem(GHOSTS_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

// Removes both slots for this user and map. Returns true if storage was written.
export function deleteGhost(storage, user, map) {
  try {
    const all = readAll(storage);
    delete all[keyOf(user, map, 'fly')];
    delete all[keyOf(user, map, 'start')];
    storage.setItem(GHOSTS_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}
