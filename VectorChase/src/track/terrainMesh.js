import * as THREE from 'three';
import { fbm } from '../maps/util.js';
import { cullTunnelTriangles } from './tunnelCut.js';
import { detailPixels } from './detailNoise.js';

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const DETAIL_METRES = 14; // one tile of the ground grain covers this many metres

let detailTexture = null;
function groundDetail() {
  if (detailTexture) return detailTexture;
  const size = 256;
  const grey = detailPixels(size);
  const rgba = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) rgba.set([grey[i], grey[i], grey[i], 255], i * 4);
  detailTexture = new THREE.DataTexture(rgba, size, size, THREE.RGBAFormat);
  detailTexture.wrapS = detailTexture.wrapT = THREE.RepeatWrapping;
  detailTexture.magFilter = THREE.LinearFilter;
  detailTexture.minFilter = THREE.LinearMipmapLinearFilter;
  detailTexture.generateMipmaps = true;
  detailTexture.anisotropy = 4;
  detailTexture.colorSpace = THREE.SRGBColorSpace;
  detailTexture.needsUpdate = true;
  return detailTexture;
}

// A square grid of terrain, coloured by height, steepness and the map's palette.
// theme: { terrainSize, terrainCell, ground: { low, high, rock, dry?, snow?, snowLine? }, water? }
// inTube (optional): from createTunnelCutter; terrain triangles inside a tunnel bore are left out.
export function buildTerrainMesh(world, theme = {}, center = { x: 0, z: 0 }, inTube = null) {
  const { terrainSize: size = 2800, terrainCell: cell = 8, ground = {} } = theme;
  const low = new THREE.Color(ground.low ?? 0x2f5d2a);
  const high = new THREE.Color(ground.high ?? 0x6b8f3c);
  const rock = new THREE.Color(ground.rock ?? 0x7b7468);
  const snow = new THREE.Color(ground.snow ?? 0xffffff);
  const dry = ground.dry !== undefined ? new THREE.Color(ground.dry) : high.clone().lerp(new THREE.Color(0xb9ab7a), 0.4);
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
  const uvs = new Float32Array(side * side * 2);
  const rockColor = new THREE.Color();
  const heightAt = (i, j) => positions[(Math.min(side - 1, Math.max(0, j)) * side + Math.min(side - 1, Math.max(0, i))) * 3 + 1];
  for (let v = 0; v < side * side; v++) {
    const x = positions[v * 3];
    const y = positions[v * 3 + 1];
    const z = positions[v * 3 + 2];
    const i = v % side;
    const j = (v - i) / side;
    uvs[v * 2] = x / DETAIL_METRES;
    uvs[v * 2 + 1] = z / DETAIL_METRES;
    const steep = smooth(0.012, 0.09, 1 - normals.getY(v));
    // Lush low ground, drier straw-coloured patches on a wide noise, and bare earth where it is driest.
    color.copy(low).lerp(high, (y - minY) / range);
    const patch = smooth(0.42, 0.72, fbm(x / 170 + 5.1, z / 170, 3));
    color.lerp(dry, 0.55 * patch * (1 - steep));
    // Steep ground shows layered rock: bands that follow the height, bent by noise.
    rockColor.copy(rock).multiplyScalar(0.86 + 0.28 * (0.5 + 0.5 * Math.sin(y * 0.7 + 5 * fbm(x / 70, z / 70, 3))));
    color.lerp(rockColor, steep);
    if (ground.snowLine !== undefined) color.lerp(snow, smooth(ground.snowLine, ground.snowLine + 30, y + 25 * fbm(x / 40, z / 40)));
    if (y < waterLevel + 2) color.lerp(rock, 0.6).multiplyScalar(0.7); // wet banks
    color.multiplyScalar(0.88 + 0.24 * fbm(x / 9, z / 9, 2)); // patchy ground
    // Hollows sit in shade and crests catch the light: the height against the average of the four neighbours.
    const around = (heightAt(i - 1, j) + heightAt(i + 1, j) + heightAt(i, j - 1) + heightAt(i, j + 1)) / 4;
    color.multiplyScalar(1.08 * (1 + 0.22 * Math.max(-1, Math.min(1, (y - around) / (cell * 0.3))))); // 1.08 makes up for the darker ground grain
    colors[v * 3] = color.r;
    colors[v * 3 + 1] = color.g;
    colors[v * 3 + 2] = color.b;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (inTube) geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from(cullTunnelTriangles(positions, indices, inTube)), 1));

  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, map: groundDetail(), roughness: 1, metalness: 0 }));
  mesh.receiveShadow = true;
  return mesh;
}
