# Racing Game (VectorChase)

3D browser racing game with live physics tuning. Built with Three.js and plain ES modules, no build step.

## Run locally

ES modules do not load from `file://`. Serve the folder over HTTP:

    python -m http.server 8000

Then open http://localhost:8000.

## Run tests

Requires Node 18 or newer. No install is needed; the tests only use Node itself.

    node --test tests/*.test.mjs

## Deploy

Push to GitHub and connect the repository in Netlify, or enable GitHub Pages on the main branch.
`netlify.toml` publishes the repository root with no build command. Paths in the game are relative,
so it also works under a sub-folder URL such as `https://USER.github.io/REPO/`.

## Design

See `docs/DESIGN.md`.

## Controls

- W / S: accelerate / brake (hold S when stopped to reverse)
- A / D: steer
- C: cycle the camera: first-person, chase, rear (the chase view turned around)
- Esc: pause (resume, restart, settings, tune car, main menu, full screen)
- E: open or close the car tuner during a race (time slows down while it is open). The tune button on the speedometer does the same
- Space: handbrake (start a drift)
- Hold the left mouse button (or drag a finger) and move: free-look around the car, starting from the chase camera; the wheel zooms
- There are no driving assists: the car behaves like a real one, and walls and cars act as solid obstacles
- The tuner opens on a Basic page; the icon toggle in its top right corner switches to Advanced, which has four tabs. Presets are on the Presets button
- Tuner keyboard: each setting on the page shows a key (1 to 0 by default; change them in Settings, Keys tabs). Press it to pick the setting. Left / Right change a slider (Shift for fine steps), Up / Down jump to its highest / lowest value. Space flips a switch or opens a list (Up / Down or Tab to move, Enter or Space to pick). Delete puts the picked setting back to stock. Tab and the arrow keys move around. The car tuning is remembered between visits
- Settings (audio, video, effects, interface, touch controls) are in the pause menu. Settings only show while the setting they depend on is on

### Phones and tablets

- The game is played full screen in landscape; a cover asks for full screen first. On an iPhone, add the page to the home screen
- Steer with the pad on the left (or arrow buttons), gas and brake on the right. Drag the empty screen to look around
- Settings, Controls, Edit layout: move each control, and change its size, touch area and opacity
- The Garage tile in the main menu shows the real car up close while you pick a paint

## Troubleshooting

- Black page on a hosted copy: a file is missing or misnamed. The page now shows which file failed to load.
  File names are case-sensitive on GitHub Pages and Netlify.
- Blank page when opening `index.html` by double-click: serve the folder over HTTP (see "Run locally").
- Scores and players are stored in your browser's `localStorage` as plain text, per device.

## Maps

Pick a map in the main menu. Roads can bank, cross over each other on bridges and run through tunnels; the car can leave the ground.

| Map | What it is |
| --- | --- |
| Thunder Speedway | NASCAR-style oval, 26 degree banking in the turns |
| Suzuka Circuit | Real F1 circuit (Japanese Grand Prix). The back straight crosses over the Degner curves |
| Monza | Real circuit, the Temple of Speed |
| Neon Metropolis | Night city: highway over the boulevard, a tunnel through a tower |
| Eiger Pass | Mountain tunnel, a bridge over a ravine, switchbacks down a cliff |
| Red Mesa Canyon | Desert gorges, a mesa tunnel and a bridge |

Shortcuts (not marked on the road): on Neon Metropolis, Eiger Pass and Red Mesa Canyon you can leave the road at a bend with a gap in the barrier and jump straight across instead of following the detour. Each needs roughly 120-150 km/h at the edge. Miss and you fall in the water and are put back on the road at your last progress. Cars also respawn this way if they fall off the world.

The Suzuka and Monza centre lines come from the [TUMFTM racetrack-database](https://github.com/TUMFTM/racetrack-database) (LGPL-3.0). Their heights, and the Suzuka bridge, are approximate, and the roads are a little wider than the real ones.

New maps live in `src/maps/`: a map is a list of waypoints (with height, banking, bridge/tunnel and barrier-gap flags), a terrain height function and a theme. `src/maps/index.js` lists them.

## Online accounts and leaderboards (optional)

The game works fully offline. To turn on shared accounts and leaderboards, follow `docs/ONLINE_PLAN.txt`: run `supabase/schema.sql` in a Supabase project, put the public project URL and anon key in `src/online/config.js`, and set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` as Netlify environment variables. The service key is a secret: it never goes in the repository.
