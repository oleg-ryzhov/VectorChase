// Free-look offsets applied on top of the chase camera, driven by holding the mouse button and dragging.
// All values are offsets from the chase pose, so free look starts exactly where the chase camera is.
// Pure logic: no DOM or Three.js imports.

const INVERT_X = false; // true makes dragging right orbit the camera right instead of left
const INVERT_Y = false; // true makes dragging down lower the camera instead of raising it
const MIN_PITCH = -0.1; // rad, lowest total camera pitch
const MAX_PITCH = 1.4; // rad, highest total camera pitch
const MIN_OFFSET = -0.35; // limits on the pitch offset, so no drag is wasted past the total limits above
const MAX_OFFSET = 1.15;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

export class FreeLook {
  constructor() {
    this.yaw = 0; // rad around the car; 0 = the chase camera's own position
    this.pitch = 0; // rad added to the chase camera's pitch
    this.zoomScale = 1; // multiplier on the chase camera's distance
    this.active = false; // the button is held
    this.engaged = false; // active, or still easing back to the chase camera
  }

  start() {
    this.active = true;
    this.engaged = true;
  }

  end() {
    this.active = false;
    // Take the short way back after several turns.
    this.yaw = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));
  }

  // Dragging right moves the camera left around the car, so the scene appears to follow the mouse.
  drag(dx, dy) {
    if (!this.active) return;
    this.yaw += dx * 0.006 * (INVERT_X ? -1 : 1);
    this.pitch = Math.min(MAX_OFFSET, Math.max(MIN_OFFSET, this.pitch + dy * 0.005 * (INVERT_Y ? -1 : 1)));
  }

  zoom(amount) {
    if (!this.engaged) return;
    this.zoomScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoomScale * Math.exp(amount * 0.001)));
  }

  // Eases back to the chase camera after the button is released.
  update(dt) {
    if (this.active || !this.engaged) return;
    const k = Math.exp(-dt * 3);
    this.yaw *= k;
    this.pitch *= k;
    this.zoomScale = 1 + (this.zoomScale - 1) * k;
    if (Math.abs(this.yaw) < 0.02 && Math.abs(this.pitch) < 0.02 && Math.abs(this.zoomScale - 1) < 0.02) {
      this.yaw = 0;
      this.pitch = 0;
      this.zoomScale = 1;
      this.engaged = false;
    }
  }

  // Applies the offsets to a base orbit: angle (rad, where the camera sits around the pivot),
  // pitch (rad above the horizon) and radius (m).
  orbit(angle, pitch, radius) {
    return {
      angle: angle + this.yaw,
      pitch: Math.min(MAX_PITCH, Math.max(MIN_PITCH, pitch + this.pitch)),
      radius: radius * this.zoomScale,
    };
  }
}
