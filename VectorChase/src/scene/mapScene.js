// Builds everything you see for a prepared map: roads, walls, bridges, tunnels, terrain, water, sky and scenery.
import * as THREE from 'three';
import { Mesher } from './mesher.js';
import { buildTerrainMesh } from '../track/terrainMesh.js';
import { WALL_GAP, WALL_HEIGHT } from '../track/world.js';
import { createTunnelCutter } from '../track/tunnelCut.js';

const TILE = 20; // m of road per texture repeat
const TUNNEL_WALL = 3.4; // m
const BRIDGE_DEPTH = 1.3; // m of deck under the road
const PILLAR_EVERY = 24; // m

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roadTexture(night) {
  const r = rng(7);
  return makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = night ? '#2b2e38' : '#3d4048';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = Math.floor(40 + r() * 40);
      g.fillStyle = `rgba(${v},${v},${v + 4},0.35)`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
    g.fillStyle = '#e8e8e8'; // edge lines
    g.fillRect(8, 0, 6, h);
    g.fillRect(w - 14, 0, 6, h);
    g.fillStyle = '#f2f2f2'; // dashed centre line
    g.fillRect(w / 2 - 3, 0, 6, h * 0.4);
  });
}

function checkerTexture() {
  return makeCanvas(128, 32, (g) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 ? '#111' : '#fff';
      g.fillRect(x * 16, y * 16, 16, 16);
    }
  });
}

// Window textures for buildings: 8 x 8 windows per tile.
function facadeTextures() {
  const r = rng(11);
  const lit = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) lit.push(r() < 0.45 ? ['#ffd98a', '#dfe8ff', '#6fe3ff', '#ff6fd8'][Math.floor(r() * 4)] : null);
  const draw = (emit) => (g, w) => {
    g.fillStyle = emit ? '#000' : '#10141f';
    g.fillRect(0, 0, w, w);
    lit.forEach((c, i) => {
      g.fillStyle = emit ? c ?? '#000' : '#1c2740';
      g.fillRect((i % 8) * 32 + 6, Math.floor(i / 8) * 32 + 6, 20, 20);
    });
  };
  return { map: makeCanvas(256, 256, draw(false)), emissive: makeCanvas(256, 256, draw(true)) };
}

const hex = (h) => new THREE.Color(h);

export function buildMapScene(prepared) {
  const { config, track, world, obstacles } = prepared;
  const theme = config.theme;
  const group = new THREE.Group();
  const { points: pts, width, spacing } = track;
  const n = pts.length;
  const hw = width / 2;
  const night = !!theme.night;
  const tanB = pts.map((p) => Math.tan(p.bank));
  const at = (i, o, h = 0) => {
    const p = pts[i];
    return [p.x + p.nx * o, p.y - o * tanB[i] + h, p.z + p.nz * o];
  };
  const wrap = (i) => (i + 1) % n;
  const add = (mesh, shadow = false) => {
    mesh.receiveShadow = shadow;
    group.add(mesh);
    return mesh;
  };
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTexture(night), roughness: 0.9, side: THREE.DoubleSide });

  // ---- Road ----
  const road = new Mesher();
  for (let i = 0; i < n; i++) {
    const j = wrap(i);
    const va = pts[i].s / TILE;
    const vb = (pts[i].s + spacing) / TILE;
    road.quad(at(i, hw), at(i, -hw), at(j, -hw), at(j, hw), [[0, va], [1, va], [1, vb], [0, vb]]);
  }
  add(new THREE.Mesh(road.geometry(), roadMat), true);

  // Start line.
  const start = new Mesher();
  const along = (o, k) => {
    const p = pts[0];
    return [p.x + p.nx * o + p.tx * k, p.y - o * tanB[0] + p.grade * k + 0.03, p.z + p.nz * o + p.tz * k];
  };
  start.quad(along(hw, -2), along(-hw, -2), along(-hw, 2), along(hw, 2), [[0, 0], [1, 0], [1, 1], [0, 1]]);
  const startTex = checkerTexture();
  startTex.repeat.set(Math.max(1, Math.round(width / 3.5)), 1);
  add(new THREE.Mesh(start.geometry(), new THREE.MeshBasicMaterial({ map: startTex, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));

  // ---- Walls (with gaps where the map has them) ----
  const wallColors = (theme.kind === 'city' ? [[0.1, 0.9, 1], [1, 0.2, 0.8]] : theme.kind === 'oval' ? [[0.95, 0.95, 0.95], [0.15, 0.3, 0.8]] : [[0.85, 0.85, 0.85], [0.75, 0.2, 0.18]]);
  const walls = new Mesher({ colors: true });
  for (let i = 0; i < n; i++) {
    const j = wrap(i);
    const col = wallColors[Math.floor(pts[i].s / 6) % 2];
    for (const side of [1, -1]) {
      if (side > 0 ? pts[i].gr : pts[i].gl) continue;
      const inner = side * (hw + WALL_GAP);
      const outer = side * (hw + WALL_GAP + 0.5);
      const P = (k, o, h) => at(k, o, h);
      walls.quad(P(i, inner, 0), P(j, inner, 0), P(j, inner, WALL_HEIGHT), P(i, inner, WALL_HEIGHT), undefined, col);
      walls.quad(P(i, inner, WALL_HEIGHT), P(j, inner, WALL_HEIGHT), P(j, outer, WALL_HEIGHT), P(i, outer, WALL_HEIGHT), undefined, col);
      walls.quad(P(i, outer, WALL_HEIGHT), P(j, outer, WALL_HEIGHT), P(j, outer, 0), P(i, outer, 0), undefined, col);
    }
  }
  const wallMat = theme.kind === 'city'
    ? new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
  add(new THREE.Mesh(walls.geometry(), wallMat));

  // ---- Kerbs on the inside of fast corners (circuits only) ----
  if (theme.kind === 'circuit') {
    const kerbs = new Mesher({ colors: true });
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      if (Math.abs(a.curvature) < 0.004 || a.mode !== 'g') continue;
      const side = a.curvature > 0 ? 1 : -1;
      const j = wrap(i);
      const col = Math.floor(a.s / 3) % 2 ? [0.85, 0.12, 0.1] : [0.95, 0.95, 0.95];
      kerbs.quad(at(i, side * (hw - 0.1), 0.03), at(j, side * (hw - 0.1), 0.03), at(j, side * (hw + 1.1), 0.03), at(i, side * (hw + 1.1), 0.03), undefined, col);
    }
    if (!kerbs.empty) add(new THREE.Mesh(kerbs.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));
  }

  // ---- Bridges: deck, side faces and pillars ----
  const concrete = new Mesher();
  const stoneMat = new THREE.MeshStandardMaterial({ color: night ? 0x3a3d48 : 0x9a9a96, roughness: 0.95, side: THREE.DoubleSide });
  const pillarEvery = Math.max(1, Math.round(PILLAR_EVERY / spacing));
  for (let i = 0; i < n; i++) {
    if (pts[i].mode !== 'b') continue;
    const j = wrap(i);
    for (const side of [1, -1]) concrete.quad(at(i, side * hw, 0), at(j, side * hw, 0), at(j, side * hw, -BRIDGE_DEPTH), at(i, side * hw, -BRIDGE_DEPTH));
    concrete.quad(at(i, hw, -BRIDGE_DEPTH), at(i, -hw, -BRIDGE_DEPTH), at(j, -hw, -BRIDGE_DEPTH), at(j, hw, -BRIDGE_DEPTH));
    if (i % pillarEvery === 0) {
      const p = pts[i];
      const top = p.y - BRIDGE_DEPTH;
      const ground = world.terrainHeight(p.x, p.z);
      if (top - ground > 1.5 && !world.roadBelow(p.x, p.z, top, 5)) concrete.box(p.x, ground - 2, p.z, 2.2, top - ground + 2, Math.min(hw * 1.4, 7), Math.atan2(p.tz, p.tx));
    }
  }
  if (!concrete.empty) add(new THREE.Mesh(concrete.geometry(), stoneMat));

  // ---- Tunnels: arched liner, lights and portal frames ----
  const liner = new Mesher();
  const frames = new Mesher();
  const lights = new Mesher();
  const W = hw + WALL_GAP + 0.4;
  const ring = (i, extra = 0) => {
    const w = W + extra;
    const wh = TUNNEL_WALL + extra;
    const ah = W * 0.5 + extra * 0.6;
    const out = [at(i, -w, 0), at(i, -w, wh)];
    for (let k = 1; k < 12; k++) {
      const t = (Math.PI * k) / 12;
      out.push(at(i, -w * Math.cos(t), wh + ah * Math.sin(t)));
    }
    out.push(at(i, w, wh), at(i, w, 0));
    return out;
  };
  const strip = (m, ra, rb) => {
    for (let k = 0; k < ra.length - 1; k++) m.quad(ra[k], ra[k + 1], rb[k + 1], rb[k]);
  };
  for (let i = 0; i < n; i++) {
    if (pts[i].mode !== 't') continue;
    const j = wrap(i);
    strip(liner, ring(i), ring(j));
    if (i % 4 === 0) {
      const c = ring(i)[7];
      lights.box(c[0], c[1] - 0.35, c[2], 3, 0.15, 1, Math.atan2(pts[i].tz, pts[i].tx));
    }
    if (pts[(i - 1 + n) % n].mode !== 't') strip(frames, ring(i), ring(i, 3.5));
    if (pts[j].mode !== 't') strip(frames, ring(j), ring(j, 3.5));
  }
  // A rock hull around the liner: where the mountain is cut away at a portal, rock shows instead of sky.
  const hull = new Mesher();
  for (let i = 0; i < n; i++) {
    if (pts[i].mode === 't') strip(hull, ring(i, 0.9), ring(wrap(i), 0.9));
  }
  if (!hull.empty) add(new THREE.Mesh(hull.geometry(), new THREE.MeshStandardMaterial({ color: theme.ground?.rock ?? 0x7b7468, roughness: 1, side: THREE.DoubleSide })));
  if (!liner.empty) {
    add(new THREE.Mesh(liner.geometry(), new THREE.MeshStandardMaterial({ color: 0x6a6e76, roughness: 0.9, side: THREE.DoubleSide })));
    add(new THREE.Mesh(frames.geometry(), new THREE.MeshStandardMaterial({ color: 0x8d8a82, roughness: 0.95, side: THREE.DoubleSide })));
    add(new THREE.Mesh(lights.geometry(), new THREE.MeshBasicMaterial({ color: 0xfff2c8 })));
  }

  // ---- Terrain and water ----
  const center = config.center ?? { x: 0, z: 0 };
  add(buildTerrainMesh(world, theme, center, createTunnelCutter(pts, { halfWidth: W, wallH: TUNNEL_WALL })), true);
  if (Number.isFinite(world.waterLevel)) {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(theme.terrainSize, theme.terrainSize),
      new THREE.MeshStandardMaterial({ color: theme.water ?? 0x1d5a8c, transparent: true, opacity: 0.88, roughness: 0.15, metalness: 0.2 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(center.x, world.waterLevel, center.z);
    group.add(water);
  }

  // ---- Buildings, lamps and towers (city) ----
  if (theme.kind === 'city') {
    const tex = facadeTextures();
    const city = new Mesher();
    for (const b of prepared.buildings) city.building(b.x0, b.x1, b.z0, b.z1, 0, b.top);
    for (const o of obstacles) if (o.top >= 100 && !prepared.buildings.includes(o)) city.building(o.x0, o.x1, o.z0, o.z1, o.bottom ?? 0, o.top);
    add(new THREE.Mesh(city.geometry(), new THREE.MeshStandardMaterial({ map: tex.map, emissive: 0xffffff, emissiveMap: tex.emissive, emissiveIntensity: 1.3, roughness: 0.5, metalness: 0.3 })));
    const lampPositions = [];
    const poles = new Mesher();
    for (let i = 0; i < n; i += 7) {
      if (pts[i].mode === 't') continue;
      const side = (i / 7) % 2 ? 1 : -1;
      const o = side * (hw + 1.6);
      const base = at(i, o, 0);
      poles.box(base[0], base[1], base[2], 0.25, 5.5, 0.25);
      lampPositions.push([base[0], base[1] + 5.6, base[2]]);
    }
    add(new THREE.Mesh(poles.geometry(), new THREE.MeshStandardMaterial({ color: 0x222633 })));
    const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe3a0 }), lampPositions.length);
    const m4 = new THREE.Matrix4();
    lampPositions.forEach((p, k) => lamps.setMatrixAt(k, m4.setPosition(p[0], p[1], p[2])));
    group.add(lamps);
  }

  // ---- Grandstands (circuits and ovals) ----
  if (theme.stands || theme.kind === 'oval') {
    const stands = new Mesher({ colors: true });
    const r = rng(5);
    const step = Math.round(14 / spacing);
    for (let i = 0; i < n; i += step) {
      const p = pts[i];
      const near = theme.kind === 'oval' ? Math.abs(p.curvature) < 1e-4 : p.s > track.length - 320 || p.s < 120;
      if (!near || p.mode !== 'g') continue;
      const yaw = Math.atan2(p.tz, p.tx);
      const base = Math.min(...[at(i, hw + 14)[1], world.terrainHeight(...[at(i, hw + 14)[0], at(i, hw + 14)[2]])]);
      for (let tier = 0; tier < 3; tier++) {
        const o = hw + 14 + tier * 3.5;
        const c = at(i, o);
        const col = [[0.8, 0.15, 0.15], [0.15, 0.3, 0.8], [0.9, 0.9, 0.9]][Math.floor(r() * 3)];
        stands.box(c[0], base, c[2], 13.5, 2.6 * (tier + 1), 3.5, yaw, col);
      }
    }
    if (!stands.empty) add(new THREE.Mesh(stands.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })));
  }

  // ---- Trees, cacti and rocks ----
  const r = rng(99);
  const spot = (clearance) => {
    for (let tries = 0; tries < 40; tries++) {
      const x = center.x + (r() - 0.5) * theme.terrainSize * 0.92;
      const z = center.z + (r() - 0.5) * theme.terrainSize * 0.92;
      if (world.roadDistance(x, z) < clearance) continue;
      const y = world.terrainHeight(x, z);
      if (y < (Number.isFinite(world.waterLevel) ? world.waterLevel + 3 : -1e9)) continue;
      if (Math.abs(world.terrainHeight(x + 3, z) - y) > 2.5 || Math.abs(world.terrainHeight(x, z + 3) - y) > 2.5) continue;
      return [x, y, z];
    }
    return null;
  };
  // Places count objects; every part (trunk, crown...) shares the same positions.
  const scatter = (count, parts, clearance, scaleRange, accept = () => true) => {
    const meshes = parts.map((part) => new THREE.InstancedMesh(part.geometry, part.material, count));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    let used = 0;
    for (let k = 0; k < count; k++) {
      const p = spot(clearance);
      if (!p || !accept(p)) continue;
      const s = scaleRange[0] + r() * (scaleRange[1] - scaleRange[0]);
      e.set(0, r() * Math.PI * 2, 0);
      m.compose(v.set(p[0], p[1], p[2]), q.setFromEuler(e), sc.set(s, s * (0.8 + r() * 0.5), s));
      const t = r();
      meshes.forEach((mesh, i) => {
        mesh.setMatrixAt(used, m);
        if (parts[i].tint) mesh.setColorAt(used, parts[i].tint(t));
      });
      used++;
    }
    meshes.forEach((mesh) => {
      mesh.count = used;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      group.add(mesh);
    });
  };
  if (theme.trees) {
    const snowLine = theme.ground.snowLine ?? Infinity;
    scatter(
      theme.trees,
      [
        { geometry: new THREE.CylinderGeometry(0.35, 0.5, 3, 5).translate(0, 1.5, 0), material: new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 1 }) },
        { geometry: new THREE.ConeGeometry(2.4, 7, 7).translate(0, 6, 0), material: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), tint: (t) => new THREE.Color().setHSL(0.3 + t * 0.06, 0.5, 0.18 + t * 0.12) },
      ],
      22, [0.9, 1.6], (p) => p[1] < snowLine * 0.8
    );
  }
  if (theme.cactus) {
    scatter(theme.cactus, [{ geometry: new THREE.CylinderGeometry(0.4, 0.5, 3.6, 6).translate(0, 1.8, 0), material: new THREE.MeshStandardMaterial({ color: 0x4d7a3a, roughness: 1 }) }], 16, [0.8, 1.5]);
    scatter(260, [{ geometry: new THREE.DodecahedronGeometry(2.2).translate(0, 1, 0), material: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), tint: (t) => new THREE.Color().setHSL(0.04 + t * 0.03, 0.5, 0.3 + t * 0.12) }], 14, [0.7, 2.4]);
  }

  // ---- Sky ----
  const sky = new THREE.SphereGeometry(5000, 24, 14);
  const top = hex(theme.sky[0]);
  const horizon = hex(theme.sky[1]);
  const skyColors = [];
  const c = new THREE.Color();
  const pos = sky.getAttribute('position');
  for (let v = 0; v < pos.count; v++) {
    c.copy(horizon).lerp(top, Math.pow(Math.max(0, pos.getY(v) / 5000), 0.55));
    skyColors.push(c.r, c.g, c.b);
  }
  sky.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
  const dome = new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  group.add(dome);
  const follow = [dome];
  if (night) {
    const sr = rng(3);
    const starPos = [];
    for (let k = 0; k < 1400; k++) {
      const a = sr() * Math.PI * 2;
      const y = 0.05 + sr() * 0.95;
      const rr = Math.sqrt(1 - y * y);
      starPos.push(Math.cos(a) * rr * 4500, y * 4500, Math.sin(a) * rr * 4500);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, fog: false, depthWrite: false }));
    stars.frustumCulled = false;
    group.add(stars);
    follow.push(stars);
  }

  return {
    group,
    lights: {
      hemi: night ? { sky: 0x5a6ab8, ground: 0x15161f, intensity: 0.6 } : { sky: 0xffffff, ground: 0x334455, intensity: 1.0 },
      sun: night ? { color: 0x8fa0ff, intensity: 0.8 } : { color: 0xfff3dc, intensity: 2.0 },
      dir: theme.sunDir ?? [0.5, 0.8, 0.35],
      headlights: night,
    },
    // Keeps the sky centred on the camera.
    update(focus) {
      for (const o of follow) o.position.copy(focus);
    },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
          m.map?.dispose();
          m.emissiveMap?.dispose();
          m.dispose();
        }
      });
    },
  };
}
