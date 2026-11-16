import * as THREE from 'three';
import { fbm } from '../maps/util.js';

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// A square grid of terrain, coloured by height, steepness and the map's palette.
// theme: { terrainSize, terrainCell, ground: { low, high, rock, snow?, snowLine? }, water? }
export function buildTerrainMesh(world, theme = {}, center = { x: 0, z: 0 }) {
  const { terrainSize: size = 2800, terrainCell: cell = 8, ground = {} } = theme;
  const low = new THREE.Color(ground.low ?? 0x2f5d2a);
  const high = new THREE.Color(ground.high ?? 0x6b8f3c);
  const rock = new THREE.Color(ground.rock ?? 0x7b7468);
  const snow = new THREE.Color(ground.snow ?? 0xffffff);
  const segments = Math.round(size / cell);
  const side = segments + 1;
  const half = size / 2;
  const positions = new Float32Array(side * side * 3);
  let minY = Infinity;
  let maxY = -Infinity;

  for (let j = 0; j < side; j++) {
    for (let i = 0; i < side; i++) {
      const x = center.x - half + i * cell;
      const z = center.z - half + j * cell;
      const y = world.terrainHeight(x, z);
      const k = (j * side + i) * 3;
      positions[k] = x;
      positions[k + 1] = y;
      positions[k + 2] = z;
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  // Triangles (a, c, b) and (b, c, d) face up.
  const indices = new Uint32Array(segments * segments * 6);
  let n = 0;
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * side + i;
      const b = a + 1;
      const c = a + side;
      const d = c + 1;
      indices.set([a, c, b, b, c, d], n);
      n += 6;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  const normals = geometry.getAttribute('normal');
  const colors = new Float32Array(side * side * 3);
  const color = new THREE.Color();
  const range = Math.max(1, maxY - minY);
  const waterLevel = Number.isFinite(world.waterLevel) ? world.waterLevel : -Infinity;
  for (let v = 0; v < side * side; v++) {
    const x = positions[v * 3];
    const y = positions[v * 3 + 1];
    const z = positions[v * 3 + 2];
    color.copy(low).lerp(high, (y - minY) / range);
    color.lerp(rock, smooth(0.012, 0.09, 1 - normals.getY(v)));
    if (ground.snowLine !== undefined) color.lerp(snow, smooth(ground.snowLine, ground.snowLine + 30, y + 25 * fbm(x / 40, z / 40)));
    if (y < waterLevel + 2) color.lerp(rock, 0.6).multiplyScalar(0.7); // wet banks
    color.multiplyScalar(0.88 + 0.24 * fbm(x / 9, z / 9, 2)); // patchy ground
    colors[v * 3] = color.r;
    colors[v * 3 + 1] = color.g;
    colors[v * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  mesh.receiveShadow = true;
  return mesh;
}
