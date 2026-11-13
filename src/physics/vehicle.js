// Planar four-wheel vehicle model. Pure logic: no DOM or Three.js imports.
//
// World: forward = (cos yaw, sin yaw) in the XZ plane, right = (-sin yaw, cos yaw).
// Body axes: u = forward speed, v = speed to the right, r = yaw rate (positive = turning right).
// Wheel order: 0 front-left, 1 front-right, 2 rear-left, 3 rear-right.
// Tunable values come from the registry through readCarSpec(), once per fixed step.

import { readCarSpec } from './spec.js';

const G = 9.81;
const AIR_DENSITY = 1.2;
const SUBSTEPS = 6;
const RPM_TO_RADS = (Math.PI * 2) / 60;
const RADS_TO_RPM = 60 / (Math.PI * 2);
export const YAW_GYRATION = 1.25; // m, yaw inertia = mass * gyration^2
const DOWNFORCE_FRONT_SHARE = 0.4;
const FLAT_GROUND = { groundHeight: () => 0 };

// Engine and gearbox
const IDLE_RPM = 1000;
const LAUNCH_RPM = 3500; // clutch slip rpm used for torque when starting from rest
const TORQUE_CURVE_REDLINE = 7500; // the unit torque curve below ends here; it is stretched to the real redline
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
const GEAR_RATIOS = [3.6, 2.3, 1.65, 1.25, 1.0, 0.82];
const REVERSE_RATIO = 3.4;
const DRIVE_EFFICIENCY = 0.92;
const DOWNSHIFT_RPM = 2800;
const SHIFT_TIME = 0.25; // s, torque cut during a shift

// Tires
const CURVE_C = 1.5;
const CURVE_B = Math.tan(Math.PI / (2 * CURVE_C)); // puts the force peak at normalized slip 1
const CURVE_SLOPE = CURVE_B * CURVE_C;
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
  return 0; // past the end of the curve
}

// Peak power of the unscaled curve, so the registry's engine power sets the real peak.
const UNIT_PEAK_POWER = (() => {
  let best = 0;
  for (let rpm = IDLE_RPM; rpm <= TORQUE_CURVE_REDLINE; rpm += 10) {
    best = Math.max(best, curveTorque(rpm) * rpm * RPM_TO_RADS);
  }
  return best;
})();

function totalRatio(gear, finalDrive) {
  return gear > 0 ? GEAR_RATIOS[gear - 1] * finalDrive : -REVERSE_RATIO * finalDrive;
}

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

function approach(current, target, up, down) {
  return target > current ? Math.min(target, current + up) : Math.max(target, current - down);
}

export class Vehicle {
  constructor({ x = 0, z = 0, yaw = 0, ground = FLAT_GROUND } = {}) {
    this.ground = ground; // anything with groundHeight(x, z); sample(x, z) adds surface grip
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.y = 0; // height of the car, from the ground under the wheels
    this.pitch = 0; // slope under the car in rad (positive = nose up)
    this.roll = 0; // cross slope under the car in rad (positive = right side lower)
    this.slope = 0; // sin(pitch), used for gravity along the road
    this.surfaceGrip = [1, 1, 1, 1]; // grip under each wheel: 1 on tarmac, less on grass
    this.surfaceDrag = 1; // rolling resistance multiplier
    this.wheelSlip = [0, 0, 0, 0]; // how hard each tire works: 1 is peak grip, above 1 is sliding
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

    this.recoveries = 0; // how many times the numbers blew up and the car was reset

    this._updateGround(readCarSpec());
    this.prev = {
      x,
      y: this.y,
      z,
      yaw,
      pitch: this.pitch,
      roll: this.roll,
      steer: 0,
      spin: [0, 0, 0, 0],
    };
  }

  // controls: { forward, back, left, right } booleans,
  // or { analog: true, throttle, brake, steer } with exact values (used by bots)
  step(dt, controls) {
    this._savePrev();
    const spec = readCarSpec();

    this._updateDriver(dt, controls, spec);
    this._updateGearbox(dt, spec);
    this._updateGround(spec);

    const sub = dt / SUBSTEPS;
    for (let i = 0; i < SUBSTEPS; i++) this._substep(sub, spec);
    for (let i = 0; i < 4; i++) this.wheelSpin[i] += this.wheelSpeed[i] * dt;

    if (!this._isFinite()) this._recover();
  }

  // Puts the car back on the ground at a position, standing still.
  reset(x, z, yaw) {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.u = 0;
    this.v = 0;
    this.r = 0;
    this.wheelSpeed.fill(0);
    this._fy.fill(0);
    this.wheelSlip.fill(0);
    this.throttle = 0;
    this.brake = 0;
    this.steerInput = 0;
    this.steer = 0;
    this.gear = 1;
    this.shiftTimer = 0;
    this.accelX = 0;
    this.accelY = 0;
    this._updateGround(readCarSpec());
    this._savePrev(); // no smearing between the old and new position when drawing
  }

  _savePrev() {
    const p = this.prev;
    p.x = this.x;
    p.z = this.z;
    p.yaw = this.yaw;
    p.y = this.y;
    p.pitch = this.pitch;
    p.roll = this.roll;
    p.steer = this.steer;
    for (let i = 0; i < 4; i++) p.spin[i] = this.wheelSpin[i];
  }

  // Height, pitch, roll and surface under the four wheels.
  _updateGround(spec) {
    const { cgToFront: a, cgToRear: b, track } = spec;
    const cosYaw = Math.cos(this.yaw);
    const sinYaw = Math.sin(this.yaw);
    const half = track / 2;
    // px is forward of the centre of gravity, py is to the right.
    const at = (px, py) => {
      const x = this.x + cosYaw * px - sinYaw * py;
      const z = this.z + sinYaw * px + cosYaw * py;
      return this.ground.sample
        ? this.ground.sample(x, z)
        : { height: this.ground.groundHeight(x, z), grip: 1, drag: 1 };
    };
    const wheels = [at(a, -half), at(a, half), at(-b, -half), at(-b, half)];
    const [fl, fr, rl, rr] = wheels.map((w) => w.height);

    wheels.forEach((w, i) => {
      this.surfaceGrip[i] = w.grip;
    });
    this.surfaceDrag = (wheels[0].drag + wheels[1].drag + wheels[2].drag + wheels[3].drag) / 4;

    const rise = (fl + fr) / 2 - (rl + rr) / 2;
    this.y = (fl + fr + rl + rr) / 4;
    this.pitch = Math.atan2(rise, a + b);
    this.slope = rise / Math.hypot(a + b, rise);
    this.roll = Math.atan2((fl + rl) / 2 - (fr + rr) / 2, track);
  }

  // Average speed of the driven wheels, weighted by the front/rear drive split.
  _driveSpeed(spec) {
    const w = this.wheelSpeed;
    return (1 - spec.frontBias) * ((w[2] + w[3]) / 2) + spec.frontBias * ((w[0] + w[1]) / 2);
  }

  _updateDriver(dt, c, spec) {
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
    if (c.analog) {
      // Bots give exact pedal and steering values instead of key presses.
      throttleTarget = clamp(c.throttle, 0, 1);
      brakeTarget = clamp(c.brake, 0, 1);
      if (this.gear < 0) this.gear = 1;
    }
    this.throttle = approach(this.throttle, throttleTarget, THROTTLE_UP * dt, THROTTLE_DOWN * dt);
    this.brake = approach(this.brake, brakeTarget, BRAKE_UP * dt, BRAKE_DOWN * dt);

    const steerTarget = c.analog ? clamp(c.steer, -1, 1) : (c.right ? 1 : 0) - (c.left ? 1 : 0);
    const rate = steerTarget === 0 ? STEER_RETURN : STEER_RATE;
    this.steerInput = approach(this.steerInput, steerTarget, rate * dt, rate * dt);
    this.steer = this.steerInput * (spec.maxSteer / (1 + (this.u / spec.steerSpeedRef) ** 2));
  }

  _updateGearbox(dt, spec) {
    if (this.shiftTimer > 0) this.shiftTimer = Math.max(0, this.shiftTimer - dt);
    if (this.gear < 1 || this.shiftTimer > 0) return;

    const rpm =
      Math.abs(this._driveSpeed(spec)) * totalRatio(this.gear, spec.finalDrive) * RADS_TO_RPM;
    if (rpm > spec.shiftRpm && this.gear < GEAR_RATIOS.length) {
      this.gear++;
      this.shiftTimer = SHIFT_TIME;
    } else if (this.gear > 1 && rpm < DOWNSHIFT_RPM) {
      const lowerRpm =
        (rpm * totalRatio(this.gear - 1, spec.finalDrive)) / totalRatio(this.gear, spec.finalDrive);
      if (lowerRpm < spec.downshiftMaxRpm) {
        this.gear--;
        this.shiftTimer = SHIFT_TIME;
      }
    }
  }

  // Largest torque a wheel can pass to the road without exceeding its grip,
  // after subtracting what the tire is already using for cornering.
  _capacity(i, limit, wheelRadius) {
    const grip = this._mu[i] * this.fz[i];
    if (grip < 1) return 0;
    const used = Math.min(1, this._fy[i] / grip);
    return limit * grip * wheelRadius * Math.max(0.2, Math.sqrt(1 - used * used));
  }

  _substep(dt, spec) {
    const {
      cgToFront: a,
      cgToRear: b,
      track,
      cgHeight: h,
      wheelRadius: R,
      wheelInertia: I,
      mass: m,
    } = spec;
    const L = a + b;
    const w = this.wheelSpeed;
    const fz = this.fz;
    const mu = this._mu;
    const u = this.u;
    const v = this.v;
    const r = this.r;

    // Wheel loads: static split, downforce, and longitudinal and lateral load transfer.
    // accelY > 0 means accelerating to the right, which loads the left wheels.
    const dLong = (m * this.accelX * h) / L;
    const dLat = (m * this.accelY * h) / track;
    const dLatF = dLat * spec.rollShareFront;
    const dLatR = dLat - dLatF;
    const downforce = 0.5 * AIR_DENSITY * spec.downforceArea * u * u;
    const downFront = downforce * DOWNFORCE_FRONT_SHARE;
    const wf = (m * G * b) / L + downFront;
    const wr = (m * G * a) / L + (downforce - downFront);
    fz[0] = Math.max(0, wf / 2 - dLong / 2 + dLatF);
    fz[1] = Math.max(0, wf / 2 - dLong / 2 - dLatF);
    fz[2] = Math.max(0, wr / 2 + dLong / 2 + dLatR);
    fz[3] = Math.max(0, wr / 2 + dLong / 2 - dLatR);

    const fzNom = (m * G) / 4;
    for (let i = 0; i < 4; i++) {
      mu[i] =
        spec.friction * this.surfaceGrip[i] * clamp(1 - spec.loadSensitivity * (fz[i] / fzNom - 1), 0.6, 1.2);
    }

    // Drivetrain: engine rpm follows the driven wheels, except while the clutch slips at launch.
    const wd = this._driveSpeed(spec);
    const ratio = totalRatio(this.gear, spec.finalDrive);
    const wheelRpm = Math.abs(wd * ratio) * RADS_TO_RPM;
    const rpm = Math.max(wheelRpm, IDLE_RPM + (LAUNCH_RPM - IDLE_RPM) * this.throttle);
    this.rpm = rpm;

    // The unit torque curve is stretched to the real redline; power scales with the stretch.
    const redlineScale = spec.redline / TORQUE_CURVE_REDLINE;
    const torqueScale = spec.enginePower / (UNIT_PEAK_POWER * redlineScale);
    let engineTorque = 0;
    if (this.shiftTimer <= 0 && rpm <= spec.redline) {
      engineTorque = this.throttle * curveTorque(rpm / redlineScale) * torqueScale;
    }
    const dragTorque =
      spec.engineBraking *
      torqueScale *
      (1 - this.throttle) *
      clamp((wheelRpm - 1100) / (spec.redline - 1100), 0, 1);
    const axleTorque =
      engineTorque * ratio * DRIVE_EFFICIENCY - Math.sign(wd) * dragTorque * Math.abs(ratio);

    // Open differential on each driven axle: equal torque, limited by the weaker wheel.
    const frontCap = Math.min(
      this._capacity(0, TRACTION_LIMIT, R),
      this._capacity(1, TRACTION_LIMIT, R)
    );
    const rearCap = Math.min(
      this._capacity(2, TRACTION_LIMIT, R),
      this._capacity(3, TRACTION_LIMIT, R)
    );
    const driveFront = clamp((axleTorque * spec.frontBias) / 2, -frontCap, frontCap);
    const driveRear = clamp((axleTorque * (1 - spec.frontBias)) / 2, -rearCap, rearCap);

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
      const nx = kappa / spec.peakSlipRatio;
      const ny = tanAlpha / spec.peakSlipTan;
      const slip = Math.hypot(nx, ny);
      this.wheelSlip[i] = slip;

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
      const drive = front ? driveFront : driveRear;
      const stiffness =
        (((mu[i] * fz[i] * CURVE_SLOPE) / spec.peakSlipRatio) * R * R) /
        (Math.max(Math.abs(vl), V_MIN_LONG) * I);
      let wn = w[i] + (dt * (drive - fxw * R)) / I / (1 + dt * stiffness);

      const brakeTorque = Math.min(
        this.brake * (front ? spec.frontBrakeTorque : spec.rearBrakeTorque),
        this._capacity(i, BRAKE_LIMIT, R)
      );
      const dw = (dt * brakeTorque) / I;
      wn = Math.abs(wn) <= dw ? 0 : wn - Math.sign(wn) * dw;
      w[i] = wn;
    }

    // Body: tire forces plus air and rolling resistance, and gravity along the slope.
    const aero = -0.5 * AIR_DENSITY * spec.dragArea * u * Math.abs(u);
    const rolling = -spec.rollingResistance * this.surfaceDrag * m * G * Math.tanh(u / 0.5);
    const fxBody = sumFx + aero + rolling;
    const gravity = -m * G * this.slope; // pulls the car back uphill and forward downhill
    const izz = m * YAW_GYRATION * YAW_GYRATION;

    this.u += ((fxBody + gravity) / m + r * v) * dt;
    this.v += (sumFy / m - r * u) * dt;
    this.r += (moment / izz) * dt;

    const cosYaw = Math.cos(this.yaw);
    const sinYaw = Math.sin(this.yaw);
    this.x += (this.u * cosYaw - this.v * sinYaw) * dt;
    this.z += (this.u * sinYaw + this.v * cosYaw) * dt;
    this.yaw += this.r * dt;

    const k = 1 - Math.exp(-dt / ACCEL_FILTER);
    this.accelX += (fxBody / m - this.accelX) * k;
    this.accelY += (sumFy / m - this.accelY) * k;
  }

  _isFinite() {
    const values = [this.x, this.z, this.yaw, this.u, this.v, this.r, ...this.wheelSpeed];
    return values.every(Number.isFinite);
  }

  // Safety net: if the numbers ever blow up, stop the car where it was.
  _recover() {
    this.recoveries++;
    this.x = this.prev.x;
    this.z = this.prev.z;
    this.yaw = this.prev.yaw;
    this.u = 0;
    this.v = 0;
    this.r = 0;
    this.wheelSpeed.fill(0);
    this._fy.fill(0);
    this.wheelSlip.fill(0);
    this.accelX = 0;
    this.accelY = 0;
    this.throttle = 0;
    this.brake = 0;
    this.shiftTimer = 0;
  }
}
