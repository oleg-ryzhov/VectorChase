// Car-to-car and car-to-wall collisions. Pure logic: no DOM or Three.js imports.
// Each car is three overlapping circles along its length. Overlaps are pushed apart, and the
// bodies exchange momentum with an impulse that includes spin, so glancing hits turn the cars.

import { YAW_GYRATION } from './vehicle.js';

const CIRCLE_RADIUS = 0.95;
const CIRCLE_OFFSETS = [1.35, 0, -1.35]; // m forward of the centre of gravity
const RESTITUTION = 0.2;
const BOUNCE_THRESHOLD = 0.5; // m/s: slower impacts do not bounce
const CAR_FRICTION = 0.15;
const WALL_FRICTION = 0.25;
const SLOP = 0.005; // m of extra separation so cars do not stay in contact

// A car as a rigid body: world velocity of the centre of gravity and yaw rate.
function bodyOf(car, mass) {
  const c = Math.cos(car.yaw);
  const s = Math.sin(car.yaw);
  return {
    car,
    mass,
    inertia: mass * YAW_GYRATION * YAW_GYRATION,
    vx: car.u * c - car.v * s,
    vz: car.u * s + car.v * c,
    r: car.r,
  };
}

// Writes the body's velocity back into the car's own forward/sideways speeds.
function store(body) {
  const c = Math.cos(body.car.yaw);
  const s = Math.sin(body.car.yaw);
  body.car.u = body.vx * c + body.vz * s;
  body.car.v = -body.vx * s + body.vz * c;
  body.car.r = body.r;
}

// Adds an impulse (jx, jz) applied at lever arm (rx, rz) from the body's centre.
function push(body, jx, jz, rx, rz) {
  body.vx += jx / body.mass;
  body.vz += jz / body.mass;
  body.r += (rx * jz - rz * jx) / body.inertia;
}

function circleAt(car, offset) {
  return { x: car.x + Math.cos(car.yaw) * offset, z: car.z + Math.sin(car.yaw) * offset };
}

// Exchanges momentum at one contact. (nx, nz) points from a into b; b = null is a fixed wall.
function impulse(a, b, px, pz, nx, nz, friction) {
  const rax = px - a.car.x;
  const raz = pz - a.car.z;
  const rbx = b ? px - b.car.x : 0;
  const rbz = b ? pz - b.car.z : 0;

  // Relative velocity of the contact point on b compared with a.
  const rvx = (b ? b.vx - b.r * rbz : 0) - (a.vx - a.r * raz);
  const rvz = (b ? b.vz + b.r * rbx : 0) - (a.vz + a.r * rax);
  const vn = rvx * nx + rvz * nz;
  if (vn >= 0) return; // already moving apart

  // Inverse mass seen along a direction, including how much the contact makes the bodies spin.
  const inverseMass = (dx, dz) => {
    const ca = rax * dz - raz * dx;
    let inv = 1 / a.mass + (ca * ca) / a.inertia;
    if (b) {
      const cb = rbx * dz - rbz * dx;
      inv += 1 / b.mass + (cb * cb) / b.inertia;
    }
    return inv;
  };

  const e = -vn > BOUNCE_THRESHOLD ? RESTITUTION : 0;
  const j = (-(1 + e) * vn) / inverseMass(nx, nz);
  push(a, -j * nx, -j * nz, rax, raz);
  if (b) push(b, j * nx, j * nz, rbx, rbz);

  // Friction along the contact, limited by the normal impulse.
  const tx = -nz;
  const tz = nx;
  const vt = rvx * tx + rvz * tz;
  const jt = Math.max(-friction * j, Math.min(friction * j, -vt / inverseMass(tx, tz)));
  push(a, -jt * tx, -jt * tz, rax, raz);
  if (b) push(b, jt * tx, jt * tz, rbx, rbz);
}

export function collideCars(carA, carB, spec) {
  const dx = carB.x - carA.x;
  const dz = carB.z - carA.z;
  if (dx * dx + dz * dz > 36) return; // centres more than 6 m apart: cannot touch

  const a = bodyOf(carA, spec.mass);
  const b = bodyOf(carB, spec.mass);
  for (const offsetA of CIRCLE_OFFSETS) {
    for (const offsetB of CIRCLE_OFFSETS) {
      // Measured fresh each time, because earlier pushes move the cars.
      const pa = circleAt(carA, offsetA);
      const pb = circleAt(carB, offsetB);
      const ddx = pb.x - pa.x;
      const ddz = pb.z - pa.z;
      const dist = Math.hypot(ddx, ddz);
      const overlap = 2 * CIRCLE_RADIUS - dist;
      if (overlap <= 0) continue;

      const nx = dist > 1e-6 ? ddx / dist : 1;
      const nz = dist > 1e-6 ? ddz / dist : 0;
      impulse(a, b, (pa.x + pb.x) / 2, (pa.z + pb.z) / 2, nx, nz, CAR_FRICTION);
      const shift = (overlap + SLOP) / 2;
      carA.x -= nx * shift;
      carA.z -= nz * shift;
      carB.x += nx * shift;
      carB.z += nz * shift;
    }
  }
  store(a);
  store(b);
}

// world needs lateral(x, z) and wallOffset (see createWorld).
export function collideWall(car, world, spec) {
  const body = bodyOf(car, spec.mass);
  const limit = world.wallOffset - CIRCLE_RADIUS; // how far a circle centre may be from the centre line
  for (const offset of CIRCLE_OFFSETS) {
    const c = circleAt(car, offset); // measured fresh each time, because earlier pushes move the car
    const lat = world.lateral(c.x, c.z);
    if (!lat) continue;
    const depth = Math.abs(lat.offset) - limit;
    if (depth <= 0) continue;

    const side = lat.offset > 0 ? 1 : -1;
    const nx = lat.nx * side; // points from the car into the wall
    const nz = lat.nz * side;
    const toWall = world.wallOffset - Math.abs(lat.offset);
    impulse(body, null, c.x + nx * toWall, c.z + nz * toWall, nx, nz, WALL_FRICTION);
    car.x -= nx * (depth + SLOP);
    car.z -= nz * (depth + SLOP);
  }
  store(body);
}

export function resolveCollisions(cars, world, spec) {
  for (const car of cars) collideWall(car, world, spec);
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) collideCars(cars[i], cars[j], spec);
  }
  // A car shoved by another car may now be inside a wall.
  for (const car of cars) collideWall(car, world, spec);
}
