import { el, button, addStyle } from './dom.js';
import {
  loadSettings,
  saveSettings,
  registerUser,
  signIn,
  findUser,
  setUserSkin,
  leaderboard,
} from '../profile/profiles.js';
import { formatTime } from '../race/race.js';

const STYLE = `
#main-menu{position:fixed;top:0;left:0;bottom:0;width:min(420px,100vw);box-sizing:border-box;overflow-y:auto;padding:18px 20px 28px;background:linear-gradient(90deg,rgba(10,13,20,.95),rgba(10,13,20,.82));color:#e8ecf3;font:14px/1.4 system-ui,sans-serif;z-index:20}
#main-menu[hidden]{display:none}
#main-menu h1{margin:0;font-size:32px;letter-spacing:.04em}
#main-menu h2{margin:20px 0 8px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#8fb8e8}
#main-menu button{background:#2a3242;color:inherit;border:1px solid #3d4760;border-radius:6px;padding:6px 12px;font:inherit;cursor:pointer}
#main-menu button:hover{background:#38425a}
#main-menu .mm-primary{background:#c1121f;border-color:#e0313d;font-weight:600;padding:8px 18px}
#main-menu input[type=text],#main-menu select{background:#171c27;color:inherit;border:1px solid #3d4760;border-radius:6px;padding:6px 8px;font:inherit;box-sizing:border-box;min-width:0}
.mm-sub,.mm-note{color:#9aa4b5;font-size:12px}
.mm-row{display:flex;gap:8px;align-items:center;margin:6px 0}
.mm-row input[type=text]{flex:1}
.mm-user{font-size:16px;font-weight:600}
.mm-message{min-height:1.4em;color:#ffd166;margin-top:6px}
.mm-swatches{display:flex;gap:8px;flex-wrap:wrap}
#main-menu .mm-swatch{width:34px;height:34px;border-radius:50%;padding:0;border:2px solid #3d4760}
#main-menu .mm-swatch.selected{border-color:#fff;box-shadow:0 0 0 2px #8fb8e8}
.mm-grid{display:grid;grid-template-columns:110px 1fr;gap:8px;align-items:center}
.mm-actions{display:flex;gap:10px;margin-top:20px}
.mm-table{width:100%;border-collapse:collapse;margin-top:8px}
.mm-table th,.mm-table td{text-align:left;padding:3px 6px;border-bottom:1px solid #222a3a}
.mm-table tr.me td{color:#ffd166}
`;

const LAP_CHOICES = [1, 2, 3, 4, 5].map((n) => [n, `${n} lap${n > 1 ? 's' : ''}`]);
const BOT_CHOICES = [1, 2, 3, 4, 5].map((n) => [n, `${n} opponent${n > 1 ? 's' : ''}`]);
const DIFFICULTIES = [
  ['easy', 'Easy'],
  ['medium', 'Medium'],
  ['hard', 'Hard'],
];

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

// callbacks: onSkinChange(skinId) when the paint changes, onStart() for "Start race".
// They are only called after the menu is built, never during createMainMenu.
export function createMainMenu({ getStorage, skins, onSkinChange, onStart }) {
  addStyle(STYLE);
  const store = getStorage(); // null if the browser blocks storage

  const settings = loadSettings(store);
  let user = settings.user && store ? findUser(store, settings.user) : null;
  let skinId = user ? user.skin : settings.skin;
  if (!skins.some((s) => s.id === skinId)) skinId = skins[0].id;

  function persist() {
    saveSettings(store, { ...settings, user: user ? user.name : null });
  }

  const root = el('div');
  root.id = 'main-menu';
  root.append(el('h1', '', 'VectorChase'), el('div', 'mm-sub', 'Race the bots. Press E in a race to tune the car live.'));

  const message = el('div', 'mm-message');
  function say(text) {
    message.textContent = text;
  }

  // Player
  const playerBox = el('div');
  root.append(el('h2', '', 'Player'), playerBox, message);

  function authenticate(result) {
    if (!result.ok) return say(result.error);
    user = result.user;
    skinId = skins.some((s) => s.id === user.skin) ? user.skin : skins[0].id;
    persist();
    say(`Welcome, ${user.name}!`);
    refreshAll();
    onSkinChange(skinId);
  }

  function signOut() {
    user = null;
    skinId = skins.some((s) => s.id === settings.skin) ? settings.skin : skins[0].id;
    persist();
    say('Signed out.');
    refreshAll();
    onSkinChange(skinId);
  }

  function renderPlayer() {
    playerBox.replaceChildren();
    if (user) {
      const out = button('Sign out');
      out.addEventListener('click', signOut);
      playerBox.append(
        el('div', 'mm-user', `Signed in as ${user.name}`),
        el('div', 'mm-note', `${user.races} races · ${user.wins} wins · ${user.points} points`),
        el('div', 'mm-row')
      );
      playerBox.lastChild.append(out);
    } else {
      const input = el('input');
      input.type = 'text';
      input.placeholder = 'Username';
      input.maxLength = 16;
      input.autocomplete = 'off';
      const register = button('Register');
      const signInButton = button('Sign in');
      const row = el('div', 'mm-row');
      row.append(input, register, signInButton);
      playerBox.append(row, el('div', 'mm-note', 'Guests can race, but their scores are not saved.'));
      register.addEventListener('click', () => authenticate(registerUser(store, input.value, skinId)));
      signInButton.addEventListener('click', () => authenticate(signIn(store, input.value)));
    }
  }

  // Car skin
  const swatches = el('div', 'mm-swatches');
  const skinName = el('div', 'mm-note');
  for (const skin of skins) {
    const swatch = button('', 'mm-swatch');
    swatch.style.background = hex(skin.color);
    swatch.title = skin.name;
    swatch.dataset.id = skin.id;
    swatch.addEventListener('click', () => setSkin(skin.id));
    swatches.append(swatch);
  }
  root.append(el('h2', '', 'Car'), swatches, skinName);

  function setSkin(id) {
    skinId = id;
    if (user) {
      setUserSkin(store, user.name, id);
      user.skin = id;
    } else {
      settings.skin = id;
      persist();
    }
    renderSkin();
    onSkinChange(id);
  }

  function renderSkin() {
    for (const swatch of swatches.children) swatch.classList.toggle('selected', swatch.dataset.id === skinId);
    skinName.textContent = skins.find((s) => s.id === skinId).name;
  }

  // Race options
  function choice(options, current, onChange) {
    const select = el('select');
    for (const [value, label] of options) select.append(new Option(label, String(value)));
    select.value = String(current);
    select.addEventListener('change', () => {
      onChange(select.value);
      persist();
    });
    return select;
  }
  const grid = el('div', 'mm-grid');
  grid.append(
    el('label', '', 'Length'),
    choice(LAP_CHOICES, settings.laps, (v) => (settings.laps = Number(v))),
    el('label', '', 'Opponents'),
    choice(BOT_CHOICES, settings.bots, (v) => (settings.bots = Number(v))),
    el('label', '', 'Difficulty'),
    choice(DIFFICULTIES, settings.difficulty, (v) => (settings.difficulty = v))
  );
  root.append(el('h2', '', 'Race'), grid);

  // Buttons and leaderboard
  const startButton = button('Start race', 'mm-primary');
  startButton.addEventListener('click', () => onStart());
  const boardButton = button('Leaderboard');
  const actions = el('div', 'mm-actions');
  actions.append(startButton, boardButton);
  const board = el('div');
  board.hidden = true;
  boardButton.addEventListener('click', () => {
    board.hidden = !board.hidden;
    renderBoard();
  });
  root.append(actions, board);
  root.append(
    el('div', 'mm-note', 'W/S gas and brake · A/D steer · C camera · R back to the road · E settings')
  );

  function renderBoard() {
    if (board.hidden) return;
    board.replaceChildren();
    const rows = store ? leaderboard(store, 20) : [];
    if (rows.length === 0) {
      board.append(el('div', 'mm-note', 'No scores yet. Register, then finish a race.'));
    } else {
      const table = el('table', 'mm-table');
      const head = el('tr');
      for (const h of ['#', 'Player', 'Pts', 'Wins', 'Races', 'Best lap']) head.append(el('th', '', h));
      table.append(head);
      rows.forEach((u, i) => {
        const tr = el('tr', user && u.name === user.name ? 'me' : '');
        const best = u.bestLapMs === null ? '-' : formatTime(u.bestLapMs / 1000);
        for (const cell of [i + 1, u.name, u.points, u.wins, u.races, best]) {
          tr.append(el('td', '', String(cell)));
        }
        table.append(tr);
      });
      board.append(table);
    }
    board.append(el('div', 'mm-note', 'Scores are kept as plain text on this device only.'));
  }

  function refreshAll() {
    if (user && store) user = findUser(store, user.name) ?? user; // pick up new scores
    renderPlayer();
    renderSkin();
    renderBoard();
  }

  document.body.appendChild(root);
  refreshAll();

  return {
    get isOpen() {
      return !root.hidden;
    },
    show() {
      root.hidden = false;
      refreshAll();
    },
    hide() {
      root.hidden = true;
    },
    refresh: refreshAll,
    getState() {
      return {
        user: user ? user.name : null,
        name: user ? user.name : 'Guest',
        skinId,
        laps: settings.laps,
        bots: settings.bots,
        difficulty: settings.difficulty,
      };
    },
  };
}
