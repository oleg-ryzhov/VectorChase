// Track layout. Points are in the XZ plane, in metres, listed in driving order.
// The curve is closed automatically (last point connects back to the first).

export const CONTROL_POINTS = [
  { x: 0, z: -120 },
  { x: 100, z: -130 },
  { x: 180, z: -90 },
  { x: 200, z: -20 },
  { x: 150, z: 40 },
  { x: 160, z: 110 },
  { x: 90, z: 150 },
  { x: 20, z: 110 },
  { x: -40, z: 150 },
  { x: -120, z: 130 },
  { x: -170, z: 60 },
  { x: -130, z: -10 },
  { x: -170, z: -70 },
  { x: -100, z: -120 },
];

export const TRACK_OPTIONS = {
  spacing: 2, // metres between sampled points
  width: 14, // road width in metres
  checkpointEvery: 100, // approximate metres between checkpoints
};