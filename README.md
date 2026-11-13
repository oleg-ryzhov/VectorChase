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
- C: switch between first-person and chase camera
- E: open or close the car settings during a race (time slows down while it is open)
- R: put the car back on the road

## Troubleshooting

- Black page on a hosted copy: a file is missing or misnamed. The page now shows which file failed to load.
  File names are case-sensitive on GitHub Pages and Netlify.
- Blank page when opening `index.html` by double-click: serve the folder over HTTP (see "Run locally").
- Scores and players are stored in your browser's `localStorage` as plain text, per device.
