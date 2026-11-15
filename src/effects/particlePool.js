// Fixed-size pool of short-lived particles. Pure logic: no DOM or Three.js imports.

export class ParticlePool {
  constructor(capacity) {
    this.capacity = capacity;
    this.next = 0;
    this.position = new Float32Array(capacity * 3);
    this.velocity = new Float32Array(capacity * 3);
    this.color = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity); // 0 = unused
    this.lift = new Float32Array(capacity);
    this.startSize = new Float32Array(capacity);
    this.endSize = new Float32Array(capacity);
    this.startAlpha = new Float32Array(capacity);
  }

  // lift: m/s^2 added to the vertical speed (negative falls, positive rises).
  // When the pool is full the oldest particle is overwritten.
  emit({ x, y, z, vx = 0, vy = 0, vz = 0, life, startSize, endSize, alpha, color = [1, 1, 1], lift = 0 }) {
    const i = this.next;
    this.next = (this.next + 1) % this.capacity;
    const k = i * 3;
    this.position[k] = x;
    this.position[k + 1] = y;
    this.position[k + 2] = z;
    this.velocity[k] = vx;
    this.velocity[k + 1] = vy;
    this.velocity[k + 2] = vz;
    this.color[k] = color[0];
    this.color[k + 1] = color[1];
    this.color[k + 2] = color[2];
    this.age[i] = 0;
    this.life[i] = life;
    this.lift[i] = lift;
    this.startSize[i] = startSize;
    this.endSize[i] = endSize;
    this.startAlpha[i] = alpha;
    this.size[i] = startSize;
    this.alpha[i] = alpha;
  }

  update(dt) {
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this.life[i] = 0;
        this.size[i] = 0;
        this.alpha[i] = 0;
        continue;
      }
      const t = this.age[i] / this.life[i];
      const k = i * 3;
      this.velocity[k + 1] += this.lift[i] * dt;
      this.position[k] += this.velocity[k] * dt;
      this.position[k + 1] += this.velocity[k + 1] * dt;
      this.position[k + 2] += this.velocity[k + 2] * dt;
      this.size[i] = this.startSize[i] + (this.endSize[i] - this.startSize[i]) * t;
      this.alpha[i] = this.startAlpha[i] * (1 - t);
    }
  }

  clear() {
    this.life.fill(0);
    this.size.fill(0);
    this.alpha.fill(0);
  }

  get activeCount() {
    let n = 0;
    for (let i = 0; i < this.capacity; i++) if (this.life[i] > 0) n++;
    return n;
  }
}
