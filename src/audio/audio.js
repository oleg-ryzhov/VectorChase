// All sounds are generated with the Web Audio API, so there are no sound files.
// Browsers only allow audio after a click or key press, so nothing exists until start() is called.
import { SOUND_LEVELS, engineFrequency, engineGain, engineCutoff, squealGain, windGain, distanceGain } from './mapping.js';

const BOT_VOICES = 2; // only the nearest bots are heard, to keep it cheap

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let squeal = null;
  let wind = null;
  let voices = [];
  let level = 'medium';

  const volume = () => SOUND_LEVELS[level] ?? SOUND_LEVELS.medium;
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
    gain.connect(master);
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
    out.connect(master);
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
    gain.connect(master);
    osc.start(t);
    osc.stop(t + seconds + 0.05);
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
      master.gain.value = volume();
      const limiter = ctx.createDynamicsCompressor();
      master.connect(limiter);
      limiter.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      squeal = loopingNoise('bandpass', 1100, 6);
      wind = loopingNoise('lowpass', 500, 0.7);
      voices = Array.from({ length: 1 + BOT_VOICES }, makeVoice); // [player, nearest bots...]
    },

    // id: 'off' | 'low' | 'medium' | 'high'
    setLevel(id) {
      level = id;
      if (ctx) ramp(master.gain, volume(), 0.05);
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
      gain.connect(master);
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
