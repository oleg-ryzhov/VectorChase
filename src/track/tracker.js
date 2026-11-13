// Follows a car along the track: distance along the circuit, laps, and distance from the road.
// Pure logic: no DOM or Three.js imports.

const WINDOW = 20; // track points searched on each side of the last known position
const MAX_OFFSET = 22; // metres from the centre line; farther away, progress stops counting

export class TrackTracker {
  constructor(track) {
    this.track = track;
    this.index = 0; // nearest track point
    this.s = 0; // distance along the lap, 0..length
    this.lap = 0;
    this.total = 0; // lap * length + s; negative behind the start line
    this.dist = 0; // distance from the centre line
    this.offTrack = false;
  }

  // Places the tracker at a total distance (negative = behind the start line).
  setProgress(total) {
    const { length, points, spacing } = this.track;
    this.lap = Math.floor(total / length);
    this.s = total - this.lap * length;
    this.index = Math.round(this.s / spacing) % points.length;
    this.total = total;
    this.dist = 0;
    this.offTrack = false;
  }

  update(x, z) {
    const { points, length, spacing } = this.track;
    const n = points.length;

    let best = this.index;
    let bestD2 = Infinity;
    for (let k = -WINDOW; k <= WINDOW; k++) {
      const i = (this.index + k + n) % n;
      const dx = points[i].x - x;
      const dz = points[i].z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = i;
      }
    }
    this.dist = Math.sqrt(bestD2);
    this.offTrack = this.dist > MAX_OFFSET;
    if (this.offTrack) return; // too far from the road: keep the last progress

    // Fraction along the segment from point a to point b.
    const fraction = (a, b) => {
      const pa = points[a];
      const pb = points[b];
      const sx = pb.x - pa.x;
      const sz = pb.z - pa.z;
      const len2 = sx * sx + sz * sz;
      return len2 > 0 ? ((x - pa.x) * sx + (z - pa.z) * sz) / len2 : 0;
    };
    let segment = best;
    let t = fraction(best, (best + 1) % n);
    if (t < 0) {
      segment = (best - 1 + n) % n;
      t = fraction(segment, best);
    }
    t = Math.min(1, Math.max(0, t));
    const s = Math.min(length, (segment + t) * spacing);

    // Crossing the start line wraps s between about 0 and length.
    const delta = s - this.s;
    if (delta < -length / 2) this.lap += 1;
    else if (delta > length / 2) this.lap -= 1;

    this.s = s;
    this.index = best;
    this.total = this.lap * length + s;
  }
}
