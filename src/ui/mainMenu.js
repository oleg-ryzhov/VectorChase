// The main menu. Built like a console racing game: one screen, a big RACE button, a track carousel with a
// map of the circuit, and the race setup as chips. No scrolling and no drop-downs. Setup choices that only
// matter in some cases (difficulty, delete ghost) appear only then. On a narrow phone screen the same
// content is split into two tabs, Track and Setup, with RACE always at the bottom.
import { el, addStyle } from './dom.js';
import { icon } from './icons.js';
import { loadSettings, saveSettings, registerUser, signIn, findUser, setUserSkin, leaderboard } from '../profile/profiles.js';
import { formatTime } from '../race/race.js';
import { loadGhost, deleteGhost } from '../race/ghost.js';
import { ensureTheme, iconButton, actionButton, segmented, switchControl, createPager, onSwipe } from './widgets.js';
import { computePaging } from './settingsMenu.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const NS = 'http://www.w3.org/2000/svg';

const LAPS = [1, 2, 3, 4, 5].map((n) => [n, String(n)]);
const OPPONENTS = [[0, 'Off'], ...[1, 2, 3, 4, 5].map((n) => [n, String(n)])];
const DIFFICULTIES = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']];

const STYLE = `
#main-menu{z-index:20;align-items:stretch;justify-content:stretch;background:linear-gradient(90deg,rgba(8,11,18,.95) 0%,rgba(8,11,18,.8) 52%,rgba(8,11,18,.5) 100%)}
.mm-shell{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;padding:max(10px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
.mm-top{display:flex;align-items:center;gap:8px;min-height:48px}
.mm-logo{flex:1;font-size:26px;font-weight:800;letter-spacing:.14em;white-space:nowrap}
.mm-logo span{color:var(--vc-accent)}
.mm-chip{display:inline-flex;align-items:center;gap:8px;min-height:44px;max-width:44vw;padding:0 14px;background:var(--vc-panel2);color:var(--vc-text);border:1px solid var(--vc-line);border-radius:22px;font:inherit;font-weight:600;cursor:pointer;overflow:hidden;white-space:nowrap}
.mm-chip span{overflow:hidden;text-overflow:ellipsis}
.mm-grid{flex:1;min-height:0;display:grid;gap:18px;grid-template-columns:minmax(260px,.9fr) 1.5fr;padding-top:8px}
.mm-col{min-height:0;min-width:0;display:flex;flex-direction:column;gap:12px}
.mm-left{justify-content:center}
.mm-race{min-height:84px;font-size:26px;letter-spacing:.12em;border-radius:18px;box-shadow:0 8px 28px rgba(230,57,70,.4)}
.mm-race svg{width:30px;height:30px}
.mm-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.mm-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:78px;padding:6px;background:var(--vc-panel2);color:var(--vc-text);border:1px solid var(--vc-line);border-radius:16px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.mm-tile:hover{background:#22304f}
.mm-hint{color:var(--vc-mute);font-size:12px}
.mm-card{display:flex;flex-direction:column;gap:6px;padding:12px;background:rgba(17,24,38,.86);border:1px solid var(--vc-line);border-radius:18px;min-height:0}
.mm-map{display:flex;align-items:center;gap:6px}
.mm-preview{flex:1;min-width:0;height:clamp(90px,24vh,190px);display:flex;align-items:center;justify-content:center;background:#0c1220;border:1px solid var(--vc-line);border-radius:14px;touch-action:pan-y}
.mm-preview svg{width:100%;height:100%}
.mm-preview .wait{color:var(--vc-mute);font-size:13px}
.mm-mapname{font-size:22px;font-weight:800;line-height:1.1}
.mm-meta{color:var(--vc-blue);font-size:13px;font-weight:600}
.mm-blurb{color:var(--vc-mute);font-size:13px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.mm-dots{display:flex;justify-content:center;gap:8px;min-height:14px}
.mm-setup{gap:8px}
.mm-line{display:flex;flex-direction:column;gap:4px}
.mm-line>label,.mm-line .lbl{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--vc-mute)}
.mm-ghost{display:flex;align-items:center;gap:10px;min-height:44px}
.mm-ghost .grow{flex:1;min-width:0}
.mm-ghost .grow b{display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--vc-mute)}
.mm-ghost .grow small{color:var(--vc-mute);font-size:12px}
.mm-paint{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.mm-swatch{width:34px;height:34px;padding:0;border-radius:50%;border:2px solid var(--vc-line);cursor:pointer}
.mm-swatch.on{border-color:#fff;box-shadow:0 0 0 3px var(--vc-blue)}
.mm-skinname{font-size:13px;font-weight:600;margin-left:4px}
.mm-nav,.mm-race-narrow{display:none}
.mm-msg{min-height:1.3em;color:var(--vc-warn);font-size:13px}
.mm-sheet{z-index:22}
.mm-sheet .vc-body{padding:12px 16px;gap:10px}
.mm-who{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.mm-who input{flex:1;min-width:140px;height:44px;padding:0 12px;background:#0c1220;color:var(--vc-text);border:1px solid var(--vc-line);border-radius:12px;font:inherit}
.mm-board{flex:1;min-height:0;overflow:hidden}
.mm-brow{display:grid;grid-template-columns:30px 1fr 56px 44px 80px;gap:6px;align-items:center;height:44px;border-bottom:1px solid #1b2540;font-variant-numeric:tabular-nums}
.mm-brow.head{color:var(--vc-mute);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.mm-brow.me{color:var(--vc-warn)}
@media (max-height:430px) and (min-width:560px){
 .mm-logo{font-size:20px}.mm-top{min-height:40px}.mm-chip,.mm-top .vc-iconbtn{min-height:40px}
 .mm-grid{grid-template-columns:1fr 1.2fr 1.1fr;gap:12px;padding-top:4px}
 .mm-race{min-height:64px;font-size:22px}.mm-tile{min-height:52px;flex-direction:row;gap:8px}.mm-tiles{grid-template-columns:1fr}
 .mm-card{padding:8px;gap:4px}.mm-preview{height:clamp(70px,32vh,120px)}.mm-mapname{font-size:18px}.mm-blurb,.mm-hint{display:none}
 .mm-line .vc-seg button{min-height:32px}.mm-line .vc-seg{padding:3px}.mm-swatch{width:28px;height:28px}.mm-paint{gap:6px}.mm-setup{gap:5px}
}
@media (max-width:759px){
 .mm-grid{display:flex;flex-direction:column;gap:10px}
 .mm-left{display:none}
 .mm-group{display:none;flex:1}
 .mm-group.active{display:flex}
 .mm-preview{height:clamp(90px,30vh,200px)}
 .mm-nav{display:flex;gap:8px;padding-top:6px}
 .mm-nav .vc-seg{flex:1}
 .mm-race-narrow{display:inline-flex;flex:1;min-height:52px;font-size:20px;letter-spacing:.1em}
 .mm-logo{font-size:20px}
 .mm-brow{grid-template-columns:24px 1fr 46px 36px 66px;font-size:13px}
}
`;

// getOutline(mapId) -> { points: [[x, z], ...], length } or null. Called after the menu is drawn.
export function createMainMenu({ getStorage, skins, maps = [], onSkinChange, onMapChange = () => {}, onStart, onTune = () => {}, onSettings = () => {}, getOutline = () => null }) {
  ensureTheme();
  addStyle(STYLE);
  const store = getStorage();
  const settings = loadSettings(store);
  let user = settings.user && store ? findUser(store, settings.user) : null;
  let skinId = user ? user.skin : settings.skin;
  if (!skins.some((s) => s.id === skinId)) skinId = skins[0].id;
  if (!maps.some((m) => m.id === settings.map)) settings.map = maps[0]?.id ?? settings.map;

  const persist = () => saveSettings(store, { ...settings, user: user ? user.name : null });
  const ghostOn = () => (settings.ghostMode === 'auto' ? !settings.botsOn : settings.ghostMode === 'on');

  const root = el('div', 'vc-screen');
  root.id = 'main-menu';
  const shell = el('div', 'mm-shell');
  root.append(shell);

  // ---- Top bar ----
  const logo = el('div', 'mm-logo');
  logo.append('VECTOR', el('span', '', 'CHASE'));
  const playerChip = el('button', 'mm-chip');
  playerChip.type = 'button';
  const settingsButton = iconButton('gear', 'Settings', () => onSettings());
  const tuneButton = iconButton('tune', 'Tune car', () => onTune());
  const top = el('div', 'mm-top');
  top.append(logo, playerChip, tuneButton, settingsButton);

  // ---- Left column: race button and tiles ----
  const raceButton = actionButton('RACE', 'flag', () => onStart(), 'primary mm-race');
  const tile = (iconName, label, fn) => {
    const b = el('button', 'mm-tile');
    b.type = 'button';
    b.append(icon(iconName, 26), el('span', '', label));
    b.addEventListener('click', fn);
    return b;
  };
  const tiles = el('div', 'mm-tiles');
  tiles.append(tile('tune', 'Tune car', () => onTune()), tile('gear', 'Settings', () => onSettings()), tile('trophy', 'Scores', () => openSheet('board')));
  const left = el('div', 'mm-col mm-left');
  left.append(raceButton, tiles, el('div', 'mm-hint', 'W S gas and brake, A D steer, Space handbrake, C camera, E tune car'));

  // ---- Track carousel ----
  const preview = el('div', 'mm-preview');
  const prev = iconButton('left', 'Previous track', () => step(-1));
  const next = iconButton('right', 'Next track', () => step(1));
  const mapRow = el('div', 'mm-map');
  mapRow.append(prev, preview, next);
  const mapName = el('div', 'mm-mapname');
  const mapMeta = el('div', 'mm-meta');
  const mapBlurb = el('div', 'mm-blurb');
  const dots = el('div', 'mm-dots');
  const trackCard = el('div', 'mm-card');
  trackCard.append(mapRow, mapName, mapMeta, mapBlurb, dots);
  onSwipe(preview, () => step(-1), () => step(1));

  let outlineTimer = null;
  let changeTimer = null;
  function drawOutline(data) {
    preview.replaceChildren();
    if (!data || data.points.length < 3) {
      preview.append(el('div', 'wait', 'No preview'));
      return;
    }
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of data.points) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    const size = Math.max(maxX - minX, maxZ - minZ) || 1;
    const pad = 8;
    const sx = (x) => pad + ((x - minX) / size) * (100 - 2 * pad) + ((size - (maxX - minX)) / size) * (50 - pad);
    const sz = (z) => pad + ((z - minZ) / size) * (100 - 2 * pad) + ((size - (maxZ - minZ)) / size) * (50 - pad);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-label', 'Track layout');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `${data.points.map(([x, z], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sz(z).toFixed(1)}`).join('')}Z`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#4da3ff');
    path.setAttribute('stroke-width', '2.6');
    path.setAttribute('stroke-linejoin', 'round');
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', sx(data.points[0][0]).toFixed(1));
    dot.setAttribute('cy', sz(data.points[0][1]).toFixed(1));
    dot.setAttribute('r', '3.2');
    dot.setAttribute('fill', '#e63946');
    svg.append(path, dot);
    preview.append(svg);
  }

  function renderMap() {
    const m = maps.find((x) => x.id === settings.map);
    mapName.textContent = m?.name ?? '';
    mapBlurb.textContent = m?.blurb ?? '';
    mapMeta.textContent = m?.kind ?? '';
    dots.replaceChildren(...maps.map((x) => {
      const d = el('span');
      d.style.cssText = `width:${x.id === settings.map ? 22 : 8}px;height:8px;border-radius:4px;background:${x.id === settings.map ? '#4da3ff' : '#33405f'}`;
      return d;
    }));
    preview.replaceChildren(el('div', 'wait', 'Loading track'));
    clearTimeout(outlineTimer);
    outlineTimer = setTimeout(() => {
      const data = getOutline(settings.map);
      drawOutline(data);
      if (data?.length && m) mapMeta.textContent = `${m.kind}  |  ${(data.length / 1000).toFixed(1)} km`;
    }, 40);
  }

  function step(d) {
    if (maps.length < 2) return;
    const i = maps.findIndex((m) => m.id === settings.map);
    settings.map = maps[(i + d + maps.length) % maps.length].id;
    persist();
    renderMap();
    renderGhost();
    clearTimeout(changeTimer);
    changeTimer = setTimeout(() => onMapChange(settings.map), 350); // wait until the player stops flicking through
  }

  // ---- Setup ----
  const line = (label, node) => {
    const l = el('div', 'mm-line');
    l.append(el('div', 'lbl', label), node);
    return l;
  };
  const lapsSeg = segmented(LAPS, settings.laps, (v) => ((settings.laps = Number(v)), persist()));
  const oppSeg = segmented(OPPONENTS, settings.botsOn ? settings.bots : 0, (v) => {
    const n = Number(v);
    settings.botsOn = n > 0;
    if (n > 0) settings.bots = n;
    persist();
    renderSetup();
  });
  const diffSeg = segmented(DIFFICULTIES, settings.difficulty, (v) => ((settings.difficulty = v), persist()));
  const diffLine = line('Difficulty', diffSeg.node);
  const ghostSwitch = switchControl(ghostOn(), (v) => {
    settings.ghostMode = v ? 'on' : 'off';
    persist();
  });
  const ghostNote = el('small');
  const ghostDelete = iconButton('close', 'Delete this ghost', () => {
    if (store) deleteGhost(store, user ? user.name : 'guest', settings.map);
    renderGhost();
  });
  const ghostRow = el('div', 'mm-ghost');
  const ghostText = el('div', 'grow');
  ghostText.append(el('b', '', 'Ghost lap'), ghostNote);
  ghostRow.append(ghostText, ghostDelete, ghostSwitch.node);
  function renderGhost() {
    const who = user ? user.name : 'guest';
    const fly = store ? loadGhost(store, who, settings.map, 'fly') : null;
    const start = store ? loadGhost(store, who, settings.map, 'start') : null;
    const parts = [];
    if (fly) parts.push(`flying ${formatTime(fly.ms / 1000)}`);
    if (start) parts.push(`standing ${formatTime(start.ms / 1000)}`);
    ghostNote.textContent = parts.length ? parts.join('  |  ') : 'Recorded while you race';
    ghostDelete.hidden = parts.length === 0; // only offered when there is a ghost to delete
    ghostSwitch.set(ghostOn());
  }
  function renderSetup() {
    diffLine.hidden = !settings.botsOn; // difficulty only matters with opponents
    ghostSwitch.set(ghostOn());
  }

  const swatches = el('div', 'mm-paint');
  const skinName = el('span', 'mm-skinname');
  for (const skin of skins) {
    const sw = el('button', 'mm-swatch');
    sw.type = 'button';
    sw.title = skin.name;
    sw.setAttribute('aria-label', skin.name);
    sw.style.background = skin.accent === undefined ? hex(skin.color) : `linear-gradient(135deg, ${hex(skin.color)} 62%, ${hex(skin.accent)} 62%)`;
    sw.dataset.id = skin.id;
    sw.addEventListener('click', () => setSkin(skin.id));
    swatches.append(sw);
  }
  swatches.append(skinName);
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
    for (const sw of swatches.querySelectorAll('.mm-swatch')) sw.classList.toggle('on', sw.dataset.id === skinId);
    skinName.textContent = skins.find((s) => s.id === skinId).name;
  }

  const setupCard = el('div', 'mm-card mm-setup');
  setupCard.append(line('Laps', lapsSeg.node), line('Opponents', oppSeg.node), diffLine, ghostRow, line('Paint', swatches));

  const trackGroup = el('div', 'mm-col mm-group active');
  trackGroup.append(trackCard);
  const setupGroup = el('div', 'mm-col mm-group');
  setupGroup.append(setupCard);
  const grid = el('div', 'mm-grid');
  grid.append(left, trackGroup, setupGroup);

  // Narrow screens: Track and Setup tabs, RACE at the bottom.
  const tabs = segmented([['track', 'Track'], ['setup', 'Setup']], 'track', (v) => {
    trackGroup.classList.toggle('active', v === 'track');
    setupGroup.classList.toggle('active', v === 'setup');
  });
  const raceNarrow = actionButton('RACE', 'flag', () => onStart(), 'primary mm-race-narrow');
  const nav = el('div', 'mm-nav');
  nav.append(tabs.node, raceNarrow);

  shell.append(top, grid, nav);
  document.body.appendChild(root);

  // ---- Player sheet: profile and scores ----
  let sheet = null;
  const message = el('div', 'mm-msg');
  function openSheet(tabId = 'player') {
    sheet?.remove();
    sheet = el('div', 'vc-screen mm-sheet');
    const panel = el('div', 'vc-panel');
    const head = el('div', 'vc-head');
    head.append(el('h2', '', 'Player'), iconButton('close', 'Close', () => closeSheet()));
    const body = el('div', 'vc-body');
    const tabBar = el('div', 'vc-tabs');
    let current = tabId;
    const tabButtons = [['player', 'Player', 'user'], ['board', 'Scores', 'trophy']].map(([id, label, ic]) => {
      const b = el('button', 'vc-tab');
      b.type = 'button';
      b.append(icon(ic, 20), el('span', '', label));
      b.addEventListener('click', () => ((current = id), draw()));
      tabBar.append(b);
      return [id, b];
    });
    panel.append(head, tabBar, body);
    sheet.append(panel);
    sheet.addEventListener('pointerdown', (e) => e.target === sheet && closeSheet());
    document.body.appendChild(sheet);

    function draw() {
      for (const [id, b] of tabButtons) b.classList.toggle('on', id === current);
      body.replaceChildren();
      if (current === 'player') drawPlayer(body);
      else drawBoard(body);
    }
    sheet.redraw = draw;
    draw();
  }
  function closeSheet() {
    sheet?.remove();
    sheet = null;
  }

  function authenticate(result) {
    if (!result.ok) {
      message.textContent = result.error;
      sheet?.redraw?.();
      return;
    }
    user = result.user;
    skinId = skins.some((s) => s.id === user.skin) ? user.skin : skins[0].id;
    persist();
    message.textContent = `Welcome, ${user.name}!`;
    refreshAll();
    onSkinChange(skinId);
  }
  function signOut() {
    user = null;
    skinId = skins.some((s) => s.id === settings.skin) ? settings.skin : skins[0].id;
    persist();
    message.textContent = 'Signed out.';
    refreshAll();
    onSkinChange(skinId);
  }
  function drawPlayer(body) {
    if (user) {
      body.append(el('div', 'mm-mapname', user.name), el('div', 'vc-note', `${user.races} races | ${user.wins} wins | ${user.points} points`), actionButton('Sign out', 'user', signOut, 'small'));
    } else {
      const input = el('input');
      input.type = 'text';
      input.placeholder = 'Username';
      input.maxLength = 16;
      input.autocomplete = 'off';
      const who = el('div', 'mm-who');
      who.append(input, actionButton('Register', 'check', () => authenticate(registerUser(store, input.value, skinId)), 'primary'), actionButton('Sign in', 'user', () => authenticate(signIn(store, input.value))));
      body.append(who, el('div', 'vc-note', 'Guests can race, but their scores are not saved.'));
    }
    body.append(message);
  }
  function drawBoard(body) {
    const rows = store ? leaderboard(store, 50, settings.map) : [];
    const box = el('div', 'mm-board');
    const pager = createPager(() => fill());
    body.append(box, pager.node, el('div', 'vc-note', `${maps.find((m) => m.id === settings.map)?.name ?? ''} | scores stay on this device`));
    function fill() {
      if (rows.length === 0) {
        box.replaceChildren(el('div', 'vc-note', 'No scores yet. Register, then finish a race.'));
        return;
      }
      const { perPage, pages } = computePaging(300, Math.max(box.clientHeight || 200, 88) - 44, 44, rows.length);
      pager.setPages(pages);
      const head = el('div', 'mm-brow head');
      for (const h of ['#', 'Player', 'Pts', 'Win', 'Best lap']) head.append(el('span', '', h));
      box.replaceChildren(head, ...rows.slice(pager.page * perPage, pager.page * perPage + perPage).map((u, i) => {
        const r = el('div', `mm-brow${user && u.name === user.name ? ' me' : ''}`);
        const best = u.bestLaps[settings.map] === undefined ? '-' : formatTime(u.bestLaps[settings.map] / 1000);
        for (const cell of [pager.page * perPage + i + 1, u.name, u.points, u.wins, best]) r.append(el('span', '', String(cell)));
        return r;
      }));
    }
    fill();
  }

  playerChip.addEventListener('click', () => openSheet('player'));
  function renderPlayer() {
    playerChip.replaceChildren(icon('user', 20), el('span', '', user ? user.name : 'Guest'));
  }

  function refreshAll() {
    if (user && store) user = findUser(store, user.name) ?? user;
    renderPlayer();
    renderSkin();
    renderMap();
    renderGhost();
    renderSetup();
    sheet?.redraw?.();
  }
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
      closeSheet();
    },
    refresh: refreshAll,
    getState() {
      return {
        user: user ? user.name : null,
        name: user ? user.name : 'Guest',
        skinId,
        laps: settings.laps,
        bots: settings.botsOn ? settings.bots : 0,
        sound: settings.sound,
        ghost: ghostOn(),
        difficulty: settings.difficulty,
        map: settings.map,
      };
    },
  };
}
