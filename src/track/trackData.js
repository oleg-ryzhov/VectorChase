// Track layout: a large closed circuit with hills.
// Control points are { x, y, z } in metres (y is height), listed in driving order.
// The curve is closed automatically (the last point connects back to the first).

const RADIUS_X = 620;
const RADIUS_Z = 380;
const POINT_COUNT = 36;
const MEAN_HEIGHT = 30;

// Road height as a function of the angle around the circuit.
function elevation(angle) {
  return (
    MEAN_HEIGHT +
    14 * Math.sin(angle - 0.6) +
    6 * Math.sin(2 * angle + 1.2) +
    3 * Math.sin(3 * angle)
  );
}

// A wobbly oval: long sweepers with a few tighter bends.
function layout(angle) {
  const wobble = 1 + 0.16 * Math.sin(3 * angle + 0.5) + 0.1 * Math.sin(5 * angle + 1.3);
  return {
    x: RADIUS_X * wobble * Math.cos(angle),
    y: elevation(angle),
    z: RADIUS_Z * wobble * Math.sin(angle),
  };
}

// Starts at the top of the oval, heading east.
export const CONTROL_POINTS = Array.from({ length: POINT_COUNT }, (_, i) =>
  layout(-Math.PI / 2 + (i / POINT_COUNT) * Math.PI * 2)
);

export const TRACK_OPTIONS = {
  spacing: 3, // metres between sampled points
  width: 16, // road width in metres
  checkpointEvery: 150, // approximate metres between checkpoints
};

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Natural ground height away from the road. Around the circuit it follows the same
// elevation as the road, so the terrain near the road is already close to road height.
export function baseHeight(x, z) {
  const nx = x / RADIUS_X;
  const nz = z / RADIUS_Z;
  const rho = Math.hypot(nx, nz); // about 1 on the circuit, 0 at the middle
  const angle = Math.atan2(nz, nx);
  // The angle is meaningless near the middle, so the hills fade out there and far outside.
  const hills =
    (elevation(angle) - MEAN_HEIGHT) *
    smoothstep(0.1, 0.5, rho) *
    (1 - 0.7 * smoothstep(1.4, 2.4, rho));
  const rolling = 5 * Math.sin(x / 230) * Math.cos(z / 190) + 3 * Math.sin((x - z) / 140);
  return MEAN_HEIGHT + hills + rolling;
}
