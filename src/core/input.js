// Tracks held keys and per-frame presses.
// Read presses in beforeFrame(), not in fixedUpdate(), because
// fixedUpdate can run zero times in a frame and would miss them.

const PREVENT_DEFAULT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Set();

    target.addEventListener('keydown', (e) => {
      if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });

    target.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });

    // Losing focus leaves keys stuck without this.
    target.addEventListener('blur', () => {
      this.down.clear();
      this.pressed.clear();
    });
  }

  isDown(code) {
    return this.down.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  // Call once per frame, after input has been read.
  endFrame() {
    this.pressed.clear();
  }
}