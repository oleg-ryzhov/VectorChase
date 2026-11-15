// Closed-track builder. Pure logic: no DOM or Three.js imports.
//
// Conventions (XZ plane, Y is up):
// - heading = atan2(tz, tx)
// - right normal = (-tz, tx)
// - curvature > 0 is a right turn, < 0 is a left turn (units: 1/m)

const DENSE_PER_SEGMENT = 64;

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function wrapAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export function buildTrack(control, options = {}) {
  const { spacing = 2, width = 14, checkpointEvery = 100 } = options;
  const n = control.length;
  if (n < 4) throw new Error('Track needs at least 4 control points');
  if (!(spacing > 0) || !(width > 0) || !(checkpointEvery > 0)) {
    throw new Error('spacing, width and checkpointEvery must be positive');
  }

  // 1. Dense polyline along the closed Catmull-Rom curve.
  const dense = [];
  for (let i = 0; i < n; i++) {
    const p0 = control[(i - 1 + n) % n];
    const p1 = control[i];
    const p2 = control[(i + 1) % n];
    const p3 = control[(i + 2) % n];
    for (let k = 0; k < DENSE_PER_SEGMENT; k++) {
      const t = k / DENSE_PER_SEGMENT;
      dense.push({
        x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
        y: catmullRom(p0.y ?? 0, p1.y ?? 0, p2.y ?? 0, p3.y ?? 0, t),
        z: catmullRom(p0.z, p1.z, p2.z, p3.z, t),
      });
    }
  }

  // 2. Cumulative length, including the closing segment.
  const m = dense.length;
  const cum = new Array(m + 1);
  cum[0] = 0;
  for (let i = 0; i < m; i++) {
    const a = dense[i];
    const b = dense[(i + 1) % m];
    cum[i + 1] = cum[i] + Math.hypot(b.x - a.x, b.z - a.z);
  }
  const length = cum[m];

  // 3. Resample at equal distances along the curve.
  const count = Math.max(8, Math.round(length / spacing));
  const step = length / count;
  const points = [];
  let seg = 0;
  for (let k = 0; k < count; k++) {
    const s = k * step;
    while (seg < m - 1 && cum[seg + 1] < s) seg++;
    const a = dense[seg];
    const b = dense[(seg + 1) % m];
    const segLen = cum[seg + 1] - cum[seg];
    const f = segLen > 0 ? (s - cum[seg]) / segLen : 0;
    points.push({
      s,
      x: a.x + (b.x - a.x) * f,
      y: a.y + (b.y - a.y) * f,
      z: a.z + (b.z - a.z) * f,
      tx: 0,
      tz: 0,
      nx: 0,
      nz: 0,
      curvature: 0,
      grade: 0,
      width,
    });
  }

  // 4. Tangent, right normal and heading from neighbouring points.
  const heading = new Array(count);
  for (let i = 0; i < count; i++) {
    const prev = points[(i - 1 + count) % count];
    const next = points[(i + 1) % count];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    const p = points[i];
    p.tx = dx / len;
    p.tz = dz / len;
    p.nx = -p.tz;
    p.nz = p.tx;
    heading[i] = Math.atan2(p.tz, p.tx);
  }

  // 5. Signed curvature = heading change over the distance between neighbours.
  for (let i = 0; i < count; i++) {
    const dTheta = wrapAngle(heading[(i + 1) % count] - heading[(i - 1 + count) % count]);
    points[i].curvature = dTheta / (2 * step);
  }

  // 5b. Grade = rise over horizontal distance, from neighbouring points.
  for (let i = 0; i < count; i++) {
    const prev = points[(i - 1 + count) % count];
    const next = points[(i + 1) % count];
    points[i].grade = (next.y - prev.y) / (2 * step);
  }

  // 6. Checkpoints, roughly every checkpointEvery metres. Index 0 is the start line.
  const cpCount = Math.max(1, Math.round(length / checkpointEvery));
  const checkpoints = [];
  for (let j = 0; j < cpCount; j++) {
    const index = Math.round((j * count) / cpCount) % count;
    const p = points[index];
    checkpoints.push({ index, s: p.s, x: p.x, z: p.z, tx: p.tx, tz: p.tz });
  }

  return { points, length, spacing: step, width, checkpoints };
}
