// The list of maps. Each entry builds its definition on demand.
import { buildOval, buildBowl } from './oval.js';
import { buildSuzuka, buildMonza } from './real.js';
import buildCity from './city.js';
import buildAlpine from './alpine.js';
import buildCanyon from './canyon.js';

export const MAPS = [
  { id: 'oval', name: 'Thunder Speedway', kind: 'Oval', blurb: 'NASCAR-style banked oval. Flat out, but the wall is right there.', build: buildOval },
  { id: 'bowl', name: 'Thunder Bowl', kind: 'Short track', blurb: 'Half-mile short track with 36 degree banking, like Bristol. Tight, steep and fast.', build: buildBowl },
  { id: 'suzuka', name: 'Suzuka Circuit', kind: 'Real F1', blurb: 'Japanese Grand Prix, 5.8 km. The back straight crosses over the Degner curves.', build: buildSuzuka },
  { id: 'monza', name: 'Monza', kind: 'Real circuit', blurb: 'The Temple of Speed, 5.8 km. Long straights and heavy braking.', build: buildMonza },
  { id: 'city', name: 'Neon Metropolis', kind: '3D city', blurb: 'Night city: a highway over the boulevard and a tunnel through a tower. Shortcut: jump the canal at the first bend (needs about 150 km/h).', build: buildCity },
  { id: 'alpine', name: 'Eiger Pass', kind: '3D mountain', blurb: 'Mountain tunnel, a bridge over a ravine and switchbacks. Shortcut: drive straight off the cliff-top ledge at about 120 km/h.', build: buildAlpine },
  { id: 'canyon', name: 'Red Mesa Canyon', kind: '3D canyon', blurb: 'Desert gorges, a mesa tunnel and a bridge. Shortcut: jump the 40 m gorge at the first bend.', build: buildCanyon },
];
