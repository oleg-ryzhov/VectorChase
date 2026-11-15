import * as THREE from 'three';

const GRASS_LOW = new THREE.Color(0x2f5d2a);
const GRASS_HIGH = new THREE.Color(0x6b8f3c);
const ROCK = new THREE.Color(0x7b7468);

function smooth(t) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

// A square grid of terrain centred on the origin, coloured by height and steepness.
export function buildTerrainMesh(world, { size = 2800, cell = 8 } = {}) {
  const segments = Math.round(size / cell);
  const side = segments + 1;
  const half = size / 2;
  const positions = new Float32Array(side * side * 3);
  let minY = Infinity;
  let maxY = -Infinity;

  for (let j = 0; j < side; j++) {
    for (let i = 0; i < side; i++) {
      const x = -half + i * cell;
      const z = -half + j * cell;
      const y = world.terrainHeight(x, z);
      const k = (j * side + i) * 3;
      positions[k] = x;
      positions[k + 1] = y;
      positions[k + 2] = z;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
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
      indices[n++] = a;
      indices[n++] = c;
      indices[n++] = b;
      indices[n++] = b;
      indices[n++] = c;
      indices[n++] = d;
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
  for (let v = 0; v < side * side; v++) {
    const height = (positions[v * 3 + 1] - minY) / range;
    color.copy(GRASS_LOW).lerp(GRASS_HIGH, height);
    color.lerp(ROCK, smooth((1 - normals.getY(v) - 0.01) / 0.07));
    colors[v * 3] = color.r;
    colors[v * 3 + 1] = color.g;
    colors[v * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })
  );
}
