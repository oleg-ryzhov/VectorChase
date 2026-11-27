// Bot driver: aims at a point ahead on the racing line and plans its speed from upcoming corners.
// It reads the same car spec as the physics, so it adapts when the settings change.
// Pure logic: no DOM or Three.js imports.

import { HABITS, MISTAKES, pickWeighted } from './personalities.js';

const G = 9.81;
const LANE_RATE = 2.2; // m/s the bot may move sideways
const PASS_GAP = 3.4; // m beside the car being passed
const wrapS = (d, length) => (d > length / 2 ? d - length : d < -length / 2 ? d + length : d);

// grip: share of the tire's cornering limit the bot uses. brake: share of the braking limit.
// maxSpeed (m/s) keeps the bot where the car stays stable; above about 50 m/s the rear gets light.
export const DIFFICULTY = {
  easy: { grip: 0.42, brake: 0.4, maxSpeed: 38, shortcut: 0.03 },
  medium: { grip: 0.48, brake: 0.45, maxSpeed: 44, shortcut: 0.07 },
  hard: { grip: 0.47, brake: 0.45, maxSpeed: 48, shortcut: 0.12 },
};

const i0 = (index, d, spacing, n) => (index + Math.round(d / spacing)) % n;

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

export class BotDriver {
  // variation: about 0.95..1 per bot. laneOffset: metres to the right of the centre line.
  // speedScale: raises the top speed on maps where the car can safely go faster (banked ovals).
  // random: a function giving 0..1 (swap in a seeded one for tests).
  // personality: optional, from personalities.js. Without one the bot drives a plain, repeatable line.
  constructor({ difficulty = 'medium', variation = 1, laneOffset = 0, speedScale = 1, random = Math.random, personality = null } = {}) {
    const d = DIFFICULTY[difficulty] ?? DIFFICULTY.medium;
    const p = personality;
    this.personality = p;
    this.gripFactor = d.grip * variation * (p?.pace.grip ?? 1);
    this.brakeFactor = d.brake * variation * (p?.pace.brake ?? 1);
    this.baseLane = laneOffset;
    this.lane = laneOffset; // where the bot is steering to, metres to the right of the centre line
    this.corner = null; // { apexS, dir, habit, mistake }
    this.confidence = 1;
    this.elapsed = 0;
    this.reaction = p ? p.reaction[0] + (p.reaction[1] - p.reaction[0]) * random() : 0;
    this.pass = null; // { lane, until }
    this.decideAt = 0;
    this.maxSpeed = d.maxSpeed * speedScale;
    this.laneOffset = laneOffset;
    this.random = random;
    this.shortcutChance = d.shortcut * (p?.shortcut ?? 1);
    this.rolled = {}; // shortcut index -> lap it was last decided on
    this.attempt = null; // { k, speed, flew }
  }

  // Forget any shortcut in progress (after a respawn, say).
  abort() {
    this.attempt = null;
    this.pass = null;
    this.corner = null;
    this.lane = this.baseLane;
  }

  // Returns the shortcut the bot is trying now, if any. Each lap a bot decides once, with a small chance,
  // whether to try each shortcut; it then commits to a run-up speed that may or may not be enough.
  _shortcut(car, tracker) {
    const list = tracker.track.shortcuts ?? [];
    const a = this.attempt;
    if (a) {
      const s = list[a.k];
      if (car.airborne) a.flew = true;
      const done = (a.flew && !car.airborne) || tracker.s > s.fromS + s.armAfter + 40 || tracker.s < s.fromS - s.armBefore - 40;
      if (!done) return a;
      this.attempt = null;
    }
    for (let k = 0; k < list.length; k++) {
      const s = list[k];
      const ahead = s.fromS - tracker.s;
      if (!s.bot || ahead > 140 || ahead < 15 || this.rolled[k] === tracker.lap) continue;
      this.rolled[k] = tracker.lap;
      if (s.bot.speed <= this.maxSpeed && this.random() < this.shortcutChance) {
        this.attempt = { k, flew: false, speed: Math.min(this.maxSpeed, s.bot.speed * (0.9 + 0.22 * this.random())) };
        return this.attempt;
      }
    }
    return null;
  }

  // Straight at the jump with a fixed run-up speed.
  _driveShortcut(car, spec, tracker, a) {
    const { aim } = tracker.track.shortcuts[a.k].bot;
    const speed = Math.max(car.u, 0);
    const steer = this._steerToward(car, spec, aim[0], aim[1], speed);
    const error = a.speed - speed;
    return { analog: true, throttle: error > 0 ? clamp(error / 2, 0, 1) : 0, brake: error < -3 ? clamp((-error - 3) / 4, 0, 1) : 0, steer };
  }

  _steerToward(car, spec, tx, tz, speed) {
    const dx = tx - car.x;
    const dz = tz - car.z;
    const ahead = dx * Math.cos(car.yaw) + dz * Math.sin(car.yaw);
    const right = -dx * Math.sin(car.yaw) + dz * Math.cos(car.yaw);
    const alpha = Math.atan2(right, ahead);
    const pursuit = Math.atan((2 * spec.wheelbase * Math.sin(alpha)) / Math.max(Math.hypot(dx, dz), 1));
    const slide = speed > 5 ? Math.atan2(car.v, speed) : 0;
    return clamp((pursuit + slide) / (spec.maxSteer / (1 + (car.u / spec.steerSpeedRef) ** 2)), -1, 1);
  }

  // Finds the next corner ahead and, once per corner, rolls the habit (and maybe a slip-up) for it.
  _scanCorner(tracker) {
    const { points, spacing, length } = tracker.track;
    const n = points.length;
    const c = this.corner;
    if (c && wrapS(c.apexS - tracker.s, length) > -15) return;
    for (let d = 0; d <= 160; d += 2 * spacing) {
      const q = points[(tracker.index + Math.round(d / spacing)) % n];
      if (Math.abs(q.curvature) <= 0.006) continue;
      let best = q;
      for (let e = d; e <= d + 120; e += 2 * spacing) {
        const r = points[(tracker.index + Math.round(e / spacing)) % n];
        if (Math.abs(r.curvature) < 0.003) break;
        if (Math.abs(r.curvature) > Math.abs(best.curvature)) best = r;
      }
      if (c && Math.abs(wrapS(best.s - c.apexS, length)) < 40) return; // the tail of the corner just taken
      const p = this.personality;
      const habit = pickWeighted(this.random, p.habits);
      const slip = this.random() < p.mistake * (2 - this.confidence);
      this.corner = { apexS: best.s, dir: Math.sign(best.curvature), tight: clamp((Math.abs(best.curvature) - 0.004) / 0.012, 0.2, 1), habit, fx: HABITS[habit], mistake: slip ? pickWeighted(this.random, MISTAKES) : null };
      return;
    }
  }

  // The nearest car ahead in this car's lane, or null: { ahead, right, u }.
  _carAhead(car, traffic) {
    const cos = Math.cos(car.yaw);
    const sin = Math.sin(car.yaw);
    let best = null;
    for (const o of traffic) {
      if (o === car || o.airborne) continue;
      const dx = o.x - car.x;
      const dz = o.z - car.z;
      const ahead = dx * cos + dz * sin;
      const right = -dx * sin + dz * cos;
      if (ahead > 1 && ahead < 70 && Math.abs(right) < 3.2 && (!best || ahead < best.ahead)) best = { ahead, right, u: o.u };
    }
    return best;
  }

  // Where the bot wants to be across the road: its habit's line through the corner, or round a car it is passing.
  _desiredLane(tracker, room) {
    let lane = this.baseLane;
    const c = this.corner;
    if (c) {
      const d = wrapS(c.apexS - tracker.s, tracker.track.length);
      // Fast, wide bends leave little room to play with, so the swing shrinks with the corner's tightness.
      const swing = room * c.tight;
      if (d < 130) {
        if (d > 20) lane = -c.dir * swing * c.fx.entry;
        else if (d > -8) lane = c.dir * swing * c.fx.apex;
        else if (d > -60) lane = -c.dir * swing * c.fx.exit; // drift out on the exit, then back to its own lane
      }
    }
    if (this.pass) lane = this.pass.lane;
    return Math.max(-room, Math.min(room, lane));
  }

  // car: Vehicle, tracker: TrackTracker, spec: readCarSpec(). Returns analog controls.
  // ctx (optional): { dt, traffic: [cars] }. Traffic lets a bot with a personality follow, draft and overtake.
  drive(car, tracker, spec, ctx = {}) {
    const { points, spacing } = tracker.track;
    const n = points.length;
    const speed = Math.max(car.u, 0);
    const dt = ctx.dt ?? 1 / 60;
    const p = this.personality;
    this.elapsed += dt;
    if (p && speed < 2 && this.elapsed < this.reaction) return { analog: true, throttle: 0, brake: 0, steer: 0 };
    const attempt = this._shortcut(car, tracker);
    if (attempt) return this._driveShortcut(car, spec, tracker, attempt);

    const brakeCapacity =
      (2 * (spec.frontBrakeTorque + spec.rearBrakeTorque)) / spec.wheelRadius / spec.mass;
    let gripMult = this.confidence;
    let brakeMult = 1;
    let speedMult = 1;
    let want = this.baseLane; // the lane to steer to
    let cap = Infinity; // top speed set by the car ahead
    if (p) {
      this._scanCorner(tracker);
      const c = this.corner;
      if (c) {
        brakeMult = c.fx.brake * (c.mistake === 'lockup' ? 0.6 : 1);
        gripMult *= c.fx.grip * (c.mistake === 'overcook' ? 1.12 : 1);
        if (c.mistake === 'dawdle') speedMult = 0.88;
      }
      const room = tracker.track.width / 2 - 2.6;
      const here = points[tracker.index];
      const lat = (car.x - here.x) * here.nx + (car.z - here.z) * here.nz;
      let drafting = false;
      const other = ctx.traffic ? this._carAhead(car, ctx.traffic) : null;
      if (this.pass && this.elapsed > this.pass.until) this.pass = null;
      if (other) {
        const straight = Math.abs(here.curvature) < 0.004;
        if (!this.pass && straight && this.elapsed >= this.decideAt) {
          const closing = speed - other.u;
          const chance = p.aggression * 0.7 + (1 - p.patience) * 0.3 + (p.draft * (other.ahead < 16 ? 0.4 : 0));
          this.decideAt = this.elapsed + 1.5;
          if (closing > -2 && this.random() < chance) {
            const theirs = lat + other.right;
            let side = theirs > 0 ? -1 : 1;
            if (Math.abs(theirs + side * PASS_GAP) > room) side = -side;
            this.pass = { lane: theirs + side * PASS_GAP, until: this.elapsed + 3.5 };
          }
        }
        if (!this.pass) {
          // Following: keep a gap, and a drafting bot tucks into the wake.
          // The speed from which it can still brake down to the other car's speed, 9 m short of it.
          const decel = 0.8 * Math.min(this.brakeFactor * spec.friction * G, brakeCapacity * 0.9);
          cap = other.u + Math.sqrt(2 * decel * Math.max(0, other.ahead - 9)) + 0.5;
          drafting = p.draft > 0.3 && straight && other.ahead < 30;
        } else if (other.ahead < 8 && Math.abs(other.right) < 2.2) cap = other.u;
      }
      want = drafting ? clamp(lat + other.right, -room, room) : this._desiredLane(tracker, room);
      const step = LANE_RATE * dt;
      this.lane += clamp(want - this.lane, -step, step);
      const slip = Math.max(car.wheelSlip[0], car.wheelSlip[1], car.wheelSlip[2], car.wheelSlip[3]);
      this.confidence = slip > 1.3 ? Math.max(0.9, this.confidence - 0.02) : Math.min(1.04, this.confidence + 0.01 * dt);
    }

    // Steering: pure pursuit towards a point ahead on the line.
    const lookAhead = clamp(8 + 0.5 * speed, 10, 40);
    const aim = points[(tracker.index + Math.round(lookAhead / spacing)) % n];
    const dx = aim.x + aim.nx * this.lane - car.x;
    const dz = aim.z + aim.nz * this.lane - car.z;
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
    const brakeAccel = Math.min(this.brakeFactor * brakeMult * spec.friction * G, brakeCapacity * 0.9);
    const horizon = Math.min(300, (speed * speed) / (2 * brakeAccel) + 40);
    let target = this.maxSpeed;
    for (let d = 0; d <= horizon; d += 2 * spacing) {
      const q = points[(tracker.index + Math.round(d / spacing)) % n];
      // A banked turn adds to the grip: v^2 = R g (tan b + mu) / (1 - mu tan b).
      const mu = this.gripFactor * gripMult * spec.friction;
      const tanBank = Math.tan(Math.max(-0.5, Math.min(0.7, q.bank * Math.sign(q.curvature))));
      const lean = Math.max(0.05, (tanBank + mu) / Math.max(0.05, 1 - mu * tanBank));
      let cornerSpeed = Math.min(this.maxSpeed, Math.sqrt((lean * G) / Math.max(Math.abs(q.curvature), 1e-4)));
      // Crests unload the tires: stay under the speed where the car would leave the road.
      const crest = (points[(i0(tracker.index, d, spacing, n) + 1) % n].grade - points[(i0(tracker.index, d, spacing, n) - 1 + n) % n].grade) / (2 * spacing);
      if (crest < -1e-4) cornerSpeed = Math.min(cornerSpeed, Math.sqrt((0.6 * G) / -crest));
      target = Math.min(target, Math.sqrt(cornerSpeed * cornerSpeed + 2 * brakeAccel * d));
    }
    target = Math.min(target * speedMult, cap);

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
