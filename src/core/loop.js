// Frame driver: beforeFrame -> fixed updates -> render.

export function runLoop({ stepper, beforeFrame, fixedUpdate, render }) {
  let last = performance.now();

  function frame(now) {
    const frameDt = (now - last) / 1000;
    last = now;

    beforeFrame?.(frameDt);
    const { steps, alpha } = stepper.update(frameDt);

    for (let i = 0; i < steps; i++) {
      fixedUpdate(stepper.step);
    }

    render(alpha, { steps, timeScale: stepper.timeScale });
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}