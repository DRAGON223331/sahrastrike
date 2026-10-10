// فيزياء مشتركة: حركة اللاعب + تصادم + أشعة (raycast)
// اتجاه النظر: forward = (-sin(yaw), 0, -cos(yaw)), pitch موجب = لأعلى

export const P = {
  R: 0.4, H: 1.8, EYE: 1.62, HEAD: 1.45,
  RUN: 5.4, WALK: 2.7, JUMP: 7.2, G: 22, STEP: 0.35,
  MINX: -39.6, MAXX: 39.6, MINZ: -29.6, MAXZ: 29.6,
};

export function pushOut(p, boxes) {
  for (let it = 0; it < 2; it++) {
    for (const b of boxes) {
      if (b.h <= p.y + P.STEP) continue;
      const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
      const dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < P.R * P.R) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), push = P.R - d;
          p.x += (dx / d) * push;
          p.z += (dz / d) * push;
        } else {
          const l = p.x - b.minX, r = b.maxX - p.x, t = p.z - b.minZ, bt = b.maxZ - p.z;
          const m = Math.min(l, r, t, bt);
          if (m === l) p.x = b.minX - P.R;
          else if (m === r) p.x = b.maxX + P.R;
          else if (m === t) p.z = b.minZ - P.R;
          else p.z = b.maxZ + P.R;
        }
      }
    }
  }
}

export function groundAt(p, boxes) {
  let g = 0;
  const rr = 0.3 * 0.3;
  for (const b of boxes) {
    if (b.h <= p.y + P.STEP && b.h > g) {
      const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
      const dx = p.x - cx, dz = p.z - cz;
      if (dx * dx + dz * dz < rr) g = b.h;
    }
  }
  return g;
}

// inp: {fwd, str, yaw, walk, jump}
export function stepPlayer(p, inp, dt, boxes) {
  const sy = Math.sin(inp.yaw), cy = Math.cos(inp.yaw);
  const fx = -sy, fz = -cy, rx = cy, rz = -sy;
  let mx = fx * inp.fwd + rx * inp.str;
  let mz = fz * inp.fwd + rz * inp.str;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const sp = inp.walk ? P.WALK : P.RUN;
  const tx = mx * sp, tz = mz * sp;
  if (p.grounded) { p.vx = tx; p.vz = tz; }
  else {
    const k = Math.min(1, 4 * dt);
    p.vx += (tx - p.vx) * k;
    p.vz += (tz - p.vz) * k;
  }
  if (inp.jump && p.grounded) { p.vy = P.JUMP; p.grounded = false; }
  p.vy -= P.G * dt;
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  pushOut(p, boxes);
  p.y += p.vy * dt;
  const g = groundAt(p, boxes);
  if (p.y <= g) {
    p.y = g;
    if (p.vy < 0) p.vy = 0;
    p.grounded = true;
  } else {
    p.grounded = false;
  }
  p.x = Math.max(P.MINX, Math.min(P.MAXX, p.x));
  p.z = Math.max(P.MINZ, Math.min(P.MAXZ, p.z));
}

export function rayBox(ox, oy, oz, dx, dy, dz, b) {
  let tmin = 0, tmax = Infinity;
  const axes = [
    [ox, dx, b.minX, b.maxX],
    [oy, dy, 0, b.h],
    [oz, dz, b.minZ, b.maxZ],
  ];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return Infinity;
    } else {
      let t1 = (lo - o) / d, t2 = (hi - o) / d;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

export function rayWorld(boxes, ox, oy, oz, dx, dy, dz) {
  let best = Infinity;
  for (const b of boxes) {
    const t = rayBox(ox, oy, oz, dx, dy, dz, b);
    if (t < best) best = t;
  }
  return best;
}

// أسطوانة اللاعب. ترجع {t, head} أو null
export function rayPlayer(ox, oy, oz, dx, dy, dz, px, py, pz) {
  const r = 0.42;
  const fx = ox - px, fz = oz - pz;
  const a = dx * dx + dz * dz;
  if (a < 1e-9) return null;
  const b = 2 * (fx * dx + fz * dz);
  const c = fx * fx + fz * fz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t = (-b - sq) / (2 * a);
  const t2 = (-b + sq) / (2 * a);
  if (t2 < 0) return null;
  if (t < 0) t = 0;
  let y = oy + dy * t;
  if (y < py || y > py + P.H) {
    const y2 = oy + dy * t2;
    if (t2 > 0 && y2 >= py && y2 <= py + P.H) { t = t2; y = y2; } else return null;
  }
  return { t, head: y >= py + P.HEAD };
}

export function hasLOS(boxes, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const L = Math.hypot(dx, dy, dz);
  if (L < 1e-6) return true;
  const t = rayWorld(boxes, ax, ay, az, dx / L, dy / L, dz / L);
  return t >= L - 0.05;
}

export function angDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
