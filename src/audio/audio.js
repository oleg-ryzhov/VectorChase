// All sounds are generated with the Web Audio API, so there are no sound files.
// Browsers only allow audio after a click or key press, so nothing exists until start() is called.
import { engineFrequency, engineGain, engineCutoff, squealGain, windGain, distanceGain } from './mapping.js';

const MASTER_SCALE = 0.45; // the engine sounds were balanced for a master gain of about 0.3
const BOT_VOICES = 2; // only the nearest bots are heard, to keep it cheap

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let squeal = null;
  let wind = null;
  let voices = [];
  let sfx = null; // bus for engines, tyres, wind and crashes
  let musicBus = null;
  let musicTimer = null;
  let nextNote = 0;
  let step = 0;
  // Volumes are 0..1. They are kept here so they apply as soon as the audio context exists.
  let vol = { master: 0.7, sfx: 0.8, music: 0.35, sfxOn: true, musicOn: true };
  const ramp = (param, value, seconds = 0.08) => param.setTargetAtTime(value, ctx.currentTime, seconds);

  function loopingNoise(filterType, frequency, q) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfx);
    src.start();
    return gain;
  }

  function makeVoice() {
    const out = ctx.createGain();
    out.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1.2;
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    const sub = ctx.createOscillator();
    sub.type = 'square';
    const subGain = ctx.createGain();
    subGain.gain.value = 0.4;
    saw.connect(filter);
    sub.connect(subGain);
    subGain.connect(filter);
    filter.connect(out);
    out.connect(sfx);
    saw.start();
    sub.start();
    return { out, filter, saw, sub };
  }

  function setVoice(v, rpm, throttle, gain) {
    const f = engineFrequency(rpm);
    ramp(v.saw.frequency, f, 0.05);
    ramp(v.sub.frequency, f / 2, 0.05);
    ramp(v.filter.frequency, engineCutoff(throttle, rpm));
    ramp(v.out.gain, gain);
  }

  function tone(freq, seconds, delay = 0, type = 'sine', vol = 0.4) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(gain);
    gain.connect(sfx);
    osc.start(t);
    osc.stop(t + seconds + 0.05);
  }

  // ---- Music: a small generated loop (bass, arpeggio, kick and hats), four bars of A minor, F, C, G ----
  const BPM = 132;
  const ROOTS = [110, 87.31, 130.81, 98];
  const CHORDS = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];

  function note(freq, start, length, type, gain, cutoff) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + length);
    osc.connect(filter);
    filter.connect(g);
    g.connect(musicBus);
    osc.start(start);
    osc.stop(start + length + 0.02);
  }

  function playStep(n, t) {
    const bar = Math.floor(n / 16) % 4;
    const pos = n % 16;
    const root = ROOTS[bar];
    if (pos % 4 === 0) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.8, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(g);
      g.connect(musicBus);
      osc.start(t);
      osc.stop(t + 0.22);
    }
    if (pos % 4 === 2) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.connect(hp);
      hp.connect(g);
      g.connect(musicBus);
      src.start(t, Math.random(), 0.06);
    }
    if ([0, 3, 6, 8, 11, 14].includes(pos)) note(root, t, 0.2, 'sawtooth', 0.3, 420);
    if (pos % 2 === 0) {
      const semi = CHORDS[bar][[0, 1, 2, 1][(pos / 2) % 4]];
      note(root * 4 * 2 ** (semi / 12), t, 0.16, 'triangle', 0.13, 2600);
    }
  }

  function scheduleMusic() {
    while (nextNote < ctx.currentTime + 0.4) {
      playStep(step, nextNote);
      nextNote += 60 / BPM / 4;
      step = (step + 1) % 64;
    }
  }

  function applyVolumes(first) {
    if (!ctx) return;
    ramp(master.gain, vol.master * MASTER_SCALE, first ? 0.001 : 0.05);
    ramp(sfx.gain, vol.sfxOn ? vol.sfx : 0, 0.05);
    const musicLevel = vol.musicOn ? vol.music * 0.8 : 0;
    ramp(musicBus.gain, musicLevel, 0.1);
    if (musicLevel > 0 && !musicTimer) {
      nextNote = ctx.currentTime + 0.1;
      musicTimer = setInterval(scheduleMusic, 100);
    } else if (musicLevel === 0 && musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  return {
    // Call from a click or key press. Safe to call again.
    start() {
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume();
        return;
      }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = vol.master * MASTER_SCALE;
      const limiter = ctx.createDynamicsCompressor();
      master.connect(limiter);
      sfx = ctx.createGain();
      sfx.connect(master);
      musicBus = ctx.createGain();
      musicBus.connect(master);
      applyVolumes(true);
      limiter.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      squeal = loopingNoise('bandpass', 1100, 6);
      wind = loopingNoise('lowpass', 500, 0.7);
      voices = Array.from({ length: 1 + BOT_VOICES }, makeVoice); // [player, nearest bots...]
    },

    // master, sfx and music are 0..1; sfxOn and musicOn switch a bus off completely.
    setVolumes(next) {
      vol = { ...vol, ...next };
      applyVolumes(false);
    },

    // Call every frame. state: { active, player: { rpm, throttle, slip, speed, airborne },
    // bots: [{ rpm, throttle, dist }] }. Everything fades out when not active (menu, pause, results).
    update(state) {
      if (!ctx) return;
      const p = state.player;
      if (!state.active || !p) {
        for (const v of voices) ramp(v.out.gain, 0);
        ramp(squeal.gain, 0);
        ramp(wind.gain, 0);
        return;
      }
      setVoice(voices[0], p.rpm, p.throttle, engineGain(p.throttle, p.rpm) * 0.35);
      for (let i = 0; i < BOT_VOICES; i++) {
        const b = state.bots[i];
        if (b) setVoice(voices[1 + i], b.rpm, b.throttle, engineGain(b.throttle, b.rpm) * 0.2 * distanceGain(b.dist));
        else ramp(voices[1 + i].out.gain, 0);
      }
      ramp(squeal.gain, squealGain(p.slip, p.speed, p.airborne), 0.05);
      ramp(wind.gain, windGain(p.speed), 0.2);
    },

    tone,

    // A dull bang: strength 0..1.
    thud(strength) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 200 + 500 * strength;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.9 * strength, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(sfx);
      src.start(t, Math.random() * 1.5, 0.35);
      tone(55, 0.25, 0, 'sine', 0.7 * strength);
    },

    jingle() {
      tone(523, 0.15, 0, 'triangle');
      tone(659, 0.15, 0.15, 'triangle');
      tone(784, 0.35, 0.3, 'triangle');
    },
  };
}
