// Drift scoring, combo and boost meter. Pure logic: no DOM or Three.js imports.

const MIN_SPEED = 10; // m/s
const MIN_ANGLE = 0.17; // rad (about 10 degrees) of sideways slide to count as a drift
const MAX_ANGLE = 1.3;
const BANK_AFTER = 1; // s of drifting needed before points are kept
const IDLE_TO_BANK = 0.4; // s without drifting that ends a drift
const FILL_RATE = 0.12; // boost meter per second of drifting (about 8 s fills it)
const BOOST_SECONDS = 3; // a full meter lasts this long

export class StyleTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.meter = 0; // boost, 0..1
    this.boosting = false;
    this.driftPoints = 0;
    this.combo = 0; // seconds of the current drift
    this.multiplier = 1;
    this.idle = 0;
    this.total = 0;
    this.best = 0;
    this.popup = 0; // seconds left to show the last banked drift
    this.popupText = '';
  }

  // car: { u, v, wheelSlip }. crashed: the car hit something hard this step.
  update(dt, car, { boostHeld = false, crashed = false } = {}) {
    this.popup = Math.max(0, this.popup - dt);
    const speed = Math.hypot(car.u, car.v);
    const angle = Math.abs(Math.atan2(car.v, Math.max(car.u, 0.001)));
    const sliding = Math.max(...car.wheelSlip) > 1.0;

    if (crashed) {
      this.driftPoints = 0;
      this.combo = 0;
      this.multiplier = 1;
    } else if (car.u > 0 && speed > MIN_SPEED && sliding && angle > MIN_ANGLE && angle < MAX_ANGLE) {
      this.idle = 0;
      this.combo += dt;
      this.multiplier = Math.min(5, 1 + Math.floor(this.combo));
      this.driftPoints += dt * speed * angle * 8 * this.multiplier;
      this.meter = Math.min(1, this.meter + dt * FILL_RATE);
    } else if (this.driftPoints > 0) {
      this.idle += dt;
      if (this.idle > IDLE_TO_BANK) {
        if (this.combo >= BANK_AFTER) {
          const banked = Math.round(this.driftPoints);
          this.total += banked;
          this.best = Math.max(this.best, banked);
          this.popup = 2;
          this.popupText = `+${banked}`;
        }
        this.driftPoints = 0;
        this.combo = 0;
        this.multiplier = 1;
        this.idle = 0;
      }
    }

    this.boosting = boostHeld && this.meter > 0;
    if (this.boosting) this.meter = Math.max(0, this.meter - dt / BOOST_SECONDS);
  }
}
