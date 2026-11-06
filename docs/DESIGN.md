# Design conventions

## Units (SI everywhere)
- Mass: kg
- Distance: m
- Speed: m/s
- Angles: radians internally, degrees only in UI labels
- Force: N
- Torque: N·m
- Power: kW in UI, W internally
- Friction: dimensionless μ

## Time
- Physics runs at a fixed step (1/120 s). Nothing in the simulation uses the raw frame delta.
- `timeScale` scales how much simulation time accumulates per frame. It never changes the step size.
- The UI and menus always run in real time.

## Parameters
- Every tunable value is defined once in `src/config/registry.js`.
- Physics, UI, and bots read values through `getParam`. Nothing caches a value at construction time.
- All writes go through `setParam`, which clamps to min/max and rejects non-numeric input.

## Input
- Per-frame "pressed" events are read in `beforeFrame`, never inside the fixed update, because the fixed update can run zero times in a frame.

## Code rules
- Pure logic (time, registry, physics math) has no DOM or Three.js imports, so it can be tested in Node.

## Track
- The track is a closed Catmull-Rom curve in the XZ plane, defined in `src/track/trackData.js`.
- `buildTrack` resamples it at equal distances. Each point has distance `s`, position, unit tangent, right normal, signed curvature and width.
- Positive curvature is a right turn. Heading is `atan2(tz, tx)`. Right normal is `(-tz, tx)`.
- Checkpoint 0 is the start line. Bots and lap logic read the sampled points, never the raw control points.