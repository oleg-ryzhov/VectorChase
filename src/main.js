import * as THREE from 'three';
import { FixedStepper } from './core/time.js';
import { Input } from './core/input.js';
import { runLoop } from './core/loop.js';
import { buildTrack } from './track/track.js';
import { CONTROL_POINTS, TRACK_OPTIONS, baseHeight } from './track/trackData.js';
import { buildTrackMesh } from './track/trackMesh.js';
import { createWorld } from './track/world.js';
import { buildTerrainMesh } from './track/terrainMesh.js';
import { TrackTracker } from './track/tracker.js';
import { Vehicle } from './physics/vehicle.js';
import { readCarSpec } from './physics/spec.js';
import { resolveCollisions } from './physics/collisions.js';
import { createCarModel } from './car/carModel.js';
import { SKINS, findSkin } from './car/skins.js';
import { BotDriver } from './ai/bot.js';
import { Race, pointsFor } from './race/race.js';
import { recordRace } from './profile/profiles.js';
import { subscribe } from './config/registry.js';
import { createEffects } from './effects/effects.js';
import { createSettingsMenu } from './ui/settingsMenu.js';
import { createMainMenu } from './ui/mainMenu.js';
import { createRaceUi } from './ui/raceUi.js';
import { createHud } from './ui/hud.js';

const SKY_COLOR = 0x9cc3e6;
const FIRST_PERSON_FOV = 72;
const CHASE_FOV = 62;
const SPEED_FOV_BOOST = 10; // extra degrees of field of view at full speed
const FULL_SPEED = 60; // m/s at which the boost is complete
const CHASE_DISTANCE = 8;
const CHASE_HEIGHT = 3;
const ORBIT_RADIUS = 7.5;
const ORBIT_HEIGHT = 2.4;
const PITCH_PER_ACCEL = 0.0035; // rad of body pitch per m/s^2
const ROLL_PER_ACCEL = 0.004; // rad of body roll per m/s^2
const MAX_BODY_ANGLE = 0.06;
const MENU_TIME_SCALE = 0.1; // simulation speed while the settings menu is open
const TIME_EASE_RATE = 10; // 1/s
const SPARK_SPEED_LOSS = 2.5; // m/s lost in one physics step that counts as an impact

const GRID_FIRST_GAP = 12; // m behind the start line for the first row
const GRID_ROW_GAP = 9;
const GRID_LANE = 3.5; // m left or right of the centre line
const GRID_STAGGER = 4.5; // right-hand cars sit this much further back
const BOT_NAMES = ['Apex', 'Drift', 'Nitro', 'Vector', 'Slipstream'];
const LANE_OFFSETS = [-3, 3, -1.5, 1.5, 0];
const STUCK_SECONDS = 4;
const OFF_ROAD_SECONDS = 6;

const hud = document.getElementById('hud');

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked by the browser
  }
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_COLOR);
scene.fog = new THREE.Fog(SKY_COLOR, 500, 2600);

const camera = new THREE.PerspectiveCamera(FIRST_PERSON_FOV, window.innerWidth / window.innerHeight, 0.1, 3000);

scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(10, 20, 10);
scene.add(sun);

const track = buildTrack(CONTROL_POINTS, TRACK_OPTIONS);
scene.add(buildTrackMesh(track));
const world = createWorld(track, baseHeight);
scene.add(buildTerrainMesh(world));
const effects = createEffects(scene, world);

const input = new Input();
const stepper = new FixedStepper(1 / 120, 8);
const controls = { forward: false, back: false, left: false, right: false };
const settingsMenu = createSettingsMenu();
const raceUi = createRaceUi();
const hudPanel = createHud(track);

// ---- Entrants -------------------------------------------------------------------------

let race = null; // the current Race, or null while in the menu
let entrants = []; // bots first, the player last
let resultsShown = false;
let nextId = 0;

function createEntrant({ name, isPlayer, skin, driver = null }) {
  const model = createCarModel(skin);
  scene.add(model.root);
  return {
    id: nextId++,
    name,
    isPlayer,
    color: skin.color,
    driver,
    model,
    car: new Vehicle({ ground: world }),
    tracker: new TrackTracker(track),
    stuckTime: 0,
    offRoadTime: 0,
  };
}

function removeEntrant(e) {
  scene.remove(e.model.root);
  e.model.dispose();
}

// Slot 0 is the front row; the player is last in the list, so starts at the back.
function placeOnGrid(list) {
  const { points, spacing, length } = track;
  const n = points.length;
  list.forEach((e, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const total = -(GRID_FIRST_GAP + Math.floor(i / 2) * GRID_ROW_GAP + (i % 2) * GRID_STAGGER);
    const s = ((total % length) + length) % length;
    const p = points[Math.round(s / spacing) % n];
    e.car.reset(p.x + p.nx * side * GRID_LANE, p.z + p.nz * side * GRID_LANE, Math.atan2(p.tz, p.tx));
    e.tracker.setProgress(total);
    e.stuckTime = 0;
    e.offRoadTime = 0;
  });
}

// Puts a car back on the centre line where it last made progress.
function respawn(e) {
  const { points, spacing } = track;
  const p = points[Math.round(e.tracker.s / spacing) % points.length];
  e.car.reset(p.x, p.z, Math.atan2(p.tz, p.tx));
  e.tracker.setProgress(e.tracker.total);
  e.stuckTime = 0;
  e.offRoadTime = 0;
}

// ---- Menu and race flow ---------------------------------------------------------------

const mainMenu = createMainMenu({
  getStorage,
  skins: SKINS,
  onSkinChange: (id) => {
    const skin = findSkin(id);
    player.model.setSkin(skin);
    player.color = skin.color;
  },
  onStart: () => startRace(),
});

const player = createEntrant({
  name: 'Guest',
  isPlayer: true,
  skin: findSkin(mainMenu.getState().skinId),
});
entrants = [player];
placeOnGrid(entrants);

// Wheel size and weight distribution also change how the cars look.
subscribe(() => {
  const spec = readCarSpec();
  entrants.forEach((e) => e.model.applyDimensions(spec));
});

function clearBots() {
  entrants.filter((e) => !e.isPlayer).forEach(removeEntrant);
  entrants = [player];
}

function startRace() {
  const state = mainMenu.getState();
  clearBots();
  effects.clear();

  const botSkins = SKINS.filter((s) => s.id !== state.skinId);
  const bots = [];
  for (let i = 0; i < state.bots; i++) {
    bots.push(
      createEntrant({
        name: BOT_NAMES[i],
        isPlayer: false,
        skin: botSkins[i % botSkins.length],
        driver: new BotDriver({
          difficulty: state.difficulty,
          variation: 0.95 + (0.05 * ((i * 5) % 7)) / 6,
          laneOffset: LANE_OFFSETS[i],
        }),
      })
    );
  }
  player.name = state.name;
  entrants = [...bots, player];
  placeOnGrid(entrants);

  race = new Race({ laps: state.laps, entrants, trackLength: track.length });
  resultsShown = false;
  raceUi.hideResults();
  mainMenu.hide();
}

function backToMenu() {
  clearBots();
  effects.clear();
  race = null;
  settingsMenu.close();
  raceUi.hideResults();
  raceUi.hideStatus();
  raceUi.setCountdown('');
  placeOnGrid(entrants);
  mainMenu.show();
}

function finishRace() {
  const order = race.standings();
  const position = order.indexOf(player) + 1;
  const state = mainMenu.getState();

  let saveNote = 'Playing as a guest: register in the menu to save scores.';
  if (state.user) {
    const store = getStorage();
    const saved =
      store &&
      recordRace(store, state.user, {
        position,
        points: pointsFor(position),
        bestLapMs: player.bestLap === null ? null : Math.round(player.bestLap * 1000),
      });
    saveNote = saved
      ? `Saved to the leaderboard as ${state.user} (+${pointsFor(position)} points).`
      : 'Could not save your score (storage is blocked or full).';
  }

  raceUi.showResults({
    standings: order.map((e, i) => ({
      position: i + 1,
      name: e.isPlayer ? e.name : `${e.name} (bot)`,
      isPlayer: e.isPlayer,
      finished: e.finished,
      time: e.finishTime,
      lapsDone: e.lapsDone,
      bestLap: e.bestLap,
      points: pointsFor(i + 1),
    })),
    laps: race.laps,
    saveNote,
    onAgain: startRace,
    onMenu: backToMenu,
  });
  settingsMenu.close();
}

const isRacing = () => race !== null && (race.phase === 'countdown' || race.phase === 'racing');

// ---- Frame loop -----------------------------------------------------------------------

let cameraMode = 'first';
let view = 'orbit'; // 'first', 'chase' or 'orbit' (menu and results)
let chaseYaw = player.car.yaw;
let chaseY = player.car.y + CHASE_HEIGHT;
let orbitAngle = 0;
let lastRender = performance.now();

function limitAngle(angle) {
  return Math.max(-MAX_BODY_ANGLE, Math.min(MAX_BODY_ANGLE, angle));
}

function beforeFrame(frameDt) {
  // Read per-frame input here, never inside fixedUpdate.
  if (!isRacing() && settingsMenu.isOpen) settingsMenu.close();
  if (isRacing() && input.wasPressed('KeyE')) settingsMenu.toggle();
  if (isRacing() && !settingsMenu.isOpen && input.wasPressed('KeyC')) {
    cameraMode = cameraMode === 'first' ? 'chase' : 'first';
  }
  const driving = race !== null && race.phase === 'racing' && !settingsMenu.isOpen;
  if (driving && input.wasPressed('KeyR')) respawn(player);

  // The car is released while the settings menu is open.
  controls.forward = driving && (input.isDown('KeyW') || input.isDown('ArrowUp'));
  controls.back = driving && (input.isDown('KeyS') || input.isDown('ArrowDown'));
  controls.left = driving && (input.isDown('KeyA') || input.isDown('ArrowLeft'));
  controls.right = driving && (input.isDown('KeyD') || input.isDown('ArrowRight'));

  // Time slows down while the settings menu is open and eases back afterwards.
  const target = settingsMenu.isOpen ? MENU_TIME_SCALE : 1;
  const diff = target - stepper.timeScale;
  stepper.timeScale =
    Math.abs(diff) < 0.001 ? target : stepper.timeScale + diff * (1 - Math.exp(-frameDt * TIME_EASE_RATE));
}

function fixedUpdate(dt) {
  if (race === null) return;
  if (race.phase === 'countdown') {
    race.update(dt);
    return;
  }
  if (race.phase !== 'racing') return;

  const spec = readCarSpec();
  for (const e of entrants) {
    e.car.step(dt, e.isPlayer ? controls : e.driver.drive(e.car, e.tracker, spec));
  }

  // A sudden loss of speed during collision handling is an impact: throw sparks.
  const before = entrants.map((e) => Math.hypot(e.car.u, e.car.v));
  resolveCollisions(
    entrants.map((e) => e.car),
    world,
    spec
  );
  entrants.forEach((e, i) => {
    const lost = before[i] - Math.hypot(e.car.u, e.car.v);
    if (lost > SPARK_SPEED_LOSS) effects.spark(e.car.x, e.car.y + 0.5, e.car.z, Math.min(30, Math.round(lost * 3)));
  });

  for (const e of entrants) {
    e.tracker.update(e.car.x, e.car.z);

    // Bots that get stuck or lost are put back on the road.
    if (!e.isPlayer) {
      e.stuckTime = e.car.u < 1.5 ? e.stuckTime + dt : 0;
      e.offRoadTime = e.tracker.offTrack ? e.offRoadTime + dt : 0;
      if (e.stuckTime > STUCK_SECONDS || e.offRoadTime > OFF_ROAD_SECONDS) respawn(e);
    }
  }
  race.update(dt);

  if (race.phase === 'finished' && !resultsShown) {
    resultsShown = true;
    finishRace();
  }
}

// Draws a car between its previous and current physics state and returns where it is.
function updateModel(e, alpha) {
  const c = e.car;
  const p = c.prev;
  const mix = (a, b) => a + (b - a) * alpha;
  const pose = { x: mix(p.x, c.x), y: mix(p.y, c.y), z: mix(p.z, c.z), yaw: mix(p.yaw, c.yaw) };
  e.model.update({
    ...pose,
    steer: mix(p.steer, c.steer),
    spin: c.wheelSpin.map((s, i) => mix(p.spin[i], s)),
    groundPitch: mix(p.pitch, c.pitch),
    groundRoll: mix(p.roll, c.roll),
    pitch: limitAngle(c.accelX * PITCH_PER_ACCEL),
    roll: limitAngle(-c.accelY * ROLL_PER_ACCEL),
    brake: c.brake,
  });
  return pose;
}

function render(alpha) {
  const now = performance.now();
  const frameDt = Math.min((now - lastRender) / 1000, 0.1);
  lastRender = now;

  let me = null;
  for (const e of entrants) {
    const pose = updateModel(e, alpha);
    if (e.isPlayer) me = pose;
  }

  const racing = isRacing();
  view = racing ? cameraMode : 'orbit';

  // Speed widens the field of view; the change is smoothed so it never pops.
  const speedFactor = Math.min(1, Math.abs(player.car.u) / FULL_SPEED);
  const targetFov =
    view === 'first'
      ? FIRST_PERSON_FOV + SPEED_FOV_BOOST * speedFactor
      : CHASE_FOV + (view === 'chase' ? SPEED_FOV_BOOST * speedFactor : 0);
  const nextFov = camera.fov + (targetFov - camera.fov) * (1 - Math.exp(-frameDt * 6));
  if (Math.abs(nextFov - camera.fov) > 0.005) {
    camera.fov = nextFov;
    camera.updateProjectionMatrix();
  }

  chaseYaw += (me.yaw - chaseYaw) * (1 - Math.exp(-frameDt * 4));
  chaseY += (me.y + CHASE_HEIGHT - chaseY) * (1 - Math.exp(-frameDt * 5));
  orbitAngle += frameDt * 0.35;

  if (view === 'first') {
    player.model.placeCamera(camera);
  } else if (view === 'chase') {
    const cx = Math.cos(chaseYaw);
    const cz = Math.sin(chaseYaw);
    const distance = CHASE_DISTANCE + 3 * speedFactor;
    const camX = me.x - cx * distance;
    const camZ = me.z - cz * distance;
    // Stay above the hill behind the car.
    camera.position.set(camX, Math.max(chaseY, world.groundHeight(camX, camZ) + 1.5), camZ);
    camera.lookAt(me.x + cx * 4, me.y + 1.0, me.z + cz * 4);
  } else {
    const camX = me.x + Math.cos(orbitAngle) * ORBIT_RADIUS;
    const camZ = me.z + Math.sin(orbitAngle) * ORBIT_RADIUS;
    camera.position.set(camX, Math.max(me.y + ORBIT_HEIGHT, world.groundHeight(camX, camZ) + 1.5), camZ);
    camera.lookAt(me.x, me.y + 0.8, me.z);
  }

  effects.update(frameDt, entrants, camera, renderer.domElement.height);
  renderer.render(scene, camera);

  hud.hidden = !racing;
  if (racing) hud.textContent = 'W/S gas/brake · A/D steer · C camera · R to road · E settings';

  hudPanel.setVisible(racing);
  if (racing) {
    hudPanel.update({
      kmh: Math.round(Math.abs(player.car.u) * 3.6),
      gear: player.car.gear < 0 ? 'R' : String(player.car.gear),
      rpm: player.car.rpm,
      redline: readCarSpec().redline,
      cars: entrants.map((e) => ({ x: e.car.x, z: e.car.z, isPlayer: e.isPlayer, color: e.color })),
    });
  }

  if (race !== null) {
    raceUi.setStatus({
      position: race.standings().indexOf(player) + 1,
      total: entrants.length,
      lap: Math.min(race.laps, player.lapsDone + 1),
      laps: race.laps,
      time: Math.max(0, race.time),
      bestLap: player.bestLap,
      offTrack: race.phase === 'racing' && player.tracker.offTrack,
    });
    raceUi.setCountdown(
      race.phase === 'countdown' ? String(Math.ceil(race.countdown)) : race.phase === 'racing' && race.time < 1 ? 'GO!' : ''
    );
  }

  input.endFrame();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

runLoop({ stepper, beforeFrame, fixedUpdate, render });
