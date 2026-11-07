import * as THREE from 'three';
import { CAR } from '../physics/vehicle.js';

const ROAD_SURFACE_Y = 0.05; // matches ROAD_Y in track/trackMesh.js
const BODY_PIVOT_Y = 0.5; // body pitches and rolls about this height
const TIRE_WIDTH = 0.26;
const RIM_RADIUS = 0.22;
const ARCH_RADIUS = 0.42;
const SILL_Y = 0.2;
const EYE = { x: 0.1, y: 1.15, z: -0.38 }; // driver's eye, left-hand drive
const STEERING_WHEEL_RATIO = 8;
const CENTER_HALF_WIDTH = 0.58;
const BODY_HALF_WIDTH = 0.925;

const paint = new THREE.MeshStandardMaterial({ color: 0xc1121f, metalness: 0.35, roughness: 0.3 });
const glass = new THREE.MeshStandardMaterial({ color: 0x0d1720, metalness: 0.2, roughness: 0.08 });
const dark = new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: 0.3, roughness: 0.7 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.95, side: THREE.DoubleSide });
const alloy = new THREE.MeshStandardMaterial({
  color: 0xc9ced6,
  metalness: 0.8,
  roughness: 0.3,
  side: THREE.DoubleSide,
});
const brakeDisc = new THREE.MeshStandardMaterial({ color: 0x6b6f76, metalness: 0.8, roughness: 0.5 });
const headlightMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xfff2cc,
  emissiveIntensity: 1.2,
});
const taillightMat = new THREE.MeshStandardMaterial({
  color: 0x330000,
  emissive: 0xff1a1a,
  emissiveIntensity: 0.6,
});
const marker = new THREE.MeshBasicMaterial({ color: 0xffd166 });

function polygon(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();
  return shape;
}

// Extrudes a side profile (x forward, y up) across the car's width, centred on z = 0.
function extrude(shape, depth, material, bevel = 0.03) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geometry.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geometry, material);
}

function box(w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

// Wheel arch cut into the bottom edge, drawn while walking the outline from front to rear.
function cutArch(shape, axleX) {
  const cy = CAR.wheelRadius;
  const dx = Math.sqrt(ARCH_RADIUS ** 2 - (cy - SILL_Y) ** 2);
  const a0 = Math.atan2(SILL_Y - cy, dx);
  shape.lineTo(axleX + dx, SILL_Y);
  shape.absarc(axleX, cy, ARCH_RADIUS, a0, Math.PI - a0, false);
}

function bodyShape(withArches) {
  const s = new THREE.Shape();
  s.moveTo(-2.35, 0.26);
  s.lineTo(-2.38, 0.58);
  s.lineTo(-2.25, 0.82);
  s.lineTo(-1.2, 0.9);
  s.lineTo(0.9, 0.9);
  s.lineTo(1.9, 0.7);
  s.lineTo(2.2, 0.55);
  s.lineTo(2.26, 0.38);
  s.lineTo(2.1, SILL_Y);
  if (withArches) {
    cutArch(s, CAR.cgToFront);
    cutArch(s, -CAR.cgToRear);
  }
  s.lineTo(-2.1, SILL_Y);
  s.closePath();
  return s;
}

function createWheel() {
  const R = CAR.wheelRadius;
  const pivot = new THREE.Group(); // steering
  const spin = new THREE.Group(); // rolling
  pivot.add(spin);

  const tread = new THREE.Mesh(new THREE.CylinderGeometry(R, R, TIRE_WIDTH, 32, 1, true), rubber);
  tread.rotation.x = Math.PI / 2;
  spin.add(tread);

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.RingGeometry(RIM_RADIUS, R, 32), rubber);
    wall.position.z = (side * TIRE_WIDTH) / 2;
    spin.add(wall);
  }

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(RIM_RADIUS, RIM_RADIUS, TIRE_WIDTH, 24, 1, true),
    alloy
  );
  barrel.rotation.x = Math.PI / 2;
  spin.add(barrel);

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 24), brakeDisc);
  disc.rotation.x = Math.PI / 2;
  spin.add(disc);

  for (let k = 0; k < 3; k++) {
    const spoke = box(RIM_RADIUS * 2 - 0.02, 0.04, 0.12, alloy, 0, 0, 0);
    spoke.rotation.z = (k * Math.PI) / 3;
    spin.add(spoke);
  }

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 16), alloy);
  hub.rotation.x = Math.PI / 2;
  spin.add(hub);

  return { pivot, spin };
}

export function createCarModel() {
  const root = new THREE.Group(); // world position and heading
  const bodyPivot = new THREE.Group(); // pitch and roll
  const bodyContent = new THREE.Group();
  bodyPivot.position.y = BODY_PIVOT_Y;
  bodyContent.position.y = -BODY_PIVOT_Y;
  root.add(bodyPivot);
  bodyPivot.add(bodyContent);

  // Body: solid centre section plus two side panels that have the wheel arches cut out.
  bodyContent.add(extrude(bodyShape(false), CENTER_HALF_WIDTH * 2, paint));
  const slabDepth = BODY_HALF_WIDTH - CENTER_HALF_WIDTH;
  const slabZ = CENTER_HALF_WIDTH + slabDepth / 2;
  for (const side of [-1, 1]) {
    const slab = extrude(bodyShape(true), slabDepth, paint);
    slab.position.z = side * slabZ;
    bodyContent.add(slab);
  }

  // Cabin: tinted glass block plus a body-coloured roof panel.
  bodyContent.add(
    extrude(
      polygon([
        [-1.25, 0.86],
        [-0.85, 1.24],
        [-0.1, 1.32],
        [0.45, 1.29],
        [1.05, 0.86],
      ]),
      1.46,
      glass,
      0.02
    )
  );
  bodyContent.add(
    extrude(
      polygon([
        [-0.85, 1.25],
        [-0.1, 1.33],
        [0.45, 1.3],
        [0.45, 1.265],
        [-0.1, 1.295],
        [-0.85, 1.215],
      ]),
      1.46,
      paint,
      0.01
    )
  );

  // Aero and details.
  bodyContent.add(box(0.4, 0.03, 1.8, dark, 2.15, 0.2, 0)); // front splitter
  bodyContent.add(box(0.38, 0.03, 1.7, paint, -2.25, 1.1, 0)); // rear wing
  for (const side of [-1, 1]) {
    bodyContent.add(box(0.06, 0.22, 0.04, dark, -2.2, 0.97, side * 0.6)); // wing uprights
    bodyContent.add(box(0.12, 0.07, 0.34, headlightMat, 2.17, 0.58, side * 0.62));
    bodyContent.add(box(0.06, 0.07, 0.4, taillightMat, -2.36, 0.62, side * 0.62));
    bodyContent.add(box(0.12, 0.08, 0.2, paint, 0.55, 1.0, side * 0.92)); // mirrors
  }

  // Interior: floor, dashboard and steering wheel.
  bodyContent.add(box(1.75, 0.02, 1.4, dark, -0.325, 0.91, 0));
  bodyContent.add(box(0.45, 0.12, 1.5, dark, 0.78, 0.96, 0));

  const steeringPivot = new THREE.Group();
  steeringPivot.position.set(0.4, 0.97, EYE.z);
  steeringPivot.rotation.z = -0.35; // column tilt
  const steeringAlign = new THREE.Group();
  steeringAlign.rotation.y = Math.PI / 2; // wheel axis points along the car
  const steeringTurn = new THREE.Group();
  steeringTurn.add(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 12, 32), dark));
  steeringTurn.add(box(0.26, 0.03, 0.02, dark, 0, 0, 0));
  steeringTurn.add(box(0.03, 0.13, 0.02, dark, 0, -0.065, 0));
  steeringTurn.add(box(0.02, 0.03, 0.025, marker, 0, 0.14, 0)); // top-centre marker
  steeringAlign.add(steeringTurn);
  steeringPivot.add(steeringAlign);
  bodyContent.add(steeringPivot);

  // Driver's eye: a camera placed here looks along the car's forward axis (+X).
  const eye = new THREE.Object3D();
  eye.position.set(EYE.x, EYE.y, EYE.z);
  eye.rotation.y = -Math.PI / 2;
  bodyContent.add(eye);

  // Wheels stay on the ground while the body pitches and rolls.
  const wheelX = [CAR.cgToFront, CAR.cgToFront, -CAR.cgToRear, -CAR.cgToRear];
  const wheelZ = [-1, 1, -1, 1].map((side) => (side * CAR.track) / 2);
  const pivots = [];
  const spins = [];
  for (let i = 0; i < 4; i++) {
    const wheel = createWheel();
    wheel.pivot.position.set(wheelX[i], CAR.wheelRadius, wheelZ[i]);
    root.add(wheel.pivot);
    pivots.push(wheel.pivot);
    spins.push(wheel.spin);
  }

  // state: { x, z, yaw, steer, spin[4], pitch, roll, brake }
  function update(state) {
    root.position.set(state.x, ROAD_SURFACE_Y, state.z);
    root.rotation.y = -state.yaw;
    bodyPivot.rotation.z = state.pitch; // nose up when accelerating
    bodyPivot.rotation.x = state.roll; // leans outwards in corners
    for (let i = 0; i < 4; i++) spins[i].rotation.z = -state.spin[i];
    pivots[0].rotation.y = -state.steer;
    pivots[1].rotation.y = -state.steer;
    steeringTurn.rotation.z = state.steer * STEERING_WHEEL_RATIO;
    taillightMat.emissiveIntensity = 0.6 + 1.6 * state.brake;
  }

  function placeCamera(camera) {
    eye.updateWorldMatrix(true, false);
    eye.getWorldPosition(camera.position);
    eye.getWorldQuaternion(camera.quaternion);
  }

  return { root, update, placeCamera };
}