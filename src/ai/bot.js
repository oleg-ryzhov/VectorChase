// Bot driver: aims at a point ahead on the racing line and plans its speed from upcoming corners.
// It reads the same car spec as the physics, so it adapts when the settings change.
// Pure logic: no DOM or Three.js imports.

const G = 9.81;

// grip: share of the tire's cornering limit the bot uses. brake: share of the braking limit.
// maxSpeed (m/s) keeps the bot where the car stays stable; above about 50 m/s the rear gets light.
export const DIFFICULTY = {
  easy: { grip: 0.42, brake: 0.4, maxSpeed: 38 },
  medium: { grip: 0.48, brake: 0.45, maxSpeed: 44 },
  hard: { grip: 0.5, brake: 0.45, maxSpeed: 48 },
};

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

export class BotDriver {
  // variation: about 0.95..1 per bot. laneOffset: metres to the right of the centre line.
  constructor({ difficulty = 'medium', variation = 1, laneOffset = 0 } = {}) {
    const d = DIFFICULTY[difficulty] ?? DIFFICULTY.medium;
    this.gripFactor = d.grip * variation;
    this.brakeFactor = d.brake * variation;
    this.maxSpeed = d.maxSpeed;
    this.laneOffset = laneOffset;
  }

  // car: Vehicle, tracker: TrackTracker, spec: readCarSpec(). Returns analog controls.
  drive(car, tracker, spec) {
    const { points, spacing } = tracker.track;
    const n = points.length;
    const speed = Math.max(car.u, 0);

    // Steering: pure pursuit towards a point ahead on the line.
    const lookAhead = clamp(8 + 0.5 * speed, 10, 40);
    const aim = points[(tracker.index + Math.round(lookAhead / spacing)) % n];
    const dx = aim.x + aim.nx * this.laneOffset - car.x;
    const dz = aim.z + aim.nz * this.laneOffset - car.z;
    const cosYaw = Math.cos(car.yaw);
    const sinYaw = Math.sin(car.yaw);
    const ahead = dx * cosYaw + dz * sinYaw;
    const right = -dx * sinYaw + dz * cosYaw;
    const alpha = Math.atan2(right, ahead);
    const distance = Math.max(Math.hypot(dx, dz), 1);
    const pursuitAngle = Math.atan((2 * spec.wheelbase * Math.sin(alpha)) / distance);
    // Countersteer: when the car slides, point the front wheels along the direction it is travelling.
    const slideAngle = speed > 5 ? Math.atan2(car.v, speed) : 0;
    const wheelAngle = pursuitAngle + slideAngle;
    const steerLimit = spec.maxSteer / (1 + (car.u / spec.steerSpeedRef) ** 2);
    const steer = clamp(wheelAngle / steerLimit, -1, 1);

    // Speed: the fastest speed from which every upcoming corner can still be taken.
    const cornerAccel = this.gripFactor * spec.friction * G;
    const brakeCapacity =
      (2 * (spec.frontBrakeTorque + spec.rearBrakeTorque)) / spec.wheelRadius / spec.mass;
    const brakeAccel = Math.min(this.brakeFactor * spec.friction * G, brakeCapacity * 0.9);
    const horizon = Math.min(300, (speed * speed) / (2 * brakeAccel) + 40);
    let target = this.maxSpeed;
    for (let d = 0; d <= horizon; d += 2 * spacing) {
      const p = points[(tracker.index + Math.round(d / spacing)) % n];
      const cornerSpeed = Math.min(this.maxSpeed, Math.sqrt(cornerAccel / Math.max(Math.abs(p.curvature), 1e-4)));
      target = Math.min(target, Math.sqrt(cornerSpeed * cornerSpeed + 2 * brakeAccel * d));
    }

    const error = target - speed;
    let throttle = 0;
    let brake = 0;
    if (error > 0) throttle = clamp(error / 3, 0, 1);
    else if (error < -1) brake = clamp((-error - 1) / 4, 0, 1);

    // Lift off the throttle while any tire is sliding, so the car can settle.
    const w = car.wheelSlip;
    if (Math.max(w[0], w[1], w[2], w[3]) > 1.05) throttle = 0;

    return { analog: true, throttle, brake, steer };
  }
}
