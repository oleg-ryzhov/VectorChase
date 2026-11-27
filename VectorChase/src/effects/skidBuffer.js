// Ring buffer of road-mark quads. Pure logic: no DOM or Three.js imports.
// Each quad is 4 vertices (12 numbers in `positions`): prev+n, prev-n, cur+n, cur-n.

const MIN_SEGMENT = 0.25; // m: shorter moves are ignored
const MAX_SEGMENT = 5; // m: longer jumps (a respawn, say) start a new line

export class SkidBuffer {
  constructor(capacity, width = 0.22) {
    this.capacity = capacity;
    this.width = width;
    this.positions = new Float32Array(capacity * 12);
    this.count = 0; // quads stored, capped at capacity
    this.next = 0; // where the next quad goes
    this.last = new Map(); // wheel key -> last marked point
  }

  // Adds a mark from the wheel's previous marked point to (x, y, z).
  add(key, x, y, z) {
    const prev = this.last.get(key);
    if (!prev) {
      this.last.set(key, { x, y, z });
      return;
    }
    const dx = x - prev.x;
    const dz = z - prev.z;
    const len = Math.hypot(dx, dz);
    if (len < MIN_SEGMENT) return;
    if (len > MAX_SEGMENT) {
      this.last.set(key, { x, y, z });
      return;
    }

    const nx = ((-dz / len) * this.width) / 2;
    const nz = ((dx / len) * this.width) / 2;
    const p = this.positions;
    const base = this.next * 12;
    p.set([prev.x + nx, prev.y, prev.z + nz], base);
    p.set([prev.x - nx, prev.y, prev.z - nz], base + 3);
    p.set([x + nx, y, z + nz], base + 6);
    p.set([x - nx, y, z - nz], base + 9);
    this.next = (this.next + 1) % this.capacity;
    this.count = Math.min(this.count + 1, this.capacity);

    prev.x = x;
    prev.y = y;
    prev.z = z;
  }

  // Call when a wheel stops sliding, so its next mark starts a new line.
  end(key) {
    this.last.delete(key);
  }

  clear() {
    this.count = 0;
    this.next = 0;
    this.last.clear();
  }
}
