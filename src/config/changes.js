// Which settings differ from their defaults. Pure logic: no DOM or Three.js imports.

import { PARAMS, getParam } from './registry.js';

export function formatValue(value) {
  return String(Number(value.toFixed(4)));
}

export function listChanges() {
  return PARAMS.filter((p) => getParam(p.id) !== p.default).map((p) => ({
    id: p.id,
    label: p.label,
    unit: p.unit,
    value: getParam(p.id),
    default: p.default,
  }));
}
