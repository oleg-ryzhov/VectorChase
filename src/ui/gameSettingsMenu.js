// The Settings screen, reachable from the main menu and in the middle of a race: audio, video, effects,
// interface and touch controls. Tabs instead of scrolling, and a setting only shows while the setting it
// depends on is switched on.
import { el } from './dom.js';
import { icon } from './icons.js';
import { ITEMS, TABS, isVisible } from '../config/gameSettings.js';
import { ensureTheme, iconButton, actionButton, sliderRow, toggleRow, choiceRow, buttonRow, keyRow } from './widgets.js';

// settings: from createGameSettings. onEditLayout(): opens the touch editor. onClose(): after the screen closes.
export function createGameSettingsMenu({ settings, onEditLayout = () => {}, onClose = () => {} }) {
  ensureTheme();
  const root = el('div', 'vc-screen');
  root.id = 'game-settings';
  root.style.zIndex = '25';
  root.hidden = true;
  const panel = el('div', 'vc-panel');
  const head = el('div', 'vc-head');
  head.append(el('h2', '', 'Settings'), iconButton('close', 'Close', () => close()));
  const tabBar = el('div', 'vc-tabs');
  tabBar.setAttribute('role', 'tablist');
  const rowsBox = el('div', 'vc-rows');
  const body = el('div', 'vc-body');
  body.append(rowsBox);
  const resetTab = actionButton('Reset this tab', 'reset', () => settings.reset(current), 'small');
  const foot = el('div', 'vc-foot');
  foot.append(resetTab, el('span', 'vc-note', 'Saved on this device'));
  panel.append(head, tabBar, body, foot);
  root.append(panel);
  document.body.appendChild(root);

  const rows = new Map(); // setting id -> { item, node, set }
  let current = TABS[0][0];

  for (const item of ITEMS) {
    let row;
    if (item.type === 'slider') {
      row = sliderRow({
        label: item.label, hint: item.hint, min: item.min, max: item.max, step: item.step,
        value: settings.get(item.id), format: (v) => `${v}${item.unit ?? ''}`,
        onInput: (v) => settings.set(item.id, v),
      });
    } else if (item.type === 'toggle') {
      row = toggleRow({ label: item.label, hint: item.hint, value: settings.get(item.id), onChange: (v) => settings.set(item.id, v) });
    } else if (item.type === 'choice') {
      row = choiceRow({ label: item.label, hint: item.hint, options: item.options, value: settings.get(item.id), onChange: (v) => settings.set(item.id, v) });
    } else if (item.type === 'key') {
      // A key can only be on one slot: taking a key that another slot has gives that slot this slot's old key.
      row = keyRow({
        label: item.label, hint: item.hint, value: settings.get(item.id),
        onChange: (code) => {
          const clash = ITEMS.find((o) => o.type === 'key' && o.id !== item.id && settings.get(o.id) === code);
          if (clash) settings.set(clash.id, settings.get(item.id));
          settings.set(item.id, code);
        },
      });
    } else {
      row = buttonRow({ label: item.label, hint: item.hint, buttonLabel: item.buttonLabel, iconName: item.icon, onClick: () => onEditLayout() });
    }
    if (item.requires) row.node.classList.add('vc-dep');
    rows.set(item.id, { item, node: row.node, set: row.set });
    rowsBox.append(row.node);
  }

  const tabButtons = TABS.map(([id, label, iconName]) => {
    const b = el('button', 'vc-tab');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.append(icon(iconName, 20), el('span', '', label));
    b.addEventListener('click', () => showTab(id));
    tabBar.append(b);
    return [id, b];
  });

  // Shows this tab's settings, and only those whose dependencies are met.
  function render() {
    const values = settings.values();
    for (const { item, node } of rows.values()) node.hidden = item.tab !== current || !isVisible(item, values);
    for (const [id, b] of tabButtons) {
      b.classList.toggle('on', id === current);
      b.setAttribute('aria-selected', String(id === current));
    }
  }
  function showTab(id) {
    current = id;
    render();
  }

  settings.subscribe((ids) => {
    for (const id of ids) {
      const r = rows.get(id);
      if (r?.set) r.set(settings.get(id));
    }
    render();
  });

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    onClose();
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && !root.hidden) close();
  });
  root.addEventListener('pointerdown', (e) => {
    if (e.target === root) close();
  });
  render();

  return {
    open(tab) {
      if (tab) current = tab;
      root.hidden = false;
      render();
    },
    close,
    toggle() {
      if (root.hidden) this.open();
      else close();
    },
    get isOpen() {
      return !root.hidden;
    },
  };
}
