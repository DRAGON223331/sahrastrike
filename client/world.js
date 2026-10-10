// بناء العالم: خامات مولّدة بالكانفاس (طابع صحراوي عربي) + مباني وقباب ومآذن وسماء
// لو حطيت صور في /assets (sand.jpg, facade.jpg, clay.jpg, crate.jpg, sky.jpg) هتتحمّل بدل المولّدة
import * as THREE from 'three';
import { MAP } from '/shared/map.js';

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cv(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// ضوضاء قيمة دورية (تتكرر بدون خطوط)
function tileNoise(size, freq, rnd) {
  const g = new Float32Array(freq * freq);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const out = new Float32Array(size * size);
  const sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    const v = (y / size) * freq, y0 = Math.floor(v), fy = sm(v - y0);
    for (let x = 0; x < size; x++) {
      const u = (x / size) * freq, x0 = Math.floor(u), fx = sm(u - x0);
      const a = g[(y0 % freq) * freq + (x0 % freq)], b = g[(y0 % freq) * freq + ((x0 + 1) % freq)];
      const c = g[((y0 + 1) % freq) * freq + (x0 % freq)], d = g[((y0 + 1) % freq) * freq + ((x0 + 1) % freq)];
      out[y * size + x] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    }
  }
  return out;
}

function fbm(size, octaves, seed) {
  const rnd = mulberry32(seed);
  const out = new Float32Array(size * size);
  let amp = 1, tot = 0;
  for (let o = 0; o < octaves; o++) {
    const n = tileNoise(size, 4 << o, rnd);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

function sandCanvas() {
  const S = 512, c = cv(S), g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const n1 = fbm(S, 5, 11), n2 = fbm(S, 3, 99);
  const c1 = [196, 160, 100], c2 = [232, 200, 140];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const ripple = Math.sin(((y / S) * 28 + n2[i] * 6) * Math.PI * 2) * 0.5 + 0.5;
      const t = Math.min(1, Math.max(0, n1[i] * 1.1 + ripple * 0.18 - 0.05));
      const col = mix(c1, c2, t);
      const grain = (Math.random() - 0.5) * 14;
      img.data[i * 4] = col[0] + grain; img.data[i * 4 + 1] = col[1] + grain; img.data[i * 4 + 2] = col[2] + grain; img.data[i * 4 + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function grain(g, S, count, alpha) {
  for (let i = 0; i < count; i++) {
    const v = Math.random() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * alpha})`;
    g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

function blocks(g, S, rows, cols, base, rnd) {
  const bh = S / rows, bw = S / cols;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? bw / 2 : 0;
    for (let k = -1; k <= cols; k++) {
      const x = k * bw + off;
      const j = (rnd() - 0.5) * 16;
      g.fillStyle = `rgb(${base[0] + j},${base[1] + j * 0.9},${base[2] + j * 0.7})`;
      g.fillRect(x, r * bh, bw, bh);
      g.strokeStyle = 'rgba(80,52,24,0.38)'; g.lineWidth = 2;
      g.strokeRect(x + 1, r * bh + 1, bw - 2, bh - 2);
    }
  }
}

function archPath(g, x, w, ya, yb) {
  g.beginPath();
  g.moveTo(x, yb); g.lineTo(x, ya + w / 2);
  g.arc(x + w / 2, ya + w / 2, w / 2, Math.PI, 0);
  g.lineTo(x + w, yb); g.closePath();
}

// نقش هندسي (معينات) في الشريط العلوي
function geoBand(g, S, y, h) {
  g.fillStyle = '#9b6a2e'; g.fillRect(0, y, S, h);
  g.fillStyle = '#e7c27a';
  const step = h;
  for (let x = 0; x < S; x += step) {
    g.beginPath(); g.moveTo(x + step / 2, y + 4); g.lineTo(x + step - 4, y + h / 2); g.lineTo(x + step / 2, y + h - 4); g.lineTo(x + 4, y + h / 2); g.closePath(); g.fill();
  }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, S, 3); g.fillRect(0, y + h - 3, S, 3);
}

function facadeCanvas(variant) {
  const S = 512, c = cv(S), g = c.getContext('2d');
  const rnd = mulberry32(100 + variant);
  blocks(g, S, 8, 4, [212, 176, 122], rnd);
  geoBand(g, S, 22, 44);
  // قاعدة
  g.fillStyle = 'rgba(70,45,20,0.28)'; g.fillRect(0, S - 36, S, 36);
  if (variant === 0) {
    // نافذة مقوسة بمشربية
    const x = 190, w = 132, ya = 130, yb = 330;
    archPath(g, x - 10, w + 20, ya - 10, yb + 8); g.fillStyle = '#f0dcae'; g.fill();
    archPath(g, x, w, ya, yb); g.fillStyle = '#2a1a0c'; g.fill();
    g.save(); archPath(g, x, w, ya, yb); g.clip();
    g.strokeStyle = '#b98a3a'; g.lineWidth = 3;
    for (let k = -6; k < 14; k++) { g.beginPath(); g.moveTo(x + k * 22, ya); g.lineTo(x + k * 22 + 160, ya + 200); g.stroke(); g.beginPath(); g.moveTo(x + k * 22 + 160, ya); g.lineTo(x + k * 22, ya + 200); g.stroke(); }
    g.restore();
    g.fillStyle = '#6a4520'; g.fillRect(x - 16, yb + 8, w + 32, 12);
  } else {
    // باب مقوس كبير + نافذتان صغيرتان
    const x = 176, w = 160, ya = 236, yb = 512 - 36;
    archPath(g, x - 12, w + 24, ya - 12, yb); g.fillStyle = '#f0dcae'; g.fill();
    archPath(g, x, w, ya, yb); g.fillStyle = '#4a2c14'; g.fill();
    g.strokeStyle = '#2a190a'; g.lineWidth = 4;
    for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(x + k * w / 5, ya + 40); g.lineTo(x + k * w / 5, yb); g.stroke(); }
    g.fillStyle = '#d9a640'; g.beginPath(); g.arc(x + w * 0.62, yb - 110, 6, 0, 7); g.fill();
    for (const wx of [60, 400]) {
      archPath(g, wx, 52, 140, 230); g.fillStyle = '#2a1a0c'; g.fill();
      g.strokeStyle = '#e7c27a'; g.lineWidth = 4; archPath(g, wx - 3, 58, 137, 233); g.stroke();
    }
  }
  const sh = g.createLinearGradient(0, 380, 0, 512);
  sh.addColorStop(0, 'rgba(90,60,30,0)'); sh.addColorStop(1, 'rgba(90,60,30,0.35)');
  g.fillStyle = sh; g.fillRect(0, 380, S, 132);
  grain(g, S, 5000, 0.12);
  return c;
}

function clayCanvas() {
  const S = 512, c = cv(S), g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const n = fbm(S, 5, 7), m = fbm(S, 3, 31);
  const a = [176, 120, 76], b = [214, 162, 104];
  for (let i = 0; i < S * S; i++) {
    const col = mix(a, b, Math.min(1, n[i] * 1.2 + (m[i] - 0.5) * 0.4));
    const gr = (Math.random() - 0.5) * 12;
    img.data[i * 4] = col[0] + gr; img.data[i * 4 + 1] = col[1] + gr; img.data[i * 4 + 2] = col[2] + gr; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const rnd = mulberry32(5);
  g.strokeStyle = 'rgba(60,35,18,0.35)'; g.lineWidth = 1.5;
  for (let i = 0; i < 14; i++) {
    let x = rnd() * S, y = rnd() * S; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 40; y += rnd() * 30; g.lineTo((x + S) % S, y); }
    g.stroke();
  }
  return c;
}

function crateCanvas() {
  const S = 256, c = cv(S), g = c.getContext('2d');
  const rnd = mulberry32(21);
  for (let i = 0; i < 6; i++) {
    const j = (rnd() - 0.5) * 24;
    g.fillStyle = `rgb(${150 + j},${104 + j * 0.8},${58 + j * 0.5})`;
    g.fillRect(0, i * S / 6, S, S / 6);
    g.strokeStyle = 'rgba(40,24,10,0.55)'; g.lineWidth = 2; g.strokeRect(0, i * S / 6, S, S / 6);
    g.strokeStyle = 'rgba(50,30,12,0.25)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, i * S / 6 + 12 + rnd() * 10); g.bezierCurveTo(S * 0.3, i * S / 6 + 8, S * 0.6, i * S / 6 + 22, S, i * S / 6 + 14); g.stroke();
  }
  g.strokeStyle = '#2a2a2a'; g.lineWidth = 12; g.strokeRect(6, 6, S - 12, S - 12);
  g.beginPath(); g.moveTo(10, 10); g.lineTo(S - 10, S - 10); g.moveTo(S - 10, 10); g.lineTo(10, S - 10); g.stroke();
  g.fillStyle = '#c9a86a';
  for (const [x, y] of [[14, 14], [S - 14, 14], [14, S - 14], [S - 14, S - 14]]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
  grain(g, S, 1200, 0.12);
  return c;
}

function roofCanvas() {
  const S = 256, c = cv(S), g = c.getContext('2d');
  g.fillStyle = '#b8935a'; g.fillRect(0, 0, S, S);
  grain(g, S, 2500, 0.2);
  g.strokeStyle = 'rgba(70,45,20,0.4)'; g.lineWidth = 6; g.strokeRect(0, 0, S, S);
  return c;
}

function rugCanvas(letter) {
  const S = 512, c = cv(S), g = c.getContext('2d');
  g.fillStyle = '#7d1f1a'; g.fillRect(0, 0, S, S);
  const band = (inset, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.strokeRect(inset, inset, S - inset * 2, S - inset * 2); };
  band(10, '#e0b04a', 8); band(34, '#12385c', 28); band(70, '#e0b04a', 4); band(90, '#a8381f', 20);
  // معينات الإطار
  g.fillStyle = '#e8c97a';
  for (let k = 0; k < 14; k++) {
    const p = 34 + k * 31;
    for (const [x, y] of [[p, 34], [p, S - 34], [34, p], [S - 34, p]]) { g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 8, y); g.lineTo(x, y + 8); g.lineTo(x - 8, y); g.closePath(); g.fill(); }
  }
  // نجمة مركزية ثمانية
  g.save(); g.translate(S / 2, S / 2);
  for (let k = 0; k < 2; k++) {
    g.rotate(Math.PI / 8 * (k + 1));
    g.beginPath();
    for (let i = 0; i < 16; i++) { const r = i % 2 ? 100 : 175; const a = (i / 16) * Math.PI * 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fillStyle = k ? '#12385c' : '#1f9a96'; g.fill(); g.strokeStyle = '#e0b04a'; g.lineWidth = 4; g.stroke();
  }
  g.restore();
  g.fillStyle = 'rgba(255,240,200,0.92)'; g.beginPath(); g.arc(S / 2, S / 2, 78, 0, 7); g.fill();
  g.fillStyle = '#7d1f1a'; g.font = 'bold 120px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(letter, S / 2, S / 2 + 6);
  grain(g, S, 4000, 0.1);
  return c;
}

function awningCanvas(c1, c2) {
  const S = 256, c = cv(S), g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c1 : c2; g.fillRect(i * S / 8, 0, S / 8, S); }
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, S - 22, S, 22);
  grain(g, S, 1500, 0.1);
  return c;
}

function skyCanvas() {
  const W = 2048, H = 1024, c = cv(W, H), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H / 2);
  gr.addColorStop(0, '#2f6ea5'); gr.addColorStop(0.55, '#8fb7cf'); gr.addColorStop(0.85, '#f1cf9d'); gr.addColorStop(1, '#f6bf80');
  g.fillStyle = gr; g.fillRect(0, 0, W, H / 2);
  g.fillStyle = '#d8aa6a'; g.fillRect(0, H / 2, W, H / 2);
  // الشمس
  const sx = W * 0.62, sy = H * 0.4;
  const sg = g.createRadialGradient(sx, sy, 0, sx, sy, 260);
  sg.addColorStop(0, 'rgba(255,248,220,1)'); sg.addColorStop(0.08, 'rgba(255,236,170,0.95)'); sg.addColorStop(0.3, 'rgba(255,200,120,0.35)'); sg.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = sg; g.fillRect(sx - 300, sy - 300, 600, 600);
  // غيوم رقيقة
  const rnd = mulberry32(8);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W, y = 40 + rnd() * 300, w = 120 + rnd() * 320, h = 6 + rnd() * 16;
    g.fillStyle = `rgba(255,245,230,${0.1 + rnd() * 0.25})`;
    g.beginPath(); g.ellipse(x, y, w, h, 0, 0, 7); g.fill();
  }
  return c;
}

function tex(canvas, renderer, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}

// تحميل صور اختيارية من /assets لو موجودة (مثلاً مولّدة بـ Higgsfield)
function overrideMap(mat, url, renderer, repeat = true) {
  fetch(url, { method: 'HEAD' }).then((r) => {
    if (!r.ok) return;
    new THREE.TextureLoader().load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      mat.map = t; mat.needsUpdate = true;
    });
  }).catch(() => {});
}

// صندوق بإحداثيات UV بمقياس العالم (تتكرر الخامة كل tile متر)
function boxGeo(w, h, d, tileX = 4, tileY = 4.5) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  // ترتيب الوجوه: +x, -x, +y, -y, +z, -z (4 رؤوس لكل وجه)
  const sizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = sizes[f];
    const ty = f === 2 || f === 3 ? tileX : tileY;
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * (su / tileX), uv.getY(i) * (sv / ty));
    }
  }
  uv.needsUpdate = true;
  return geo;
}

function std(map, extra = {}) {
  return new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0, ...extra });
}

export function buildWorld(scene, renderer, shadows = true) {
  const mats = {};
  mats.sand = std(tex(sandCanvas(), renderer));
  mats.facade0 = std(tex(facadeCanvas(0), renderer));
  mats.facade1 = std(tex(facadeCanvas(1), renderer));
  mats.clay = std(tex(clayCanvas(), renderer));
  mats.crate = std(tex(crateCanvas(), renderer));
  mats.roof = std(tex(roofCanvas(), renderer));
  overrideMap(mats.sand, '/assets/sand.jpg', renderer);
  overrideMap(mats.facade0, '/assets/facade.jpg', renderer);
  overrideMap(mats.facade1, '/assets/facade.jpg', renderer);
  overrideMap(mats.clay, '/assets/clay.jpg', renderer);
  overrideMap(mats.crate, '/assets/crate.jpg', renderer);

  // ===== الإضاءة =====
  const hemi = new THREE.HemisphereLight(0xffeccb, 0xb88a52, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b0, 2.4);
  sun.position.set(-55, 70, -35);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -62; sc.right = 62; sc.top = 48; sc.bottom = -48; sc.near = 10; sc.far = 220;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun);

  scene.background = new THREE.Color(0xe9c99c);
  scene.fog = new THREE.Fog(0xe7c79b, 70, 260);

  // ===== السماء =====
  const skyTex = tex(skyCanvas(), renderer);
  skyTex.wrapS = THREE.RepeatWrapping; skyTex.wrapT = THREE.ClampToEdgeWrapping;
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false });
  fetch('/assets/sky.jpg', { method: 'HEAD' }).then((r) => {
    if (!r.ok) return;
    new THREE.TextureLoader().load('/assets/sky.jpg', (t) => { t.colorSpace = THREE.SRGBColorSpace; skyMat.map = t; skyMat.needsUpdate = true; });
  }).catch(() => {});
  const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 48, 24), skyMat);
  sky.renderOrder = -10;
  scene.add(sky);

  // ===== الأرض =====
  mats.sand.map.repeat.set(36, 28);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), mats.sand.clone());
  ground.material.map = mats.sand.map.clone();
  ground.material.map.repeat.set(300, 300);
  ground.material.map.needsUpdate = true;
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);
  const arena = new THREE.Mesh(new THREE.PlaneGeometry(82, 62), mats.sand);
  arena.rotation.x = -Math.PI / 2;
  arena.receiveShadow = true;
  scene.add(arena);
  // مفاتيح للتحديث لو تحمّلت صورة بديلة
  mats.sand.map.repeat.set(20, 15);

  // ===== المباني والصناديق =====
  const domeMat = new THREE.MeshStandardMaterial({ color: 0x1f9a96, roughness: 0.45, metalness: 0.25 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe0b04a, roughness: 0.3, metalness: 0.8 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xd6b27a, roughness: 0.95 });
  const hashed = (i) => (i * 2654435761 >>> 0) % 2;

  MAP.boxes.forEach((b, i) => {
    let sideMat, geo;
    if (b.kind === 'outer') { sideMat = mats.clay; geo = boxGeo(b.w, b.h, b.d, 4, 4); }
    else if (b.kind === 'crate') { sideMat = mats.crate; geo = boxGeo(b.w, b.h, b.d, 2, 2); }
    else if (b.kind === 'low') { sideMat = mats.clay; geo = boxGeo(b.w, b.h, b.d, 3, 3); }
    else { sideMat = hashed(i) ? mats.facade1 : mats.facade0; geo = boxGeo(b.w, b.h, b.d, 4, 4.5); }
    const topMat = b.kind === 'crate' ? mats.crate : mats.roof;
    const mesh = new THREE.Mesh(geo, [sideMat, sideMat, topMat, topMat, sideMat, sideMat]);
    mesh.position.set(b.x, b.h / 2, b.z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);

    if (b.kind === 'building' && b.h >= 4) {
      // حاجز علوي (parapet)
      const par = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.3, 0.35, b.d + 0.3), stoneMat);
      par.position.set(b.x, b.h + 0.17, b.z); par.castShadow = true; scene.add(par);
      if (b.dome) {
        const r = Math.min(b.w, b.d) * 0.36;
        const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
        dome.position.set(b.x, b.h + 0.35, b.z); dome.castShadow = true; scene.add(dome);
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9, 8), goldMat);
        fin.position.set(b.x, b.h + 0.35 + r + 0.35, b.z); scene.add(fin);
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), goldMat);
        ball.position.set(b.x, b.h + 0.35 + r - 0.05, b.z); scene.add(ball);
      }
      if (b.minaret) addMinaret(scene, b.x + b.w / 2 - 0.9, b.z + b.d / 2 - 0.9, b.h, stoneMat, goldMat);
    }
  });

  // ===== سجاد المواقع A / B =====
  for (const [k, s] of Object.entries(MAP.sites)) {
    const m = std(tex(rugCanvas(k), renderer), { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 10.5), m);
    rug.rotation.x = -Math.PI / 2;
    rug.rotation.z = k === 'A' ? 0.08 : -0.08;
    rug.position.set(s.x, 0.03, s.z);
    rug.receiveShadow = true;
    scene.add(rug);
  }

  // ===== مظلّات وفوانيس (زينة فوق مستوى الرأس) =====
  const awn = [
    ['#b8432f', '#f1e2c4', -8, 3.4, -13, 7, 5, 0.12],
    ['#1f6f9a', '#f1e2c4', 4, 3.4, -13, 6, 5, -0.1],
    ['#c58b24', '#f1e2c4', -8, 3.4, 13, 7, 5, -0.12],
    ['#7d3a8a', '#f1e2c4', 4, 3.4, 13, 6, 5, 0.1],
    ['#1f9a96', '#f1e2c4', 15, 3.8, 0, 8, 5, 0],
    ['#b8432f', '#f1e2c4', -22, 3.8, 0, 6, 6, 0],
  ];
  for (const [c1, c2, x, y, z, w, d, rz] of awn) {
    const m = new THREE.MeshStandardMaterial({ map: tex(awningCanvas(c1, c2), renderer), roughness: 0.9, side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    p.rotation.x = -Math.PI / 2 + 0.12; p.rotation.z = rz;
    p.position.set(x, y, z); p.castShadow = true; scene.add(p);
    // فوانيس على حواف المظلة
    for (let k = 0; k < 4; k++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff9a2a, emissiveIntensity: 1.6 }));
      l.scale.y = 1.4;
      l.position.set(x - w / 2 + (k + 0.5) * w / 4, y - 0.4, z + d / 2 - 0.4);
      scene.add(l);
    }
  }

  // ===== نخيل وخيام في الأركان =====
  const palms = [[-37, -27], [-37, 27], [37, -27], [37, 27], [-37, -14], [-37, 14], [37, -17], [37, 17]];
  for (const [x, z] of palms) addPalm(scene, x, z);
  for (const [x, z, r] of [[-33, -27, 0.3], [-33, 27, -0.4], [33, -27, 0.5], [33, 27, 0.1]]) addTent(scene, x, z, r);

  // ===== أفق المدينة خارج الساحة (يظهر فوق الأسوار) =====
  const rnd = mulberry32(77);
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + rnd() * 0.1;
    const rx = 82 + rnd() * 22, rz = 66 + rnd() * 18;
    const x = Math.cos(a) * rx, z = Math.sin(a) * rz;
    const w = 7 + rnd() * 8, d = 7 + rnd() * 8, h = 11 + rnd() * 16;
    const m = new THREE.Mesh(boxGeo(w, h, d, 4, 4.5), [mats.facade0, mats.facade0, mats.roof, mats.roof, mats.facade1, mats.facade1]);
    m.position.set(x, h / 2, z); scene.add(m);
    if (rnd() < 0.55) {
      const r = Math.min(w, d) * 0.38;
      const dm = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
      dm.position.set(x, h, z); scene.add(dm);
      const fn = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.4, 8), goldMat); fn.position.set(x, h + r + 0.5, z); scene.add(fn);
    }
    if (rnd() < 0.4) addMinaret(scene, x + w / 2 - 1, z + d / 2 - 1, h, stoneMat, goldMat, 1.6);
  }
  // كثبان بعيدة
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const dune = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshStandardMaterial({ color: 0xd8b070, roughness: 1 }));
    dune.scale.set(60 + rnd() * 40, 14 + rnd() * 12, 40 + rnd() * 20);
    dune.position.set(Math.cos(a) * 190, -3, Math.sin(a) * 160);
    scene.add(dune);
  }

  // ===== أعلام =====
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xb8432f, side: THREE.DoubleSide, roughness: 0.9 });
  const flagMat2 = new THREE.MeshStandardMaterial({ color: 0x1f6f9a, side: THREE.DoubleSide, roughness: 0.9 });
  const flags = [];
  for (const [x, z, m] of [[-38, -4, flagMat], [-38, 4, flagMat], [38, -4, flagMat2], [38, 4, flagMat2]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5, 6), goldMat); pole.position.set(x, 2.5, z); scene.add(pole);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1, 8, 1), m); fl.position.set(x + (x < 0 ? 0.9 : -0.9), 4.4, z); scene.add(fl);
    flags.push(fl);
  }

  return {
    sun, hemi,
    update(t) {
      for (const fl of flags) {
        const p = fl.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(t * 3 + p.getX(i) * 3) * 0.12 * (p.getX(i) + 0.9));
        p.needsUpdate = true;
      }
    },
  };
}

function addMinaret(scene, x, z, base, stoneMat, goldMat, s = 1) {
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * s, 0.55 * s, 6 * s, 14), stoneMat);
  sh.position.set(x, base + 3 * s, z); sh.castShadow = true; scene.add(sh);
  const bal = new THREE.Mesh(new THREE.CylinderGeometry(0.75 * s, 0.6 * s, 0.35 * s, 14), stoneMat);
  bal.position.set(x, base + 5.2 * s, z); scene.add(bal);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.4 * s, 0.4 * s, 1.2 * s, 14), stoneMat);
  top.position.set(x, base + 6.5 * s, z); scene.add(top);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55 * s, 1.6 * s, 14), goldMat);
  cone.position.set(x, base + 7.9 * s, z); scene.add(cone);
}

function addPalm(scene, x, z) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5530, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7a35, roughness: 0.8, side: THREE.DoubleSide });
  const lean = (x * 0.37 + z * 0.19) % 0.3;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 6.2, 8), trunkMat);
  trunk.position.y = 3.1; trunk.rotation.z = lean; trunk.castShadow = true; g.add(trunk);
  const top = new THREE.Group();
  top.position.set(-Math.sin(lean) * 3.1, 6.1, 0);
  for (let k = 0; k < 9; k++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.28, 3.4, 4), leafMat);
    leaf.geometry.translate(0, 1.7, 0);
    leaf.rotation.z = Math.PI / 2 + 0.55 + (k % 2) * 0.25;
    const holder = new THREE.Group(); holder.rotation.y = (k / 9) * Math.PI * 2; holder.add(leaf);
    leaf.castShadow = true; top.add(holder);
  }
  g.add(top);
  g.position.set(x, 0, z);
  scene.add(g);
}

function addTent(scene, x, z, rot) {
  const m = new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 1, side: THREE.DoubleSide });
  const m2 = new THREE.MeshStandardMaterial({ color: 0xc58b24, roughness: 1, side: THREE.DoubleSide });
  const t = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2.2, 4), m);
  t.position.set(x, 1.1, z); t.rotation.y = rot + Math.PI / 4; t.castShadow = true; scene.add(t);
  const band = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.4, 4, 1, true), m2);
  band.position.set(x, 1.85, z); band.rotation.y = rot + Math.PI / 4; scene.add(band);
}
