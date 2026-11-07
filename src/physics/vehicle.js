// Planar four-wheel vehicle model. Pure logic: no DOM or Three.js imports.
//
// World: forward = (cos yaw, sin yaw) in the XZ plane, right = (-sin yaw, cos yaw).
// Body axes: u = forward speed, v = speed to the right, r = yaw rate (positive = turning right).
// Wheel order: 0 front-left, 1 front-right, 2 rear-left, 3 rear-right. Rear-wheel drive.

import { getParam } from '../config/registry.js';

const G = 9.81;
const AIR_DENSITY = 1.2;
const SUBSTEPS = 6;
const RPM_TO_RADS = (Math.PI * 2) / 60;
const RADS_TO_RPM = 60 / (Math.PI * 2);

export const CAR = {
  cgToFront: 1.3, // m, centre of gravity to front axle
  cgToRear: 1.4, // m, centre of gravity to rear axle
  track: 1.6, // m, distance between left and right wheels
  cgHeight: 0.5, // m
  wheelRadius: 0.33, // m (0.66 m diameter)
  wheelInertia: 1.4, // kg*m^2 per wheel, including tire and brake disc
  yawGyration: 1.25, // m, yaw inertia = mass * gyration^2
  dragArea: 0.64, // Cd * frontal area, m^2
  rollingResistance: 0.013,
  rollShareFront: 0.55, // share of lateral load transfer taken by the front axle
  frontBrakeTorque: 1500, // N*m per wheel
  rearBrakeTorque: 800, // N*m per wheel
};

// Engine and gearbox
const IDLE_RPM = 1000;
const REDLINE_RPM = 7500;
const LAUNCH_RPM = 3500; // clutch slip rpm used for torque when starting from rest
const TORQUE_CURVE = [
  [1000, 0.7],
  [2000, 0.82],
  [3000, 0.92],
  [4000, 1.0],
  [5000, 1.0],
  [6000, 0.95],
  [7000, 0.82],
  [7500, 0.7],
];
const ENGINE_BRAKING = 0.15; // fraction of peak torque at redline when off the throttle
const GEAR_RATIOS = [3.6, 2.3, 1.65, 1.25, 1.0, 0.82];
const REVERSE_RATIO = 3.4;
const FINAL_DRIVE = 3.7;
const DRIVE_EFFICIENCY = 0.92;
const UPSHIFT_RPM = 6800;
const DOWNSHIFT_RPM = 2800;
const DOWNSHIFT_MAX_RPM = 6200;
const SHIFT_TIME = 0.25; // s, torque cut during a shift

// Tires
const PEAK_SLIP_RATIO = 0.12;
const PEAK_SLIP_TAN = 0.14; // tan of the peak slip angle (about 8 degrees)
const CURVE_C = 1.5;
const CURVE_B = Math.tan(Math.PI / (2 * CURVE_C)); // puts the force peak at normalized slip 1
const CURVE_SLOPE = CURVE_B * CURVE_C;
const LOAD_SENSITIVITY = 0.1;
const V_MIN_LONG = 3; // m/s, lowest speed used when computing slip ratio
const V_MIN_LAT = 2; // m/s, lowest speed used when computing slip angle
const TRACTION_LIMIT = 0.92; // drive torque cap as a fraction of peak grip
const BRAKE_LIMIT = 0.97; // brake torque cap as a fraction of peak grip

// Driver input smoothing
const THROTTLE_UP = 3;
const THROTTLE_DOWN = 6;
const BRAKE_UP = 8;
const BRAKE_DOWN = 12;
const STEER_RATE = 3.5;
const STEER_RETURN = 5;
const MAX_STEER = 0.55; // rad at standstill
const STEER_SPEED_REF = 14; // m/s, steering lock halves around this speed
const ACCEL_FILTER = 0.06; // s, suspension-like smoothing of body accelerations

function curveTorque(rpm) {
  if (rpm <= TORQUE_CURVE[0][0]) return TORQUE_CURVE[0][1];
  for (let i = 1; i < TORQUE_CURVE.length; i++) {
    const [r1, t1] = TORQUE_CURVE[i];
    if (rpm <= r1) {
      const [r0, t0] = TORQUE_CURVE[i - 1];
      return t0 + ((t1 - t0) * (rpm - r0)) / (r1 - r0);
    }
  }
  return 0; // past redline
}

// Peak power of the unscaled curve, so the registry's engine power sets the real peak.
const UNIT_PEAK_POWER = (() => {
  let best = 0;
  for (let rpm = IDLE_RPM; rpm <= REDLINE_RPM; rpm += 10) {
    best = Math.max(best, curveTorque(rpm) * rpm * RPM_TO_RADS);
  }
  return best;
})();

function totalRatio(gear) {
  return gear > 0 ? GEAR_RATIOS[gear - 1] * FINAL_DRIVE : -REVERSE_RATIO * FINAL_DRIVE;
}

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

function approach(current, target, up, down) {
  return target > current ? Math.min(target, current + up) : Math.max(target, current - down);
}

export class Vehicle {
  constructor({ x = 0, z = 0, yaw = 0 } = {}) {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.u = 0;
    this.v = 0;
    this.r = 0;

    this.wheelSpeed = [0, 0, 0, 0]; // rad/s, positive = rolling forward
    this.wheelSpin = [0, 0, 0, 0]; // accumulated angle in rad, for rendering

    this.throttle = 0;
    this.brake = 0;
    this.steerInput = 0;
    this.steer = 0; // front wheel angle in rad, positive = right
    this.gear = 1; // 1..6, or -1 for reverse
    this.shiftTimer = 0;
    this.rpm = IDLE_RPM;

    this.accelX = 0; // filtered body accelerations in m/s^2
    this.accelY = 0;
    this.fz = [0, 0, 0, 0];
    this._mu = [0, 0, 0, 0];
    this._fy = [0, 0, 0, 0];

    this.prev = { x, z, yaw, steer: 0, spin: [0, 0, 0, 0] };
  }

  // controls: { forward, back, left, right } booleans
  step(dt, controls) {
    this._savePrev();
    const m = getParam('chassis.mass');
    const mu0 = getParam('tire.friction');
    const enginePower = getParam('engine.power') * 1000;

    this._updateDriver(dt, controls);
    this._updateGearbox(dt);

    const sub = dt / SUBSTEPS;
    for (let i = 0; i < SUBSTEPS; i++) this._substep(sub, m, mu0, enginePower);
    for (let i = 0; i < 4; i++) this.wheelSpin[i] += this.wheelSpeed[i] * dt;

    if (!this._isFinite()) this._recover();
  }

  _savePrev() {
    const p = this.prev;
    p.x = this.x;
    p.z = this.z;
    p.yaw = this.yaw;
    p.steer = this.steer;
    for (let i = 0; i < 4; i++) p.spin[i] = this.wheelSpin[i];
  }

  _updateDriver(dt, c) {
    let throttleTarget = 0;
    let brakeTarget = 0;
    if (c.forward && c.back) {
      brakeTarget = 1;
    } else if (c.forward) {
      if (this.u < -1) {
        brakeTarget = 1; // still rolling backwards: brake first
      } else {
        throttleTarget = 1;
        if (this.gear < 0) this.gear = 1;
      }
    } else if (c.back) {
      if (this.u > 1) {
        brakeTarget = 1; // still rolling forwards: brake first
      } else {
        throttleTarget = 1;
        if (this.gear > 0) this.gear = -1;
      }
    }
    this.throttle = approach(this.throttle, throttleTarget, THROTTLE_UP * dt, THROTTLE_DOWN * dt);
    this.brake = approach(this.brake, brakeTarget, BRAKE_UP * dt, BRAKE_DOWN * dt);

    const steerTarget = (c.right ? 1 : 0) - (c.left ? 1 : 0);
    const rate = steerTarget === 0 ? STEER_RETURN : STEER_RATE;
    this.steerInput = approach(this.steerInput, steerTarget, rate * dt, rate * dt);
    this.steer = this.steerInput * (MAX_STEER / (1 + (this.u / STEER_SPEED_REF) ** 2));
  }

  _updateGearbox(dt) {
    if (this.shiftTimer > 0) this.shiftTimer = Math.max(0, this.shiftTimer - dt);
    if (this.gear < 1 || this.shiftTimer > 0) return;

    const wd = (this.wheelSpeed[2] + this.wheelSpeed[3]) / 2;
    const rpm = Math.abs(wd) * totalRatio(this.gear) * RADS_TO_RPM;
    if (rpm > UPSHIFT_RPM && this.gear < GEAR_RATIOS.length) {
      this.gear++;
      this.shiftTimer = SHIFT_TIME;
    } else if (this.gear > 1 && rpm < DOWNSHIFT_RPM) {
      const lowerRpm = (rpm * totalRatio(this.gear - 1)) / totalRatio(this.gear);
      if (lowerRpm < DOWNSHIFT_MAX_RPM) {
        this.gear--;
        this.shiftTimer = SHIFT_TIME;
      }
    }
  }

  // Largest torque a wheel can pass to the road without exceeding its grip,
  // after subtracting what the tire is already using for cornering.
  _capacity(i, limit) {
    const grip = this._mu[i] * this.fz[i];
    if (grip < 1) return 0;
    const used = Math.min(1, this._fy[i] / grip);
    return limit * grip * CAR.wheelRadius * Math.max(0.2, Math.sqrt(1 - used * used));
  }

  _substep(dt, m, mu0, enginePower) {
    const { cgToFront: a, cgToRear: b, track, cgHeight: h, wheelRadius: R, wheelInertia: I } = CAR;
    const L = a + b;
    const w = this.wheelSpeed;
    const fz = this.fz;
    const mu = this._mu;

    // Wheel loads: static split plus longitudinal and lateral load transfer.
    // accelY > 0 means accelerating to the right, which loads the left wheels.
    const dLong = (m * this.accelX * h) / L;
    const dLat = (m * this.accelY * h) / track;
    const dLatF = dLat * CAR.rollShareFront;
    const dLatR = dLat - dLatF;
    const wf = (m * G * b) / L;
    const wr = (m * G * a) / L;
    fz[0] = Math.max(0, wf / 2 - dLong / 2 + dLatF);
    fz[1] = Math.max(0, wf / 2 - dLong / 2 - dLatF);
    fz[2] = Math.max(0, wr / 2 + dLong / 2 + dLatR);
    fz[3] = Math.max(0, wr / 2 + dLong / 2 - dLatR);

    const fzNom = (m * G) / 4;
    for (let i = 0; i < 4; i++) {
      mu[i] = mu0 * clamp(1 - LOAD_SENSITIVITY * (fz[i] / fzNom - 1), 0.6, 1.2);
    }

    // Drivetrain: engine rpm follows the rear wheels, except while the clutch slips at launch.
    const wd = (w[2] + w[3]) / 2;
    const ratio = totalRatio(this.gear);
    const wheelRpm = Math.abs(wd * ratio) * RADS_TO_RPM;
    const rpm = Math.max(wheelRpm, IDLE_RPM + (LAUNCH_RPM - IDLE_RPM) * this.throttle);
    this.rpm = rpm;

    const torqueScale = enginePower / UNIT_PEAK_POWER;
    let engineTorque = 0;
    if (this.shiftTimer <= 0 && rpm <= REDLINE_RPM) {
      engineTorque = this.throttle * curveTorque(rpm) * torqueScale;
    }
    const dragTorque =
      ENGINE_BRAKING *
      torqueScale *
      (1 - this.throttle) *
      clamp((wheelRpm - 1100) / (REDLINE_RPM - 1100), 0, 1);
    const axleTorque =
      engineTorque * ratio * DRIVE_EFFICIENCY - Math.sign(wd) * dragTorque * Math.abs(ratio);

    // Open differential: both wheels get equal torque, limited by the weaker wheel.
    const driveCap = Math.min(this._capacity(2, TRACTION_LIMIT), this._capacity(3, TRACTION_LIMIT));
    const driveEach = clamp(axleTorque / 2, -driveCap, driveCap);

    const u = this.u;
    const v = this.v;
    const r = this.r;
    const cosSteer = Math.cos(this.steer);
    const sinSteer = Math.sin(this.steer);
    let sumFx = 0;
    let sumFy = 0;
    let moment = 0;

    for (let i = 0; i < 4; i++) {
      const front = i < 2;
      const px = front ? a : -b;
      const py = i % 2 === 0 ? -track / 2 : track / 2;
      const c = front ? cosSteer : 1;
      const s = front ? sinSteer : 0;

      // Contact patch velocity in the wheel's own frame.
      const vx = u - r * py;
      const vy = v + r * px;
      const vl = vx * c + vy * s;
      const vt = -vx * s + vy * c;

      const kappa = (w[i] * R - vl) / Math.max(Math.abs(vl), V_MIN_LONG);
      const tanAlpha = vt / Math.max(Math.abs(vl), V_MIN_LAT);
      const nx = kappa / PEAK_SLIP_RATIO;
      const ny = tanAlpha / PEAK_SLIP_TAN;
      const slip = Math.hypot(nx, ny);

      let fxw = 0;
      let fyw = 0;
      if (slip > 1e-9) {
        const mag = mu[i] * fz[i] * Math.sin(CURVE_C * Math.atan(CURVE_B * slip));
        fxw = (mag * nx) / slip;
        fyw = (-mag * ny) / slip;
      }
      this._fy[i] = Math.abs(fyw);

      const fbx = fxw * c - fyw * s;
      const fby = fxw * s + fyw * c;
      sumFx += fbx;
      sumFy += fby;
      moment += px * fby - py * fbx;

      // Wheel spin: drive torque minus the road's reaction, then brakes.
      // The reaction is stiff at low speed, so the update is damped by its linear stiffness.
      const drive = front ? 0 : driveEach;
      const stiffness =
        (((mu[i] * fz[i] * CURVE_SLOPE) / PEAK_SLIP_RATIO) * R * R) /
        (Math.max(Math.abs(vl), V_MIN_LONG) * I);
      let wn = w[i] + (dt * (drive - fxw * R)) / I / (1 + dt * stiffness);

      const brakeTorque = Math.min(
        this.brake * (front ? CAR.frontBrakeTorque : CAR.rearBrakeTorque),
        this._capacity(i, BRAKE_LIMIT)
      );
      const dw = (dt * brakeTorque) / I;
      wn = Math.abs(wn) <= dw ? 0 : wn - Math.sign(wn) * dw;
      w[i] = wn;
    }

    // Body: tire forces plus air and rolling resistance.
    const aero = -0.5 * AIR_DENSITY * CAR.dragArea * u * Math.abs(u);
    const rolling = -CAR.rollingResistance * m * G * Math.tanh(u / 0.5);
    const fxTotal = sumFx + aero + rolling;
    const izz = m * CAR.yawGyration * CAR.yawGyration;

    this.u += (fxTotal / m + r * v) * dt;
    this.v += (sumFy / m - r * u) * dt;
    this.r += (moment / izz) * dt;

    const cosYaw = Math.cos(this.yaw);
    const sinYaw = Math.sin(this.yaw);
    this.x += (this.u * cosYaw - this.v * sinYaw) * dt;
    this.z += (this.u * sinYaw + this.v * cosYaw) * dt;
    this.yaw += this.r * dt;

    const k = 1 - Math.exp(-dt / ACCEL_FILTER);
    this.accelX += (fxTotal / m - this.accelX) * k;
    this.accelY += (sumFy / m - this.accelY) * k;
  }

  _isFinite() {
    const values = [this.x, this.z, this.yaw, this.u, this.v, this.r, ...this.wheelSpeed];
    return values.every(Number.isFinite);
  }

  // Safety net: if the numbers ever blow up, stop the car where it was.
  _recover() {
    this.x = this.prev.x;
    this.z = this.prev.z;
    this.yaw = this.prev.yaw;
    this.u = 0;
    this.v = 0;
    this.r = 0;
    this.wheelSpeed.fill(0);
    this._fy.fill(0);
    this.accelX = 0;
    this.accelY = 0;
    this.throttle = 0;
    this.brake = 0;
    this.shiftTimer = 0;
  }
}