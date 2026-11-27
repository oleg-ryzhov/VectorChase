import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { needsGate, fullscreenSupported, isFullscreen } from '../src/ui/fullscreen.js';
import { ICONS } from '../src/ui/icons.js';

test('the gate shows only on touch devices that are not full screen and were not told to carry on', () => {
  assert.equal(needsGate({ touch: true, fullscreen: false, dismissed: false }), true);
  assert.equal(needsGate({ touch: true, fullscreen: true, dismissed: false }), false);
  assert.equal(needsGate({ touch: true, fullscreen: false, dismissed: true }), false);
  assert.equal(needsGate({ touch: false, fullscreen: false, dismissed: false }), false);
});

test('full screen support and state are read from the standard and the webkit names', () => {
  assert.equal(fullscreenSupported({ documentElement: {} }), false);
  assert.equal(fullscreenSupported({ documentElement: { requestFullscreen() {} } }), true);
  assert.equal(fullscreenSupported({ documentElement: { webkitRequestFullscreen() {} } }), true);
  const win = (modes = [], standalone) => ({ matchMedia: (q) => ({ matches: modes.includes(q) }), navigator: { standalone } });
  assert.equal(isFullscreen({}, win()), false);
  assert.equal(isFullscreen({ fullscreenElement: {} }, win()), true);
  assert.equal(isFullscreen({ webkitFullscreenElement: {} }, win()), true);
  assert.equal(isFullscreen({}, win(['(display-mode: fullscreen)'])), true);
  assert.equal(isFullscreen({}, win(['(display-mode: standalone)'])), true);
  assert.equal(isFullscreen({}, win([], true)), true); // iPhone home screen app
});

test('the installable app manifest asks for full screen and landscape, and the page links it', () => {
  const m = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
  assert.equal(m.display, 'fullscreen');
  assert.equal(m.orientation, 'landscape');
  const html = readFileSync('index.html', 'utf8');
  assert.ok(html.includes('rel="manifest"') && html.includes('apple-mobile-web-app-capable') && html.includes('viewport-fit=cover'));
  assert.ok(ICONS.expand && ICONS.shrink);
});
