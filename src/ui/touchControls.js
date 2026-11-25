// On-screen controls for phones and tablets. Where they sit, how big and how see-through they are comes from the
// layout the player edits in Settings. Every control has a drawn part and a touch area that can be bigger.
// Dragging the empty part of the screen still orbits the camera.
import { el, addStyle } from './dom.js';
import { icon } from './icons.js';
import { CONTROLS, controlsFor, sanitizeLayout, boxFor } from './touchLayout.js';

// Maps a finger position over the steering pad to -1 (left) .. 1 (right), with a small dead zone and a
// gentle curve so small movements steer finely. Pure, so it can be tested.
export function padSteer(x, left, width) {
  const half = width / 2;
  const v = Math.max(-1, Math.min(1, (x - (left + half)) / (half * 0.8)));
  const DEAD = 0.06;
  if (Math.abs(v) < DEAD) return 0;
  return Math.sign(v) * ((Math.abs(v) - DEAD) / (1 - DEAD)) ** 1.25;
}

const STYLE = `
#touch{position:fixed;inset:0;z-index:6;pointer-events:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:none;font-family:system-ui,sans-serif}
#touch[hidden]{display:none}
.th{position:absolute;pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent}
.tv{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:#fff;font-weight:700;font-size:11px;letter-spacing:.08em;background:rgba(18,26,44,.62);border:2px solid rgba(255,255,255,.38);border-radius:18px;pointer-events:none;transition:background .08s}
.tv svg{flex:none}
.tv.round{border-radius:50%}
.tv-gas{background:rgba(40,150,90,.55)}
.tv-brake{background:rgba(200,60,70,.5)}
.tv.on{background:rgba(77,163,255,.78);border-color:#fff}
.tv-gas.on{background:rgba(60,210,120,.85)}
.tv-brake.on{background:rgba(240,80,90,.88)}
.tv-pad{flex-direction:row;justify-content:space-between;padding:0 12px}
.tv-knob{position:absolute;top:50%;left:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(255,255,255,.6);border:3px solid #fff}
.t-rotate{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(10,13,20,.92);color:#fff;font-size:18px;text-align:center;pointer-events:auto}
.t-rotate[hidden]{display:none}
body.touch-ui #dash{top:168px;bottom:auto}
`;

let styled = false;
export function ensureTouchStyle() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  addStyle(STYLE);
}

// The drawn part of a control. Used by the live controls and the layout editor.
export function createVisual(id) {
  ensureTouchStyle();
  const def = CONTROLS[id];
  const round = def.w === def.h;
  const tv = el('div', `tv tv-${id}${round ? ' round' : ''}`);
  if (id === 'steer') {
    tv.classList.add('tv-pad');
    tv.append(icon('left', 28), icon('wheel', 28), icon('right', 28));
    const knob = el('div', 'tv-knob');
    knob.hidden = true;
    tv.append(knob);
  } else if (id === 'left' || id === 'right') {
    tv.append(icon(def.icon, 40));
  } else if (round) {
    tv.append(icon(def.icon, 26));
  } else {
    tv.append(icon(def.icon, 30), el('span', '', id === 'handbrake' ? 'HAND' : id.toUpperCase()));
  }
  return tv;
}

// Puts a touch box and its drawn box in place (in pixels).
export function placeControl(th, tv, box, opacity) {
  th.style.left = `${box.hitLeft}px`;
  th.style.top = `${box.hitTop}px`;
  th.style.width = `${box.hw}px`;
  th.style.height = `${box.hh}px`;
  tv.style.left = `${(box.hw - box.w) / 2}px`;
  tv.style.top = `${(box.hh - box.h) / 2}px`;
  tv.style.width = `${box.w}px`;
  tv.style.height = `${box.h}px`;
  tv.style.opacity = String(opacity);
}

// settings: from createGameSettings (optional). Callbacks: onPause, onTune, onCamera.
// Returns { state, enabled, setVisible, hint }.
export function createTouchControls({ settings = null, onPause, onTune, onCamera }) {
  const get = (id, fallback) => settings?.get(id) ?? fallback;
  const state = { forward: false, back: false, handbrake: false, steer: 0, steering: false };
  const held = { left: false, right: false };
  let seenTouch = false;
  let visible = false;
  let suspended = false;
  let root = null;
  let items = {};
  let rotate = null;

  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
  const isEnabled = () => {
    const mode = get('controls.touchMode', 'auto');
    return mode === 'on' || (mode === 'auto' && (coarse || seenTouch));
  };
  const buzz = () => {
    if (get('controls.haptics', true)) navigator.vibrate?.(8);
  };
  const releaseAll = () => {
    state.forward = state.back = state.handbrake = state.steering = false;
    state.steer = 0;
    held.left = held.right = false;
    root?.querySelectorAll('.on').forEach((n) => n.classList.remove('on'));
    root?.querySelectorAll('.tv-knob').forEach((n) => (n.hidden = true));
  };

  function updateArrows() {
    state.steering = held.left || held.right;
    state.steer = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  }

  function wire(id, th, tv) {
    const on = (v) => tv.classList.toggle('on', v);
    const press = (key) => {
      th.addEventListener('pointerdown', (e) => {
        th.setPointerCapture?.(e.pointerId);
        key(true);
        on(true);
        buzz();
        e.preventDefault();
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        th.addEventListener(type, () => {
          key(false);
          on(false);
        });
      }
    };
    if (id === 'gas') press((v) => (state.forward = v));
    else if (id === 'brake') press((v) => (state.back = v));
    else if (id === 'handbrake') press((v) => (state.handbrake = v));
    else if (id === 'left' || id === 'right') {
      press((v) => {
        held[id] = v;
        updateArrows();
      });
    } else if (id === 'steer') {
      const knob = tv.querySelector('.tv-knob');
      let pointer = null;
      const steerTo = (e) => {
        const r = th.getBoundingClientRect();
        const sens = get('controls.sensitivity', 100) / 100;
        state.steer = Math.max(-1, Math.min(1, padSteer(e.clientX, r.left, r.width) * sens));
        const k = Math.max(r.left + 23, Math.min(r.right - 23, e.clientX));
        knob.style.left = `${k - r.left - (r.width - tv.offsetWidth) / 2}px`;
      };
      const release = (e) => {
        if (e.pointerId !== pointer) return;
        pointer = null;
        state.steering = false;
        state.steer = 0;
        knob.hidden = true;
        on(false);
      };
      th.addEventListener('pointerdown', (e) => {
        if (pointer !== null) return;
        pointer = e.pointerId;
        th.setPointerCapture?.(e.pointerId);
        state.steering = true;
        knob.hidden = false;
        on(true);
        buzz();
        steerTo(e);
        e.preventDefault();
      });
      th.addEventListener('pointermove', (e) => {
        if (e.pointerId === pointer) steerTo(e);
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) th.addEventListener(type, release);
    } else {
      const action = { pause: onPause, tune: onTune, camera: onCamera }[id];
      th.addEventListener('pointerdown', (e) => {
        buzz();
        action?.();
        e.preventDefault();
      });
    }
  }

  function layout() {
    if (!root) return;
    const entries = sanitizeLayout(settings?.getLayout?.());
    for (const [id, { th, tv }] of Object.entries(items)) {
      placeControl(th, tv, boxFor(id, entries[id], window.innerWidth, window.innerHeight), entries[id].opacity);
    }
    if (rotate) rotate.hidden = window.innerHeight <= window.innerWidth;
  }

  function build() {
    ensureTouchStyle();
    root?.remove();
    items = {};
    root = el('div');
    root.id = 'touch';
    root.hidden = !(visible && !suspended);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    for (const id of controlsFor(get('controls.scheme', 'pad'))) {
      const th = el('div', 'th');
      const tv = createVisual(id);
      th.append(tv);
      wire(id, th, tv);
      root.append(th);
      items[id] = { th, tv };
    }
    // Portrait phones are cramped: ask for landscape.
    rotate = el('div', 't-rotate', 'Turn your phone sideways to drive');
    root.append(rotate);
    document.body.appendChild(root);
    layout();
  }

  function refresh() {
    const on = isEnabled();
    api.enabled = on;
    document.body.classList.toggle('touch-ui', on);
    if (on) build();
    else {
      root?.remove();
      root = null;
      items = {};
      releaseAll();
    }
  }

  function setVisible(v) {
    visible = v;
    if (root) root.hidden = !(v && !suspended);
    if (!v) releaseAll();
  }

  const api = {
    state,
    enabled: false,
    setVisible,
    // The editor hides the live controls while it shows its own copies.
    suspend(v) {
      suspended = v;
      if (root) root.hidden = !(visible && !suspended);
      if (v) releaseAll();
    },
    hint: 'Steer on the left, gas and brake on the right, drag to look',
  };

  window.addEventListener('resize', layout);
  window.addEventListener('blur', releaseAll);
  if (!coarse) {
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'touch' && !seenTouch) {
          seenTouch = true;
          refresh();
        }
      },
      { capture: true }
    );
  }
  settings?.subscribe((ids) => {
    if (ids.some((id) => id.startsWith('controls.'))) refresh();
  });
  refresh();
  return api;
}
