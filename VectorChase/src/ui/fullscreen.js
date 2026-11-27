// Full screen: helpers for the button, and the gate that keeps touch devices in full screen while playing.
import { el } from './dom.js';
import { icon } from './icons.js';
import { ensureTheme, actionButton } from './widgets.js';

// The gate shows on a touch device that is not full screen (and has not been told to carry on anyway).
export function needsGate({ touch, fullscreen, dismissed }) {
  return Boolean(touch) && !fullscreen && !dismissed;
}

export function fullscreenSupported(doc = document) {
  const e = doc.documentElement;
  return Boolean(e.requestFullscreen || e.webkitRequestFullscreen);
}

// Full screen in the browser, or an installed app opened from the home screen.
export function isFullscreen(doc = document, win = window) {
  return (
    Boolean(doc.fullscreenElement || doc.webkitFullscreenElement) ||
    Boolean(win.matchMedia?.('(display-mode: fullscreen)').matches) ||
    Boolean(win.matchMedia?.('(display-mode: standalone)').matches) ||
    win.navigator?.standalone === true
  );
}

// Must be called from a tap or key press. Also asks for landscape where the browser allows it.
export async function enterFullscreen(doc = document) {
  const e = doc.documentElement;
  try {
    if (e.requestFullscreen) await e.requestFullscreen({ navigationUI: 'hide' });
    else if (e.webkitRequestFullscreen) await e.webkitRequestFullscreen();
    else return false;
  } catch {
    return false;
  }
  try {
    await screen.orientation?.lock?.('landscape');
  } catch {
    /* not every browser can lock the orientation: the rotate hint covers that */
  }
  return true;
}

export async function exitFullscreen(doc = document) {
  try {
    if (doc.exitFullscreen) await doc.exitFullscreen();
    else doc.webkitExitFullscreen?.();
  } catch {
    /* already out */
  }
}

export function toggleFullscreen() {
  return isFullscreen() ? exitFullscreen() : enterFullscreen();
}

// Calls fn whenever full screen starts or ends. Returns a function that stops listening.
export function onFullscreenChange(fn) {
  const events = ['fullscreenchange', 'webkitfullscreenchange'];
  for (const type of events) document.addEventListener(type, fn);
  return () => events.forEach((type) => document.removeEventListener(type, fn));
}

// The cover that asks for full screen. touch: whether this is a touch device.
// onLost(): called when full screen ends while the game is running, so the race can be paused.
export function createFullscreenGate({ touch, onLost = () => {} }) {
  ensureTheme();
  let dismissed = false;
  const root = el('div', 'vc-screen');
  root.id = 'fullscreen-gate';
  root.style.zIndex = '40';
  root.style.background = 'rgba(8,11,18,.97)';
  const box = el('div');
  box.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;max-width:440px;padding:24px;text-align:center';
  const heading = el('h2', '', 'Play full screen');
  heading.style.margin = '0';
  const text = el('div', '');
  text.style.color = 'var(--vc-mute)';
  const enter = actionButton('Play full screen', 'expand', async () => {
    const ok = await enterFullscreen();
    if (!ok) text.textContent = 'Your browser did not allow full screen.';
    update();
  }, 'primary');
  enter.style.minHeight = '60px';
  enter.style.fontSize = '20px';
  const carryOn = actionButton('Continue anyway', null, () => {
    dismissed = true;
    update();
  }, 'small');
  box.append(icon('expand', 56), heading, text, enter, carryOn);
  root.append(box);
  document.body.appendChild(root);

  const supported = fullscreenSupported();
  text.textContent = supported
    ? 'VectorChase is played full screen on phones and tablets, in landscape.'
    : 'This browser cannot go full screen. Add VectorChase to your home screen (Share, then Add to Home Screen) and open it from there.';
  enter.hidden = !supported;
  carryOn.hidden = supported; // only offered when full screen is impossible

  let showing = false;
  // initial: the first check at start-up must not report "lost", the game is not running yet.
  function update(initial = false) {
    const need = needsGate({ touch, fullscreen: isFullscreen(), dismissed });
    root.hidden = !need;
    if (need && !showing && !initial) onLost();
    showing = need;
  }
  onFullscreenChange(() => update());
  window.addEventListener('resize', () => update());
  update(true);
  return {
    get isShowing() {
      return showing;
    },
    update,
  };
}
