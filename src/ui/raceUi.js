import { el, addStyle } from './dom.js';
import { ensureTheme, actionButton } from './widgets.js';
import { toggleFullscreen, fullscreenSupported } from './fullscreen.js';
import { formatTime } from '../race/race.js';

const STYLE = `
#race-status{position:fixed;top:10px;left:50%;transform:translateX(-50%);text-align:center;color:#fff;background:rgba(11,15,23,.72);border:1px solid rgba(255,255,255,.12);padding:8px 18px;border-radius:14px;font:700 16px/1.25 system-ui,sans-serif;font-variant-numeric:tabular-nums;letter-spacing:.03em;box-shadow:0 6px 20px rgba(0,0,0,.35);z-index:5;pointer-events:none}
#race-status[hidden]{display:none}
#race-ghost{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);padding:4px 14px;border-radius:999px;background:rgba(11,15,23,.72);border:1px solid rgba(255,255,255,.12);font:700 18px system-ui,sans-serif;font-variant-numeric:tabular-nums;z-index:5;pointer-events:none}
#race-ghost[hidden]{display:none}
#race-ghost.ahead{color:#7dff9a}
#race-ghost.behind{color:#ff9a9a}
.rs-sub{font-weight:500;font-size:13px;color:#c9d2e0}
.rs-warn{font-size:13px;font-weight:700;color:#ff9a9a}
#race-countdown{position:fixed;top:30%;left:0;right:0;text-align:center;color:#fff;font:800 120px system-ui,sans-serif;text-shadow:0 4px 32px rgba(214,40,57,.55),0 2px 8px rgba(0,0,0,.6);z-index:5;pointer-events:none}
#race-results,#race-pause{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);box-sizing:border-box;padding:20px 24px 24px;background:linear-gradient(180deg,#151e30,var(--vc-panel,#111826) 120px);color:var(--vc-text,#e8ecf3);border:1px solid var(--vc-line,#26324f);border-radius:16px;box-shadow:0 0 0 100vmax rgba(5,8,14,.55),0 24px 80px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.06);font:15px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;z-index:20;animation:vc-rise .2s var(--vc-ease,ease-out)}
#race-results{width:min(560px,94vw)}
#race-pause{width:min(440px,94vw)}
#race-results[hidden],#race-pause[hidden]{display:none}
#race-results h2,#race-pause h2{margin:0 0 14px;font-size:20px;letter-spacing:.04em}
#race-results h2::before,#race-pause h2::before{content:'';display:inline-block;width:4px;height:1em;margin-right:10px;border-radius:2px;background:var(--vc-accent,#e63946);vertical-align:-.14em}
.rp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.rp-grid .vc-btn{min-height:52px}
.rp-grid .wide{grid-column:1/-1}
.rp-grid .primary{min-height:60px;font-size:18px}
#race-results table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
#race-results th{text-align:left;padding:6px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--vc-mute,#8d9ab0);border-bottom:1px solid var(--vc-edge,#62729a)}
#race-results td{text-align:left;padding:8px 6px;border-bottom:1px solid #1b2540}
#race-results tr:nth-child(2) td:first-child{color:var(--vc-warn,#ffd166);font-weight:800}
#race-results tr.me td{color:var(--vc-warn,#ffd166);font-weight:700;background:rgba(255,209,102,.08)}
.rr-note{margin:12px 0;color:var(--vc-mute,#8d9ab0);font-size:13px}
.rr-buttons{display:flex;gap:10px}
.rr-buttons .vc-btn{flex:1;min-height:52px}
@media (prefers-reduced-motion:reduce){#race-results,#race-pause{animation:none}}
`;

export function createRaceUi() {
  ensureTheme();
  addStyle(STYLE);

  const status = el('div');
  status.id = 'race-status';
  status.hidden = true;
  const mainLine = el('div');
  const subLine = el('div', 'rs-sub');
  const warning = el('div', 'rs-warn');
  status.append(mainLine, subLine, warning);

  const countdown = el('div');
  countdown.id = 'race-countdown';
  const results = el('div');
  results.id = 'race-results';
  results.hidden = true;
  const ghostLine = el('div');
  ghostLine.id = 'race-ghost';
  ghostLine.hidden = true;
  const pause = el('div');
  pause.id = 'race-pause';
  pause.hidden = true;
  document.body.append(status, ghostLine, countdown, results, pause);

  let noteLine = null;
  return {
    setStatus({ position, total, lap, laps, time, bestLap, offTrack }) {
      status.hidden = false;
      mainLine.textContent = `P${position}/${total} | Lap ${lap}/${laps} | ${formatTime(time)}`;
      subLine.textContent = bestLap === null ? '' : `Best lap ${formatTime(bestLap)}`;
      warning.textContent = offTrack ? 'OFF TRACK - get back on the road' : '';
    },
    // seconds ahead (negative) or behind (positive) the ghost at this point of the lap; null hides it
    setGhostDelta(delta) {
      ghostLine.hidden = delta === null;
      if (delta === null) return;
      const text = `Ghost ${delta <= 0 ? '-' : '+'}${Math.abs(delta).toFixed(2)}`;
      if (ghostLine.textContent !== text) ghostLine.textContent = text;
      ghostLine.className = delta <= 0 ? 'ahead' : 'behind';
    },
    hideStatus() {
      status.hidden = true;
    },
    setCountdown(text) {
      countdown.textContent = text;
    },
    showPause({ onResume, onRestart, onMenu, onSettings = () => {}, onTune = () => {} }) {
      ensureTheme();
      pause.replaceChildren();
      const grid = el('div', 'rp-grid');
      const resume = actionButton('Resume', 'play', onResume, 'primary wide');
      grid.append(
        resume,
        actionButton('Restart', 'reset', onRestart),
        actionButton('Settings', 'gear', onSettings),
        actionButton('Tune car', 'tune', onTune),
        actionButton('Main menu', 'flag', onMenu)
      );
      if (fullscreenSupported()) grid.append(actionButton('Full screen', 'expand', () => toggleFullscreen(), 'wide'));
      pause.append(el('h2', '', 'Paused'), grid);
      pause.hidden = false;
    },
    hidePause() {
      pause.hidden = true;
      pause.replaceChildren();
    },
    hideResults() {
      results.hidden = true;
      results.replaceChildren();
    },
    // standings: [{ position, name, isPlayer, finished, time, lapsDone, bestLap, points }]
    setSaveNote(text) {
      if (noteLine) noteLine.textContent = text;
    },
    showResults({ standings, laps, saveNote, onAgain, onMenu }) {
      results.replaceChildren();
      const me = standings.find((r) => r.isPlayer);
      results.append(el('h2', '', `You finished P${me.position} of ${standings.length}`));

      const table = el('table');
      const head = el('tr');
      for (const h of ['Pos', 'Driver', 'Time', 'Best lap', 'Points']) head.append(el('th', '', h));
      table.append(head);
      for (const r of standings) {
        const tr = el('tr', r.isPlayer ? 'me' : '');
        const time = r.finished ? formatTime(r.time) : `${r.lapsDone}/${laps} laps`;
        const best = r.bestLap === null ? '-' : formatTime(r.bestLap);
        for (const cell of [r.position, r.name, time, best, r.points]) tr.append(el('td', '', String(cell)));
        table.append(tr);
      }

      const again = actionButton('Race again', 'reset', onAgain, 'primary');
      const menu = actionButton('Main menu', 'flag', onMenu);
      const buttons = el('div', 'rr-buttons');
      buttons.append(again, menu);
      noteLine = el('div', 'rr-note', saveNote);
      results.append(table, noteLine, buttons);
      results.hidden = false;
    },
  };
}
