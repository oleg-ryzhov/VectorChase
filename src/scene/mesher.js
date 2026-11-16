import * as THREE from 'three';

// Collects flat-shaded triangles with optional colours and texture coordinates into one geometry.
export class Mesher {
  constructor({ colors = false } = {}) {
    this.p = [];
    this.uv = [];
    this.c = colors ? [] : null;
  }

  tri(a, b, c, ua = [0, 0], ub = [1, 0], uc = [0, 1], col) {
    this.p.push(...a, ...b, ...c);
    this.uv.push(...ua, ...ub, ...uc);
    if (this.c) {
      const k = col ?? [1, 1, 1];
      this.c.push(...k, ...k, ...k);
    }
  }

  // Corners in order around the quad.
  quad(a, b, c, d, uvs = [[0, 0], [1, 0], [1, 1], [0, 1]], col) {
    this.tri(a, b, c, uvs[0], uvs[1], uvs[2], col);
    this.tri(a, c, d, uvs[0], uvs[2], uvs[3], col);
  }

  // A box from its bottom centre, rotated about the vertical axis by yaw. sx is along the heading.
  box(cx, y0, cz, sx, sy, sz, yaw = 0, col) {
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const pt = (ax, ay, az) => [cx + ax * cos - az * sin, y0 + ay, cz + ax * sin + az * cos];
    const hx = sx / 2;
    const hz = sz / 2;
    const v = [
      pt(-hx, 0, -hz), pt(hx, 0, -hz), pt(hx, 0, hz), pt(-hx, 0, hz),
      pt(-hx, sy, -hz), pt(hx, sy, -hz), pt(hx, sy, hz), pt(-hx, sy, hz),
    ];
    for (const f of [[4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) {
      this.quad(v[f[0]], v[f[1]], v[f[2]], v[f[3]], undefined, col);
    }
  }

  // A building block: four walls with windows repeating every `module` metres, plus a roof.
  building(x0, x1, z0, z1, y0, y1, module = 28) {
    const w = (x1 - x0) / module;
    const d = (z1 - z0) / module;
    const h = (y1 - y0) / module;
    const wall = (a, b, c, e, repeat) => this.quad(a, b, c, e, [[0, 0], [repeat, 0], [repeat, h], [0, h]]);
    wall([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], w);
    wall([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], d);
    wall([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], w);
    wall([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], d);
    this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [[0, 0], [0, 0], [0, 0], [0, 0]]);
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.c) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals();
    return g;
  }

  get empty() {
    return this.p.length === 0;
  }
}
