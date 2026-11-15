import * as THREE from 'three';
import { ParticlePool } from './particlePool.js';
import { SkidBuffer } from './skidBuffer.js';
import { readCarSpec } from '../physics/spec.js';

const SKID_CAPACITY = 6000; // road-mark segments kept before the oldest are overwritten
const PARTICLE_CAPACITY = 800;
const SKID_SLIP = 0.9; // tire slip (1 = peak grip) above which marks are laid
const SMOKE_SLIP = 1.15; // tire slip above which smoke is produced
const MIN_SPEED = 3; // m/s
const MARK_LIFT = 0.03; // m above the road

const VERTEX = `
uniform float uScale;
attribute float size;
attribute float alpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vAlpha = alpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * uScale / max(-mv.z, 0.1);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENT = `
varying float vAlpha;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  if (d > 0.5) discard;
  gl_FragColor = vec4(vColor, vAlpha * (1.0 - d * 2.0));
}
`;

// Skid marks, tire smoke, dust and sparks. world needs groundHeight(x, z).
export function createEffects(scene, world) {
  // Skid marks: one big mesh holding a ring buffer of quads.
  const skid = new SkidBuffer(SKID_CAPACITY);
  const skidGeometry = new THREE.BufferGeometry();
  const skidAttribute = new THREE.BufferAttribute(skid.positions, 3);
  skidAttribute.setUsage(THREE.DynamicDrawUsage);
  skidGeometry.setAttribute('position', skidAttribute);
  const indices = new Uint32Array(SKID_CAPACITY * 6);
  for (let q = 0; q < SKID_CAPACITY; q++) {
    const b = q * 4;
    indices.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], q * 6);
  }
  skidGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
  skidGeometry.setDrawRange(0, 0);
  const skidMesh = new THREE.Mesh(
    skidGeometry,
    new THREE.MeshBasicMaterial({
      color: 0x050505,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  skidMesh.frustumCulled = false; // its bounds change every frame
  scene.add(skidMesh);

  // Smoke, dust and sparks: one point cloud with per-particle size, colour and fade.
  const pool = new ParticlePool(PARTICLE_CAPACITY);
  const geometry = new THREE.BufferGeometry();
  const attributes = [
    ['position', new THREE.BufferAttribute(pool.position, 3)],
    ['size', new THREE.BufferAttribute(pool.size, 1)],
    ['alpha', new THREE.BufferAttribute(pool.alpha, 1)],
    ['aColor', new THREE.BufferAttribute(pool.color, 3)],
  ];
  for (const [name, attribute] of attributes) {
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, attribute);
  }
  const material = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 600 } },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  function emitFor(e, spec, dt) {
    const car = e.car;
    const speed = Math.hypot(car.u, car.v);
    const cos = Math.cos(car.yaw);
    const sin = Math.sin(car.yaw);
    for (let i = 0; i < 4; i++) {
      const px = i < 2 ? spec.cgToFront : -spec.cgToRear;
      const py = (i % 2 === 0 ? -1 : 1) * (spec.track / 2);
      const x = car.x + cos * px - sin * py;
      const z = car.z + sin * px + cos * py;
      const ground = world.groundHeight(x, z);
      const key = e.id * 4 + i;
      const onRoad = car.surfaceGrip[i] > 0.9;
      const slip = car.wheelSlip[i];

      if (onRoad && slip > SKID_SLIP && speed > MIN_SPEED) {
        skid.add(key, x, ground + MARK_LIFT, z);
      } else {
        skid.end(key);
      }

      if (onRoad && slip > SMOKE_SLIP && speed > MIN_SPEED && Math.random() < 14 * dt) {
        pool.emit({
          x,
          y: ground + 0.2,
          z,
          vx: (Math.random() - 0.5) * 1.5,
          vy: 0.6 + Math.random() * 0.8,
          vz: (Math.random() - 0.5) * 1.5,
          life: 1.1,
          startSize: 0.8,
          endSize: 3.5,
          alpha: 0.35,
          color: [0.85, 0.85, 0.85],
          lift: 0.4,
        });
      } else if (!onRoad && speed > 4 && Math.random() < 20 * dt * Math.min(1, speed / 20)) {
        pool.emit({
          x,
          y: ground + 0.15,
          z,
          vx: (Math.random() - 0.5) * 2,
          vy: 0.5 + Math.random() * 0.8,
          vz: (Math.random() - 0.5) * 2,
          life: 0.9,
          startSize: 0.6,
          endSize: 2.5,
          alpha: 0.4,
          color: [0.45, 0.4, 0.3],
          lift: 0.2,
        });
      }
    }
  }

  return {
    // dt in real seconds; viewportHeight is the canvas height in pixels.
    update(dt, entrants, camera, viewportHeight) {
      const spec = readCarSpec();
      for (const e of entrants) emitFor(e, spec, dt);
      pool.update(dt);

      for (const [, attribute] of attributes) attribute.needsUpdate = true;
      skidAttribute.needsUpdate = true;
      skidGeometry.setDrawRange(0, skid.count * 6);
      // Converts a size in metres to pixels at a given distance.
      material.uniforms.uScale.value = viewportHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));
    },

    spark(x, y, z, count = 12) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5;
        pool.emit({
          x,
          y,
          z,
          vx: Math.cos(angle) * speed,
          vy: 2 + Math.random() * 4,
          vz: Math.sin(angle) * speed,
          life: 0.3 + Math.random() * 0.3,
          startSize: 0.2,
          endSize: 0.05,
          alpha: 1,
          color: [1, 0.72, 0.25],
          lift: -9.8,
        });
      }
    },

    clear() {
      skid.clear();
      pool.clear();
    },
  };
}
