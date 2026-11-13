// Saved parameter presets. Pure logic apart from the storage object passed in
// (localStorage in the browser, a fake in tests).

import { PARAMS, getParam, setParam, resetAll } from './registry.js';

export const PRESETS_KEY = 'vectorchase.presets';
const MAX_NAME_LENGTH = 40;

export function snapshotValues() {
  const values = {};
  for (const p of PARAMS) values[p.id] = getParam(p.id);
  return values;
}

// Resets everything first, so parameters missing from an older preset go back to defaults.
export function applyValues(values) {
  resetAll();
  if (!values || typeof values !== 'object') return;
  for (const p of PARAMS) {
    if (Object.prototype.hasOwnProperty.call(values, p.id)) setParam(p.id, values[p.id]);
  }
}

export function cleanName(name) {
  return String(name ?? '').trim().slice(0, MAX_NAME_LENGTH);
}

// Stored as a list of { name, values }. Anything unreadable counts as "no presets".
function readAll(storage) {
  try {
    const raw = storage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) => e && typeof e.name === 'string' && e.values && typeof e.values === 'object'
    );
  } catch {
    return [];
  }
}

function writeAll(storage, presets) {
  try {
    storage.setItem(PRESETS_KEY, JSON.stringify(presets));
    return true;
  } catch {
    return false;
  }
}

export function listPresets(storage) {
  return readAll(storage)
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

export function readPreset(storage, name) {
  const found = readAll(storage).find((e) => e.name === name);
  return found ? found.values : null;
}

// Returns true if the preset was stored.
export function savePreset(storage, name, values) {
  const clean = cleanName(name);
  if (!clean) return false;
  const presets = readAll(storage).filter((e) => e.name !== clean);
  presets.push({ name: clean, values });
  return writeAll(storage, presets);
}

// Returns true if a preset was removed.
export function deletePreset(storage, name) {
  const presets = readAll(storage);
  const kept = presets.filter((e) => e.name !== name);
  if (kept.length === presets.length) return false;
  return writeAll(storage, kept);
}
