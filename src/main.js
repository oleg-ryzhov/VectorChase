import * as THREE from 'three';
import { FixedStepper } from './core/time.js';
import { Input } from './core/input.js';
import { runLoop } from './core/loop.js';
import { buildTrack } from './track/track.js';
import { CONTROL_POINTS, TRACK_OPTIONS } from './track/trackData.js';
import { buildTrackMesh, buildDebugOverlay } from './track/trackMesh.js';

const SLOW_MO_SCALE = 0.25;
const MOVE_SPEED = 10; // m/s
const ACCEL = 8; // velocity response rate, 1/s

const hud = document.getElementById('hud');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1f2a);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 8, 14);

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
const debugOverlay = buildDebugOverlay(track);
scene.add(debugOverlay);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xe06c75 })
);
scene.add(cube);

const start = track.points[0];
const state = {
  pos: new THREE.Vector3(start.x, 0.5, start.z),
  prev: new THREE.Vector3(start.x, 0.5, start.z),
  vel: new THREE.Vector3(),
};
const target = new THREE.Vector3();

const input = new Input();
const stepper = new FixedStepper(1 / 120, 8);

function beforeFrame() {
  // Read per-frame input here, never inside fixedUpdate.
  stepper.timeScale = input.isDown('Space') ? SLOW_MO_SCALE : 1;
  if (input.wasPressed('KeyG')) debugOverlay.visible = !debugOverlay.visible;
}

function fixedUpdate(dt) {
  state.prev.copy(state.pos);

  let x = 0;
  let z = 0;
  if (input.isDown('KeyA') || input.isDown('ArrowLeft')) x -= 1;
  if (input.isDown('KeyD') || input.isDown('ArrowRight')) x += 1;
  if (input.isDown('KeyW') || input.isDown('ArrowUp')) z -= 1;
  if (input.isDown('KeyS') || input.isDown('ArrowDown')) z += 1;

  target.set(x, 0, z);
  if (target.lengthSq() > 0) {
    target.normalize().multiplyScalar(MOVE_SPEED);
  }

  state.vel.lerp(target, 1 - Math.exp(-ACCEL * dt));
  state.pos.addScaledVector(state.vel, dt);
}

function render(alpha, info) {
  cube.position.lerpVectors(state.prev, state.pos, alpha);

  camera.position.set(cube.position.x, 8, cube.position.z + 14);
  camera.lookAt(cube.position);

  renderer.render(scene, camera);

  hud.textContent =
    `timeScale ${info.timeScale.toFixed(2)} · steps ${info.steps} · ` +
    'WASD/arrows move · Space slow-mo · G debug line';;

  input.endFrame();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

runLoop({ stepper, beforeFrame, fixedUpdate, render });