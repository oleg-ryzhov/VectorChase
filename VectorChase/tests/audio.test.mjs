import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SOUND_LEVELS,
  engineFrequency,
  engineGain,
  engineCutoff,
  squealGain,
  windGain,
  distanceGain,
  crashStrength,
  landingStrength,
} from '../src/audio/mapping.js';

test('engine pitch rises with revs and is clamped', () => {
  assert.equal(engineFrequency(6000), 200);
  assert.ok(engineFrequency(7000) > engineFrequency(3000));
  assert.equal(engineFrequency(0), engineFrequency(500));
  assert.equal(engineFrequency(99999), engineFrequency(12000));
});

test('engine gets louder and brighter with throttle', () => {
  assert.ok(engineGain(1, 5000) > engineGain(0, 5000));
  assert.ok(engineGain(1, 9000) <= 0.9 + 1e-9);
  assert.ok(engineCutoff(1, 5000) > engineCutoff(0, 5000));
});

test('tyres only squeal when sliding on the ground at speed', () => {
  assert.equal(squealGain(1, 30, false), 0);
  assert.equal(squealGain(2, 30, true), 0);
  assert.equal(squealGain(2, 0.5, false) < squealGain(2, 30, false), true);
  assert.ok(squealGain(1.5, 30, false) > 0);
  assert.ok(squealGain(9, 99, false) <= 0.5);
});

test('wind, distance, crash and landing mappings', () => {
  assert.equal(windGain(0), 0);
  assert.ok(windGain(60) > windGain(20));
  assert.equal(distanceGain(0), 1);
  assert.ok(distanceGain(30) < distanceGain(10));
  assert.equal(crashStrength(0.3), 0); // ordinary braking
  assert.ok(crashStrength(10) > 0 && crashStrength(99) === 1);
  assert.equal(landingStrength(2), 0);
  assert.ok(landingStrength(9) > 0 && landingStrength(99) === 1);
});

test('sound levels', () => {
  assert.equal(SOUND_LEVELS.off, 0);
  assert.ok(SOUND_LEVELS.low < SOUND_LEVELS.medium && SOUND_LEVELS.medium < SOUND_LEVELS.high);
});
