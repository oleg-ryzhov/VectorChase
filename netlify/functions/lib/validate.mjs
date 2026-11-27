// Checks on a submitted lap time. Pure logic, so it is unit tested.
// A lap cannot be faster than the circuit length at a speed no car here can keep up. The speed
// is set generously (120 m/s, 432 km/h) so honest laps are never refused; the shortcut maps get
// a lower minimum because the shortcut skips part of the lap. Tighten these once you know the
// real best times (see docs/ONLINE_PLAN.txt, step 2.5).

const MAX_AVG_SPEED = 120; // m/s
export const MIN_GAP_MS = 5000; // between two submissions from one player
export const MAX_LAP_MS = 20 * 60 * 1000;

// lengthM: the lap length (from the built map). shortcut: the map has a shortcut.
export const MAP_LIMITS = {
  oval: { lengthM: 3405 },
  bowl: { lengthM: 963 },
  suzuka: { lengthM: 5802 },
  monza: { lengthM: 5788 },
  city: { lengthM: 3446 },
  alpine: { lengthM: 3757, shortcut: true },
  canyon: { lengthM: 4071, shortcut: true },
};

export function limitsFor(mapId) {
  if (typeof mapId !== 'string' || !Object.hasOwn(MAP_LIMITS, mapId)) return null;
  const { lengthM, shortcut } = MAP_LIMITS[mapId];
  return { minMs: Math.round((lengthM / MAX_AVG_SPEED) * 1000 * (shortcut ? 0.6 : 1)), maxMs: MAX_LAP_MS };
}

export function validateSubmission(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Bad request.' };
  const limits = limitsFor(body.mapId);
  if (!limits) return { ok: false, error: 'Unknown map.' };
  const { timeMs } = body;
  if (!Number.isInteger(timeMs)) return { ok: false, error: 'Bad time.' };
  if (timeMs < limits.minMs) return { ok: false, error: 'That time is not believable.' };
  if (timeMs > limits.maxMs) return { ok: false, error: 'That time is too long.' };
  return { ok: true, mapId: body.mapId, timeMs };
}
