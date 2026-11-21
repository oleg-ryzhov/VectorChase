// Where the on-screen controls sit, how big they are and how see-through. Pure logic: no DOM imports.
//
// Every control has a centre (x, y as fractions of the screen), a size multiplier, a "touch area" multiplier
// (the part that reacts to a finger, which may be larger than what is drawn) and an opacity.

// Base size of each control in "vmin" units (1/100 of the shorter screen side), so it scales with the screen.
export const CONTROLS = {
  steer: { label: 'Steering pad', icon: 'wheel', w: 62, h: 30, scheme: 'pad', x: 0.2, y: 0.8 },
  left: { label: 'Steer left', icon: 'left', w: 20, h: 20, scheme: 'arrows', x: 0.1, y: 0.8 },
  right: { label: 'Steer right', icon: 'right', w: 20, h: 20, scheme: 'arrows', x: 0.28, y: 0.8 },
  gas: { label: 'Gas', icon: 'gas', w: 20, h: 34, scheme: 'both', x: 0.9, y: 0.76 },
  brake: { label: 'Brake', icon: 'brake', w: 16, h: 24, scheme: 'both', x: 0.74, y: 0.85 },
  handbrake: { label: 'Handbrake', icon: 'handbrake', w: 16, h: 12, scheme: 'both', x: 0.74, y: 0.62 },
  pause: { label: 'Pause', icon: 'pause', w: 11, h: 11, scheme: 'both', x: 0.05, y: 0.11 },
  settings: { label: 'Settings', icon: 'gear', w: 11, h: 11, scheme: 'both', x: 0.15, y: 0.11 },
  camera: { label: 'Camera', icon: 'camera', w: 11, h: 11, scheme: 'both', x: 0.25, y: 0.11 },
};

export const LIMITS = { scale: [0.6, 1.8], hit: [1, 2.2], opacity: [0.15, 1] };
export const MIN_TOUCH = 44; // px: no touch area is ever smaller than this

// The controls shown for a steering style.
export function controlsFor(scheme) {
  return Object.keys(CONTROLS).filter((id) => CONTROLS[id].scheme === 'both' || CONTROLS[id].scheme === scheme);
}

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export function defaultEntry(id) {
  const c = CONTROLS[id];
  return { x: c.x, y: c.y, scale: 1, hit: 1.15, opacity: 0.7 };
}

export function defaultLayout() {
  return Object.fromEntries(Object.keys(CONTROLS).map((id) => [id, defaultEntry(id)]));
}

// Stored layouts can be missing or damaged: keep valid numbers, default the rest, clamp everything.
export function sanitizeLayout(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  for (const id of Object.keys(CONTROLS)) {
    const d = defaultEntry(id);
    const e = src[id] && typeof src[id] === 'object' ? src[id] : {};
    out[id] = {
      x: clamp(num(e.x, d.x), [0, 1]),
      y: clamp(num(e.y, d.y), [0, 1]),
      scale: clamp(num(e.scale, d.scale), LIMITS.scale),
      hit: clamp(num(e.hit, d.hit), LIMITS.hit),
      opacity: clamp(num(e.opacity, d.opacity), LIMITS.opacity),
    };
  }
  return out;
}

// Pixel boxes for a control on a vw x vh screen: the drawn box and the touch box, both centred on the same point.
// The touch box is kept fully on screen, and the drawn box moves with it.
export function boxFor(id, entry, vw, vh) {
  const unit = Math.min(vw, vh) / 100;
  const c = CONTROLS[id];
  // Nothing is ever larger than the screen: the touch box is capped first, and the drawn box stays inside it.
  const hw = Math.min(Math.max(c.w * unit * entry.scale * entry.hit, MIN_TOUCH), vw);
  const hh = Math.min(Math.max(c.h * unit * entry.scale * entry.hit, MIN_TOUCH), vh);
  const w = Math.min(c.w * unit * entry.scale, hw);
  const h = Math.min(c.h * unit * entry.scale, hh);
  const cx = Math.min(vw - hw / 2, Math.max(hw / 2, entry.x * vw));
  const cy = Math.min(vh - hh / 2, Math.max(hh / 2, entry.y * vh));
  return { cx, cy, w, h, hw, hh, left: cx - w / 2, top: cy - h / 2, hitLeft: cx - hw / 2, hitTop: cy - hh / 2 };
}

// Mirrors the layout left to right, for left-handed play.
export function mirrorLayout(layout) {
  return Object.fromEntries(Object.entries(layout).map(([id, e]) => [id, { ...e, x: Math.round((1 - e.x) * 1000) / 1000 }]));
}

export function boxesOverlap(a, b) {
  return a.hitLeft < b.hitLeft + b.hw && b.hitLeft < a.hitLeft + a.hw && a.hitTop < b.hitTop + b.hh && b.hitTop < a.hitTop + a.hh;
}

// The centre fractions that would place the control's centre at pixel (px, py), snapped to a grid if asked.
export function positionFromPixels(px, py, vw, vh, snap = false) {
  let x = px / vw;
  let y = py / vh;
  if (snap) {
    x = Math.round(x / 0.025) * 0.025;
    y = Math.round(y / 0.025) * 0.025;
  }
  return { x: clamp(x, [0, 1]), y: clamp(y, [0, 1]) };
}
