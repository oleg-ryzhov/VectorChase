import { el, button, addStyle } from './dom.js';
import { formatTime } from '../race/race.js';

const STYLE = `
#race-status{position:fixed;top:10px;left:50%;transform:translateX(-50%);text-align:center;color:#fff;background:rgba(0,0,0,.5);padding:6px 16px;border-radius:8px;font:600 16px system-ui,sans-serif;z-index:5;pointer-events:none}
#race-status[hidden]{display:none}
.rs-sub{font-weight:400;font-size:12px;color:#c9d2e0}
.rs-warn{font-size:13px;color:#ff8080}
#race-countdown{position:fixed;top:30%;left:0;right:0;text-align:center;color:#fff;font:700 120px system-ui,sans-serif;text-shadow:0 4px 24px rgba(0,0,0,.6);z-index:5;pointer-events:none}
#race-results{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(520px,94vw);box-sizing:border-box;padding:18px 22px;background:rgba(10,13,20,.94);color:#e8ecf3;border-radius:12px;font:14px/1.4 system-ui,sans-serif;z-index:20}
#race-results[hidden]{display:none}
#race-results h2{margin:0 0 10px}
#race-results table{width:100%;border-collapse:collapse}
#race-results th,#race-results td{text-align:left;padding:4px 6px;border-bottom:1px solid #222a3a}
#race-results tr.me td{color:#ffd166}
.rr-note{margin:10px 0;color:#9aa4b5;font-size:12px}
.rr-buttons{display:flex;gap:10px}
#race-results button{background:#2a3242;color:inherit;border:1px solid #3d4760;border-radius:6px;padding:7px 14px;font:inherit;cursor:pointer}
`;

export function createRaceUi() {
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
  document.body.append(status, countdown, results);

  return {
    setStatus({ position, total, lap, laps, time, bestLap, offTrack }) {
      status.hidden = false;
      mainLine.textContent = `P${position}/${total} · Lap ${lap}/${laps} · ${formatTime(time)}`;
      subLine.textContent = bestLap === null ? '' : `Best lap ${formatTime(bestLap)}`;
      warning.textContent = offTrack ? 'OFF TRACK - press R to return to the road' : '';
    },
    hideStatus() {
      status.hidden = true;
    },
    setCountdown(text) {
      countdown.textContent = text;
    },
    hideResults() {
      results.hidden = true;
      results.replaceChildren();
    },
    // standings: [{ position, name, isPlayer, finished, time, lapsDone, bestLap, points }]
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

      const again = button('Race again');
      const menu = button('Main menu');
      again.addEventListener('click', onAgain);
      menu.addEventListener('click', onMenu);
      const buttons = el('div', 'rr-buttons');
      buttons.append(again, menu);
      results.append(table, el('div', 'rr-note', saveNote), buttons);
      results.hidden = false;
    },
  };
}
