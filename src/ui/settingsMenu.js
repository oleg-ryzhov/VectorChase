// The car tuner (E in a race, or Tune car in the menu). No scrolling: sections on a rail, rows that fit the
// screen, and a pager when a section needs more room. The icon toggle in the top right switches between the
// Basic page and the Advanced tabs. The drive share slider only shows for a custom drive layout.
// Keyboard: a number key picks a setting (keys can be changed in Settings), Left / Right / Up / Down change a
// slider, Space opens a list or flips a switch, Tab and the arrow keys move around.
import { PARAMS, getParam, setParam, resetParam, resetAll, subscribe } from '../config/registry.js';
import { BUILTIN_PRESETS, snapshotValues, applyValues, cleanName, listPresets, readPreset, savePreset, deletePreset } from '../config/presets.js';
import { el, addStyle } from './dom.js';
import { icon } from './icons.js';
import { ensureTheme, iconButton, actionButton, dropdown, rangeInput, createPager, onSwipe } from './widgets.js';
import { DEFAULT_SLOT_KEYS, SLOT_COUNT, keyLabel, stepValue } from '../config/tunerKeys.js';

export const ROW_HEIGHT = 84; // px, the same in the CSS, so the number of rows per page can be worked out
const SHEET_ROW = 56;

// Basic is one page of the core settings. Advanced has every setting once, in four tabs. Each page has at
// most 10 settings (the drive share row only counts while the layout is Custom), one number key each.
export const SECTIONS = [
  { id: 'basic', label: 'Basic', icon: 'tune', ids: ['chassis.mass', 'chassis.frontWeight', 'engine.power', 'drivetrain.frontBias', 'tire.friction', 'aero.downforce', 'brakes.torque', 'steering.maxAngle'] },
  { id: 'body', label: 'Body and aero', icon: 'chassis', advanced: true, ids: ['chassis.mass', 'chassis.frontWeight', 'chassis.cgHeight', 'suspension.rollFront', 'aero.dragArea', 'aero.downforce'] },
  { id: 'power', label: 'Powertrain', icon: 'engine', advanced: true, ids: ['engine.power', 'engine.redline', 'engine.braking', 'drivetrain.finalDrive', 'drivetrain.shiftRpm', 'drivetrain.frontBias'] },
  { id: 'grip', label: 'Wheels and tires', icon: 'grip', advanced: true, ids: ['wheel.radius', 'wheel.mass', 'tire.friction', 'tire.peakSlipAngle', 'tire.peakSlipRatio', 'tire.loadSensitivity', 'tire.rollingResistance'] },
  { id: 'control', label: 'Brakes and steering', icon: 'brakes', advanced: true, ids: ['brakes.torque', 'brakes.bias', 'steering.maxAngle', 'steering.speedRef'] },
];

export const DRIVE_LAYOUTS = [['rwd', 'RWD', 0], ['awd', 'AWD', 50], ['fwd', 'FWD', 100]];

// How many columns and rows per page fit in a width x height area, and how many pages that makes.
export function computePaging(width, height, rowHeight, total) {
  const columns = width >= 560 ? 2 : 1;
  const perPage = columns * Math.max(1, Math.floor(height / rowHeight));
  return { columns, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
}

const STYLE = `
#settings-menu{z-index:24}
.pt-main{flex:1;min-height:0;display:flex}
.pt-rail{width:170px;flex:none;display:flex;flex-direction:column;gap:6px;padding:10px;border-right:1px solid var(--vc-line);background:#0e1522}
.pt-rail button{display:flex;align-items:center;gap:10px;min-height:52px;padding:0 12px;border-radius:12px;background:transparent;border:1px solid transparent;color:var(--vc-mute);font:inherit;font-weight:600;cursor:pointer;text-align:left;transition:background .12s,color .12s}
.pt-rail button:hover{color:#fff;background:rgba(255,255,255,.05)}
.pt-rail button.on{background:var(--vc-panel2);color:#fff;border-color:var(--vc-line);box-shadow:inset 3px 0 0 var(--vc-accent)}
.pt-badge{margin-left:auto;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:var(--vc-warn);color:#241a00;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
.pt-badge:empty{display:none}
.pt-content{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}
.pt-rows{flex:1;min-height:0;display:grid;align-content:start;column-gap:26px;padding:2px 16px;overflow:hidden}
.pt-row{height:${ROW_HEIGHT}px;display:flex;flex-direction:column;justify-content:center;gap:2px;border-bottom:1px solid #1b2540}
.pt-top{display:flex;align-items:center;gap:8px;min-height:36px}
.pt-name{flex:1;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pt-row.changed .pt-name::after{content:'';display:inline-block;width:8px;height:8px;margin-left:8px;border-radius:50%;background:var(--vc-warn)}
.pt-num{width:84px;height:36px;padding:0 8px;text-align:right;font:inherit;font-weight:700;color:var(--vc-blue);background:#0c1220;border:1px solid var(--vc-edge);border-radius:10px}
.pt-num{-moz-appearance:textfield;appearance:textfield}
.pt-num::-webkit-inner-spin-button,.pt-num::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.pt-unit{width:32px;font-size:12px;color:var(--vc-mute)}
.pt-reset{width:36px;height:36px;visibility:hidden}
.pt-row.changed .pt-reset{visibility:visible}
.pt-track{display:flex;align-items:center;gap:4px}
.pt-track .vc-iconbtn{width:40px;height:40px;background:#0c1220;border:1px solid var(--vc-line)}
.pt-row .vc-seg{margin-top:2px}
.pt-dep{border-left:3px solid var(--vc-blue);padding-left:10px;margin-left:-13px}
.pt-bar{display:flex;align-items:center;gap:8px;padding:0 6px 0 0}
.pt-mode{width:auto;gap:2px;padding:0 4px;background:#0c1220;border-color:var(--vc-line)}
.pt-mode svg{width:28px;height:28px;padding:4px;border-radius:8px}
.pt-mode[aria-checked=false] svg:first-child,.pt-mode[aria-checked=true] svg:last-child{background:var(--vc-blue);color:#06101f}
.pt-key{flex:none;min-width:22px;height:22px;padding:0 6px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--vc-line);border-bottom-width:2px;border-radius:6px;background:#0c1220;color:var(--vc-mute);font-size:12px;font-weight:700}
.pt-row:focus-within{background:#17223c;box-shadow:inset 3px 0 0 var(--vc-blue)}
.pt-row .vc-select{min-height:36px}
@media (pointer:coarse){.pt-key,.vc-foot.pt-hint{display:none}}
.pt-sheet{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;background:var(--vc-panel)}
.pt-sheet .pt-list{flex:1;min-height:0;overflow:hidden;padding:6px 16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));column-gap:20px;align-content:start}
.pt-entry{display:flex;align-items:center;gap:6px;height:${SHEET_ROW}px}
.pt-entry .vc-btn{flex:1;justify-content:flex-start;min-width:0}
.pt-save{display:flex;gap:8px;padding:8px 12px;border-top:1px solid var(--vc-line)}
.pt-save input{flex:1;min-width:0;height:44px;padding:0 12px;background:#0c1220;color:var(--vc-text);border:1px solid var(--vc-edge);border-radius:12px;font:inherit}
@media (max-width:760px){.pt-main{flex-direction:column}.pt-rail{width:auto;flex-direction:row;gap:4px;padding:6px;border-right:0;border-bottom:1px solid var(--vc-line)}.pt-rail button{flex:1;min-width:0;justify-content:center;padding:0 4px;min-height:44px}.pt-rail button .lbl{display:none}.pt-badge{margin-left:0}}
@media (max-height:430px){.pt-rail{padding:6px;gap:4px}.pt-rail button{min-height:44px}}
`;

export function createSettingsMenu({ getStorage = () => null, settings = null } = {}) {
  ensureTheme();
  addStyle(STYLE);
  const store = getStorage();
  const byId = new Map(PARAMS.map((p) => [p.id, p]));

  const root = el('div', 'vc-screen');
  root.id = 'settings-menu';
  root.hidden = true;
  const panel = el('div', 'vc-panel');
  root.append(panel);

  let open = false;
  let advanced = false;
  let customDrive = false;
  let sectionId = 'basic';
  let armed = null;

  // ---- Header ----
  const title = el('h2', '', 'Tune car');
  // Two icons side by side: the one for the current mode is lit.
  const modeToggle = el('button', 'vc-iconbtn pt-mode');
  modeToggle.type = 'button';
  modeToggle.setAttribute('role', 'switch');
  modeToggle.append(icon('tune', 20), icon('grid', 20));
  modeToggle.addEventListener('click', () => setMode(!advanced));
  function syncMode() {
    const label = advanced ? 'Advanced tuner. Switch to basic' : 'Basic tuner. Switch to advanced';
    modeToggle.title = label;
    modeToggle.setAttribute('aria-label', label);
    modeToggle.setAttribute('aria-checked', String(advanced));
  }
  function setMode(next) {
    advanced = next;
    sectionId = SECTIONS.find((s) => Boolean(s.advanced) === advanced).id;
    pager.setPage(0);
    syncMode();
    renderAll();
  }
  syncMode();
  const presetsButton = actionButton('Presets', 'car', () => openSheet(), 'small');
  const resetButton = iconButton('reset', 'Reset everything to stock', () => {
    if (armed) {
      clearTimeout(armed);
      armed = null;
      title.textContent = 'Tune car';
      resetAll();
      return;
    }
    title.textContent = 'Tap reset again to confirm';
    armed = setTimeout(() => {
      armed = null;
      title.textContent = 'Tune car';
    }, 2500);
  });
  const closeButton = iconButton('close', 'Close', () => setOpen(false));
  const head = el('div', 'vc-head');
  const bar = el('div', 'pt-bar');
  bar.append(presetsButton, resetButton, modeToggle, closeButton);
  head.append(title, bar);

  // ---- Rail ----
  const rail = el('div', 'pt-rail');
  const railButtons = new Map();
  for (const s of SECTIONS) {
    const b = el('button');
    b.type = 'button';
    b.title = s.label;
    const badge = el('span', 'pt-badge');
    b.append(icon(s.icon, 22), el('span', 'lbl', s.label), badge);
    b.addEventListener('click', () => {
      sectionId = s.id;
      pager.setPage(0);
      renderAll();
    });
    rail.append(b);
    railButtons.set(s.id, { b, badge });
  }

  // ---- Rows ----
  const rowsBox = el('div', 'pt-rows');
  const pager = createPager(() => renderRows());
  const content = el('div', 'pt-content');
  content.append(rowsBox, pager.node);
  const main = el('div', 'pt-main');
  main.append(rail, content);
  const body = el('div', 'vc-body');
  body.append(main);
  const hint = el('div', 'vc-foot pt-hint');
  hint.append(el('span', 'vc-note', "Press a setting's key to pick it. Left and Right adjust (hold Shift for fine steps), Up and Down jump to the highest or lowest value. Space flips a switch or opens a list. Delete puts a setting back to stock."));
  panel.append(head, body, hint);
  onSwipe(rowsBox, () => pager.setPage(pager.page - 1, true), () => pager.setPage(pager.page + 1, true));

  const rows = new Map(); // id -> { node, refresh }
  const fmt = (def, v) => String(Number(v.toFixed(4)));

  function paramRow(def) {
    const node = el('div', 'pt-row');
    node.title = def.description;
    const name = el('div', 'pt-name', def.label);
    const key = el('span', 'pt-key');
    const num = el('input', 'pt-num');
    num.type = 'number';
    num.inputMode = 'decimal';
    num.min = String(def.min);
    num.max = String(def.max);
    num.step = String(def.step);
    num.setAttribute('aria-label', def.label);
    const reset = iconButton('reset', 'Reset to stock', () => resetParam(def.id), 'pt-reset');
    reset.tabIndex = -1;
    const top = el('div', 'pt-top');
    top.append(key, name, num, el('span', 'pt-unit', def.unit), reset);
    const nudge = (d) => setParam(def.id, Number((getParam(def.id) + d * def.step).toFixed(6)));
    const range = rangeInput({ min: def.min, max: def.max, step: def.step, value: getParam(def.id), onInput: (v) => setParam(def.id, v) });
    const track = el('div', 'pt-track');
    const minus = iconButton('minus', 'Decrease', () => nudge(-1));
    const plus = iconButton('plus', 'Increase', () => nudge(1));
    minus.tabIndex = plus.tabIndex = -1; // the keyboard uses the slider itself
    range.input.dataset.param = def.id;
    track.append(minus, range.input, plus);
    node.append(top, track);
    num.addEventListener('change', () => {
      setParam(def.id, num.value);
      refresh(true);
    });
    function refresh(force = false) {
      const v = getParam(def.id);
      range.set(v);
      if (force || document.activeElement !== num) num.value = fmt(def, v);
      node.classList.toggle('changed', v !== def.default);
    }
    refresh(true);
    return { node, refresh, key, primary: range.input };
  }

  // The drive share: layout chips, and the exact share only for a custom layout.
  const driveDef = byId.get('drivetrain.frontBias');
  const driveShare = paramRow(driveDef);
  driveShare.node.classList.add('pt-dep');
  const driveNode = el('div', 'pt-row');
  driveNode.title = 'Which wheels the engine drives.';
  const driveSelect = dropdown({
    label: 'Drive layout',
    options: [...DRIVE_LAYOUTS.map(([id, label]) => [id, label]), ['custom', 'Custom']],
    value: 'rwd',
    host: body,
    onChange: (id) => {
      if (id === 'custom') customDrive = true;
      else {
        customDrive = false;
        setParam(driveDef.id, DRIVE_LAYOUTS.find((d) => d[0] === id)[2]);
      }
      renderAll();
    },
  });
  const driveKey = el('span', 'pt-key');
  const driveTop = el('div', 'pt-top');
  driveTop.append(driveKey, el('div', 'pt-name', 'Drive layout'));
  driveNode.append(driveTop, driveSelect.node);
  function refreshDrive() {
    const v = getParam(driveDef.id);
    const preset = DRIVE_LAYOUTS.find((d) => d[2] === v);
    if (!preset) customDrive = true;
    driveSelect.set(customDrive || !preset ? 'custom' : preset[0]);
    driveNode.classList.toggle('changed', v !== driveDef.default);
    driveShare.refresh();
  }
  rows.set('drive.layout', { node: driveNode, refresh: refreshDrive, key: driveKey, primary: driveSelect.node });
  rows.set(driveDef.id, { node: driveShare.node, refresh: refreshDrive, key: driveShare.key, primary: driveShare.primary });
  for (const def of PARAMS) if (def.id !== driveDef.id) rows.set(def.id, paramRow(def));

  // Rows of a section that should show now.
  function sectionRows(section) {
    const list = [];
    for (const id of section.ids) {
      if (id === driveDef.id) {
        list.push(rows.get('drive.layout'));
        if (customDrive) list.push(rows.get(driveDef.id));
      } else list.push(rows.get(id));
    }
    return list;
  }

  const activeSections = () => SECTIONS.filter((s) => Boolean(s.advanced) === advanced);

  // The rows of the page shown (all pages of it) and how many fit on one screen.
  const view = { list: [], perPage: 1 };
  const slotKey = (i) => (settings ? settings.get(`tuner.key${i + 1}`) : DEFAULT_SLOT_KEYS[i]);
  function renderKeys() {
    view.list.forEach((r, i) => {
      const label = i < SLOT_COUNT ? keyLabel(slotKey(i)) : '';
      r.key.textContent = label;
      r.key.hidden = !label;
    });
  }

  function renderRows() {
    const section = SECTIONS.find((s) => s.id === sectionId);
    const list = sectionRows(section);
    const w = rowsBox.clientWidth || 700;
    const h = rowsBox.clientHeight || ROW_HEIGHT * 4;
    const { columns, perPage, pages } = computePaging(w, h, ROW_HEIGHT, list.length);
    pager.setPages(pages);
    const start = pager.page * perPage;
    rowsBox.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    view.list = list;
    view.perPage = perPage;
    rowsBox.replaceChildren(...list.slice(start, start + perPage).map((r) => r.node));
    renderKeys();
  }

  function renderRail() {
    const visible = activeSections();
    rail.hidden = visible.length <= 1;
    for (const s of SECTIONS) {
      const { b, badge } = railButtons.get(s.id);
      b.hidden = !visible.includes(s);
      b.classList.toggle('on', s.id === sectionId);
      const changed = s.ids.filter((id) => getParam(id) !== byId.get(id).default).length;
      badge.textContent = changed ? String(changed) : '';
    }
  }

  function renderAll() {
    refreshDrive();
    for (const r of rows.values()) r.refresh();
    renderRail();
    renderRows();
  }

  settings?.subscribe(() => renderKeys());
  subscribe(() => {
    for (const r of rows.values()) r.refresh();
    refreshDrive();
    renderRail();
  });

  // ---- Presets sheet ----
  let sheet = null;
  function openSheet() {
    sheet?.remove();
    const names = () => (store ? listPresets(store) : []);
    sheet = el('div', 'pt-sheet');
    const sheetHead = el('div', 'vc-head');
    sheetHead.append(el('h2', '', 'Presets'), iconButton('close', 'Back', () => closeSheet()));
    const list = el('div', 'pt-list');
    const sheetPager = createPager(() => fill());
    const input = el('input');
    input.type = 'text';
    input.placeholder = 'Name for this setup';
    input.maxLength = 40;
    const save = actionButton('Save', 'check', () => {
      const name = cleanName(input.value);
      if (!name || !store) return;
      if (savePreset(store, name, snapshotValues())) {
        input.value = '';
        fill();
      }
    }, 'primary');
    const saveBar = el('div', 'pt-save');
    saveBar.append(input, save);
    sheet.append(sheetHead, list, sheetPager.node, saveBar);
    body.append(sheet);

    function fill() {
      const entries = [
        ...BUILTIN_PRESETS.map((p) => ({ name: p.name, apply: () => applyValues(p.values), builtin: true })),
        ...names().map((n) => ({ name: n, apply: () => applyValues(readPreset(store, n) ?? {}), builtin: false })),
      ];
      const h = list.clientHeight || SHEET_ROW * 5;
      const { columns, perPage, pages } = computePaging(list.clientWidth || 700, h, SHEET_ROW, entries.length);
      sheetPager.setPages(pages);
      list.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
      list.replaceChildren(
        ...entries.slice(sheetPager.page * perPage, sheetPager.page * perPage + perPage).map((e) => {
          const row = el('div', 'pt-entry');
          const b = actionButton(e.name, e.builtin ? 'tune' : 'car', () => {
            e.apply();
            closeSheet();
          });
          row.append(b);
          if (!e.builtin) {
            row.append(iconButton('close', `Delete ${e.name}`, () => {
              deletePreset(store, e.name);
              fill();
            }));
          }
          return row;
        })
      );
    }
    fill();
  }
  function closeSheet() {
    sheet?.remove();
    sheet = null;
  }

  function setOpen(next) {
    if (next === open) return;
    open = next;
    root.hidden = !open;
    if (open) renderAll();
    else {
      closeSheet();
      driveSelect.close(false); // a pop-up left open would still be there next time
      if (root.contains(document.activeElement)) document.activeElement.blur();
    }
  }

  closeButton.addEventListener('click', () => setOpen(false));
  root.addEventListener('pointerdown', (e) => {
    if (e.target === root) setOpen(false);
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && open) {
      if (sheet) closeSheet();
      else setOpen(false);
    }
  });
  // ---- Keyboard ----
  const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
  const pageControls = () => [...rowsBox.children].map((n) => view.list.find((r) => r.node === n)?.primary).filter(Boolean);

  // Focus the setting in slot i of this page, turning to the page it is on if needed.
  function focusSlot(i) {
    if (i >= view.list.length) return;
    const page = Math.floor(i / view.perPage);
    if (page !== pager.page) {
      pager.setPage(page);
      renderRows();
    }
    view.list[i].primary.focus();
  }

  window.addEventListener('keydown', (e) => {
    if (!open || sheet || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target instanceof Element ? e.target : null;
    if (e.code === 'Tab' && t && root.contains(t)) {
      // Keep Tab inside the tuner: from the last control it goes back to the first, and the other way round.
      const all = [...root.querySelectorAll('button, input')].filter((n) => n.tabIndex >= 0 && !n.disabled && !n.closest('[hidden]'));
      const edge = e.shiftKey ? all[0] : all[all.length - 1];
      if (t === edge) {
        e.preventDefault();
        (e.shiftKey ? all[all.length - 1] : all[0]).focus();
        return;
      }
    }
    if (t?.matches('input[type="number"], input[type="text"]')) return; // typing a value
    const slot = Array.from({ length: SLOT_COUNT }, (_, i) => slotKey(i)).indexOf(e.code);
    if (slot >= 0) {
      e.preventDefault();
      if (!e.repeat) focusSlot(slot);
      return;
    }
    if (!t || !root.contains(t)) {
      // Focus is outside the tuner: the first navigation key brings it in.
      if (NAV_KEYS.has(e.code)) {
        e.preventDefault();
        pageControls()[0]?.focus();
      }
      return;
    }
    if (e.code === 'Delete' || e.code === 'Backspace') {
      // Put the focused setting back to stock.
      if (t.dataset.param) resetParam(t.dataset.param);
      else if (t === driveSelect.node) {
        customDrive = false;
        resetParam(driveDef.id);
        renderAll();
      } else return;
      e.preventDefault();
      return;
    }
    if (t.dataset.param) {
      // A slider: Left / Right step it, Up / Down jump to the end.
      const def = byId.get(t.dataset.param);
      const now = getParam(def.id);
      const next = e.code === 'ArrowLeft' ? stepValue(def, now, -1, e.shiftKey)
        : e.code === 'ArrowRight' ? stepValue(def, now, 1, e.shiftKey)
        : e.code === 'ArrowUp' ? def.max
        : e.code === 'ArrowDown' ? def.min : null;
      if (next !== null) {
        e.preventDefault();
        setParam(def.id, next);
      }
      return;
    }
    const down = e.code === 'ArrowDown';
    const vertical = down || e.code === 'ArrowUp';
    const railButton = t.closest('.pt-rail button');
    if (railButton) {
      const buttons = activeSections().map((s) => railButtons.get(s.id).b);
      if (vertical) buttons[buttons.indexOf(railButton) + (down ? 1 : -1)]?.focus();
      else if (e.code === 'ArrowRight') pageControls()[0]?.focus();
      else return;
      e.preventDefault();
      return;
    }
    const controls = pageControls();
    const i = controls.indexOf(t);
    if (i < 0) return;
    if (vertical) {
      e.preventDefault();
      controls[i + (down ? 1 : -1)]?.focus();
    } else if (e.code === 'ArrowLeft' && !rail.hidden) {
      e.preventDefault();
      railButtons.get(sectionId).b.focus();
    }
  });
  window.addEventListener('resize', () => open && renderRows());
  document.body.appendChild(root);

  return {
    get isOpen() {
      return open;
    },
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!open),
  };
}
