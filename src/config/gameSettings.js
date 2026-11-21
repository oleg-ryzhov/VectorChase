// The game's own settings (sound, picture, effects, interface, controls), kept apart from the car physics.
// Pure logic: no DOM or Three.js imports. A setting can depend on another one ("requires"), and the menus
// only show it while the setting it depends on has the right value.

export const SETTINGS_KEY = 'vectorchase.game';

// [id, label, icon name]
export const TABS = [
  ['audio', 'Audio', 'speaker'],
  ['video', 'Video', 'display'],
  ['effects', 'Effects', 'sparkle'],
  ['hud', 'Interface', 'flag'],
  ['controls', 'Controls', 'touch'],
];

// requires: [[id, 'eq' | 'ne', value], ...]. All of them must hold for the setting to show.
export const ITEMS = [
  { id: 'audio.master', tab: 'audio', type: 'slider', label: 'Master volume', min: 0, max: 100, step: 5, unit: '%', default: 70 },
  { id: 'audio.sfx', tab: 'audio', type: 'toggle', label: 'Sound effects', hint: 'Engines, tyres, wind and crashes', default: true },
  { id: 'audio.sfxVolume', tab: 'audio', type: 'slider', label: 'Effects volume', min: 0, max: 100, step: 5, unit: '%', default: 80, requires: [['audio.sfx', 'eq', true]] },
  { id: 'audio.music', tab: 'audio', type: 'toggle', label: 'Music', default: true },
  { id: 'audio.musicVolume', tab: 'audio', type: 'slider', label: 'Music volume', min: 0, max: 100, step: 5, unit: '%', default: 35, requires: [['audio.music', 'eq', true]] },

  { id: 'video.fov', tab: 'video', type: 'slider', label: 'Field of view', min: 55, max: 110, step: 1, unit: '°', default: 72 },
  { id: 'video.speedFov', tab: 'video', type: 'toggle', label: 'Speed stretch', hint: 'Widen the view as you go faster', default: true },
  { id: 'video.speedFovAmount', tab: 'video', type: 'slider', label: 'Stretch amount', min: 0, max: 20, step: 1, unit: '°', default: 10, requires: [['video.speedFov', 'eq', true]] },
  { id: 'video.quality', tab: 'video', type: 'choice', label: 'Render quality', hint: 'Lower is smoother on slow devices', options: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], default: 'high' },
  { id: 'video.fps', tab: 'video', type: 'toggle', label: 'Show frame rate', default: false },

  { id: 'effects.skid', tab: 'effects', type: 'toggle', label: 'Skid marks', default: true },
  { id: 'effects.smoke', tab: 'effects', type: 'toggle', label: 'Tyre smoke and dust', default: true },
  { id: 'effects.smokeAmount', tab: 'effects', type: 'slider', label: 'Smoke amount', min: 20, max: 100, step: 10, unit: '%', default: 100, requires: [['effects.smoke', 'eq', true]] },
  { id: 'effects.sparks', tab: 'effects', type: 'toggle', label: 'Sparks', default: true },

  { id: 'hud.minimap', tab: 'hud', type: 'toggle', label: 'Minimap', default: true },
  { id: 'hud.speedo', tab: 'hud', type: 'toggle', label: 'Speedometer', default: true },
  { id: 'hud.units', tab: 'hud', type: 'choice', label: 'Speed units', options: [['kph', 'km/h'], ['mph', 'mph']], default: 'kph', requires: [['hud.speedo', 'eq', true]] },
  { id: 'hud.hints', tab: 'hud', type: 'toggle', label: 'Control hints', default: true },

  { id: 'controls.touchMode', tab: 'controls', type: 'choice', label: 'On-screen controls', hint: 'Auto shows them on touch screens', options: [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], default: 'auto' },
  { id: 'controls.scheme', tab: 'controls', type: 'choice', label: 'Steering style', options: [['pad', 'Slide pad'], ['arrows', 'Arrows']], default: 'pad', requires: [['controls.touchMode', 'ne', 'off']] },
  { id: 'controls.sensitivity', tab: 'controls', type: 'slider', label: 'Pad sensitivity', min: 50, max: 150, step: 5, unit: '%', default: 100, requires: [['controls.touchMode', 'ne', 'off'], ['controls.scheme', 'eq', 'pad']] },
  { id: 'controls.haptics', tab: 'controls', type: 'toggle', label: 'Vibration on touch', default: true, requires: [['controls.touchMode', 'ne', 'off']] },
  { id: 'controls.editLayout', tab: 'controls', type: 'action', label: 'Button layout', hint: 'Move, resize and fade each control', buttonLabel: 'Edit layout', icon: 'move', requires: [['controls.touchMode', 'ne', 'off']] },
];

const VALUE_ITEMS = ITEMS.filter((i) => i.type !== 'action');

export function defaultValues({ touch = false } = {}) {
  const out = {};
  for (const item of VALUE_ITEMS) out[item.id] = item.default;
  if (touch) out['video.quality'] = 'medium';
  return out;
}

// Whether a setting should be shown, given the current values.
export function isVisible(item, values) {
  return (item.requires ?? []).every(([id, op, want]) => (op === 'eq' ? values[id] === want : values[id] !== want));
}

// Settings of a tab that are shown right now.
export function visibleItems(tab, values) {
  return ITEMS.filter((i) => i.tab === tab && isVisible(i, values));
}

function cleanValue(item, raw) {
  if (item.type === 'toggle') return typeof raw === 'boolean' ? raw : item.default;
  if (item.type === 'choice') return item.options.some((o) => o[0] === raw) ? raw : item.default;
  if (item.type === 'slider') {
    const n = Number(raw);
    if (!Number.isFinite(n)) return item.default;
    const stepped = Math.round((n - item.min) / item.step) * item.step + item.min;
    return Math.min(item.max, Math.max(item.min, Number(stepped.toFixed(6))));
  }
  return item.default;
}

// Stored data can be missing or damaged: keep what is valid, fall back to the defaults for the rest.
export function sanitize(raw, defaults) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  for (const item of VALUE_ITEMS) out[item.id] = Object.hasOwn(src, item.id) ? cleanValue(item, src[item.id]) : defaults[item.id];
  return out;
}

// Picture quality to render scale: the pixel ratio the renderer uses.
export function pixelRatioFor(quality, devicePixelRatio = 1) {
  const cap = quality === 'low' ? 1 : quality === 'medium' ? 1.5 : 2;
  return Math.max(0.5, Math.min(cap, devicePixelRatio || 1));
}

// Field of view for a camera view: the setting is for first person, the chase view is 10 degrees narrower.
export function fovFor(view, setting) {
  return view === 'first' ? setting : setting - 10;
}

export function speedInUnits(metresPerSecond, units) {
  return metresPerSecond * (units === 'mph' ? 2.236936 : 3.6);
}

function read(storage) {
  try {
    const text = storage?.getItem(SETTINGS_KEY);
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

// storage: localStorage or null. Returns the live settings object.
export function createGameSettings(storage, { touch = false } = {}) {
  const defaults = defaultValues({ touch });
  const saved = read(storage);
  let values = sanitize(saved.values, defaults);
  let layout = saved.layout && typeof saved.layout === 'object' ? saved.layout : null;
  const listeners = new Set();

  function persist() {
    try {
      storage?.setItem(SETTINGS_KEY, JSON.stringify({ values, layout }));
    } catch {
      /* storage is full or blocked: the settings still work for this visit */
    }
  }
  function emit(ids) {
    for (const fn of listeners) fn(ids, values);
  }

  return {
    get: (id) => values[id],
    values: () => ({ ...values }),
    set(id, value) {
      const item = VALUE_ITEMS.find((i) => i.id === id);
      if (!item) return;
      const next = cleanValue(item, value);
      if (next === values[id]) return;
      values = { ...values, [id]: next };
      persist();
      emit([id]);
    },
    // Puts one tab (or everything) back to the defaults.
    reset(tab = null) {
      const ids = VALUE_ITEMS.filter((i) => !tab || i.tab === tab).map((i) => i.id);
      values = { ...values, ...Object.fromEntries(ids.map((id) => [id, defaults[id]])) };
      persist();
      emit(ids);
    },
    // Called with (changedIds, allValues). Returns a function that stops listening.
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getLayout: () => layout,
    setLayout(next) {
      layout = next;
      persist();
      emit(['controls.layout']);
    },
    isVisible: (item) => isVisible(item, values),
    defaults: () => ({ ...defaults }),
  };
}
