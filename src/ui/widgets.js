// Shared building blocks for the menus: one look, big touch targets, no scrolling and no drop-downs.
// Menus are built from tabs, segmented choices, switches, sliders, key rows, a pager, and a drop-down that
// opens a small pop-up list (never a scrolling one).
import { el, addStyle } from './dom.js';
import { icon } from './icons.js';
import { isBindable, keyLabel } from '../config/tunerKeys.js';

const THEME = `
:root{--vc-bg:#0b0f17;--vc-panel:#111826;--vc-panel2:#18223a;--vc-line:#26324f;--vc-edge:#62729a;--vc-text:#e8ecf3;--vc-mute:#8d9ab0;--vc-accent:#e63946;--vc-accent-fill:#d62839;--vc-blue:#4da3ff;--vc-good:#4ee08a;--vc-warn:#ffd166;--vc-ease:cubic-bezier(.2,.8,.2,1)}
/* Control edges (inputs, sliders, switches) use --vc-edge: 3:1 against the panel. --vc-line is for dividers. White on --vc-accent-fill is 4.9:1. */
.vc-screen{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(5,8,14,.74);color:var(--vc-text);font:15px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;touch-action:manipulation}
.vc-screen[hidden],.vc-screen [hidden]{display:none!important}
.vc-screen *{box-sizing:border-box}
.vc-screen button:focus-visible,.vc-screen input:focus-visible{outline:3px solid var(--vc-blue);outline-offset:2px}
.vc-screen:not([hidden]){animation:vc-fade .16s ease-out}
[data-quality=high] .vc-screen{-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
@media (pointer:coarse) and (min-height:521px){.vc-btn{min-height:48px}.vc-iconbtn{width:48px;height:48px}.vc-tab{min-height:48px}.vc-seg button{min-height:44px}}
.vc-screen:not([hidden]) .vc-panel{animation:vc-rise .2s var(--vc-ease)}
.vc-btn,.vc-iconbtn,.vc-tab,.vc-seg button,.vc-select,.vc-switch,.vc-row{transition:background .12s,border-color .12s,box-shadow .12s,transform .08s,color .12s}
.vc-screen input[type=text],.vc-screen input[type=number],.vc-screen input[type=email],.vc-screen input[type=password]{user-select:text;-webkit-user-select:text;border-color:var(--vc-edge)}
.vc-panel{width:min(980px,100vw);height:min(620px,100vh);height:min(620px,100dvh);display:flex;flex-direction:column;background:linear-gradient(180deg,#151e30,var(--vc-panel) 140px);border:1px solid var(--vc-line);border-radius:16px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.06)}
@media (max-width:760px),(max-height:520px){.vc-panel{width:100vw;height:100vh;height:100dvh;border-radius:0;border:0}}
.vc-head{display:flex;align-items:center;gap:10px;padding:6px 8px 6px 16px;min-height:54px;border-bottom:1px solid var(--vc-line);background:linear-gradient(180deg,#16203a,var(--vc-panel))}
.vc-head h2{margin:0;flex:1;font-size:18px;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vc-head h2::before{content:'';display:inline-block;width:4px;height:1em;margin-right:10px;border-radius:2px;background:var(--vc-accent);vertical-align:-.14em}
.vc-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 16px;background:linear-gradient(180deg,#202c49,var(--vc-panel2));color:var(--vc-text);border:1px solid var(--vc-line);border-radius:12px;font:inherit;font-weight:600;cursor:pointer;box-shadow:0 1px 0 rgba(255,255,255,.05) inset}
.vc-btn:hover{background:linear-gradient(180deg,#2a3a60,#1f2d4c);border-color:var(--vc-edge)}
.vc-btn:active{transform:translateY(1px) scale(.98)}
.vc-btn:disabled{opacity:.4;cursor:default}
.vc-btn.primary{background:linear-gradient(180deg,#d62839,#c81d2f);border-color:#ff6b75;color:#fff;box-shadow:0 4px 16px rgba(214,40,57,.35),inset 0 1px 0 rgba(255,255,255,.2)}
.vc-btn.primary:hover{background:linear-gradient(180deg,#d62839,#c81d2f);box-shadow:0 6px 22px rgba(214,40,57,.55),inset 0 1px 0 rgba(255,255,255,.25);transform:translateY(-1px)}
.vc-btn.primary:active{transform:translateY(1px) scale(.98)}
.vc-btn.small{min-height:36px;padding:0 12px;font-size:14px}
.vc-iconbtn{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;padding:0;background:transparent;color:var(--vc-text);border:1px solid transparent;border-radius:12px;cursor:pointer}
.vc-iconbtn:hover{background:var(--vc-panel2);border-color:var(--vc-line)}
.vc-iconbtn:active{transform:scale(.94)}
.vc-iconbtn:disabled{opacity:.35;cursor:default}
.vc-tabs{display:flex;gap:6px;padding:8px 10px;border-bottom:1px solid var(--vc-line);background:#0e1522}
.vc-tab{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 8px;background:transparent;color:var(--vc-mute);border:1px solid transparent;border-radius:12px;font:inherit;font-weight:600;cursor:pointer}
.vc-tab:hover{color:#fff;background:rgba(255,255,255,.05)}
.vc-tab.on{background:var(--vc-panel2);color:#fff;border-color:var(--vc-line);box-shadow:inset 0 -3px 0 var(--vc-accent),0 2px 10px rgba(0,0,0,.3)}
.vc-tab svg{flex:none}
@media (max-width:560px){.vc-tab span{display:none}}
.vc-body{flex:1;min-height:0;overflow:hidden;position:relative;display:flex;flex-direction:column}
.vc-rows{flex:1;min-height:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));grid-auto-rows:max-content;align-content:start;column-gap:28px;padding:6px 16px}
.vc-row{display:flex;align-items:center;gap:12px;min-height:56px;border-bottom:1px solid #1b2540}
.vc-row:hover{background:rgba(255,255,255,.025)}
.vc-label{flex:0 0 38%;min-width:0;font-weight:600;line-height:1.2}
.vc-label small{display:block;margin-top:2px;color:var(--vc-mute);font-weight:400;font-size:12px}
.vc-grow{flex:1;min-width:0;display:flex;align-items:center;gap:10px}
.vc-value{flex:0 0 52px;text-align:right;font-variant-numeric:tabular-nums;font-weight:700;color:var(--vc-blue)}
.vc-range{flex:1;min-width:0;height:44px;margin:0;background:transparent;-webkit-appearance:none;appearance:none;cursor:pointer;touch-action:pan-y}
.vc-range::-webkit-slider-runnable-track{height:8px;border-radius:4px;background:linear-gradient(to right,var(--vc-blue) var(--pct,0%),#3b4a70 var(--pct,0%))}
.vc-range::-moz-range-track{height:8px;border-radius:4px;background:#3b4a70}
.vc-range::-moz-range-progress{height:8px;border-radius:4px;background:var(--vc-blue)}
.vc-range::-webkit-slider-thumb{-webkit-appearance:none;width:28px;height:28px;margin-top:-10px;border-radius:50%;background:#fff;border:4px solid var(--vc-blue);box-shadow:0 2px 6px rgba(0,0,0,.5);transition:box-shadow .12s}
.vc-range:hover::-webkit-slider-thumb{box-shadow:0 0 0 6px rgba(77,163,255,.22),0 2px 6px rgba(0,0,0,.5)}
.vc-range:active::-webkit-slider-thumb{box-shadow:0 0 0 9px rgba(77,163,255,.3),0 2px 6px rgba(0,0,0,.5)}
.vc-range::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#fff;border:4px solid var(--vc-blue)}
.vc-switch{position:relative;flex:none;width:56px;height:32px;border-radius:16px;background:#1b2640;border:2px solid var(--vc-edge);padding:0;cursor:pointer}
.vc-switch::after{content:'';position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:50%;background:#c9d2e0;transition:transform .15s var(--vc-ease),background .12s}
.vc-switch[aria-checked=true]{background:var(--vc-good);border-color:var(--vc-good)}
.vc-switch[aria-checked=true]::after{transform:translateX(24px);background:#fff}
.vc-seg{display:flex;flex:1;min-width:0;gap:4px;padding:4px;background:#0c1220;border:1px solid var(--vc-edge);border-radius:12px}
.vc-seg button{flex:1;min-width:0;min-height:40px;padding:0 6px;display:flex;align-items:center;justify-content:center;gap:6px;background:transparent;color:var(--vc-mute);border:0;border-radius:9px;font:inherit;font-weight:600;cursor:pointer}
.vc-seg button:hover{color:#fff;background:rgba(255,255,255,.06)}
.vc-seg button.on{background:var(--vc-blue);color:#06101f;box-shadow:0 2px 10px rgba(77,163,255,.35)}
.vc-pager{display:flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:4px 10px;border-top:1px solid var(--vc-line)}
.vc-dots{display:flex;gap:8px;align-items:center}
.vc-dot{width:10px;height:10px;padding:0;border-radius:50%;border:0;background:#4a5a82;cursor:pointer}
.vc-dot.on{background:var(--vc-blue);transform:scale(1.3)}
.vc-foot{display:flex;align-items:center;gap:10px;padding:8px 12px;border-top:1px solid var(--vc-line);background:#0e1522}
.vc-note{color:var(--vc-mute);font-size:13px}
.vc-dep{border-left:3px solid var(--vc-blue);padding-left:10px;margin-left:-13px}
.vc-select{flex:1;min-width:0;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:40px;padding:0 12px;background:#0c1220;color:var(--vc-text);border:1px solid var(--vc-edge);border-radius:12px;font:inherit;font-weight:600;cursor:pointer}
.vc-select:hover{background:#121b2e}
.vc-pop{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;background:rgba(5,8,14,.55);animation:vc-fade .12s ease-out}
.vc-pop-card{width:min(300px,90%);padding:8px;background:var(--vc-panel2);border:1px solid var(--vc-line);border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,.6);animation:vc-pop .14s cubic-bezier(.2,.9,.3,1)}
.vc-pop.closing{opacity:0;pointer-events:none;transition:opacity .12s}
.vc-pop.closing .vc-pop-card{transform:scale(.96);transition:transform .12s}
.vc-pop-title{padding:6px 10px 8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--vc-mute)}
.vc-pop-item{display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:0 14px;background:transparent;color:var(--vc-text);border:0;border-radius:10px;font:inherit;font-weight:600;text-align:left;cursor:pointer}
.vc-pop-item:hover,.vc-pop-item:focus-visible{background:#22304f}
.vc-pop-item.on{color:var(--vc-blue)}
.vc-keybtn{min-width:150px}
@keyframes vc-fade{from{opacity:0}}
@keyframes vc-rise{from{opacity:0;transform:translateY(10px) scale(.985)}}
@keyframes vc-pop{from{opacity:0;transform:translateY(8px) scale(.96)}}
@media (prefers-reduced-motion:reduce){.vc-screen,.vc-screen *{animation:none!important;transition:none!important}}
@media (prefers-contrast:more){:root{--vc-mute:#b4bfd2;--vc-line:#5b6b92}}
@media (max-height:430px){.vc-head{min-height:46px}.vc-tabs{padding:4px 8px}.vc-tab{min-height:38px}.vc-row{min-height:46px}.vc-label small{display:none}.vc-pager{min-height:44px}.vc-foot{padding:4px 10px}}
`;

let themed = false;
export function ensureTheme() {
  if (themed || typeof document === 'undefined') return;
  themed = true;
  addStyle(THEME);
}

export function iconButton(name, title, onClick, className = '') {
  const b = el('button', `vc-iconbtn ${className}`.trim());
  b.type = 'button';
  b.title = title;
  b.setAttribute('aria-label', title);
  b.append(icon(name, 24));
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

// A normal button with an optional icon in front.
export function actionButton(label, iconName, onClick, className = '') {
  const b = el('button', `vc-btn ${className}`.trim());
  b.type = 'button';
  if (iconName) b.append(icon(iconName, 20));
  if (label) b.append(el('span', '', label));
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

// Choices side by side. options: [[value, label, iconName?], ...]. Returns { node, set }.
export function segmented(options, value, onChange) {
  const node = el('div', 'vc-seg');
  node.setAttribute('role', 'radiogroup');
  const buttons = options.map(([v, label, iconName]) => {
    const b = el('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    if (iconName) b.append(icon(iconName, 18));
    if (label !== undefined && label !== '') b.append(el('span', '', String(label)));
    b.addEventListener('click', () => {
      set(v);
      onChange(v);
    });
    node.append(b);
    return [v, b];
  });
  function set(v) {
    for (const [value2, b] of buttons) {
      b.classList.toggle('on', value2 === v);
      b.setAttribute('aria-checked', String(value2 === v));
    }
  }
  set(value);
  return { node, set };
}

// An on / off switch. Returns { node, set }.
export function switchControl(value, onChange) {
  const node = el('button', 'vc-switch');
  node.type = 'button';
  node.setAttribute('role', 'switch');
  let on = value;
  const set = (v) => {
    on = Boolean(v);
    node.setAttribute('aria-checked', String(on));
  };
  set(value);
  node.addEventListener('click', () => {
    set(!on);
    onChange(on);
  });
  return { node, set };
}

const pct = (min, max, v) => `${((v - min) / (max - min)) * 100}%`;

// A range input with a filled track. Returns { input, set }.
export function rangeInput({ min, max, step, value, onInput }) {
  const input = el('input', 'vc-range');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  const set = (v) => {
    input.value = String(v);
    input.style.setProperty('--pct', pct(min, max, Number(input.value)));
  };
  set(value);
  input.addEventListener('input', () => {
    input.style.setProperty('--pct', pct(min, max, Number(input.value)));
    onInput(Number(input.value));
  });
  return { input, set };
}

// A settings row: label, slider and value on one line.
export function sliderRow({ label, hint, min, max, step, value, format = (v) => String(v), onInput }) {
  const node = el('div', 'vc-row');
  const text = el('div', 'vc-label', label);
  if (hint) text.append(el('small', '', hint));
  const readout = el('div', 'vc-value', format(value));
  const range = rangeInput({
    min, max, step, value,
    onInput: (v) => {
      readout.textContent = format(v);
      onInput(v);
    },
  });
  const grow = el('div', 'vc-grow');
  grow.append(range.input, readout);
  node.append(text, grow);
  return {
    node,
    set(v) {
      range.set(v);
      readout.textContent = format(v);
    },
  };
}

// A settings row: label and a switch.
export function toggleRow({ label, hint, value, onChange }) {
  const node = el('div', 'vc-row');
  const text = el('div', 'vc-label', label);
  if (hint) text.append(el('small', '', hint));
  const sw = switchControl(value, onChange);
  const grow = el('div', 'vc-grow');
  grow.style.justifyContent = 'flex-end';
  grow.append(sw.node);
  node.append(text, grow);
  return { node, set: sw.set };
}

// A settings row: label and a segmented choice.
export function choiceRow({ label, hint, options, value, onChange }) {
  const node = el('div', 'vc-row');
  const text = el('div', 'vc-label', label);
  if (hint) text.append(el('small', '', hint));
  const seg = segmented(options, value, onChange);
  node.append(text, seg.node);
  return { node, set: seg.set };
}

// A button that opens a small pop-up list with no scrolling. host: the element the pop-up covers.
// Up / Down or Tab / Shift+Tab move through the options; Enter, Space or a click picks one and closes the pop-up.
export function dropdown({ label, options, value, onChange, host }) {
  const node = el('button', 'vc-select');
  node.type = 'button';
  node.setAttribute('aria-haspopup', 'listbox');
  node.setAttribute('aria-expanded', 'false');
  const text = el('span');
  node.append(text, icon('down', 18));
  let current = value;
  let layer = null;
  const set = (v) => {
    current = v;
    const name = options.find((o) => o[0] === v)?.[1] ?? '';
    text.textContent = name;
    node.setAttribute('aria-label', `${label}: ${name}`);
  };
  function close(refocus = true) {
    if (!layer) return;
    const gone = layer;
    layer = null;
    node.setAttribute('aria-expanded', 'false');
    gone.classList.add('closing');
    setTimeout(() => gone.remove(), 130);
    if (refocus) node.focus();
  }
  function open() {
    if (layer) return;
    const items = options.map(([v, name]) => {
      const b = el('button', `vc-pop-item${v === current ? ' on' : ''}`);
      b.type = 'button';
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(v === current));
      b.append(el('span', '', String(name)));
      if (v === current) b.append(icon('check', 18));
      b.addEventListener('click', () => {
        set(v);
        onChange(v);
        close();
      });
      return b;
    });
    const list = el('div', 'vc-pop-list');
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', label);
    list.append(...items);
    const card = el('div', 'vc-pop-card');
    card.append(el('div', 'vc-pop-title', label), list);
    layer = el('div', 'vc-pop');
    layer.append(card);
    layer.addEventListener('pointerdown', (e) => {
      if (e.target === layer) close();
    });
    // Keys never leave the pop-up while it is open (so Escape closes only the pop-up).
    layer.addEventListener('keydown', (e) => {
      e.stopPropagation();
      // A held Enter or Space must not pick the highlighted option again and again.
      if (e.repeat && (e.code === 'Enter' || e.code === 'Space')) e.preventDefault();
      if (e.code === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      const down = e.code === 'ArrowDown' || (e.code === 'Tab' && !e.shiftKey);
      const up = e.code === 'ArrowUp' || (e.code === 'Tab' && e.shiftKey);
      if (!down && !up) return;
      e.preventDefault();
      const from = items.indexOf(document.activeElement);
      const to = from < 0 ? (down ? 0 : items.length - 1) : (from + (down ? 1 : -1) + items.length) % items.length;
      items[to].focus();
    });
    host.append(layer);
    node.setAttribute('aria-expanded', 'true');
    (items.find((b) => b.classList.contains('on')) ?? items[0]).focus();
  }
  node.addEventListener('click', open);
  set(value);
  return { node, set, close };
}

// A settings row: label and a key cap. Click it, then press a letter or number key to bind it. Escape cancels.
export function keyRow({ label, hint, value, onChange }) {
  const node = el('div', 'vc-row');
  const text = el('div', 'vc-label', label);
  if (hint) text.append(el('small', '', hint));
  const btn = actionButton('', null, null, 'small vc-keybtn');
  let current = value;
  let waiting = false;
  const show = () => {
    btn.textContent = waiting ? 'Press a letter or number' : keyLabel(current);
  };
  function stop() {
    waiting = false;
    window.removeEventListener('keydown', onKey, true);
    show();
  }
  function onKey(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.code === 'Escape') stop();
    else if (isBindable(e.code)) {
      stop();
      onChange(e.code);
    }
  }
  btn.addEventListener('click', () => {
    if (waiting) return stop();
    waiting = true;
    show();
    window.addEventListener('keydown', onKey, true);
  });
  btn.addEventListener('blur', () => waiting && stop());
  const grow = el('div', 'vc-grow');
  grow.style.justifyContent = 'flex-end';
  grow.append(btn);
  node.append(text, grow);
  show();
  return {
    node,
    set(v) {
      current = v;
      show();
    },
  };
}

// A settings row with a button.
export function buttonRow({ label, hint, buttonLabel, iconName, onClick }) {
  const node = el('div', 'vc-row');
  const text = el('div', 'vc-label', label);
  if (hint) text.append(el('small', '', hint));
  const grow = el('div', 'vc-grow');
  grow.style.justifyContent = 'flex-end';
  grow.append(actionButton(buttonLabel, iconName, onClick, 'small'));
  node.append(text, grow);
  return { node };
}

// Page controls: previous, dots, next. Hidden when there is only one page. onChange(page).
export function createPager(onChange) {
  const node = el('div', 'vc-pager');
  const prev = iconButton('left', 'Previous page', () => setPage(page - 1, true));
  const next = iconButton('right', 'Next page', () => setPage(page + 1, true));
  const dots = el('div', 'vc-dots');
  node.append(prev, dots, next);
  let page = 0;
  let count = 1;
  function render() {
    node.hidden = count <= 1;
    dots.replaceChildren();
    for (let i = 0; i < count; i++) {
      const d = el('button', `vc-dot${i === page ? ' on' : ''}`);
      d.type = 'button';
      d.setAttribute('aria-label', `Page ${i + 1}`);
      d.addEventListener('click', () => setPage(i, true));
      dots.append(d);
    }
    prev.disabled = page === 0;
    next.disabled = page >= count - 1;
  }
  function setPage(p, notify = false) {
    const clamped = Math.max(0, Math.min(count - 1, p));
    const changed = clamped !== page;
    page = clamped;
    render();
    if (notify && changed) onChange(page);
  }
  return {
    node,
    get page() {
      return page;
    },
    get count() {
      return count;
    },
    setPages(n) {
      count = Math.max(1, n);
      page = Math.min(page, count - 1);
      render();
    },
    setPage,
  };
}

// How many rows of rowHeight pixels fit in height pixels (at least one).
export function rowsThatFit(height, rowHeight) {
  return Math.max(1, Math.floor(height / rowHeight));
}

// Calls onPrev / onNext when a finger or mouse is dragged sideways across the element.
export function onSwipe(node, onPrev, onNext, distance = 50) {
  let startX = null;
  node.addEventListener('pointerdown', (e) => {
    // A drag that starts on a slider or a button belongs to that control, not to the page swipe.
    startX = e.target.closest?.('input, button') ? null : e.clientX;
  });
  const end = (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (dx > distance) onPrev();
    else if (dx < -distance) onNext();
  };
  node.addEventListener('pointerup', end);
  node.addEventListener('pointercancel', () => (startX = null));
}
