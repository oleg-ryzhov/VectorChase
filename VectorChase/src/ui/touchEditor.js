// The touch controls editor: drag a control to move it, pick it to change its size, its touch area and its
// opacity. The touch area is the part that reacts to a finger; the dashed outline shows it.
import { el, addStyle } from './dom.js';
import { icon } from './icons.js';
import { ensureTheme, actionButton, rangeInput, switchControl } from './widgets.js';
import { createVisual, placeControl } from './touchControls.js';
import { CONTROLS, LIMITS, controlsFor, sanitizeLayout, boxFor, defaultEntry, defaultLayout, mirrorLayout, positionFromPixels } from './touchLayout.js';

const STYLE = `
#touch-editor{z-index:30;background:rgba(5,8,14,.5);align-items:stretch;justify-content:stretch}
#touch-editor .te-stage{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:40px 40px}
#touch-editor .th{border:2px dashed rgba(255,255,255,.25);border-radius:14px;cursor:grab}
#touch-editor .th.sel{border-color:#4da3ff;background:rgba(77,163,255,.12)}
#touch-editor .te-panel{position:absolute;left:50%;transform:translateX(-50%);width:min(760px,calc(100vw - 16px));padding:10px 12px;background:rgba(17,24,38,.96);border:1px solid var(--vc-line);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.6)}
#touch-editor .te-top{top:calc(8px + env(safe-area-inset-top,0px))}
#touch-editor .te-bottom{bottom:calc(8px + env(safe-area-inset-bottom,0px))}
#touch-editor .te-head{display:flex;align-items:center;gap:10px;margin-bottom:6px}
#touch-editor .te-head b{flex:1;font-size:16px}
#touch-editor .te-sliders{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:2px 18px}
#touch-editor .te-cell{display:flex;flex-direction:column}
#touch-editor .te-cell div{display:flex;justify-content:space-between;font-size:13px;color:var(--vc-mute)}
#touch-editor .te-cell strong{color:var(--vc-blue)}
#touch-editor .te-buttons{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:4px}
#touch-editor .te-snap{display:flex;align-items:center;gap:8px;margin-left:auto;font-size:14px;font-weight:600}
`;

// settings: from createGameSettings. onClose(): called when the player taps Done.
export function createTouchEditor({ settings, onClose = () => {} }) {
  ensureTheme();
  addStyle(STYLE);
  const root = el('div', 'vc-screen');
  root.id = 'touch-editor';
  root.hidden = true;
  const stage = el('div', 'te-stage');
  const panel = el('div', 'te-panel te-bottom');
  root.append(stage, panel);
  document.body.appendChild(root);

  let layout = sanitizeLayout(settings.getLayout());
  let selected = 'gas';
  let snap = false;
  let open = false;
  let items = {};

  const scheme = () => settings.get('controls.scheme') ?? 'pad';
  const save = () => settings.setLayout(layout);

  // ---- Panel ----
  const title = el('b');
  const titleIcon = el('span');
  const done = actionButton('Done', 'check', () => close(), 'primary small');
  const head = el('div', 'te-head');
  head.append(titleIcon, title, done);

  function cell(label, limits, key) {
    const wrap = el('div', 'te-cell');
    const readout = el('strong');
    const top = el('div');
    top.append(el('span', '', label), readout);
    const range = rangeInput({
      min: Math.round(limits[0] * 100),
      max: Math.round(limits[1] * 100),
      step: 5,
      value: 100,
      onInput: (v) => {
        layout[selected][key] = v / 100;
        readout.textContent = `${v}%`;
        place();
        save();
      },
    });
    wrap.append(top, range.input);
    return {
      wrap,
      set(v) {
        range.set(Math.round(v * 100));
        readout.textContent = `${Math.round(v * 100)}%`;
      },
    };
  }
  const sizeCell = cell('Size', LIMITS.scale, 'scale');
  const hitCell = cell('Touch area', LIMITS.hit, 'hit');
  const opacityCell = cell('Opacity', LIMITS.opacity, 'opacity');
  const sliders = el('div', 'te-sliders');
  sliders.append(sizeCell.wrap, hitCell.wrap, opacityCell.wrap);

  const resetOne = actionButton('Reset control', 'reset', () => {
    layout[selected] = defaultEntry(selected);
    place();
    save();
    syncPanel();
  }, 'small');
  const mirror = actionButton('Mirror', 'mirror', () => {
    layout = mirrorLayout(layout);
    place();
    save();
  }, 'small');
  const resetAll = actionButton('Reset all', 'reset', () => {
    layout = defaultLayout();
    place();
    save();
    syncPanel();
  }, 'small');
  const snapSwitch = switchControl(false, (v) => (snap = v));
  const snapLabel = el('label', 'te-snap');
  snapLabel.append(el('span', '', 'Snap'), snapSwitch.node);
  const buttons = el('div', 'te-buttons');
  buttons.append(resetOne, mirror, resetAll, snapLabel);
  panel.append(head, sliders, buttons);

  function syncPanel() {
    const e = layout[selected];
    title.textContent = CONTROLS[selected].label;
    titleIcon.replaceChildren(icon(CONTROLS[selected].icon, 22));
    sizeCell.set(e.scale);
    hitCell.set(e.hit);
    opacityCell.set(e.opacity);
    for (const [id, it] of Object.entries(items)) it.th.classList.toggle('sel', id === selected);
    // Keep the panel away from the control being edited.
    const lower = boxFor(selected, e, window.innerWidth, window.innerHeight).cy > window.innerHeight / 2;
    panel.classList.toggle('te-top', lower);
    panel.classList.toggle('te-bottom', !lower);
  }

  // ---- Stage ----
  function place() {
    for (const [id, it] of Object.entries(items)) {
      placeControl(it.th, it.tv, boxFor(id, layout[id], window.innerWidth, window.innerHeight), layout[id].opacity);
    }
  }

  function buildStage() {
    stage.replaceChildren();
    items = {};
    for (const id of controlsFor(scheme())) {
      const th = el('div', 'th');
      const tv = createVisual(id);
      th.append(tv);
      stage.append(th);
      items[id] = { th, tv };
      let drag = null;
      th.addEventListener('pointerdown', (e) => {
        selected = id;
        const b = boxFor(id, layout[id], window.innerWidth, window.innerHeight);
        drag = { id: e.pointerId, dx: e.clientX - b.cx, dy: e.clientY - b.cy };
        th.setPointerCapture?.(e.pointerId);
        syncPanel();
        e.preventDefault();
      });
      th.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const p = positionFromPixels(e.clientX - drag.dx, e.clientY - drag.dy, window.innerWidth, window.innerHeight, snap);
        layout[id].x = p.x;
        layout[id].y = p.y;
        place();
      });
      const end = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        drag = null;
        save();
        syncPanel();
      };
      th.addEventListener('pointerup', end);
      th.addEventListener('pointercancel', end);
    }
    if (!items[selected]) selected = Object.keys(items)[0];
    place();
    syncPanel();
  }

  window.addEventListener('resize', () => open && (place(), syncPanel()));

  function openEditor() {
    layout = sanitizeLayout(settings.getLayout());
    open = true;
    root.hidden = false;
    buildStage();
  }
  function close() {
    open = false;
    root.hidden = true;
    save();
    onClose();
  }

  return {
    open: openEditor,
    close,
    get isOpen() {
      return open;
    },
  };
}
