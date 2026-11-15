# Design conventions

## Units (SI everywhere)
- Mass: kg, distance: m, speed: m/s, angles: radians internally (degrees only in UI labels)
- Force: N, torque: N·m, power: kW in UI and W internally, friction: dimensionless μ

## Time
- Physics runs at a fixed step (1/120 s). Nothing in the simulation uses the raw frame delta.
- `timeScale` scales how much simulation time accumulates per frame. It never changes the step size.
- The UI and menus always run in real time. Race time and the countdown run on physics time.

## Parameters
- Every tunable value is defined once in `src/config/registry.js`.
- The physics reads every value once per fixed step through `readCarSpec()` in `src/physics/spec.js`,
  so a changed value applies on the next step. Registry values use UI units; `readCarSpec()` converts them.
- `subscribe(fn)` notifies listeners of real changes (the settings menu, the car model, the HUD).
- `tests/vehicle.test.mjs` runs random driving with all values at their minimum, maximum and alternating.

## Input
- Per-frame "pressed" events are read in `beforeFrame`, never inside the fixed update.
- `Input` ignores keys typed into text fields and leaves arrow keys and Space to sliders and buttons.

## Code rules
- Pure logic (time, registry, physics, track, race, bots, profiles, effects buffers) has no DOM or
  Three.js imports, so it can be tested in Node.

## Track and terrain
- The track is a closed Catmull-Rom curve (x, y height, z) defined in `src/track/trackData.js`.
- `buildTrack` resamples it at equal horizontal distances. Each point has distance `s`, position, unit
  tangent, right normal, signed curvature (positive = right turn) and grade. Heading is `atan2(tz, tx)`.
- `src/track/world.js` answers "how high is the ground at (x, z)", the surface grip there and the signed
  distance from the centre line. Beside the road the ground is flat for 14 m, then eases to natural terrain.
- The terrain mesh sits 0.1 m under the road so the two never flicker.

## Vehicle
- Planar four-wheel model in `src/physics/vehicle.js`. Body axes: u forward, v right, r yaw rate (positive = right).
- Each wheel has its own spin speed and inertia. Tire force comes from slip ratio and slip angle with a
  combined-slip curve scaled by friction and wheel load, including load transfer and downforce.
- Rear-wheel drive by default with an open differential. Drive and brake torque are capped just below the tire's
  grip limit (acts as traction control and ABS). The car samples the ground under all four wheels each step.
- Grass gives 55% grip and 4x rolling resistance. Gravity acts along the slope.
- `Vehicle.wheelSlip[i]` is how hard each tire works: 1 is peak grip, above 1 is sliding.

## Race, bots and collisions
- `TrackTracker` follows a car along the track (distance, laps, distance from the road). Progress stops counting
  more than 22 m from the centre line.
- `Race` runs the countdown, laps, finish and standings. The race ends when the player finishes.
- `BotDriver` returns analog pedals and steering. It reads `readCarSpec()` every step, so it adapts to the same
  settings the player changes. It keeps a safety margin, countersteers slides and lifts off while tires slide.
  Each difficulty has a cornering margin and a top speed.
- `src/physics/collisions.js` treats each car as three circles with impulse-based collisions (including spin).

## Players and scores
- Players are stored as plain readable JSON in `localStorage` (`src/profile/profiles.js`). There are no
  passwords and no encryption yet. Scores exist only on the device that played the race.
- All storage code takes the storage object as a parameter, so a server-backed version can replace it later.

## Effects and HUD
- `src/effects/` holds skid marks, smoke, dust and sparks. `ParticlePool` and `SkidBuffer` are pure logic.
- `src/ui/hud.js` shows speed, gear, rpm, a minimap and the settings that differ from their defaults.
