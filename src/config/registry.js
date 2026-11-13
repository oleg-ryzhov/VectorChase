// Single source of truth for every tunable value.
// Values are stored in the units shown here (kW, %, degrees...); src/physics/spec.js
// converts them to SI. Physics, UI and bots read through getParam() or readCarSpec();
// nothing caches values.

export const PARAMS = [
  // Chassis
  {
    id: 'chassis.mass', group: 'Chassis', label: 'Mass', unit: 'kg',
    min: 500, max: 3000, step: 10, default: 1200,
    description: 'Total vehicle mass including driver.',
  },
  {
    id: 'chassis.frontWeight', group: 'Chassis', label: 'Front weight', unit: '%',
    min: 40, max: 60, step: 0.5, default: 52,
    description: 'Share of the weight over the front axle. Moves the centre of gravity.',
  },
  {
    id: 'chassis.cgHeight', group: 'Chassis', label: 'Centre of gravity height', unit: 'm',
    min: 0.3, max: 0.8, step: 0.01, default: 0.5,
    description: 'Higher means more weight shifts between wheels when braking and cornering.',
  },

  // Aero
  {
    id: 'aero.dragArea', group: 'Aero', label: 'Drag area (Cd x area)', unit: 'm²',
    min: 0.3, max: 1.2, step: 0.01, default: 0.64,
    description: 'Air resistance. Lower means a higher top speed.',
  },
  {
    id: 'aero.downforce', group: 'Aero', label: 'Downforce area (Cl x area)', unit: 'm²',
    min: 0, max: 2, step: 0.05, default: 0.4,
    description: 'Pushes the car onto the road as speed rises, adding grip.',
  },

  // Suspension
  {
    id: 'suspension.rollFront', group: 'Suspension', label: 'Front roll stiffness share', unit: '%',
    min: 30, max: 70, step: 1, default: 55,
    description: 'Higher means the front tires take more of the cornering load transfer.',
  },

  // Engine
  {
    id: 'engine.power', group: 'Engine', label: 'Peak power', unit: 'kW',
    min: 50, max: 800, step: 5, default: 250,
    description: 'Peak engine output.',
  },
  {
    id: 'engine.redline', group: 'Engine', label: 'Redline', unit: 'rpm',
    min: 6000, max: 9000, step: 100, default: 7500,
    description: 'Maximum engine speed. Stretches the torque curve.',
  },
  {
    id: 'engine.braking', group: 'Engine', label: 'Engine braking', unit: '%',
    min: 0, max: 40, step: 1, default: 15,
    description: 'Drag from the engine when off the throttle.',
  },

  // Drivetrain
  {
    id: 'drivetrain.finalDrive', group: 'Drivetrain', label: 'Final drive ratio', unit: '',
    min: 2.5, max: 5, step: 0.05, default: 3.7,
    description: 'Higher is quicker acceleration but a lower top speed.',
  },
  {
    id: 'drivetrain.shiftRpm', group: 'Drivetrain', label: 'Upshift point', unit: 'rpm',
    min: 4800, max: 8800, step: 100, default: 6800,
    description: 'Engine speed at which the automatic gearbox changes up. Capped just below the redline.',
  },
  {
    id: 'drivetrain.frontBias', group: 'Drivetrain', label: 'Front drive share', unit: '%',
    min: 0, max: 100, step: 5, default: 0,
    description: '0 is rear-wheel drive, 50 is all-wheel drive, 100 is front-wheel drive.',
  },

  // Wheels
  {
    id: 'wheel.radius', group: 'Wheels', label: 'Wheel radius', unit: 'm',
    min: 0.28, max: 0.37, step: 0.005, default: 0.33,
    description: 'Larger wheels act like taller gearing and are heavier to spin up.',
  },
  {
    id: 'wheel.mass', group: 'Wheels', label: 'Wheel mass', unit: 'kg',
    min: 8, max: 40, step: 0.5, default: 18,
    description: 'Wheel, tire and brake disc. Heavier wheels spin up and slow down more slowly.',
  },

  // Tires
  {
    id: 'tire.friction', group: 'Tires', label: 'Friction coefficient', unit: 'μ',
    min: 0.1, max: 2, step: 0.01, default: 1.0,
    description: 'Scales maximum tire grip.',
  },
  {
    id: 'tire.peakSlipAngle', group: 'Tires', label: 'Peak slip angle', unit: '°',
    min: 4, max: 14, step: 0.5, default: 8,
    description: 'Sideways slip at which cornering grip peaks. Lower feels sharper but less forgiving.',
  },
  {
    id: 'tire.peakSlipRatio', group: 'Tires', label: 'Peak slip ratio', unit: '',
    min: 0.06, max: 0.25, step: 0.01, default: 0.12,
    description: 'Wheelspin or lock-up at which acceleration and braking grip peaks.',
  },
  {
    id: 'tire.loadSensitivity', group: 'Tires', label: 'Load sensitivity', unit: '%',
    min: 0, max: 30, step: 1, default: 10,
    description: 'How much grip a tire loses as its load rises.',
  },
  {
    id: 'tire.rollingResistance', group: 'Tires', label: 'Rolling resistance', unit: '',
    min: 0.005, max: 0.05, step: 0.001, default: 0.013,
    description: 'Constant drag from the tires.',
  },

  // Brakes
  {
    id: 'brakes.torque', group: 'Brakes', label: 'Total brake torque', unit: 'N·m',
    min: 1500, max: 9000, step: 100, default: 4600,
    description: 'Brake strength summed over all four wheels.',
  },
  {
    id: 'brakes.bias', group: 'Brakes', label: 'Front brake bias', unit: '%',
    min: 30, max: 80, step: 1, default: 65,
    description: 'Share of braking done by the front wheels.',
  },

  // Steering
  {
    id: 'steering.maxAngle', group: 'Steering', label: 'Maximum steering angle', unit: '°',
    min: 15, max: 45, step: 1, default: 32,
    description: 'Front wheel angle at full lock when standing still.',
  },
  {
    id: 'steering.speedRef', group: 'Steering', label: 'Steering falloff speed', unit: 'm/s',
    min: 5, max: 40, step: 1, default: 14,
    description: 'Speed at which steering lock has halved. Higher keeps more lock at speed.',
  },
];

const defs = new Map(PARAMS.map((p) => [p.id, p]));
const values = new Map(PARAMS.map((p) => [p.id, p.default]));
const listeners = new Set();

function getDef(id) {
  const def = defs.get(id);
  if (!def) throw new Error(`Unknown parameter: ${id}`);
  return def;
}

// listener(ids) is called with the ids that actually changed. Returns an unsubscribe function.
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(ids) {
  if (ids.length === 0) return;
  for (const listener of listeners) {
    try {
      listener(ids);
    } catch (err) {
      console.error('Parameter listener failed:', err);
    }
  }
}

export function getParam(id) {
  getDef(id);
  return values.get(id);
}

// Returns the stored value after the write. Invalid input leaves the
// current value unchanged. Out-of-range input is clamped.
export function setParam(id, value) {
  const def = getDef(id);
  const current = values.get(id);
  if (typeof value !== 'number' && typeof value !== 'string') return current;
  if (typeof value === 'string' && value.trim() === '') return current;
  const n = Number(value);
  if (!Number.isFinite(n)) return current;
  const clamped = Math.min(def.max, Math.max(def.min, n));
  if (clamped !== current) {
    values.set(id, clamped);
    notify([id]);
  }
  return clamped;
}

export function resetParam(id) {
  const def = getDef(id);
  if (values.get(id) !== def.default) {
    values.set(id, def.default);
    notify([id]);
  }
  return def.default;
}

export function resetAll() {
  const changed = [];
  for (const def of PARAMS) {
    if (values.get(def.id) !== def.default) {
      values.set(def.id, def.default);
      changed.push(def.id);
    }
  }
  notify(changed);
}
