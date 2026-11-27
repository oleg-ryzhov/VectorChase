// The car tuner (E in a race, or Tune car in the menu). Built for a phone held sideways: no scrolling, no
// drop-downs. A few sections on a rail, rows that fit the screen, and a pager when a section needs more room.
// Advanced sections only appear while the Advanced switch is on, and the drive share slider only for a
// custom drive layout.
import { PARAMS, getParam, setParam, resetParam, resetAll, subscribe } from '../config/registry.js';
import { BUILTIN_PRESETS, snapshotValues, applyValues, cleanName, listPresets, readPreset, savePreset, deletePreset } from '../config/presets.js';
import { el, addStyle } from './dom.js';
import { icon } from './icons.js';
import { ensureTheme, iconButton, actionButton, segmented, switchControl, rangeInput, createPager, onSwipe } from './widgets.js';

export const ROW_HEIGHT = 76; // px, the same in the CSS, so the number of rows per page can be worked out
const SHEET_ROW = 56;

// Every setting appears in exactly one section.
export const SECTIONS = [
  { id: 'essentials', label: 'Essentials', icon: 'tune', ids: ['chassis.mass', 'engine.power', 'drivetrain.frontBias', 'tire.friction', 'aero.downforce', 'brakes.torque', 'steering.maxAngle'] },
  { id: 'body', label: 'Body', icon: 'chassis', advanced: true, ids: ['chassis.frontWeight', 'chassis.cgHeight', 'aero.dragArea', 'suspension.rollFront'] },
  { id: 'power', label: 'Powertrain', icon: 'engine', advanced: true, ids: ['engine.redline', 'engine.braking', 'drivetrain.finalDrive', 'drivetrain.shiftRpm'] },
  { id: 'grip', label: 'Grip', icon: 'grip', advanced: true, ids: ['wheel.radius', 'wheel.mass', 'tire.peakSlipAngle', 'tire.peakSlipRatio', 'tire.loadSensitivity', 'tire.rollingResistance'] },
  { id: 'control', label: 'Control', icon: 'brakes', advanced: true, ids: ['brakes.bias', 'steering.speedRef'] },
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
.pt-rail button{display:flex;align-items:center;gap:10px;min-height:52px;padding:0 12px;border-radius:12px;background:transparent;border:1px solid transparent;color:var(--vc-mute);font:inherit;font-weight:600;cursor:pointer;text-align:left}
.pt-rail button.on{background:var(--vc-panel2);color:#fff;border-color:var(--vc-line);box-shadow:inset 3px 0 0 var(--vc-accent)}
.pt-badge{margin-left:auto;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:var(--vc-warn);color:#241a00;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
.pt-badge:empty{display:none}
.pt-content{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}
.pt-rows{flex:1;min-height:0;display:grid;align-content:start;column-gap:26px;padding:2px 16px;overflow:hidden}
.pt-row{height:${ROW_HEIGHT}px;display:flex;flex-direction:column;justify-content:center;gap:2px;border-bottom:1px solid #1b2540}
.pt-top{display:flex;align-items:center;gap:8px;min-height:36px}
.pt-name{flex:1;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pt-row.changed .pt-name::after{content:'';display:inline-block;width:8px;height:8px;margin-left:8px;border-radius:50%;background:var(--vc-warn)}
.pt-num{width:84px;height:36px;padding:0 8px;text-align:right;font:inherit;font-weight:700;color:var(--vc-blue);background:#0c1220;border:1px solid var(--vc-line);border-radius:10px}
.pt-unit{width:32px;font-size:12px;color:var(--vc-mute)}
.pt-reset{width:36px;height:36px;visibility:hidden}
.pt-row.changed .pt-reset{visibility:visible}
.pt-track{display:flex;align-items:center;gap:4px}
.pt-track .vc-iconbtn{width:40px;height:40px;background:#0c1220;border:1px solid var(--vc-line)}
.pt-row .vc-seg{margin-top:2px}
.pt-dep{border-left:3px solid var(--vc-blue);padding-left:10px;margin-left:-13px}
.pt-bar{display:flex;align-items:center;gap:8px;padding:0 6px 0 0}
.pt-bar label{display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px;white-space:nowrap}
.pt-sheet{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;background:var(--vc-panel)}
.pt-sheet .pt-list{flex:1;min-height:0;overflow:hidden;padding:6px 16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));column-gap:20px;align-content:start}
.pt-entry{display:flex;align-items:center;gap:6px;height:${SHEET_ROW}px}
.pt-entry .vc-btn{flex:1;justify-content:flex-start;min-width:0}
.pt-save{display:flex;gap:8px;padding:8px 12px;border-top:1px solid var(--vc-line)}
.pt-save input{flex:1;min-width:0;height:44px;padding:0 12px;background:#0c1220;color:var(--vc-text);border:1px solid var(--vc-line);border-radius:12px;font:inherit}
@media (max-width:760px){.pt-main{flex-direction:column}.pt-rail{width:auto;flex-direction:row;gap:4px;padding:6px;border-right:0;border-bottom:1px solid var(--vc-line)}.pt-rail button{flex:1;min-width:0;justify-content:center;padding:0 4px;min-height:44px}.pt-rail button .lbl{display:none}.pt-badge{margin-left:0}}
@media (max-height:430px){.pt-rail{padding:6px;gap:4px}.pt-rail button{min-height:44px}}
`;

export function createSettingsMenu({ getStorage = () => null } = {}) {
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
  let sectionId = 'essentials';
  let armed = null;

  // ---- Header ----
  const title = el('h2', '', 'Tune car');
  const advancedSwitch = switchControl(false, (v) => {
    advanced = v;
    if (!advanced) sectionId = 'essentials';
    renderAll();
  });
  const advancedLabel = el('label');
  advancedLabel.append(el('span', '', 'Advanced'), advancedSwitch.node);
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
  bar.append(advancedLabel, presetsButton, resetButton, closeButton);
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
  panel.append(head, body);
  onSwipe(rowsBox, () => pager.setPage(pager.page - 1, true), () => pager.setPage(pager.page + 1, true));

  const rows = new Map(); // id -> { node, refresh }
  const fmt = (def, v) => String(Number(v.toFixed(4)));

  function paramRow(def) {
    const node = el('div', 'pt-row');
    node.title = def.description;
    const name = el('div', 'pt-name', def.label);
    const num = el('input', 'pt-num');
    num.type = 'number';
    num.inputMode = 'decimal';
    num.min = String(def.min);
    num.max = String(def.max);
    num.step = String(def.step);
    num.setAttribute('aria-label', def.label);
    const reset = iconButton('reset', 'Reset to stock', () => resetParam(def.id), 'pt-reset');
    const top = el('div', 'pt-top');
    top.append(name, num, el('span', 'pt-unit', def.unit), reset);
    const nudge = (d) => setParam(def.id, Number((getParam(def.id) + d * def.step).toFixed(6)));
    const range = rangeInput({ min: def.min, max: def.max, step: def.step, value: getParam(def.id), onInput: (v) => setParam(def.id, v) });
    const track = el('div', 'pt-track');
    track.append(iconButton('minus', 'Decrease', () => nudge(-1)), range.input, iconButton('plus', 'Increase', () => nudge(1)));
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
    return { node, refresh };
  }

  // The drive share: layout chips, and the exact share only for a custom layout.
  const driveDef = byId.get('drivetrain.frontBias');
  const driveShare = paramRow(driveDef);
  driveShare.node.classList.add('pt-dep');
  const driveNode = el('div', 'pt-row');
  driveNode.title = 'Which wheels the engine drives.';
  const driveSeg = segmented([...DRIVE_LAYOUTS.map(([id, label]) => [id, label]), ['custom', 'Custom']], 'rwd', (id) => {
    if (id === 'custom') customDrive = true;
    else {
      customDrive = false;
      setParam(driveDef.id, DRIVE_LAYOUTS.find((d) => d[0] === id)[2]);
    }
    renderAll();
  });
  const driveTop = el('div', 'pt-top');
  driveTop.append(el('div', 'pt-name', 'Drive layout'));
  driveNode.append(driveTop, driveSeg.node);
  function refreshDrive() {
    const v = getParam(driveDef.id);
    const preset = DRIVE_LAYOUTS.find((d) => d[2] === v);
    if (!preset) customDrive = true;
    driveSeg.set(customDrive || !preset ? 'custom' : preset[0]);
    driveNode.classList.toggle('changed', v !== driveDef.default);
    driveShare.refresh();
  }
  rows.set('drive.layout', { node: driveNode, refresh: refreshDrive });
  rows.set(driveDef.id, { node: driveShare.node, refresh: refreshDrive });
  for (const def of PARAMS) if (def.id !== driveDef.id) rows.set(def.id, paramRow(def));

  // Rows of a section that should show now.
  function sectionRows(section) {
    const list = [];
    for (const id of section.ids) {
      if (id === driveDef.id) {
        list.push(rows.get('drive.layout').node);
        if (customDrive) list.push(driveShare.node);
      } else list.push(rows.get(id).node);
    }
    return list;
  }

  const activeSections = () => SECTIONS.filter((s) => advanced || !s.advanced);

  function renderRows() {
    const section = SECTIONS.find((s) => s.id === sectionId);
    const list = sectionRows(section);
    const w = rowsBox.clientWidth || 700;
    const h = rowsBox.clientHeight || ROW_HEIGHT * 4;
    const { columns, perPage, pages } = computePaging(w, h, ROW_HEIGHT, list.length);
    pager.setPages(pages);
    const start = pager.page * perPage;
    rowsBox.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    rowsBox.replaceChildren(...list.slice(start, start + perPage));
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
