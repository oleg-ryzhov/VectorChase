// Turns a map definition into a track and a world the game can drive on. Pure logic.
import { buildTrack } from '../track/track.js';
import { createWorld } from '../track/world.js';

function nearestControl(control, [x, z]) {
  let best = 0;
  control.forEach((c, i) => {
    if (Math.hypot(c.x - x, c.z - z) < Math.hypot(control[best].x - x, control[best].z - z)) best = i;
  });
  return best;
}

// shortcuts: [{ fromAt: [x, z], toAt: [x, z] }]: a car that leaves the road near fromAt and lands near toAt
// gets the progress of toAt.
export function prepareMap(config) {
  const track = buildTrack(config.control, config.options);
  const halfWidth = track.width / 2;
  track.shortcuts = (config.shortcuts ?? []).map((s) => {
    const from = track.points[track.controlIndex[nearestControl(config.control, s.fromAt)]];
    const toIndex = track.controlIndex[nearestControl(config.control, s.toAt)];
    return {
      fromS: from.s,
      toIndex,
      toS: track.points[toIndex].s,
      armBefore: s.armBefore ?? 60,
      armAfter: s.armAfter ?? 120,
      reach: halfWidth + 3, // must be back on the road itself
      window: 12,
    };
  });
  const features = config.features ?? [];
  const bare = createWorld(track, config.base, { features, waterLevel: config.waterLevel, terrainGrip: config.terrainGrip });
  const extra = config.populate ? config.populate(track, bare) : {};
  const obstacles = [...(config.obstacles ?? []), ...(extra.obstacles ?? [])];
  const world = createWorld(track, config.base, {
    features,
    obstacles,
    waterLevel: config.waterLevel,
    killY: config.killY,
    terrainGrip: config.terrainGrip,
  });
  return { config, track, world, buildings: extra.buildings ?? [], obstacles };
}
