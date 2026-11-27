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
import { toggleFullscreen, isFullscreen, fullscreenSupported, onFullscreenChange } from './fullscreen.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const NS = 'http://www.w3.org/2000/svg';

const LAPS = [1, 2, 3, 4, 5].map((n) => [n, String(n)]);
const OPPONENTS = [[0, 'Off'], ...[1, 2, 3, 4, 5].map((n) => [n, String(n)])];
const DIFFICULTIES = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']];

const STYLE = `
#main-menu{z-index:20;align-items:stretch;justify-content:stretch;background:radial-gradient(900px 480px at 88% -8%,rgba(214,40,57,.16),transparent 62%),linear-gradient(90deg,rgba(8,11,18,.95) 0%,rgba(8,11,18,.8) 52%,rgba(8,11,18,.5) 100%)}
.mm-shell{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;padding:max(10px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
.mm-top{display:flex;align-items:center;gap:8px;min-height:48px}
.mm-logo{flex:1;font-size:26px;font-weight:800;letter-spacing:.14em;white-space:nowrap;text-shadow:0 2px 18px rgba(214,40,57,.35)}
.mm-logo span{color:var(--vc-accent)}
.mm-chip{display:inline-flex;align-items:center;gap:8px;min-height:44px;max-width:44vw;padding:0 14px;background:var(--vc-panel2);color:var(--vc-text);border:1px solid var(--vc-line);border-radius:22px;font:inherit;font-weight:600;cursor:pointer;overflow:hidden;white-space:nowrap}
.mm-chip span{overflow:hidden;text-overflow:ellipsis}
.mm-chip{transition:background .12s,border-color .12s}
.mm-chip:hover{background:#22304f;border-color:var(--vc-edge)}
.mm-grid{flex:1;min-height:0;display:grid;gap:18px;grid-template-columns:minmax(260px,.9fr) 1.5fr;padding-top:8px}
.mm-col{min-height:0;min-width:0;display:flex;flex-direction:column;gap:12px}
.mm-left{justify-content:center}
.mm-race{min-height:84px;font-size:26px;letter-spacing:.12em;border-radius:18px;animation:mm-pulse 2.6s ease-in-out infinite}
@keyframes mm-pulse{0%,100%{box-shadow:0 8px 28px rgba(214,40,57,.4),inset 0 1px 0 rgba(255,255,255,.2)}50%{box-shadow:0 10px 42px rgba(214,40,57,.7),inset 0 1px 0 rgba(255,255,255,.2)}}
.mm-race svg{width:30px;height:30px}
.mm-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.mm-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:78px;padding:6px;background:linear-gradient(180deg,#1d2945,var(--vc-panel2));color:var(--vc-text);border:1px solid var(--vc-line);border-radius:16px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:background .12s,transform .1s,border-color .12s}
.mm-tile svg{color:var(--vc-blue)}
.mm-tile:active{transform:scale(.97)}
.mm-tile:hover{background:linear-gradient(180deg,#2a3a60,#1f2d4c);border-color:var(--vc-edge);transform:translateY(-2px)}
.mm-hint{color:var(--vc-mute);font-size:12px}
.mm-card{display:flex;flex-direction:column;gap:6px;padding:12px;background:linear-gradient(180deg,rgba(24,34,56,.9),rgba(17,24,38,.9));border:1px solid var(--vc-line);border-radius:18px;min-height:0;box-shadow:0 12px 36px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.05)}
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
.mm-swatch{width:34px;height:34px;padding:0;border-radius:50%;border:2px solid var(--vc-edge);cursor:pointer;transition:transform .1s}
.mm-swatch:hover{transform:scale(1.12)}
.mm-swatch.on{border-color:#fff;box-shadow:0 0 0 3px var(--vc-blue)}
.mm-skinname{font-size:13px;font-weight:600;margin-left:4px}
.mm-nav,.mm-race-narrow{display:none}
.mm-msg{min-height:1.3em;color:var(--vc-warn);font-size:13px}
.mm-sheet{z-index:22}
.mm-sheet .vc-body{padding:12px 16px;gap:10px}
.mm-who{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.mm-who input{flex:1;min-width:140px;height:44px;padding:0 12px;background:#0c1220;color:var(--vc-text);border:1px solid var(--vc-edge);border-radius:12px;font:inherit}
.mm-board{flex:1;min-height:0;overflow:hidden}
.mm-brow{display:grid;grid-template-columns:30px 1fr 56px 44px 80px;gap:6px;align-items:center;height:44px;border-bottom:1px solid #1b2540;font-variant-numeric:tabular-nums}
.mm-brow.head{color:var(--vc-mute);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.mm-brow.me{color:var(--vc-warn);background:rgba(255,209,102,.08);font-weight:700}
.mm-brow:not(.head):hover{background:rgba(255,255,255,.03)}
.mm-dup{display:none}
.mm-garage{z-index:21;flex-direction:column;align-items:stretch;justify-content:space-between;background:linear-gradient(180deg,rgba(5,8,14,.6) 0,rgba(5,8,14,0) 24%,rgba(5,8,14,0) 56%,rgba(5,8,14,.88) 100%)}
.mm-garage-top{display:flex;align-items:center;gap:10px;padding:max(8px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) 0 max(14px,env(safe-area-inset-left))}
.mm-garage-top h2{flex:1;margin:0;font-size:20px;letter-spacing:.12em}
.mm-garage-mid{flex:1;min-height:0}
.mm-garage-bar{display:flex;align-items:center;gap:8px;padding:6px max(14px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left))}
.mm-garage-bar .vc-iconbtn{width:56px;height:56px;background:rgba(17,24,38,.8);border-color:var(--vc-line)}
.mm-garage-info{flex:1;min-width:0;text-align:center}
.mm-garage-name{font-size:24px;font-weight:800;line-height:1.1}
.mm-garage-count{color:var(--vc-mute);font-size:13px;margin-top:2px}
.mm-traits{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:6px}
.mm-trait{padding:3px 10px;border-radius:12px;background:rgba(77,163,255,.18);border:1px solid rgba(77,163,255,.5);font-size:12px;font-weight:600}
.mm-garage-on{background:none!important}
.mm-garage-on .mm-shell{visibility:hidden}
@media (orientation:landscape) and (max-height:480px){.mm-garage-name{font-size:18px}.mm-garage-bar .vc-iconbtn{width:48px;height:48px}.mm-traits{margin-top:3px}}
.mm-stepper{display:none;align-items:center;gap:6px}
.mm-stepper .name{flex:1;min-width:0;text-align:center;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mm-stepper .dot{width:26px;height:26px;border-radius:50%;border:2px solid #fff;flex:none}
.mm-stepper .vc-iconbtn{width:36px;height:36px}
/* A phone held sideways: three columns (play, track, setup) so everything fits without scrolling. */
@media (orientation:landscape) and (max-height:480px){
 .mm-shell{padding-top:max(6px,env(safe-area-inset-top));padding-bottom:max(6px,env(safe-area-inset-bottom))}
 .mm-logo{font-size:20px}.mm-top{min-height:40px}.mm-chip,.mm-top .vc-iconbtn{min-height:40px}
 .mm-grid{grid-template-columns:1fr 1.2fr 1.1fr;gap:12px;padding-top:4px}
 .mm-race{min-height:64px;font-size:22px}.mm-tile{min-height:52px;flex-direction:row;gap:8px}.mm-tiles{grid-template-columns:1fr}
 .mm-card{padding:8px;gap:4px}.mm-preview{height:clamp(56px,28vh,120px)}.mm-mapname{font-size:18px}.mm-blurb,.mm-hint{display:none}
 .mm-line{gap:2px}.mm-line>.lbl{font-size:10px;line-height:1.1}
 .mm-line .vc-seg{padding:3px;gap:3px}.mm-line .vc-seg button{min-height:clamp(24px,8vh,32px);font-size:13px}
 .mm-ghost{min-height:36px}.mm-setup{gap:4px}
 .mm-paint{display:none}.mm-stepper{display:flex}
}
/* A phone held upright: Track and Setup tabs, RACE at the bottom. */
@media (orientation:portrait) and (max-width:759px){
 .mm-grid{display:flex;flex-direction:column;gap:10px}
 .mm-left{display:none}
 .mm-dup{display:inline-flex}
 .mm-group{display:none;flex:1}
 .mm-group.active{display:flex}
 .mm-preview{height:clamp(90px,30vh,200px)}
 .mm-nav{display:flex;gap:8px;padding-top:6px}
 .mm-nav .vc-seg{flex:1}
 .mm-race-narrow{display:inline-flex;flex:1;min-height:52px;font-size:20px;letter-spacing:.1em}
 .mm-logo{font-size:20px}
 .mm-chip{padding:0 12px}.mm-chip span{display:none}
 .mm-brow{grid-template-columns:24px 1fr 46px 36px 66px;font-size:13px}
}
`;

// getOutline(mapId) -> { points: [[x, z], ...], length } or null. Called after the menu is drawn.
export function createMainMenu({ getStorage, skins, maps = [], onSkinChange, onMapChange = () => {}, onStart, onTune = () => {}, onGarage = () => {}, getOutline = () => null, online = null }) {
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
  const garageButton = iconButton('car', 'Garage', () => openGarage(), 'mm-dup');
  const tuneButton = iconButton('tune', 'Tune car', () => onTune(), 'mm-dup');
  const fullscreenButton = iconButton('expand', 'Full screen', () => toggleFullscreen());
  fullscreenButton.hidden = !fullscreenSupported(); // some phones (iPhone) cannot do it in the browser
  const syncFullscreen = () => fullscreenButton.replaceChildren(icon(isFullscreen() ? 'shrink' : 'expand', 24));
  onFullscreenChange(syncFullscreen);
  const top = el('div', 'mm-top');
  top.append(logo, playerChip, garageButton, tuneButton, fullscreenButton);

  // ---- Left column: race button and tiles ----
  // A track picked a moment ago may not be loaded yet: load it before the race starts.
  const start = () => {
    if (changeTimer !== null) {
      clearTimeout(changeTimer);
      changeTimer = null;
      onMapChange(settings.map);
    }
    onStart();
  };
  const raceButton = actionButton('RACE', 'flag', () => start(), 'primary mm-race');
  const tile = (iconName, label, fn) => {
    const b = el('button', 'mm-tile');
    b.type = 'button';
    b.append(icon(iconName, 26), el('span', '', label));
    b.addEventListener('click', fn);
    return b;
  };
  const tiles = el('div', 'mm-tiles');
  tiles.append(tile('tune', 'Tune car', () => onTune()), tile('car', 'Garage', () => openGarage()), tile('trophy', 'Scores', () => openSheet('board')));
  const left = el('div', 'mm-col mm-left');
  left.append(raceButton, tiles, el('div', 'mm-hint', 'W S gas and brake, A D steer, Space handbrake, C camera, E tune car, Esc pause and settings'));

  // ---- Track carousel ----
  let changeTimer = null;
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
    changeTimer = setTimeout(() => {
      changeTimer = null;
      onMapChange(settings.map);
    }, 350); // wait until the player stops flicking through
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
  const stepDot = el('span', 'dot');
  const stepName = el('span', 'name');
  const stepSkin = (d) => {
    const i = skins.findIndex((x) => x.id === skinId);
    setSkin(skins[(i + d + skins.length) % skins.length].id);
  };
  const stepper = el('div', 'mm-stepper');
  stepper.append(iconButton('left', 'Previous paint', () => stepSkin(-1)), stepDot, stepName, iconButton('right', 'Next paint', () => stepSkin(1)));
  const paintBox = el('div');
  paintBox.append(swatches, stepper);
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
    const current = skins.find((s) => s.id === skinId);
    skinName.textContent = current.name;
    stepName.textContent = current.name;
    if (!garage.hidden) renderGarage();
    stepDot.style.background = current.accent === undefined ? hex(current.color) : `linear-gradient(135deg, ${hex(current.color)} 62%, ${hex(current.accent)} 62%)`;
  }

  const setupCard = el('div', 'mm-card mm-setup');
  setupCard.append(line('Laps', lapsSeg.node), line('Opponents', oppSeg.node), diffLine, ghostRow, line('Paint', paintBox));

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
  const raceNarrow = actionButton('RACE', 'flag', () => start(), 'primary mm-race-narrow');
  const nav = el('div', 'mm-nav');
  nav.append(tabs.node, raceNarrow);

  shell.append(top, grid, nav);
  document.body.appendChild(root);

  // ---- Garage: the real car up close, so the paint (gloss, glow, pearl shift) can be judged ----
  const traitsOf = (skin) => [
    skin.clearcoat >= 0.5 ? 'Gloss' : 'Matte',
    skin.metalness >= 0.7 ? 'Metallic' : null,
    skin.glow !== undefined ? 'Neon glow' : null,
    skin.iridescence ? 'Pearl shift' : null,
    skin.accent !== undefined ? 'Stripes' : null,
  ].filter(Boolean);
  const garage = el('div', 'vc-screen mm-garage');
  garage.id = 'garage';
  garage.hidden = true;
  const garageName = el('div', 'mm-garage-name');
  const garageCount = el('div', 'mm-garage-count');
  const garageTraits = el('div', 'mm-traits');
  const garageInfo = el('div', 'mm-garage-info');
  garageInfo.append(garageName, garageCount, garageTraits);
  const garageTop = el('div', 'mm-garage-top');
  garageTop.append(el('h2', '', 'GARAGE'), actionButton('Done', 'check', () => closeGarage(), 'primary small'));
  const garageMid = el('div', 'mm-garage-mid');
  const garageBar = el('div', 'mm-garage-bar');
  garageBar.append(iconButton('left', 'Previous paint', () => stepSkin(-1)), garageInfo, iconButton('right', 'Next paint', () => stepSkin(1)));
  garage.append(garageTop, garageMid, garageBar);
  document.body.appendChild(garage);
  onSwipe(garageMid, () => stepSkin(-1), () => stepSkin(1));
  function renderGarage() {
    const i = skins.findIndex((x) => x.id === skinId);
    const skin = skins[i];
    garageName.textContent = skin.name;
    garageCount.textContent = `${i + 1} of ${skins.length}`;
    garageTraits.replaceChildren(...traitsOf(skin).map((t) => el('span', 'mm-trait', t)));
  }
  function openGarage() {
    closeSheet();
    garage.hidden = false;
    root.classList.add('mm-garage-on');
    renderGarage();
    onGarage(true);
  }
  function closeGarage() {
    if (garage.hidden) return;
    garage.hidden = true;
    root.classList.remove('mm-garage-on');
    onGarage(false);
  }
  window.addEventListener('keydown', (e) => {
    if (garage.hidden) return;
    if (e.code === 'ArrowLeft') stepSkin(-1);
    else if (e.code === 'ArrowRight') stepSkin(1);
    else if (e.code === 'Escape' || e.code === 'Enter') closeGarage();
  });

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
    if (online?.enabled) drawOnline(body);
  }

  // An online account (email and password, kept by Supabase). Separate from the local profile above.
  function drawOnline(body) {
    const status = el('div', 'vc-note');
    body.append(el('div', 'mm-mapname', 'Online account'));
    if (online.user) {
      body.append(el('div', 'vc-note', `Signed in online as ${online.user.username}. Your best laps go on the shared leaderboard.`), actionButton('Sign out online', 'user', async () => {
        await online.signOut();
        sheet?.redraw?.();
      }, 'small'));
      return;
    }
    const field = (type, placeholder, auto, max) => {
      const i = el('input');
      i.type = type;
      i.placeholder = placeholder;
      i.autocomplete = auto;
      if (max) i.maxLength = max;
      return i;
    };
    const email = field('email', 'Email', 'email', 120);
    const password = field('password', 'Password (8+ characters)', 'current-password', 72);
    const name = field('text', 'Username (to register)', 'off', 16);
    const run = (job) => async () => {
      status.textContent = 'Working...';
      try {
        status.textContent = await job();
      } catch (err) {
        status.textContent = err.message;
      }
      if (online.user) sheet?.redraw?.();
    };
    const who = el('div', 'mm-who');
    who.append(email, password, name);
    const buttons = el('div', 'mm-who');
    buttons.append(
      actionButton('Register online', 'check', run(async () => ((await online.signUp(email.value.trim(), password.value, name.value.trim())).signedIn ? 'Registered.' : 'Check your email to confirm, then sign in.')), 'primary'),
      actionButton('Sign in online', 'user', run(async () => {
        await online.signIn(email.value.trim(), password.value);
        return 'Signed in.';
      })),
    );
    body.append(who, buttons, status);
  }
  function drawBoard(body) {
    let mode = 'device';
    let onlineRows = [];
    let note = '';
    const box = el('div', 'mm-board');
    const pager = createPager(() => fill());
    const footer = el('div', 'vc-note');
    const mapName = maps.find((m) => m.id === settings.map)?.name ?? '';
    if (online?.enabled) {
      body.append(segmented([['device', 'This device'], ['online', 'Online']], mode, (m) => {
        mode = m;
        pager.setPage(0);
        if (m === 'online') loadOnline();
        fill();
      }).node);
    }
    body.append(box, pager.node, footer);
    function loadOnline() {
      note = 'Loading...';
      online.leaderboard(settings.map)
        .then((r) => { onlineRows = r; note = ''; })
        .catch((e) => { onlineRows = []; note = e.message; })
        .finally(() => mode === 'online' && fill());
    }
    function fill() {
      const isOnline = mode === 'online';
      const rows = isOnline ? onlineRows : store ? leaderboard(store, 50, settings.map) : [];
      footer.textContent = `${mapName} | ${isOnline ? 'online scores' : 'scores stay on this device'}`;
      if (rows.length === 0) {
        pager.setPages(1);
        box.replaceChildren(el('div', 'vc-note', isOnline ? note || 'No online scores yet.' : 'No scores yet. Register, then finish a race.'));
        return;
      }
      const { perPage, pages } = computePaging(300, Math.max(box.clientHeight || 200, 88) - 44, 44, rows.length);
      pager.setPages(pages);
      const head = el('div', 'mm-brow head');
      for (const h of isOnline ? ['#', 'Player', 'Runs', '', 'Best lap'] : ['#', 'Player', 'Pts', 'Win', 'Best lap']) head.append(el('span', '', h));
      box.replaceChildren(head, ...rows.slice(pager.page * perPage, pager.page * perPage + perPage).map((u, i) => {
        const mine = isOnline ? online.user?.username === u.username : user && u.name === user.name;
        const r = el('div', `mm-brow${mine ? ' me' : ''}`);
        const cells = isOnline
          ? [u.username, u.runs, '', formatTime(u.best_ms / 1000)]
          : [u.name, u.points, u.wins, u.bestLaps[settings.map] === undefined ? '-' : formatTime(u.bestLaps[settings.map] / 1000)];
        for (const cell of [pager.page * perPage + i + 1, ...cells]) r.append(el('span', '', String(cell)));
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
  syncFullscreen();
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
      closeGarage();
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
