import * as THREE from 'three';

const ROAD_Y = 0.05;
const WALL_HEIGHT = 1.2;
const WALL_GAP = 0.3; // distance from the road edge to the wall

function geometryFromPoints(pts) {
  const g = new THREE.BufferGeometry();
  g.setFromPoints(pts);
  return g;
}

// Vertex 2i is the right edge (or wall bottom), vertex 2i+1 the left edge (or wall top).
// Triangles (2i, 2j, 2i+1) and (2i+1, 2j, 2j+1) face up for the road.
function buildStrip(positions, count) {
  const indices = [];
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    indices.push(2 * i, 2 * j, 2 * i + 1, 2 * i + 1, 2 * j, 2 * j + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildRoad(track) {
  const { points, width } = track;
  const hw = width / 2;
  const n = points.length;
  const positions = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const p = points[i];
    positions.set([p.x + p.nx * hw, ROAD_Y, p.z + p.nz * hw], i * 6);
    positions.set([p.x - p.nx * hw, ROAD_Y, p.z - p.nz * hw], i * 6 + 3);
  }
  return new THREE.Mesh(
    buildStrip(positions, n),
    new THREE.MeshStandardMaterial({ color: 0x555b66 })
  );
}

// side = +1 for the right wall, -1 for the left wall.
function buildWall(track, side) {
  const { points, width } = track;
  const offset = side * (width / 2 + WALL_GAP);
  const n = points.length;
  const positions = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const x = p.x + p.nx * offset;
    const z = p.z + p.nz * offset;
    positions.set([x, ROAD_Y, z], i * 6);
    positions.set([x, ROAD_Y + WALL_HEIGHT, z], i * 6 + 3);
  }
  return new THREE.Mesh(
    buildStrip(positions, n),
    new THREE.MeshStandardMaterial({ color: 0xb0453a, side: THREE.DoubleSide })
  );
}

function buildStartLine(track) {
  const p = track.points[0];
  const hw = track.width / 2;
  const y = ROAD_Y + 0.02;
  const corner = (side, along) => new THREE.Vector3(
    p.x + p.nx * hw * side + p.tx * along,
    y,
    p.z + p.nz * hw * side + p.tz * along
  );
  const rightBack = corner(1, -1);
  const rightFront = corner(1, 1);
  const leftBack = corner(-1, -1);
  const leftFront = corner(-1, 1);

  const geo = new THREE.BufferGeometry();
  geo.setFromPoints([rightBack, rightFront, leftBack, leftBack, rightFront, leftFront]);
  return new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
}

export function buildTrackMesh(track) {
  const group = new THREE.Group();
  group.add(buildRoad(track));
  group.add(buildWall(track, 1));
  group.add(buildWall(track, -1));
  group.add(buildStartLine(track));
  return group;
}

// Racing line (yellow) and checkpoint gates (green).
export function buildDebugOverlay(track) {
  const group = new THREE.Group();
  const y = ROAD_Y + 0.1;
  const hw = track.width / 2;

  const line = track.points.map((p) => new THREE.Vector3(p.x, y, p.z));
  group.add(new THREE.LineLoop(geometryFromPoints(line), new THREE.LineBasicMaterial({ color: 0xffd166 })));

  const gates = [];
  for (const cp of track.checkpoints) {
    const p = track.points[cp.index];
    gates.push(
      new THREE.Vector3(p.x + p.nx * hw, y, p.z + p.nz * hw),
      new THREE.Vector3(p.x - p.nx * hw, y, p.z - p.nz * hw)
    );
  }
  group.add(new THREE.LineSegments(geometryFromPoints(gates), new THREE.LineBasicMaterial({ color: 0x06d6a0 })));

  return group;
}