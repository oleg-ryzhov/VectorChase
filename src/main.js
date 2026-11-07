import * as THREE from 'three';
import { FixedStepper } from './core/time.js';
import { Input } from './core/input.js';
import { runLoop } from './core/loop.js';
import { buildTrack } from './track/track.js';
import { CONTROL_POINTS, TRACK_OPTIONS } from './track/trackData.js';
import { buildTrackMesh } from './track/trackMesh.js';
import { Vehicle } from './physics/vehicle.js';
import { createCarModel } from './car/carModel.js';

const FIRST_PERSON_FOV = 72;
const CHASE_FOV = 62;
const CHASE_DISTANCE = 7.5;
const CHASE_HEIGHT = 2.8;
const PITCH_PER_ACCEL = 0.0035; // rad of body pitch per m/s^2
const ROLL_PER_ACCEL = 0.004; // rad of body roll per m/s^2
const MAX_BODY_ANGLE = 0.06;

const hud = document.getElementById('hud');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1f2a);

const camera = new THREE.PerspectiveCamera(FIRST_PERSON_FOV, window.innerWidth / window.innerHeight, 0.1, 500);

scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(10, 20, 10);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(800, 800),
  new THREE.MeshStandardMaterial({ color: 0x2e3440 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const track = buildTrack(CONTROL_POINTS, TRACK_OPTIONS);
scene.add(buildTrackMesh(track));

const start = track.points[0];
const car = new Vehicle({ x: start.x, z: start.z, yaw: Math.atan2(start.tz, start.tx) });
const carModel = createCarModel();
scene.add(carModel.root);

const input = new Input();
const stepper = new FixedStepper(1 / 120, 8);
const controls = { forward: false, back: false, left: false, right: false };

let cameraMode = 'first';
let chaseYaw = car.yaw;
let lastRender = performance.now();

function applyCameraFov() {
  camera.fov = cameraMode === 'first' ? FIRST_PERSON_FOV : CHASE_FOV;
  camera.updateProjectionMatrix();
}

function limitAngle(angle) {
  return Math.max(-MAX_BODY_ANGLE, Math.min(MAX_BODY_ANGLE, angle));
}

function beforeFrame() {
  // Read per-frame input here, never inside fixedUpdate.
  if (input.wasPressed('KeyC')) {
    cameraMode = cameraMode === 'first' ? 'chase' : 'first';
    applyCameraFov();
  }
  controls.forward = input.isDown('KeyW') || input.isDown('ArrowUp');
  controls.back = input.isDown('KeyS') || input.isDown('ArrowDown');
  controls.left = input.isDown('KeyA') || input.isDown('ArrowLeft');
  controls.right = input.isDown('KeyD') || input.isDown('ArrowRight');
}

function fixedUpdate(dt) {
  car.step(dt, controls);
}

function render(alpha) {
  const now = performance.now();
  const frameDt = Math.min((now - lastRender) / 1000, 0.1);
  lastRender = now;

  // Draw the car between its previous and current physics state.
  const p = car.prev;
  const mix = (a, b) => a + (b - a) * alpha;
  const x = mix(p.x, car.x);
  const z = mix(p.z, car.z);
  const yaw = mix(p.yaw, car.yaw);
  const spin = car.wheelSpin.map((s, i) => mix(p.spin[i], s));

  carModel.update({
    x,
    z,
    yaw,
    steer: mix(p.steer, car.steer),
    spin,
    pitch: limitAngle(car.accelX * PITCH_PER_ACCEL),
    roll: limitAngle(-car.accelY * ROLL_PER_ACCEL),
    brake: car.brake,
  });

  chaseYaw += (yaw - chaseYaw) * (1 - Math.exp(-frameDt * 4));
  if (cameraMode === 'first') {
    carModel.placeCamera(camera);
  } else {
    const cx = Math.cos(chaseYaw);
    const cz = Math.sin(chaseYaw);
    camera.position.set(x - cx * CHASE_DISTANCE, CHASE_HEIGHT, z - cz * CHASE_DISTANCE);
    camera.lookAt(x + cx * 4, 1.0, z + cz * 4);
  }

  renderer.render(scene, camera);

  const kmh = Math.round(Math.abs(car.u) * 3.6);
  const gear = car.gear < 0 ? 'R' : String(car.gear);
  hud.textContent =
    `${kmh} km/h · gear ${gear} · ${Math.round(car.rpm)} rpm · ` +
    'W/S gas/brake · A/D steer · C camera';

  input.endFrame();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

runLoop({ stepper, beforeFrame, fixedUpdate, render });