import * as THREE from 'three';
import { FixedStepper } from './core/time.js';
import { Input } from './core/input.js';
import { runLoop } from './core/loop.js';
import { MAPS } from './maps/index.js';
import { prepareMap } from './maps/prepare.js';
import { buildMapScene } from './scene/mapScene.js';
import { TrackTracker } from './track/tracker.js';
import { Vehicle } from './physics/vehicle.js';
import { readCarSpec } from './physics/spec.js';
import { resolveCollisions } from './physics/collisions.js';
import { createCarModel } from './car/carModel.js';
import { SKINS, findSkin } from './car/skins.js';
import { BotDriver } from './ai/bot.js';
import { Race, pointsFor } from './race/race.js';
import { recordRace, loadSettings } from './profile/profiles.js';
import { subscribe } from './config/registry.js';
import { createEffects } from './effects/effects.js';
import { createSettingsMenu } from './ui/settingsMenu.js';
import { createMainMenu } from './ui/mainMenu.js';
import { createRaceUi } from './ui/raceUi.js';
import { createHud } from './ui/hud.js';
import { StyleTracker } from './game/style.js';
import { FreeLook } from './camera/freeLook.js';

const SKY_COLOR = 0x9cc3e6;
const FIRST_PERSON_FOV = 72;
const CHASE_FOV = 62;
const SPEED_FOV_BOOST = 10; // extra degrees of field of view at full speed
const FULL_SPEED = 60; // m/s at which the boost is complete
const CHASE_DISTANCE = 8;
const CHASE_HEIGHT = 3;
const ORBIT_RADIUS = 7.5;
const CHASE_LOOK_AHEAD = 4; // m past the car that the chase cameras aim at
const VIEW_BLEND_SECONDS = 0.35; // smooth switch between first-person, chase and rear views
const CAMERA_MODES = ['first', 'chase', 'rear'];
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
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Free look: hold the left mouse button (or drag a finger) and move to orbit the car; the wheel zooms.
const look = new FreeLook();
{
  const canvas = renderer.domElement;
  let lastX = 0;
  let lastY = 0;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !isRacing() || settingsMenu.isOpen) return;
    look.start();
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    look.drag(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const stopLook = () => {
    look.end();
    canvas.style.cursor = '';
  };
  canvas.addEventListener('pointerup', stopLook);
  canvas.addEventListener('pointercancel', stopLook);
  canvas.addEventListener('wheel', (e) => look.zoom(e.deltaY), { passive: true });
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_COLOR);
scene.fog = new THREE.Fog(SKY_COLOR, 500, 2600);

const camera = new THREE.PerspectiveCamera(FIRST_PERSON_FOV, window.innerWidth / window.innerHeight, 0.1, 6000);

const hemi = new THREE.HemisphereLight(0xffffff, 0x334455, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.3;
scene.add(sun, sun.target);
const sunDir = new THREE.Vector3(0.5, 0.8, 0.35).normalize();

// The map being raced on. installMap() swaps these when another map is picked.
const mapById = (id) => MAPS.find((m) => m.id === id) ?? MAPS[0];
let prepared = prepareMap(mapById(loadSettings(getStorage()).map).build());
let track = prepared.track;
let world = prepared.world;
let mapScene = null;
const worldView = { groundHeight: (x, z, y) => world.groundHeight(x, z, y) };
const effects = createEffects(scene, worldView);

const input = new Input();
const stepper = new FixedStepper(1 / 120, 8);
const controls = { forward: false, back: false, left: false, right: false, handbrake: false };
const settingsMenu = createSettingsMenu();
const raceUi = createRaceUi();
const hudPanel = createHud(track);
const style = new StyleTracker();

// ---- Entrants -------------------------------------------------------------------------

let race = null; // the current Race, or null while in the menu
let entrants = []; // bots first, the player last
let resultsShown = false;
let nextId = 0;

function createEntrant({ name, isPlayer, skin, driver = null }) {
  const model = createCarModel(skin);
  scene.add(model.root);
  model.root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
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
    e.car.reset(p.x + p.nx * side * GRID_LANE, p.z + p.nz * side * GRID_LANE, Math.atan2(p.tz, p.tx), p.y);
    e.tracker.setProgress(total);
    e.stuckTime = 0;
    e.offRoadTime = 0;
  });
}

// Puts a car back on the centre line where it last made progress.
function respawn(e) {
  const { points, spacing } = track;
  const p = points[Math.round(e.tracker.s / spacing) % points.length];
  e.car.reset(p.x, p.z, Math.atan2(p.tz, p.tx), p.y);
  e.tracker.setProgress(e.tracker.total);
  e.stuckTime = 0;
  e.offRoadTime = 0;
  e.driver?.abort();
}

// ---- Menu and race flow ---------------------------------------------------------------

const mainMenu = createMainMenu({
  getStorage,
  skins: SKINS,
  maps: MAPS,
  onMapChange: (id) => installMap(prepareMap(mapById(id).build())),
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
  style.reset();

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
          speedScale: prepared.config.botSpeedScale ?? 1,
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
        map: prepared.config.id,
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
let view = 'orbit'; // 'first', 'chase', 'rear' or 'orbit' (menu and results)
let chaseYaw = player.car.yaw;
let chaseY = player.car.y + CHASE_HEIGHT;
let orbitAngle = 0;
let lastRender = performance.now();
let lastView = null;
let blend = 1; // 0..1 progress of the current view change
const blendFrom = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
const blendTo = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
const lastPose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };

function limitAngle(angle) {
  return Math.max(-MAX_BODY_ANGLE, Math.min(MAX_BODY_ANGLE, angle));
}

function beforeFrame(frameDt) {
  // Read per-frame input here, never inside fixedUpdate.
  if (!isRacing() && settingsMenu.isOpen) settingsMenu.close();
  if (isRacing() && input.wasPressed('KeyE')) settingsMenu.toggle();
  if (isRacing() && !settingsMenu.isOpen && input.wasPressed('KeyC')) {
    cameraMode = CAMERA_MODES[(CAMERA_MODES.indexOf(cameraMode) + 1) % CAMERA_MODES.length];
  }
  const driving = race !== null && race.phase === 'racing' && !settingsMenu.isOpen;

  // The car is released while the settings menu is open.
  controls.forward = driving && (input.isDown('KeyW') || input.isDown('ArrowUp'));
  controls.back = driving && (input.isDown('KeyS') || input.isDown('ArrowDown'));
  controls.left = driving && (input.isDown('KeyA') || input.isDown('ArrowLeft'));
  controls.right = driving && (input.isDown('KeyD') || input.isDown('ArrowRight'));

  controls.handbrake = driving && input.isDown('Space');

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
  let playerCrashed = false;
  entrants.forEach((e, i) => {
    const lost = before[i] - Math.hypot(e.car.u, e.car.v);
    if (e.isPlayer && lost > SPARK_SPEED_LOSS) playerCrashed = true;
    if (lost > SPARK_SPEED_LOSS) effects.spark(e.car.x, e.car.y + 0.5, e.car.z, Math.min(30, Math.round(lost * 3)));
  });

  style.update(dt, player.car, { crashed: playerCrashed });

  for (const e of entrants) {
    e.tracker.update(e.car.x, e.car.z, e.car.y, !e.car.airborne);
    // Falling into water or off the world puts the car back on the road.
    if (world.hazard(e.car.x, e.car.z, e.car.y)) respawn(e);

    // Cars that get stuck or lost are put back on the road (the player gets longer, since there is no
    // reset key).
    if (!e.isPlayer || race.phase === 'racing') {
      e.stuckTime = Math.abs(e.car.u) < 1.5 ? e.stuckTime + dt : 0;
      e.offRoadTime = e.tracker.offTrack ? e.offRoadTime + dt : 0;
      const slack = e.isPlayer ? 2 : 1;
      if (e.stuckTime > STUCK_SECONDS * slack || e.offRoadTime > OFF_ROAD_SECONDS * slack) respawn(e);
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
  const pose = { x: mix(p.x, c.x), y: mix(p.y, c.y), z: mix(p.z, c.z), yaw: mix(p.yaw, c.yaw), roll: mix(p.roll, c.roll) };
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

let tunnelLight = 0; // 0..1, how far inside a tunnel the player is
let camRoll = 0; // rad the camera leans with a banked road
const lightBase = { sun: 2, hemi: 1, headlight: 0 };

// Puts the free camera at (x, y, z) without letting it sink into the ground, pop onto the mountain above a
// tunnel, or leave the tunnel walls.
function placeAwayFromGround(x, y, z, me) {
  const lat = world.lateral(x, z, me.y + 1);
  const inTunnel = lat?.mode === 't';
  if (inTunnel) {
    const limit = world.wallOffset - 1.2;
    const excess = lat.offset - Math.max(-limit, Math.min(limit, lat.offset));
    x -= lat.nx * excess;
    z -= lat.nz * excess;
  }
  const floor = world.floorHeight(x, z, me.y + 2);
  if (floor !== null) y = Math.max(y, floor + 1.5);
  if (inTunnel && floor !== null) y = Math.min(y, floor + 5);
  camera.position.set(x, y, z);
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
  look.update(frameDt);
  view = racing ? cameraMode : 'orbit';
  // Free look orbits from the chase pose (the rear pose when that is the chosen view).
  if (racing && look.engaged && view === 'first') view = 'chase';

  // Speed widens the field of view; the change is smoothed so it never pops.
  const speedFactor = Math.min(1, Math.abs(player.car.u) / FULL_SPEED);
  const targetFov =
    view === 'first'
      ? FIRST_PERSON_FOV + SPEED_FOV_BOOST * speedFactor
      : CHASE_FOV + (view === 'orbit' ? 0 : SPEED_FOV_BOOST * speedFactor);
  const nextFov = camera.fov + (targetFov - camera.fov) * (1 - Math.exp(-frameDt * 6));
  if (Math.abs(nextFov - camera.fov) > 0.005) {
    camera.fov = nextFov;
    camera.updateProjectionMatrix();
  }

  chaseYaw += (me.yaw - chaseYaw) * (1 - Math.exp(-frameDt * 4));
  chaseY += (me.y + CHASE_HEIGHT - chaseY) * (1 - Math.exp(-frameDt * 5));
  orbitAngle += frameDt * 0.35;

  // Tunnels are dark, and the camera leans with a banked road.
  const lat = racing ? world.lateral(me.x, me.z, me.y) : null;
  tunnelLight += ((lat?.mode === 't' ? 1 : 0) - tunnelLight) * Math.min(1, frameDt * 4);
  sun.intensity = lightBase.sun * (1 - 0.9 * tunnelLight);
  hemi.intensity = lightBase.hemi * (1 - 0.65 * tunnelLight);
  headlight.intensity = Math.max(lightBase.headlight, 40 * tunnelLight);
  camRoll += (me.roll * (view === 'first' ? 0.9 : 0.5) - camRoll) * Math.min(1, frameDt * 6);

  if (view === 'first') {
    player.model.placeCamera(camera);
  } else if (view === 'chase' || view === 'rear') {
    // The rear view is the chase view turned around: the camera sits ahead of the car and looks back.
    // Free look orbits the same pivot, so with no offset it is exactly this pose.
    const heading = chaseYaw + (view === 'rear' ? Math.PI : 0);
    const distance = CHASE_DISTANCE + 3 * speedFactor;
    const rise = chaseY - (me.y + 1.0);
    const o = look.orbit(heading + Math.PI, Math.atan2(rise, distance), Math.hypot(distance, rise));
    const flat = o.radius * Math.cos(o.pitch);
    const camX = me.x + flat * Math.cos(o.angle);
    const camZ = me.z + flat * Math.sin(o.angle);
    const camY = me.y + 1.0 + o.radius * Math.sin(o.pitch);
    placeAwayFromGround(camX, camY, camZ, me);
    camera.lookAt(
      me.x - CHASE_LOOK_AHEAD * Math.cos(o.angle),
      me.y + 1.0,
      me.z - CHASE_LOOK_AHEAD * Math.sin(o.angle)
    );
  } else {
    const camX = me.x + Math.cos(orbitAngle) * ORBIT_RADIUS;
    const camZ = me.z + Math.sin(orbitAngle) * ORBIT_RADIUS;
    placeAwayFromGround(camX, me.y + ORBIT_HEIGHT, camZ, me);
    camera.lookAt(me.x, me.y + 0.8, me.z);
  }

  if (view !== 'orbit') camera.rotateZ(-camRoll);

  // Changing view blends from the last camera pose instead of jumping.
  if (view !== lastView) {
    if (lastView !== null) {
      blendFrom.pos.copy(lastPose.pos);
      blendFrom.quat.copy(lastPose.quat);
      blend = 0;
    }
    lastView = view;
  }
  if (blend < 1) {
    blend = Math.min(1, blend + frameDt / VIEW_BLEND_SECONDS);
    const k = blend * blend * (3 - 2 * blend);
    blendTo.pos.copy(camera.position);
    blendTo.quat.copy(camera.quaternion);
    camera.position.lerpVectors(blendFrom.pos, blendTo.pos, k);
    camera.quaternion.copy(blendFrom.quat).slerp(blendTo.quat, k);
  }
  lastPose.pos.copy(camera.position);
  lastPose.quat.copy(camera.quaternion);

  sun.position.set(me.x + sunDir.x * 100, me.y + sunDir.y * 100, me.z + sunDir.z * 100);
  sun.target.position.set(me.x, me.y, me.z);
  sun.target.updateMatrixWorld();
  mapScene.update(camera.position);

  effects.update(frameDt, entrants, camera, renderer.domElement.height);
  renderer.render(scene, camera);

  hud.hidden = !racing;
  if (racing) hud.textContent =
      'W/S gas/brake · A/D steer · Space handbrake · drag mouse to look · C camera · E settings';

  hudPanel.setVisible(racing);
  if (racing) {
    hudPanel.update({
      kmh: Math.round(Math.abs(player.car.u) * 3.6),
      gear: player.car.gear < 0 ? 'R' : String(player.car.gear),
      rpm: player.car.rpm,
      redline: readCarSpec().redline,
      driftText:
        style.driftPoints > 0
          ? `DRIFT ${Math.round(style.driftPoints)} ×${style.multiplier}`
          : style.popup > 0
            ? style.popupText
            : '',
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

// Night maps give the player headlights.
const headlight = new THREE.SpotLight(0xfff0cc, 0, 140, 0.55, 0.7, 1);
headlight.position.set(1.8, 0.9, 0);
headlight.target.position.set(30, -1, 0);
player.model.root.add(headlight, headlight.target);

// Swaps the whole map: world, scenery, lighting, minimap and the starting grid.
function installMap(next) {
  if (mapScene) {
    scene.remove(mapScene.group);
    mapScene.dispose();
  }
  prepared = next;
  track = next.track;
  world = next.world;
  mapScene = buildMapScene(next);
  scene.add(mapScene.group);

  const theme = next.config.theme;
  scene.background = new THREE.Color(theme.sky[1]);
  scene.fog = new THREE.Fog(theme.fog[0], theme.fog[1], theme.fog[2]);
  const l = mapScene.lights;
  hemi.color.set(l.hemi.sky);
  hemi.groundColor.set(l.hemi.ground);
  sun.color.set(l.sun.color);
  lightBase.sun = l.sun.intensity;
  lightBase.hemi = l.hemi.intensity;
  lightBase.headlight = l.headlights ? 40 : 0;
  sunDir.set(...l.dir).normalize();

  clearBots();
  effects.clear();
  style.reset();
  player.car.ground = world;
  player.tracker = new TrackTracker(track);
  hudPanel.setTrack(track);
  placeOnGrid(entrants);
  chaseYaw = player.car.yaw;
  chaseY = player.car.y + CHASE_HEIGHT;
  lastView = null;
}
installMap(prepared);

runLoop({ stepper, beforeFrame, fixedUpdate, render });
