import { el, addStyle } from './dom.js';
import { subscribe } from '../config/registry.js';
import { listChanges, formatValue } from '../config/changes.js';

const STYLE = `
#dash{position:fixed;right:16px;bottom:16px;width:170px;padding:10px 14px;box-sizing:border-box;background:rgba(0,0,0,.5);border-radius:10px;color:#fff;font-family:system-ui,sans-serif;z-index:5;pointer-events:none}
#dash[hidden]{display:none}
.dash-speed{font-size:44px;font-weight:700;line-height:1;text-align:right;font-variant-numeric:tabular-nums}
.dash-unit{text-align:right;font-size:12px;color:#c9d2e0}
.dash-gear{position:absolute;left:14px;top:8px;font-size:30px;font-weight:700;color:#ffd166}
.dash-rpm{margin-top:8px;height:8px;background:rgba(255,255,255,.2);border-radius:4px;overflow:hidden}
.dash-rpm-fill{height:100%;width:0;background:#7bd88f}
#drift{position:fixed;top:95px;left:50%;transform:translateX(-50%);color:#ffd166;font:700 26px system-ui,sans-serif;text-shadow:0 2px 10px rgba(0,0,0,.7);z-index:5;pointer-events:none;white-space:nowrap}
#minimap{position:fixed;top:10px;right:10px;width:200px;height:150px;z-index:5;pointer-events:none}
#minimap[hidden]{display:none}
#changes{position:fixed;left:8px;top:50px;max-width:260px;padding:8px 10px;background:rgba(0,0,0,.5);color:#ffd166;border-radius:8px;font:12px/1.4 system-ui,sans-serif;z-index:5;pointer-events:none}
#changes[hidden]{display:none}
`;

const MAP_WIDTH = 200;
const MAP_HEIGHT = 150;
const MAP_PADDING = 12;

const cssColor = (n) => `#${n.toString(16).padStart(6, '0')}`;

// Speed, gear and rpm, a track minimap, and a list of settings that differ from the defaults.
export function createHud(track) {
  addStyle(STYLE);

  const dash = el('div');
  dash.id = 'dash';
  dash.hidden = true;
  const speed = el('div', 'dash-speed', '0');
  const gear = el('div', 'dash-gear', '1');
  const rpmBar = el('div', 'dash-rpm');
  const rpmFill = el('div', 'dash-rpm-fill');
  rpmBar.append(rpmFill);
  const unitLabel = el('div', 'dash-unit', 'km/h');
  dash.append(gear, speed, unitLabel, rpmBar);
  const drift = el('div');
  drift.id = 'drift';

  const map = document.createElement('canvas');
  map.id = 'minimap';
  map.width = MAP_WIDTH;
  map.height = MAP_HEIGHT;
  map.hidden = true;
  const ctx = map.getContext('2d');

  const changes = el('div');
  changes.id = 'changes';
  changes.hidden = true;

  document.body.append(dash, map, changes, drift);

  // The track outline only changes with the map, so it is drawn once and copied each frame.
  const base = document.createElement('canvas');
  base.width = MAP_WIDTH;
  base.height = MAP_HEIGHT;
  const baseCtx = base.getContext('2d');
  let mapX = () => 0;
  let mapY = () => 0;

  function drawBase(track) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of track.points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    const scale = Math.min(
      (MAP_WIDTH - 2 * MAP_PADDING) / (maxX - minX),
      (MAP_HEIGHT - 2 * MAP_PADDING) / (maxZ - minZ)
    );
    const offsetX = (MAP_WIDTH - (maxX - minX) * scale) / 2;
    const offsetZ = (MAP_HEIGHT - (maxZ - minZ) * scale) / 2;
    mapX = (x) => offsetX + (x - minX) * scale;
    mapY = (z) => offsetZ + (z - minZ) * scale;

    baseCtx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    baseCtx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    baseCtx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    baseCtx.strokeStyle = '#c9d2e0';
    baseCtx.lineWidth = 3;
    baseCtx.lineJoin = 'round';
    baseCtx.beginPath();
    track.points.forEach((p, i) => {
      if (i % 6 !== 0) return;
      if (i === 0) baseCtx.moveTo(mapX(p.x), mapY(p.z));
      else baseCtx.lineTo(mapX(p.x), mapY(p.z));
    });
    baseCtx.closePath();
    baseCtx.stroke();
    baseCtx.fillStyle = '#ffffff';
    baseCtx.fillRect(mapX(track.points[0].x) - 3, mapY(track.points[0].z) - 3, 6, 6); // start line
  }
  drawBase(track);

  let visible = false;
  let lastSpeed = '';
  let lastGear = '';

  function renderChanges() {
    const list = listChanges();
    changes.hidden = !visible || list.length === 0;
    if (changes.hidden) return;
    changes.replaceChildren(
      el('div', '', 'Changed settings'),
      ...list.map((c) => el('div', '', `${c.label}: ${formatValue(c.value)}${c.unit ? ' ' + c.unit : ''}`))
    );
  }
  subscribe(renderChanges);

  // Which parts show while racing, and the speed units (kph or mph).
  const options = { minimap: true, speedo: true, units: 'kph' };
  function applyVisibility() {
    dash.hidden = !(visible && options.speedo);
    map.hidden = !(visible && options.minimap);
  }

  return {
    setTrack: drawBase,
    setOptions(next) {
      Object.assign(options, next);
      unitLabel.textContent = options.units === 'mph' ? 'mph' : 'km/h';
      lastSpeed = null;
      applyVisibility();
    },
    setVisible(next) {
      if (next === visible) return;
      visible = next;
      applyVisibility();
      if (!next) drift.textContent = '';
      renderChanges();
    },

    // cars: [{ x, z, isPlayer, color }] with the player last so it is drawn on top.
    // driftText: current drift or last banked score ('' to hide).
    update({ kmh, gear: gearLabel, rpm, redline, cars, driftText = '' }) {
      if (!visible) return;
      const speedText = String(options.units === 'mph' ? Math.round(kmh * 0.621371) : kmh);
      if (speedText !== lastSpeed) speed.textContent = lastSpeed = speedText;
      if (gearLabel !== lastGear) gear.textContent = lastGear = gearLabel;
      const fraction = Math.max(0, Math.min(1, rpm / redline));
      rpmFill.style.width = `${fraction * 100}%`;
      rpmFill.style.background = fraction > 0.9 ? '#ff6b6b' : '#7bd88f';
      drift.textContent = driftText;

      ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
      ctx.drawImage(base, 0, 0);
      for (const car of cars) {
        ctx.beginPath();
        ctx.arc(mapX(car.x), mapY(car.z), car.isPlayer ? 4.5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = cssColor(car.color);
        ctx.fill();
        if (car.isPlayer) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
        }
      }
    },
  };
}
