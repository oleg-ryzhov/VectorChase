// Turns registry values (UI units) into the SI values the physics uses, plus derived values.
// Called once per physics step, so a changed parameter takes effect on the next step.
// Pure logic: no DOM or Three.js imports.

import { getParam } from '../config/registry.js';

export const WHEELBASE = 2.7; // m, fixed by the body model
export const TRACK = 1.6; // m, fixed by the body model

const DEG = Math.PI / 180;
const WHEEL_INERTIA_FACTOR = 0.7; // I = factor * mass * radius^2

export function readCarSpec() {
  const frontWeight = getParam('chassis.frontWeight') / 100;
  const wheelRadius = getParam('wheel.radius');
  const wheelMass = getParam('wheel.mass');
  const redline = getParam('engine.redline');
  const shiftRpm = Math.min(getParam('drivetrain.shiftRpm'), redline - 200);
  const brakeTotal = getParam('brakes.torque');
  const brakeBias = getParam('brakes.bias') / 100;

  return {
    mass: getParam('chassis.mass'),
    wheelbase: WHEELBASE,
    track: TRACK,
    // More weight on the front axle means the centre of gravity sits closer to it.
    cgToFront: (1 - frontWeight) * WHEELBASE,
    cgToRear: frontWeight * WHEELBASE,
    cgHeight: getParam('chassis.cgHeight'),
    rollShareFront: getParam('suspension.rollFront') / 100,

    dragArea: getParam('aero.dragArea'),
    downforceArea: getParam('aero.downforce'),

    enginePower: getParam('engine.power') * 1000, // W
    redline,
    engineBraking: getParam('engine.braking') / 100,

    finalDrive: getParam('drivetrain.finalDrive'),
    shiftRpm,
    downshiftMaxRpm: shiftRpm - 600,
    frontBias: getParam('drivetrain.frontBias') / 100,

    wheelRadius,
    wheelInertia: WHEEL_INERTIA_FACTOR * wheelMass * wheelRadius * wheelRadius,

    friction: getParam('tire.friction'),
    peakSlipTan: Math.tan(getParam('tire.peakSlipAngle') * DEG),
    peakSlipRatio: getParam('tire.peakSlipRatio'),
    loadSensitivity: getParam('tire.loadSensitivity') / 100,
    rollingResistance: getParam('tire.rollingResistance'),

    // Total brake torque is split front/rear, then shared between the two wheels of an axle.
    frontBrakeTorque: (brakeTotal * brakeBias) / 2,
    rearBrakeTorque: (brakeTotal * (1 - brakeBias)) / 2,

    maxSteer: getParam('steering.maxAngle') * DEG,
    steerSpeedRef: getParam('steering.speedRef'),
  };
}
