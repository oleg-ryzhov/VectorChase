// Bot personalities: fixed traits plus habits that are rolled with weights every corner.
// Pure logic: no DOM or Three.js imports.

// A small seeded random generator (0..1), so tests can replay a race.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// entries: [[value, weight], ...]. Zero weights are never picked.
export function pickWeighted(random, entries) {
  const total = entries.reduce((s, e) => s + Math.max(0, e[1]), 0);
  if (total <= 0) return entries[0][0];
  let r = random() * total;
  for (const [value, weight] of entries) {
    r -= Math.max(0, weight);
    if (r < 0) return value;
  }
  return entries[entries.length - 1][0];
}

// What a habit does through one corner. brake and grip scale the bot's limits (more than 1 means braking
// later or carrying more speed); entry, apex and exit are shares of the free road width: entry and exit
// swing to the outside, the apex to the inside.
export const HABITS = {
  smooth: { brake: 1, grip: 1, entry: 0.4, apex: 0.6, exit: 0.5 },
  lateBrake: { brake: 1.14, grip: 1, entry: 0.3, apex: 0.8, exit: 0.4 },
  earlyBrake: { brake: 0.86, grip: 0.97, entry: 0.5, apex: 0.5, exit: 0.6 },
  wideEntry: { brake: 1, grip: 1, entry: 0.95, apex: 0.9, exit: 0.8 },
  cutApex: { brake: 1, grip: 1, entry: 0.15, apex: 1, exit: 0.3 },
  overdrive: { brake: 1.07, grip: 1.05, entry: 0.5, apex: 0.7, exit: 0.5 },
};

// Slip-ups, rolled per corner with the personality's mistake chance.
export const MISTAKES = [['overcook', 3], ['lockup', 2], ['dawdle', 1]];

// pace: multipliers on the difficulty's grip and braking use. reaction: seconds before moving off the grid.
// mistake: chance of a slip-up per corner. aggression: wish to overtake. patience: willingness to wait behind.
// draft: tendency to sit in a car's wake and slingshot. shortcut: multiplier on the shortcut chance.
export const PERSONALITIES = [
  {
    id: 'apex', name: 'Apex', blurb: 'Clean and precise. Hits the apex, rarely errs, passes only when it is safe.',
    pace: { grip: 1, brake: 1 }, reaction: [0.15, 0.3], mistake: 0.03, aggression: 0.35, patience: 0.7, draft: 0.1, shortcut: 0.8,
    habits: [['smooth', 6], ['cutApex', 3], ['earlyBrake', 1], ['wideEntry', 1]],
  },
  {
    id: 'drift', name: 'Drift', blurb: 'Swings wide and carries speed through corners. Flashy, and slips up more often.',
    pace: { grip: 0.99, brake: 0.95 }, reaction: [0.1, 0.45], mistake: 0.08, aggression: 0.5, patience: 0.4, draft: 0.1, shortcut: 1.2,
    habits: [['wideEntry', 4], ['overdrive', 2], ['smooth', 3], ['lateBrake', 1]],
  },
  {
    id: 'nitro', name: 'Nitro', blurb: 'Brakes late and dives down the inside. Tries every shortcut and every gap.',
    pace: { grip: 1.02, brake: 1.07 }, reaction: [0.05, 0.2], mistake: 0.09, aggression: 0.9, patience: 0.15, draft: 0.2, shortcut: 2,
    habits: [['lateBrake', 5], ['overdrive', 3], ['cutApex', 2], ['smooth', 1]],
  },
  {
    id: 'vector', name: 'Vector', blurb: 'Calm and calculating. Brakes early, almost never errs, waits for the right moment.',
    pace: { grip: 0.98, brake: 0.97 }, reaction: [0.2, 0.35], mistake: 0.015, aggression: 0.25, patience: 0.9, draft: 0.5, shortcut: 0.5,
    habits: [['smooth', 7], ['earlyBrake', 2], ['cutApex', 1]],
  },
  {
    id: 'slipstream', name: 'Slipstream', blurb: 'Hides in your wake, then slingshots past on the straight.',
    pace: { grip: 1, brake: 1 }, reaction: [0.1, 0.3], mistake: 0.05, aggression: 0.6, patience: 0.5, draft: 1, shortcut: 1,
    habits: [['smooth', 3], ['wideEntry', 2], ['cutApex', 2], ['lateBrake', 2]],
  },
];
