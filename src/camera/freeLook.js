// Free-look orbit around the car, driven by holding the mouse button and dragging.
// Pure logic: no DOM or Three.js imports.

const DEFAULT_PITCH = 0.25;

export class FreeLook {
  constructor() {
    this.yaw = 0; // 0 = straight behind the car
    this.pitch = DEFAULT_PITCH;
    this.radius = 7;
    this.active = false; // the button is held
    this.engaged = false; // active, or still easing back to the normal camera
  }

  start() {
    this.active = true;
    this.engaged = true;
  }

  end() {
    this.active = false;
  }

  drag(dx, dy) {
    if (!this.active) return;
    this.yaw -= dx * 0.006;
    this.pitch = Math.min(1.4, Math.max(-0.1, this.pitch + dy * 0.005));
  }

  zoom(amount) {
    this.radius = Math.min(16, Math.max(4, this.radius + amount * 0.01));
  }

  // Eases back to the normal camera after the button is released.
  update(dt) {
    if (this.active || !this.engaged) return;
    const k = Math.exp(-dt * 3);
    this.yaw *= k;
    this.pitch = DEFAULT_PITCH + (this.pitch - DEFAULT_PITCH) * k;
    if (Math.abs(this.yaw) < 0.02 && Math.abs(this.pitch - DEFAULT_PITCH) < 0.02) {
      this.yaw = 0;
      this.pitch = DEFAULT_PITCH;
      this.engaged = false;
    }
  }

  // Camera position around a pivot for a car heading carYaw.
  position(pivot, carYaw) {
    const a = carYaw + Math.PI + this.yaw;
    const c = Math.cos(this.pitch);
    return {
      x: pivot.x + this.radius * c * Math.cos(a),
      y: pivot.y + this.radius * Math.sin(this.pitch),
      z: pivot.z + this.radius * c * Math.sin(a),
    };
  }
}
