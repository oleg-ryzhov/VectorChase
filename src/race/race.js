// Race rules: countdown, laps, finishing and standings. Pure logic: no DOM or Three.js imports.

export const POINTS_TABLE = [10, 8, 6, 5, 4, 3, 2, 1];
const COUNTDOWN_SECONDS = 3;

export function pointsFor(position) {
  return POINTS_TABLE[position - 1] ?? 0;
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '--:--.---';
  const ms = Math.round(seconds * 1000);
  const minutes = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${String(secs).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}

export class Race {
  // entrants: [{ name, isPlayer, tracker }]. Race adds lap and finish fields to each entrant.
  constructor({ laps, entrants, trackLength }) {
    this.laps = laps;
    this.trackLength = trackLength;
    this.entrants = entrants;
    this.phase = 'countdown'; // 'countdown' -> 'racing' -> 'finished'
    this.countdown = COUNTDOWN_SECONDS;
    this.time = 0;
    for (const e of entrants) {
      e.lapsDone = 0;
      e.lapStart = 0;
      e.lapTimes = [];
      e.bestLap = null;
      e.finishTime = null;
      e.finished = false;
    }
  }

  // dt is physics time, so slow motion slows the race clock too.
  update(dt) {
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.phase = 'racing';
        this.time = 0;
      }
      return;
    }
    if (this.phase !== 'racing') return;

    this.time += dt;
    for (const e of this.entrants) {
      if (e.finished) continue;
      // Cars start behind the line, so lap 1 is complete after the first full circuit.
      const done = Math.min(this.laps, Math.max(0, Math.floor(e.tracker.total / this.trackLength)));
      while (e.lapsDone < done) {
        e.lapsDone += 1;
        const lapTime = this.time - e.lapStart;
        e.lapStart = this.time;
        e.lapTimes.push(lapTime);
        if (e.bestLap === null || lapTime < e.bestLap) e.bestLap = lapTime;
      }
      if (e.lapsDone >= this.laps) {
        e.finished = true;
        e.finishTime = this.time;
      }
    }

    // The race ends when the player finishes; drivers still out there are ranked by distance.
    const player = this.entrants.find((e) => e.isPlayer);
    if (player && player.finished) this.phase = 'finished';
  }

  // Finished drivers first (by finish time), then the rest by distance covered.
  standings() {
    return [...this.entrants].sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished) return a.finishTime - b.finishTime;
      return b.tracker.total - a.tracker.total;
    });
  }
}
