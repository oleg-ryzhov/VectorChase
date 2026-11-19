// On-screen controls for phones and tablets: a steering pad on the left, pedals on the right and a few
// small buttons on top. They appear the first time the screen is touched (or at once on a touch device).
// Dragging the empty part of the screen still orbits the camera.

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
#touch .t{position:absolute;pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;letter-spacing:.05em;background:rgba(20,26,40,.42);border:2px solid rgba(255,255,255,.28);border-radius:18px;-webkit-tap-highlight-color:transparent}
#touch .t.on{background:rgba(90,169,255,.55);border-color:#fff}
#touch .pad{left:calc(10px + env(safe-area-inset-left,0px));bottom:calc(10px + env(safe-area-inset-bottom,0px));width:min(46vw,380px);height:min(34vh,190px)}
#touch .pad i{position:absolute;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;left:50%;border-radius:50%;background:rgba(255,255,255,.5);border:3px solid #fff;pointer-events:none}
#touch .pad b{font-size:12px;opacity:.7;position:absolute;top:8px;left:0;right:0;text-align:center}
#touch .gas{right:calc(10px + env(safe-area-inset-right,0px));bottom:calc(10px + env(safe-area-inset-bottom,0px));width:min(20vw,150px);height:min(34vh,190px);background:rgba(60,190,110,.4)}
#touch .gas.on{background:rgba(60,190,110,.75)}
#touch .brk{right:calc(min(20vw,150px) + 20px + env(safe-area-inset-right,0px));bottom:calc(10px + env(safe-area-inset-bottom,0px));width:min(15vw,110px);height:min(22vh,120px);background:rgba(220,80,80,.4)}
#touch .brk.on{background:rgba(220,80,80,.75)}
#touch .hb{right:calc(min(20vw,150px) + 20px + env(safe-area-inset-right,0px));bottom:calc(min(22vh,120px) + 20px + env(safe-area-inset-bottom,0px));width:min(15vw,110px);height:min(11vh,60px);font-size:12px}
#touch .top{top:calc(8px + env(safe-area-inset-top,0px));width:46px;height:46px;border-radius:50%;font-size:20px}
#touch .rotate{inset:0;border-radius:0;background:rgba(10,13,20,.9);font-size:18px;text-align:center}
#touch .rotate[hidden]{display:none}
body.touch-ui #dash{top:168px;bottom:auto}
`;

// Callbacks: onPause, onSettings, onCamera. Returns { state, setVisible, enabled }.
export function createTouchControls({ onPause, onSettings, onCamera }) {
  const state = { forward: false, back: false, handbrake: false, steer: 0, steering: false };
  const api = { state, enabled: false, setVisible, hint: 'Left pad: steer · right: gas / brake · drag to look' };
  let root = null;
  let visible = false;

  function build() {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);
    root = document.createElement('div');
    root.id = 'touch';
    root.hidden = !visible;
    root.addEventListener('contextmenu', (e) => e.preventDefault());

    const make = (cls, text) => {
      const d = document.createElement('div');
      d.className = `t ${cls}`;
      d.textContent = text;
      root.append(d);
      return d;
    };
    // A button that is on while a finger holds it.
    const hold = (node, key) => {
      const set = (v) => {
        state[key] = v;
        node.classList.toggle('on', v);
      };
      node.addEventListener('pointerdown', (e) => {
        node.setPointerCapture?.(e.pointerId);
        set(true);
        navigator.vibrate?.(8);
        e.preventDefault();
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) node.addEventListener(type, () => set(false));
    };
    const tap = (node, fn) => {
      node.addEventListener('pointerdown', (e) => {
        navigator.vibrate?.(8);
        fn?.();
        e.preventDefault();
      });
      return node;
    };

    // Steering pad: the knob follows the finger sideways.
    const pad = make('pad');
    const label = document.createElement('b');
    label.textContent = '◀  STEER  ▶';
    const knob = document.createElement('i');
    pad.append(label, knob);
    let padId = null;
    const steerTo = (e) => {
      const r = pad.getBoundingClientRect();
      state.steer = padSteer(e.clientX, r.left, r.width);
      const k = Math.max(r.left + 32, Math.min(r.right - 32, e.clientX));
      knob.style.left = `${k - r.left}px`;
    };
    const release = (e) => {
      if (e.pointerId !== padId) return;
      padId = null;
      state.steering = false;
      state.steer = 0;
      knob.style.left = '50%';
      pad.classList.remove('on');
    };
    pad.addEventListener('pointerdown', (e) => {
      if (padId !== null) return;
      padId = e.pointerId;
      pad.setPointerCapture?.(e.pointerId);
      state.steering = true;
      pad.classList.add('on');
      steerTo(e);
      e.preventDefault();
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId === padId) steerTo(e);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(type, release);

    hold(make('gas', 'GAS'), 'forward');
    hold(make('brk', 'BRAKE'), 'back');
    hold(make('hb', 'HANDBRAKE'), 'handbrake');
    tap(make('top', '⏸'), onPause).style.left = 'calc(8px + env(safe-area-inset-left,0px))';
    tap(make('top', '⚙'), onSettings).style.left = 'calc(62px + env(safe-area-inset-left,0px))';
    tap(make('top', '◉'), onCamera).style.left = 'calc(116px + env(safe-area-inset-left,0px))';

    // Portrait phones are cramped: ask for landscape.
    const rotate = make('rotate', 'Turn your phone sideways to drive');
    rotate.hidden = true;
    const checkRotate = () => {
      rotate.hidden = window.innerHeight <= window.innerWidth;
    };
    window.addEventListener('resize', checkRotate);
    checkRotate();

    // Never leave a pedal held if the page loses focus.
    window.addEventListener('blur', () => {
      state.forward = state.back = state.handbrake = state.steering = false;
      state.steer = 0;
      root.querySelectorAll('.on').forEach((n) => n.classList.remove('on'));
    });
    document.body.appendChild(root);
  }

  function enable() {
    if (api.enabled) return;
    api.enabled = true;
    document.body.classList.add('touch-ui');
    build();
  }

  function setVisible(v) {
    visible = v;
    if (root) root.hidden = !v;
    if (!v) {
      state.forward = state.back = state.handbrake = state.steering = false;
      state.steer = 0;
    }
  }

  const coarse = window.matchMedia?.('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
  if (coarse) enable();
  else window.addEventListener('pointerdown', (e) => e.pointerType === 'touch' && enable(), { capture: true });
  return api;
}
