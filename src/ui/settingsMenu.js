import { PARAMS, getParam, setParam, resetParam, resetAll, subscribe } from '../config/registry.js';
import {
  BUILTIN_PRESETS,
  snapshotValues,
  applyValues,
  cleanName,
  listPresets,
  readPreset,
  savePreset,
  deletePreset,
} from '../config/presets.js';

// Three layouts of one dashboard, picked with the buttons in the header (and remembered):
//  a "Garage":   sidebar of sections, one section at a time
//  b "Overview": every section on one screen
//  c "Race day": the essentials up front, every other section folded away
const LAYOUTS = [
  ['a', 'Garage', 'Sidebar with one section at a time'],
  ['b', 'Overview', 'Every section on one screen'],
  ['c', 'Race day', 'Essentials first, the rest folds away'],
];
const LAYOUT_KEY = 'vectorchase.menuLayout';
const ESSENTIALS = 'Essentials';
const ACCENTS = {
  Essentials: '#5aa9ff', Chassis: '#ffb454', Aero: '#6ee7b7', Suspension: '#c4a1ff', Engine: '#ff6b6b',
  Drivetrain: '#ff9f43', Wheels: '#7bd5f5', Tires: '#f2d16b', Brakes: '#ff7a90', Steering: '#8be28b',
};
// One-tap choices that set a numeric setting (shown above its slider).
const QUICK = {
  'drivetrain.frontBias': [['RWD', 0], ['AWD', 50], ['FWD', 100]],
  'tire.friction': [['Road', 1.1], ['Sport', 1.35], ['Slick', 1.7]],
};

const STYLE = `
#settings-menu{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(4,7,12,.55);z-index:10;font:14px/1.4 system-ui,sans-serif;color:#e8ecf3}
#settings-menu[hidden]{display:none}
#settings-menu *{box-sizing:border-box}
.sm-modal{width:min(980px,96vw);height:min(660px,92vh);display:flex;flex-direction:column;background:#0f131c;border:1px solid #2b3550;border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.6);overflow:hidden}
#settings-menu button{background:#222a3b;color:inherit;border:1px solid #36415c;border-radius:8px;padding:5px 10px;font:inherit;cursor:pointer;min-height:34px}
#settings-menu button:hover:not(:disabled){background:#2d3750}
#settings-menu button:disabled{opacity:.35;cursor:default}
#settings-menu button.on{background:#2f4f8f;border-color:#6e8fd8;color:#fff}
#settings-menu input[type=text],#settings-menu input[type=number],#settings-menu select{background:#151a26;color:inherit;border:1px solid #36415c;border-radius:8px;padding:5px 8px;font:inherit;min-height:34px}
.sm-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:10px 14px;border-bottom:1px solid #222b40;background:#121826}
.sm-head h2{margin:0 6px 0 0;font-size:17px;white-space:nowrap}
.sm-chips{display:flex;gap:6px;flex-wrap:wrap}
.sm-search{flex:1;min-width:140px}
.sm-layouts{display:flex;gap:4px}
.sm-close{width:34px;padding:0!important;font-size:16px}
.sm-stats{display:flex;gap:8px;flex-wrap:wrap;padding:8px 14px;border-bottom:1px solid #1b2232}
.sm-stat{flex:1;min-width:110px;background:#151b29;border:1px solid #232c42;border-radius:8px;padding:4px 10px}
.sm-stat small{display:block;color:#8a95ab;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.sm-stat b{font-size:17px;font-variant-numeric:tabular-nums}
.sm-body{flex:1;min-height:0;display:flex}
.sm-nav{width:170px;flex:none;overflow-y:auto;padding:10px 8px;border-right:1px solid #1b2232;display:flex;flex-direction:column;gap:4px}
.sm-nav button{display:flex;justify-content:space-between;align-items:center;text-align:left;border-left:4px solid var(--ac)!important;background:transparent!important}
.sm-nav button.on{background:#232d45!important}
.sm-badge{min-width:18px;text-align:center;border-radius:9px;background:#ffd166;color:#241a00;font-size:11px;font-weight:700;padding:0 5px}
.sm-badge:empty{display:none}
.sm-cards{flex:1;min-width:0;overflow-y:auto;padding:12px 14px;display:grid;gap:12px;align-content:start}
.sm-modal[data-layout=b] .sm-nav{display:none}
.sm-modal[data-layout=c] .sm-nav{display:none}
.sm-modal[data-layout=a] .sm-cards{grid-template-columns:1fr}
.sm-modal[data-layout=b] .sm-cards{grid-template-columns:repeat(auto-fill,minmax(290px,1fr))}
.sm-modal[data-layout=c] .sm-cards{grid-template-columns:1fr}
.sm-card{background:#131a28;border:1px solid #222b40;border-top:3px solid var(--ac);border-radius:10px;min-width:0}
.sm-card[hidden]{display:none}
.sm-card-head{display:flex;align-items:center;gap:8px;padding:8px 12px}
.sm-card-head h3{margin:0;flex:1;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--ac)}
.sm-card-head button{min-height:28px;padding:2px 8px;font-size:12px}
.sm-modal[data-layout=c] .sm-card:not(.big) .sm-card-head{cursor:pointer}
.sm-modal[data-layout=c] .sm-card:not(.big) .sm-card-head h3::before{content:'▸ '}
.sm-modal[data-layout=c] .sm-card:not(.big):not(.collapsed) .sm-card-head h3::before{content:'▾ '}
.sm-rows{display:grid;gap:0 18px;padding:0 12px 8px;grid-template-columns:1fr}
.sm-modal[data-layout=a] .sm-rows,.sm-modal[data-layout=c] .sm-rows{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.sm-modal[data-layout=b] .sm-card.big{grid-column:1/-1}
.sm-modal[data-layout=b] .sm-card.big .sm-rows{grid-template-columns:repeat(auto-fill,minmax(290px,1fr))}
.sm-modal[data-layout=c] .sm-card.collapsed .sm-rows{display:none}
.sm-modal[data-layout=b] .sm-desc,.sm-modal[data-layout=c] .sm-desc{display:none}
.sm-row{padding:8px 0;border-top:1px solid #1c2435}
.sm-row[hidden]{display:none}
.sm-row-top{display:flex;align-items:center;gap:8px}
.sm-label{flex:1;font-weight:600}
.sm-row.changed .sm-label::after{content:' ●';color:#ffd166;font-size:11px}
.sm-value{display:flex;align-items:center;gap:4px}
.sm-value input{width:84px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
.sm-unit{width:34px;color:#8a95ab;font-size:12px}
.sm-reset{width:34px;padding:0!important;visibility:hidden}
.sm-row.changed .sm-reset{visibility:visible}
.sm-seg{display:flex;gap:4px;margin-top:6px}
.sm-seg button{flex:1}
.sm-track{display:flex;align-items:center;gap:6px;margin-top:6px}
.sm-track button{width:34px;padding:0!important;font-size:18px}
.sm-slider{position:relative;flex:1;height:30px;display:flex;align-items:center}
.sm-slider input{width:100%;margin:0;height:30px;background:transparent;-webkit-appearance:none;appearance:none;cursor:pointer}
.sm-slider input::-webkit-slider-runnable-track{height:8px;border-radius:4px;background:linear-gradient(to right,var(--ac) var(--pct),#2a3346 var(--pct))}
.sm-slider input::-moz-range-track{height:8px;border-radius:4px;background:#2a3346}
.sm-slider input::-moz-range-progress{height:8px;border-radius:4px;background:var(--ac)}
.sm-slider input::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;margin-top:-6px;border-radius:50%;background:#fff;border:3px solid var(--ac)}
.sm-slider input::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid var(--ac)}
.sm-tick{position:absolute;top:4px;width:2px;height:22px;margin-left:-1px;background:#ffffff55;pointer-events:none;border-radius:1px}
.sm-range{display:flex;justify-content:space-between;margin:0 40px;color:#6f7a91;font-size:11px}
.sm-desc{margin-top:2px;color:#8a95ab;font-size:12px}
.sm-empty{color:#8a95ab;padding:20px;text-align:center}
.sm-foot{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;padding:8px 14px;border-top:1px solid #222b40;background:#121826}
.sm-foot input[type=text]{width:140px}
.sm-foot select{max-width:150px}
.sm-status{flex:1;min-width:120px;color:#9ad1a0;font-size:12px}
@media (max-width:720px){
.sm-modal{width:100vw;height:100vh;border-radius:0}
.sm-nav{position:static;width:auto;flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid #1b2232}
.sm-modal[data-layout=a] .sm-body{flex-direction:column}
.sm-rows,.sm-modal[data-layout=a] .sm-rows,.sm-modal[data-layout=c] .sm-rows{grid-template-columns:1fr}
.sm-nav button{flex:none}
}
`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, title, className) {
  const b = el('button', className ?? '', text);
  b.type = 'button';
  if (title) b.title = title;
  return b;
}

const formatValue = (value) => String(Number(value.toFixed(4)));
const percent = (def, value) => ((value - def.min) / (def.max - def.min)) * 100;

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked by the browser
  }
}

// Builds the settings dashboard from the registry. Returns { isOpen, open, close, toggle }.
export function createSettingsMenu() {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);
  const store = getStorage();

  const rows = new Map(); // parameter id -> its controls
  const cards = []; // { key, card, defs, items, nav, badges }
  let open = false;
  let layout = 'a';
  try {
    const saved = store?.getItem(LAYOUT_KEY);
    if (LAYOUTS.some((l) => l[0] === saved)) layout = saved;
  } catch {
    /* keep the default */
  }
  let activeKey = ESSENTIALS;
  const unfolded = new Set(); // sections opened by hand in layout c

  const backdrop = el('div');
  backdrop.id = 'settings-menu';
  backdrop.hidden = true;
  const modal = el('div', 'sm-modal');
  backdrop.append(modal);

  const status = el('div', 'sm-status');
  const say = (text) => {
    status.textContent = text;
  };

  // ---- Rows ----
  function refresh(id, force = false) {
    const ui = rows.get(id);
    const value = getParam(id);
    ui.slider.value = String(value);
    ui.row.style.setProperty('--pct', `${percent(ui.def, value)}%`);
    if (force || document.activeElement !== ui.number) ui.number.value = formatValue(value);
    ui.row.classList.toggle('changed', value !== ui.def.default);
    for (const b of ui.quick) b.classList.toggle('on', Number(b.dataset.v) === value);
  }

  const nudge = (def, direction) => setParam(def.id, Number((getParam(def.id) + direction * def.step).toFixed(6)));

  function createRow(def) {
    const row = el('div', 'sm-row');
    row.title = def.description;
    const label = el('label', 'sm-label', def.label);
    const number = el('input');
    number.type = 'number';
    number.min = String(def.min);
    number.max = String(def.max);
    number.step = String(def.step);
    number.id = `sm-${def.id}`;
    label.htmlFor = number.id;
    const reset = button('↺', 'Reset to stock', 'sm-reset');
    const value = el('div', 'sm-value');
    value.append(number, el('span', 'sm-unit', def.unit));
    const top = el('div', 'sm-row-top');
    top.append(label, value, reset);
    row.append(top);

    const quick = [];
    if (QUICK[def.id]) {
      const seg = el('div', 'sm-seg');
      for (const [name, v] of QUICK[def.id]) {
        const b = button(name, `${def.label}: ${v} ${def.unit}`.trim());
        b.dataset.v = String(v);
        b.addEventListener('click', () => setParam(def.id, v));
        quick.push(b);
        seg.append(b);
      }
      row.append(seg);
    }

    const slider = el('input');
    slider.type = 'range';
    slider.min = String(def.min);
    slider.max = String(def.max);
    slider.step = String(def.step);
    const tick = el('i', 'sm-tick');
    tick.style.left = `${percent(def, def.default)}%`;
    tick.title = 'Stock value';
    const box = el('div', 'sm-slider');
    box.append(slider, tick);
    const minus = button('−', 'Decrease');
    const plus = button('+', 'Increase');
    const track = el('div', 'sm-track');
    track.append(minus, box, plus);
    const range = el('div', 'sm-range');
    range.append(el('span', '', formatValue(def.min)), el('span', '', formatValue(def.max)));
    row.append(track, range, el('div', 'sm-desc', def.description));
    rows.set(def.id, { def, row, slider, number, quick });

    slider.addEventListener('input', () => setParam(def.id, slider.value));
    minus.addEventListener('click', () => nudge(def, -1));
    plus.addEventListener('click', () => nudge(def, 1));
    // The number box is applied when committed (Enter or leaving the box), not on every key.
    number.addEventListener('change', () => {
      setParam(def.id, number.value);
      refresh(def.id, true);
    });
    reset.addEventListener('click', () => resetParam(def.id));
    return row;
  }

  // ---- Header ----
  const head = el('div', 'sm-head');
  const chips = el('div', 'sm-chips');
  for (const preset of BUILTIN_PRESETS) {
    const b = button(preset.name, `Apply the ${preset.name} setup`);
    b.addEventListener('click', () => {
      applyValues(preset.values);
      say(`Applied the ${preset.name} setup.`);
    });
    chips.append(b);
  }
  const search = el('input', 'sm-search');
  search.type = 'text';
  search.placeholder = 'Search settings (grip, gears, aero...)';
  const layoutBar = el('div', 'sm-layouts');
  const layoutButtons = LAYOUTS.map(([key, name, hint]) => {
    const b = button(name, hint);
    b.addEventListener('click', () => setLayout(key));
    layoutBar.append(b);
    return b;
  });
  const closeButton = button('✕', 'Close (E)', 'sm-close');
  head.append(el('h2', '', 'Car dashboard'), chips, search, layoutBar, closeButton);

  // ---- Stats strip ----
  const stats = el('div', 'sm-stats');
  const statValues = {};
  for (const [key, name] of [['pw', 'Power / weight'], ['drive', 'Drive'], ['grip', 'Tire grip'], ['down', 'Downforce']]) {
    const box = el('div', 'sm-stat');
    statValues[key] = el('b');
    box.append(el('small', '', name), statValues[key]);
    stats.append(box);
  }
  function refreshStats() {
    const bias = getParam('drivetrain.frontBias');
    statValues.pw.textContent = `${Math.round((getParam('engine.power') / getParam('chassis.mass')) * 1000)} kW/t`;
    statValues.drive.textContent = bias === 0 ? 'Rear-wheel' : bias === 100 ? 'Front-wheel' : bias === 50 ? 'All-wheel' : `${bias}% front`;
    statValues.grip.textContent = `μ ${formatValue(getParam('tire.friction'))}`;
    statValues.down.textContent = `${formatValue(getParam('aero.downforce'))} m²`;
  }

  // ---- Sections: Essentials (the basic settings) first, then one per group ----
  const sections = new Map([[ESSENTIALS, []]]);
  for (const def of PARAMS) {
    if (def.basic) sections.get(ESSENTIALS).push(def);
    else {
      if (!sections.has(def.group)) sections.set(def.group, []);
      sections.get(def.group).push(def);
    }
  }
  const body = el('div', 'sm-body');
  const nav = el('div', 'sm-nav');
  const cardBox = el('div', 'sm-cards');
  const empty = el('div', 'sm-empty', 'No settings match your search.');
  empty.hidden = true;
  for (const [key, defs] of sections) {
    const card = el('section', `sm-card${key === ESSENTIALS ? ' big' : ''}`);
    card.style.setProperty('--ac', ACCENTS[key] ?? '#8fb8e8');
    const cardHead = el('div', 'sm-card-head');
    const resetGroup = button('Reset section', `Put every ${key.toLowerCase()} setting back to stock`);
    cardHead.append(el('h3', '', key), resetGroup);
    const rowBox = el('div', 'sm-rows');
    const items = defs.map((def) => ({ def, row: createRow(def) }));
    items.forEach((i) => rowBox.append(i.row));
    card.append(cardHead, rowBox);
    const navButton = button(key);
    navButton.style.setProperty('--ac', ACCENTS[key] ?? '#8fb8e8');
    const badge = el('span', 'sm-badge');
    navButton.append(badge);
    const entry = { key, card, items, navButton, badge };
    cards.push(entry);
    resetGroup.addEventListener('click', () => defs.forEach((d) => resetParam(d.id)));
    navButton.addEventListener('click', () => {
      activeKey = key;
      applyView();
    });
    cardHead.addEventListener('click', (e) => {
      if (layout !== 'c' || key === ESSENTIALS || e.target.closest('button')) return;
      if (unfolded.has(key)) unfolded.delete(key);
      else unfolded.add(key);
      applyView();
    });
    nav.append(navButton);
    cardBox.append(card);
  }
  cardBox.append(empty);
  body.append(nav, cardBox);

  function refreshBadges() {
    for (const c of cards) {
      const n = c.items.filter((i) => getParam(i.def.id) !== i.def.default).length;
      c.badge.textContent = n ? String(n) : '';
    }
  }

  // Shows the right sections for the layout and the search text.
  function applyView() {
    const q = search.value.trim().toLowerCase();
    let anyVisible = false;
    for (const c of cards) {
      let visible = 0;
      for (const { def, row } of c.items) {
        const hit = !q || `${def.label} ${def.description} ${def.group} ${def.id}`.toLowerCase().includes(q);
        row.hidden = !hit;
        if (hit) visible++;
      }
      const wanted = q ? visible > 0 : layout === 'a' ? c.key === activeKey : true;
      c.card.hidden = !wanted;
      c.card.classList.toggle('collapsed', layout === 'c' && !q && c.key !== ESSENTIALS && !unfolded.has(c.key));
      c.navButton.classList.toggle('on', c.key === activeKey);
      if (wanted) anyVisible = true;
    }
    nav.style.visibility = q ? 'hidden' : '';
    empty.hidden = anyVisible;
  }

  function setLayout(key) {
    layout = key;
    modal.dataset.layout = key;
    layoutButtons.forEach((b, i) => b.classList.toggle('on', LAYOUTS[i][0] === key));
    try {
      store?.setItem(LAYOUT_KEY, key);
    } catch {
      /* not saved, still works */
    }
    applyView();
  }
  search.addEventListener('input', applyView);

  // ---- Footer: presets ----
  const nameInput = el('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Preset name';
  nameInput.maxLength = 40;
  const saveButton = button('Save');
  const presetSelect = el('select');
  const loadButton = button('Load');
  const deleteButton = button('Delete');
  const resetAllButton = button('Reset all to stock');
  const foot = el('div', 'sm-foot');
  foot.append(nameInput, saveButton, presetSelect, loadButton, deleteButton, resetAllButton, status);

  function refreshPresetList(selectName) {
    const names = store ? listPresets(store) : [];
    if (names.length === 0) {
      presetSelect.replaceChildren(new Option('No saved presets', ''));
    } else {
      presetSelect.replaceChildren(...names.map((n) => new Option(n, n)));
      if (selectName && names.includes(selectName)) presetSelect.value = selectName;
    }
    loadButton.disabled = names.length === 0;
    deleteButton.disabled = names.length === 0;
  }

  resetAllButton.addEventListener('click', () => {
    resetAll();
    say('Everything is back to stock.');
  });
  saveButton.addEventListener('click', () => {
    const name = cleanName(nameInput.value);
    if (!store) return say('Saving is not available in this browser.');
    if (!name) return say('Type a name first.');
    if (savePreset(store, name, snapshotValues())) {
      say(`Saved "${name}".`);
      refreshPresetList(name);
    } else {
      say('Could not save (storage is full or blocked).');
    }
  });
  loadButton.addEventListener('click', () => {
    const name = presetSelect.value;
    const values = store && name ? readPreset(store, name) : null;
    if (!values) return say('Nothing to load.');
    applyValues(values);
    say(`Loaded "${name}".`);
  });
  deleteButton.addEventListener('click', () => {
    const name = presetSelect.value;
    if (store && name && deletePreset(store, name)) {
      say(`Deleted "${name}".`);
      refreshPresetList();
    } else {
      say('Nothing to delete.');
    }
  });

  modal.append(head, stats, body, foot);
  document.body.appendChild(backdrop);
  PARAMS.forEach((p) => refresh(p.id, true));
  refreshStats();
  refreshBadges();
  refreshPresetList();
  setLayout(layout);
  subscribe((ids) => {
    ids.forEach((id) => refresh(id));
    refreshStats();
    refreshBadges();
  });

  function setOpen(next) {
    if (next === open) return;
    open = next;
    backdrop.hidden = !open;
    // Hand the keyboard back to the game.
    if (!open && backdrop.contains(document.activeElement)) document.activeElement.blur();
  }

  closeButton.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) setOpen(false);
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && open) setOpen(false);
  });

  return {
    get isOpen() {
      return open;
    },
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!open),
  };
}
