# Racing Game

3D browser racing game with live physics tuning. Built with Three.js and plain ES modules, no build step.

## Run locally

ES modules do not load from `file://`. Serve the folder over HTTP:

    python -m http.server 8000

Then open http://localhost:8000.

## Run tests

Requires Node 18 or newer.

    node --test tests/time.test.mjs tests/registry.test.mjs

## Deploy

Push to GitHub and connect the repository in Netlify. `netlify.toml` publishes the repository root with no build command.

## Design

See `docs/DESIGN.md`.