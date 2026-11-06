// Single source of truth for every tunable value.
// Physics, UI, and bots read through getParam(); nothing caches values.

export const PARAMS = [
  {
    id: 'chassis.mass',
    group: 'Chassis',
    label: 'Mass',
    unit: 'kg',
    min: 500,
    max: 3000,
    step: 10,
    default: 1200,
    description: 'Total vehicle mass including driver.',
  },
  {
    id: 'engine.power',
    group: 'Engine',
    label: 'Peak power',
    unit: 'kW',
    min: 50,
    max: 800,
    step: 5,
    default: 250,
    description: 'Peak engine output.',
  },
  {
    id: 'tire.friction',
    group: 'Tires',
    label: 'Friction coefficient',
    unit: 'μ',
    min: 0.1,
    max: 2,
    step: 0.01,
    default: 1.0,
    description: 'Scales maximum tire grip.',
  },
];

const defs = new Map(PARAMS.map((p) => [p.id, p]));
const values = new Map(PARAMS.map((p) => [p.id, p.default]));

function getDef(id) {
  const def = defs.get(id);
  if (!def) throw new Error(`Unknown parameter: ${id}`);
  return def;
}

export function getParam(id) {
  getDef(id);
  return values.get(id);
}

// Returns the stored value after the write. Invalid input leaves the
// current value unchanged. Out-of-range input is clamped.
export function setParam(id, value) {
  const def = getDef(id);
  if (typeof value === 'string' && value.trim() === '') return values.get(id);
  const n = Number(value);
  if (!Number.isFinite(n)) return values.get(id);
  const clamped = Math.min(def.max, Math.max(def.min, n));
  values.set(id, clamped);
  return clamped;
}

export function resetParam(id) {
  const def = getDef(id);
  values.set(id, def.default);
  return def.default;
}

export function resetAll() {
  for (const def of PARAMS) values.set(def.id, def.default);
}