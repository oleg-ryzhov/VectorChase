// Players and scores, kept as plain readable JSON text in the browser's localStorage.
// There are NO passwords and NO encryption yet: anyone using this browser can sign in as any name.
// Pure logic apart from the storage object passed in (localStorage in the browser, a fake in tests).

export const PROFILES_KEY = 'vectorchase.profiles';
export const SETTINGS_KEY = 'vectorchase.settings';

const NAME_PATTERN = /^[A-Za-z0-9_-]{3,16}$/;
const DIFFICULTY_IDS = ['easy', 'medium', 'hard'];

function readJson(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();

export function validateUsername(input) {
  const name = String(input ?? '').trim();
  if (!NAME_PATTERN.test(name)) {
    return { ok: false, error: 'Use 3 to 16 letters, numbers, _ or -.' };
  }
  return { ok: true, name };
}

function normalizeUser(u) {
  const num = (v) => (Number.isFinite(v) ? v : 0);
  return {
    name: u.name,
    skin: typeof u.skin === 'string' ? u.skin : 'red',
    createdAt: typeof u.createdAt === 'string' ? u.createdAt : '',
    races: num(u.races),
    wins: num(u.wins),
    podiums: num(u.podiums),
    points: num(u.points),
    bestLapMs: Number.isFinite(u.bestLapMs) ? u.bestLapMs : null,
  };
}

export function loadUsers(storage) {
  const parsed = readJson(storage, PROFILES_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((u) => u && typeof u.name === 'string').map(normalizeUser);
}

export function findUser(storage, name) {
  return loadUsers(storage).find((u) => sameName(u.name, String(name))) ?? null;
}

// Returns { ok: true, user } or { ok: false, error }.
export function registerUser(storage, input, skin = 'red') {
  const checked = validateUsername(input);
  if (!checked.ok) return checked;
  const users = loadUsers(storage);
  if (users.some((u) => sameName(u.name, checked.name))) {
    return { ok: false, error: 'That name is taken. Use Sign in if it is yours.' };
  }
  const user = normalizeUser({ name: checked.name, skin, createdAt: new Date().toISOString() });
  users.push(user);
  if (!writeJson(storage, PROFILES_KEY, users)) {
    return { ok: false, error: 'Could not save (storage is blocked or full).' };
  }
  return { ok: true, user };
}

export function signIn(storage, input) {
  const checked = validateUsername(input);
  if (!checked.ok) return checked;
  const user = findUser(storage, checked.name);
  return user ? { ok: true, user } : { ok: false, error: 'No player with that name. Use Register.' };
}

function updateUser(storage, name, change) {
  const users = loadUsers(storage);
  const user = users.find((u) => sameName(u.name, name));
  if (!user) return null;
  change(user);
  return writeJson(storage, PROFILES_KEY, users) ? user : null;
}

export function setUserSkin(storage, name, skinId) {
  return updateUser(storage, name, (u) => {
    u.skin = skinId;
  });
}

// result: { position, points, bestLapMs }. Returns the updated user, or null if not saved.
export function recordRace(storage, name, { position, points, bestLapMs }) {
  return updateUser(storage, name, (u) => {
    u.races += 1;
    if (position === 1) u.wins += 1;
    if (position <= 3) u.podiums += 1;
    u.points += points;
    if (Number.isFinite(bestLapMs) && (u.bestLapMs === null || bestLapMs < u.bestLapMs)) {
      u.bestLapMs = bestLapMs;
    }
  });
}

function compareUsers(a, b) {
  if (b.points !== a.points) return b.points - a.points;
  if (b.wins !== a.wins) return b.wins - a.wins;
  const lapA = a.bestLapMs ?? Infinity;
  const lapB = b.bestLapMs ?? Infinity;
  if (lapA !== lapB) return lapA - lapB;
  return a.name.localeCompare(b.name);
}

export function leaderboard(storage, limit = 20) {
  return loadUsers(storage).sort(compareUsers).slice(0, limit);
}

function clampInt(value, lo, hi, fallback) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
}

// Menu choices that are remembered between visits.
export function loadSettings(storage) {
  const raw = readJson(storage, SETTINGS_KEY, {});
  const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    user: typeof s.user === 'string' && s.user ? s.user : null,
    skin: typeof s.skin === 'string' ? s.skin : 'red',
    laps: clampInt(s.laps, 1, 5, 3),
    bots: clampInt(s.bots, 1, 5, 3),
    difficulty: DIFFICULTY_IDS.includes(s.difficulty) ? s.difficulty : 'medium',
  };
}

export function saveSettings(storage, settings) {
  return writeJson(storage, SETTINGS_KEY, settings);
}
