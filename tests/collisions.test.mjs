import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vehicle } from '../src/physics/vehicle.js';
import { readCarSpec } from '../src/physics/spec.js';
import { collideCars, collideWall, resolveCollisions } from '../src/physics/collisions.js';
import { resetAll } from '../src/config/registry.js';

// A straight road along the X axis: the centre line is z = 0 and "right" is +z.
const straightWorld = { wallOffset: 8.3, lateral: (x, z) => ({ offset: z, nx: 0, nz: 1 }) };

test('overlapping cars are pushed apart and exchange momentum', () => {
  resetAll();
  const spec = readCarSpec();
  const a = new Vehicle({ x: 0, z: 0, yaw: 0 });
  const b = new Vehicle({ x: 3.5, z: 0, yaw: 0 });
  a.u = 10;
  collideCars(a, b, spec);
  assert.ok(a.u < 10 && b.u > 0, `a ${a.u} b ${b.u}`);
  assert.ok(a.u <= b.u + 1e-9, 'the cars should be separating');
  assert.ok(Math.abs(a.u + b.u - 10) < 1e-6, 'momentum is not conserved');
  assert.ok(b.x - a.x > 4.59, `still overlapping: ${b.x - a.x}`);
});

test('cars that do not touch are left alone', () => {
  resetAll();
  const spec = readCarSpec();
  const a = new Vehicle({ x: 0, z: 0, yaw: 0 });
  const b = new Vehicle({ x: 10, z: 0, yaw: 0 });
  a.u = 20;
  collideCars(a, b, spec);
  assert.equal(a.u, 20);
  assert.equal(b.u, 0);
  assert.equal(b.x, 10);
});

test('a car driving into the wall is stopped, pushed back and slowed', () => {
  resetAll();
  const spec = readCarSpec();
  const car = new Vehicle({ x: 0, z: 7.8, yaw: 0.2 });
  car.u = 10;
  collideWall(car, straightWorld, spec);
  // The impact is at the front corner, so check that corner rather than the centre.
  const vz = car.u * Math.sin(car.yaw) + car.v * Math.cos(car.yaw);
  const frontVz = vz + car.r * 1.35 * Math.cos(car.yaw);
  assert.ok(frontVz < 0.1, `the front corner is still moving into the wall at ${frontVz}`);
  assert.ok(car.z + 1.35 * Math.sin(car.yaw) <= 8.3 - 0.95 + 0.01, 'still inside the wall');
  assert.ok(car.u < 10);
});

test('a car in the middle of the road is not touched by the walls', () => {
  resetAll();
  const spec = readCarSpec();
  const car = new Vehicle({ x: 0, z: 0, yaw: 0 });
  car.u = 10;
  collideWall(car, straightWorld, spec);
  assert.equal(car.u, 10);
  assert.equal(car.z, 0);
});

test('a pile-up of cars stays finite', () => {
  resetAll();
  const spec = readCarSpec();
  const cars = [0, 1, 2, 3].map((i) => new Vehicle({ x: i * 1.5, z: 6 + (i % 2) * 1.2, yaw: i * 0.3 }));
  cars.forEach((c, i) => {
    c.u = 15 + i;
  });
  for (let i = 0; i < 60; i++) resolveCollisions(cars, straightWorld, spec);
  for (const c of cars) {
    assert.ok(Number.isFinite(c.x + c.z + c.u + c.v + c.r));
    assert.ok(Math.abs(c.z) < 8.4, `car left the road at z=${c.z}`);
  }
});
