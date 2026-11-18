// Numbers behind the sounds: how car state maps to pitch and volume. Pure logic, no Web Audio here.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Master volume choices in the menu.
export const SOUND_LEVELS = { off: 0, low: 0.15, medium: 0.3, high: 0.6 };

// A four-stroke engine fires about twice per revolution.
export function engineFrequency(rpm) {
  return (clamp(rpm, 500, 12000) / 60) * 2;
}

// 0..0.9: quiet at idle, louder with throttle and revs.
export function engineGain(throttle, rpm) {
  return 0.2 + 0.5 * clamp(throttle, 0, 1) + 0.2 * clamp(rpm / 8000, 0, 1);
}

// Brighter tone when pushing hard.
export function engineCutoff(throttle, rpm) {
  return 300 + rpm * 0.35 + 900 * clamp(throttle, 0, 1);
}

// Tyres squeal once a wheel slides (slip above 1) while the car is moving on the ground.
export function squealGain(maxSlip, speed, airborne) {
  if (airborne) return 0;
  return clamp((maxSlip - 1.05) / 0.6, 0, 1) * clamp(speed / 6, 0, 1) * 0.5;
}

export function windGain(speed) {
  return clamp(speed / 70, 0, 1) ** 1.5 * 0.35;
}

// Other cars get quieter with distance (metres).
export function distanceGain(distance) {
  return 1 / (1 + (distance / 12) ** 2);
}

// A sudden loss of speed (m/s within one frame) is a crash. Returns 0 for ordinary braking.
export function crashStrength(speedDrop) {
  return clamp((speedDrop - 4) / 12, 0, 1);
}

// vyDown: downward speed in m/s at touchdown.
export function landingStrength(vyDown) {
  return clamp((vyDown - 3) / 10, 0, 1);
}
