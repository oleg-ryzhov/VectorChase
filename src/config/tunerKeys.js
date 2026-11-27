// Keyboard rules for the car tuner. Pure logic: no DOM imports.
// Each setting on the page shown gets a slot (1 to 10) and each slot has a key the player can change.

export const SLOT_COUNT = 10;
export const DEFAULT_SLOT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];

const RESERVED = new Set(['KeyE']); // E opens and closes the tuner

// Letters and number keys (top row or keypad) can be bound.
export function isBindable(code) {
  return typeof code === 'string' && /^(Digit[0-9]|Numpad[0-9]|Key[A-Z])$/.test(code) && !RESERVED.has(code);
}

// The text on a key cap.
export function keyLabel(code) {
  if (typeof code !== 'string') return '';
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  if (code.startsWith('Key')) return code.slice(3);
  return code;
}

const round6 = (n) => Number(n.toFixed(6));

// How far Left / Right moves a slider: about 1/40 of its range, a whole number of the slider's own steps.
export function keyStep(def) {
  const raw = (def.max - def.min) / 40;
  return Math.max(def.step, round6(Math.round(raw / def.step) * def.step));
}

// The value after one Left (direction -1) or Right (+1) press. fine: the slider's own small step.
export function stepValue(def, current, direction, fine = false) {
  const next = current + direction * (fine ? def.step : keyStep(def));
  const snapped = def.min + Math.round((next - def.min) / def.step) * def.step;
  return Math.min(def.max, Math.max(def.min, round6(snapped)));
}
