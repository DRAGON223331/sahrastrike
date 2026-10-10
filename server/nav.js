// شبكة ملاحة للبوتات: خلايا 1م + A*
import { MAP } from '../shared/map.js';

const OX = -40, OZ = -30, W = 80, H = 60;
const blocked = new Uint8Array(W * H);

for (let j = 0; j < H; j++) {
  for (let i = 0; i < W; i++) {
    const cx = OX + i + 0.5, cz = OZ + j + 0.5;
    let bl = 0;
    for (const b of MAP.boxes) {
      if (b.h <= 1.0) continue;
      const px = Math.max(b.minX, Math.min(cx, b.maxX));
      const pz = Math.max(b.minZ, Math.min(cz, b.maxZ));
      if (Math.hypot(cx - px, cz - pz) < 0.46) { bl = 1; break; }
    }
    blocked[j * W + i] = bl;
  }
}

const cellOf = (x, z) => {
  const i = Math.max(0, Math.min(W - 1, Math.floor(x - OX)));
  const j = Math.max(0, Math.min(H - 1, Math.floor(z - OZ)));
  return [i, j];
};

export function isWalkable(x, z) {
  if (x < OX || x > OX + W || z < OZ || z > OZ + H) return false;
  const [i, j] = cellOf(x, z);
  return !blocked[j * W + i];
}

// أقرب نقطة سالكة (حلزونياً)
export function nearestWalkable(x, z) {
  const [ci, cj] = cellOf(x, z);
  if (!blocked[cj * W + ci]) return { x, z, i: ci, j: cj };
  for (let r = 1; r < 12; r++) {
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= W || j >= H) continue;
        if (!blocked[j * W + i]) return { x: OX + i + 0.5, z: OZ + j + 0.5, i, j };
      }
    }
  }
  return { x, z, i: ci, j: cj };
}

function lineClear(x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0;
  const L = Math.hypot(dx, dz);
  if (L < 0.01) return true;
  const nx = -dz / L * 0.32, nz = dx / L * 0.32;
  const steps = Math.ceil(L / 0.3);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = x0 + dx * t, z = z0 + dz * t;
    if (!isWalkable(x, z) || !isWalkable(x + nx, z + nz) || !isWalkable(x - nx, z - nz)) return false;
  }
  return true;
}

// كومة ثنائية بسيطة
class Heap {
  constructor() { this.a = []; }
  push(k, v) {
    const a = this.a; a.push([k, v]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a;
    if (!a.length) return null;
    const top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        let l = 2 * i + 1, r = l + 1, m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];

export function findPath(sx, sz, gx, gz) {
  const s = nearestWalkable(sx, sz), g = nearestWalkable(gx, gz);
  const start = s.j * W + s.i, goal = g.j * W + g.i;
  const gs = new Float32Array(W * H).fill(Infinity);
  const from = new Int32Array(W * H).fill(-1);
  const closed = new Uint8Array(W * H);
  const heap = new Heap();
  gs[start] = 0;
  heap.push(0, start);
  let found = false;
  while (heap.size) {
    const [, cur] = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) { found = true; break; }
    const ci = cur % W, cj = (cur / W) | 0;
    for (const [di, dj, c] of NB) {
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const n = nj * W + ni;
      if (blocked[n] || closed[n]) continue;
      if (di !== 0 && dj !== 0 && (blocked[cj * W + ni] || blocked[nj * W + ci])) continue;
      const ng = gs[cur] + c;
      if (ng < gs[n]) {
        gs[n] = ng; from[n] = cur;
        const hh = Math.max(Math.abs(ni - g.i), Math.abs(nj - g.j)) + 0.414 * Math.min(Math.abs(ni - g.i), Math.abs(nj - g.j));
        heap.push(ng + hh, n);
      }
    }
  }
  if (!found) return null;
  const pts = [];
  for (let c = goal; c !== -1; c = from[c]) {
    pts.push({ x: OX + (c % W) + 0.5, z: OZ + ((c / W) | 0) + 0.5 });
  }
  pts.reverse();
  // تنعيم المسار (string pulling)
  const out = [];
  let anchor = { x: sx, z: sz }, idx = 0;
  while (idx < pts.length) {
    let far = idx;
    for (let k = pts.length - 1; k > idx; k--) {
      if (lineClear(anchor.x, anchor.z, pts[k].x, pts[k].z)) { far = k; break; }
    }
    out.push(pts[far]);
    anchor = pts[far];
    idx = far + 1;
  }
  return out;
}

export const NAV = { blocked, W, H, OX, OZ };
