// Fixed-timestep accumulator with a time scale.
// Pure logic, no DOM or Three.js imports.

export class FixedStepper {
  constructor(step = 1 / 120, maxSubsteps = 8) {
    this.step = step;
    this.maxSubsteps = maxSubsteps;
    this.accumulator = 0;
    this.timeScale = 1;
  }

  // frameDt is in seconds. Large gaps (tab switches) are clamped so the
  // simulation does not try to catch up on minutes of time.
  update(frameDt) {
    const clampedDt = Math.min(Math.max(frameDt, 0), 0.25);
    this.accumulator += clampedDt * Math.max(this.timeScale, 0);

    let steps = 0;
    while (this.accumulator >= this.step && steps < this.maxSubsteps) {
      this.accumulator -= this.step;
      steps++;
    }
    if (steps === this.maxSubsteps) {
      // Hit the cap: drop the backlog instead of spiraling.
      this.accumulator = 0;
    }

    return { steps, alpha: this.accumulator / this.step };
  }
}