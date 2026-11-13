import { PARAMS, getParam, setParam, resetParam, resetAll, subscribe } from '../config/registry.js';
import {
  snapshotValues,
  applyValues,
  cleanName,
  listPresets,
  readPreset,
  savePreset,
  deletePreset,
} from '../config/presets.js';

const STYLE = `
#settings-menu{position:fixed;top:0;right:0;bottom:0;width:min(400px,100vw);box-sizing:border-box;overflow-y:auto;padding:14px 16px 28px;background:rgba(12,15,22,.93);color:#e8ecf3;font:13px/1.4 system-ui,sans-serif;z-index:10}
#settings-menu[hidden]{display:none}
#settings-menu h2{margin:0;font-size:18px}
#settings-menu h3{margin:18px 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8fb8e8}
#settings-menu button{background:#2a3242;color:inherit;border:1px solid #3d4760;border-radius:5px;padding:4px 10px;font:inherit;cursor:pointer}
#settings-menu button:hover:not(:disabled){background:#38425a}
#settings-menu button:disabled{opacity:.4;cursor:default}
#settings-menu input[type=text],#settings-menu input[type=number],#settings-menu select{background:#171c27;color:inherit;border:1px solid #3d4760;border-radius:5px;padding:4px 6px;font:inherit;box-sizing:border-box}
.sm-header{display:flex;justify-content:space-between;align-items:center}
.sm-hint{margin:6px 0 10px;color:#9aa4b5}
.sm-bar{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
.sm-bar input[type=text],.sm-bar select{flex:1;min-width:0}
.sm-status{min-height:1.4em;color:#9ad1a0}
.sm-row{padding:8px 0;border-bottom:1px solid #222a3a}
.sm-row.changed .sm-label{color:#ffd166}
.sm-row-head{display:flex;align-items:center;gap:8px}
.sm-label{flex:1}
.sm-unit{color:#9aa4b5}
.sm-controls{display:flex;gap:8px;margin-top:4px}
.sm-controls input[type=range]{flex:1;min-width:0}
.sm-controls input[type=number]{width:84px}
.sm-desc{margin-top:3px;color:#9aa4b5;font-size:12px}
`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, title) {
  const b = el('button', '', text);
  b.type = 'button';
  if (title) b.title = title;
  return b;
}

function formatValue(value) {
  return String(Number(value.toFixed(4)));
}

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked by the browser
  }
}

// Builds the settings panel from the registry. Returns { isOpen, open, close, toggle }.
export function createSettingsMenu() {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  const panel = el('div');
  panel.id = 'settings-menu';
  panel.hidden = true;

  const rows = new Map(); // parameter id -> its controls
  let open = false;

  function say(text) {
    status.textContent = text;
  }

  // Shows the stored value in the controls. The number box is left alone while it is
  // being typed in, unless force is set (used when its value has just been committed).
  function refresh(id, force = false) {
    const ui = rows.get(id);
    const value = getParam(id);
    ui.slider.value = String(value);
    if (force || document.activeElement !== ui.number) ui.number.value = formatValue(value);
    const isDefault = value === ui.def.default;
    ui.row.classList.toggle('changed', !isDefault);
    ui.reset.disabled = isDefault;
  }

  function createRow(def) {
    const row = el('div', 'sm-row');
    const head = el('div', 'sm-row-head');
    const label = el('label', 'sm-label', def.label);
    const unit = el('span', 'sm-unit', def.unit);
    const reset = button('↺', 'Reset to default');
    head.append(label, unit, reset);

    const slider = el('input');
    slider.type = 'range';
    slider.min = String(def.min);
    slider.max = String(def.max);
    slider.step = String(def.step);

    const number = el('input');
    number.type = 'number';
    number.min = String(def.min);
    number.max = String(def.max);
    number.step = String(def.step);
    number.id = `sm-${def.id}`;
    label.htmlFor = number.id;

    const controlsRow = el('div', 'sm-controls');
    controlsRow.append(slider, number);
    row.append(head, controlsRow, el('div', 'sm-desc', def.description));
    rows.set(def.id, { def, row, slider, number, reset });

    slider.addEventListener('input', () => setParam(def.id, slider.value));
    // The number box is applied when committed (Enter or leaving the box), not on every key.
    number.addEventListener('change', () => {
      setParam(def.id, number.value);
      refresh(def.id, true);
    });
    reset.addEventListener('click', () => resetParam(def.id));
    return row;
  }

  // Header
  const header = el('div', 'sm-header');
  const closeButton = button('✕', 'Close (E)');
  header.append(el('h2', '', 'Car settings'), closeButton);
  panel.append(header, el('p', 'sm-hint', 'Press E to close. Time slows while this is open.'));

  // Presets
  const resetAllButton = button('Reset all to defaults');
  const nameInput = el('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Preset name';
  nameInput.maxLength = 40;
  const saveButton = button('Save');
  const presetSelect = el('select');
  const loadButton = button('Load');
  const deleteButton = button('Delete');
  const status = el('div', 'sm-status');

  const saveBar = el('div', 'sm-bar');
  saveBar.append(nameInput, saveButton);
  const loadBar = el('div', 'sm-bar');
  loadBar.append(presetSelect, loadButton, deleteButton);
  const resetBar = el('div', 'sm-bar');
  resetBar.append(resetAllButton);
  panel.append(resetBar, saveBar, loadBar, status);

  function refreshPresetList(selectName) {
    const store = getStorage();
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
    say('All values reset.');
  });

  saveButton.addEventListener('click', () => {
    const store = getStorage();
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
    const store = getStorage();
    const name = presetSelect.value;
    const values = store && name ? readPreset(store, name) : null;
    if (!values) return say('Nothing to load.');
    applyValues(values);
    say(`Loaded "${name}".`);
  });

  deleteButton.addEventListener('click', () => {
    const store = getStorage();
    const name = presetSelect.value;
    if (store && name && deletePreset(store, name)) {
      say(`Deleted "${name}".`);
      refreshPresetList();
    } else {
      say('Nothing to delete.');
    }
  });

  // One section per group, in the order groups first appear in the registry.
  const groups = new Map();
  for (const def of PARAMS) {
    if (!groups.has(def.group)) groups.set(def.group, []);
    groups.get(def.group).push(def);
  }
  for (const [name, defs] of groups) {
    const section = el('section');
    section.append(el('h3', '', name));
    for (const def of defs) section.append(createRow(def));
    panel.append(section);
  }

  document.body.appendChild(panel);
  PARAMS.forEach((p) => refresh(p.id, true));
  refreshPresetList();
  subscribe((ids) => ids.forEach((id) => refresh(id)));

  function setOpen(next) {
    if (next === open) return;
    open = next;
    panel.hidden = !open;
    // Hand the keyboard back to the game.
    if (!open && panel.contains(document.activeElement)) document.activeElement.blur();
  }

  closeButton.addEventListener('click', () => setOpen(false));
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
