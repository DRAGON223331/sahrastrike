// مجسمات: أسلحة (من مكعبات/أسطوانات) + شخصيات بالشماغ + القنبلة
import * as THREE from 'three';

const M = {
  metal: new THREE.MeshStandardMaterial({ color: 0x2b2d2f, roughness: 0.45, metalness: 0.85 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6, metalness: 0.5 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.7 }),
  tan: new THREE.MeshStandardMaterial({ color: 0xb59a68, roughness: 0.6, metalness: 0.3 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xe0b04a, roughness: 0.3, metalness: 0.9 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xcfd6dc, roughness: 0.2, metalness: 1 }),
  leather: new THREE.MeshStandardMaterial({ color: 0x4a2c14, roughness: 0.8 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x66aaff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.55 }),
};

// الأسلحة تتجه نحو -Z (فوهة السلاح على -Z)
function bx(w, h, d, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}
function cyl(r, len, mat, x, y, z, parent, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}

export function buildWeapon(id) {
  const g = new THREE.Group();
  g.userData.muzzle = new THREE.Object3D();
  switch (id) {
    case 'pistol':
      bx(0.05, 0.07, 0.3, M.metal, 0, 0, -0.12, g);
      bx(0.045, 0.045, 0.26, M.tan, 0, 0.055, -0.12, g);
      bx(0.045, 0.13, 0.055, M.dark, 0, -0.095, 0.01, g).rotation.x = 0.25;
      bx(0.03, 0.03, 0.05, M.dark, 0, -0.04, -0.06, g);
      g.userData.muzzle.position.set(0, 0.02, -0.29);
      break;
    case 'smg':
      bx(0.07, 0.1, 0.4, M.dark, 0, 0, -0.15, g);
      cyl(0.022, 0.25, M.metal, 0, 0.02, -0.5, g);
      bx(0.04, 0.2, 0.06, M.dark, 0, -0.14, -0.2, g).rotation.x = 0.1;
      bx(0.05, 0.13, 0.05, M.leather, 0, -0.11, 0.0, g).rotation.x = 0.25;
      bx(0.04, 0.06, 0.2, M.metal, 0, -0.01, 0.2, g);
      bx(0.03, 0.03, 0.06, M.gold, 0, 0.065, -0.1, g);
      g.userData.muzzle.position.set(0, 0.02, -0.63);
      break;
    case 'rifle':
      bx(0.07, 0.1, 0.5, M.dark, 0, 0, -0.1, g);
      cyl(0.02, 0.5, M.metal, 0, 0.025, -0.6, g);
      bx(0.06, 0.07, 0.38, M.wood, 0, 0, -0.52, g);       // الحارس الخشبي
      bx(0.05, 0.06, 0.4, M.wood, 0, -0.01, 0.32, g);      // الكعب
      const mag = bx(0.05, 0.22, 0.09, M.dark, 0, -0.16, -0.12, g); mag.rotation.x = -0.35;
      bx(0.05, 0.13, 0.05, M.wood, 0, -0.11, 0.08, g).rotation.x = 0.25;
      bx(0.012, 0.045, 0.012, M.metal, 0, 0.085, -0.75, g);
      bx(0.012, 0.03, 0.012, M.metal, 0, 0.08, 0.05, g);
      bx(0.07, 0.014, 0.4, M.gold, 0, 0.056, -0.1, g);     // نقش ذهبي
      g.userData.muzzle.position.set(0, 0.025, -0.88);
      break;
    case 'sniper':
      bx(0.07, 0.1, 0.55, M.dark, 0, 0, -0.1, g);
      cyl(0.022, 0.8, M.metal, 0, 0.02, -0.75, g);
      bx(0.06, 0.07, 0.4, M.wood, 0, -0.01, -0.5, g);
      bx(0.06, 0.1, 0.5, M.wood, 0, -0.02, 0.4, g);
      cyl(0.04, 0.34, M.dark, 0, 0.11, -0.12, g, 14);
      cyl(0.05, 0.04, M.glass, 0, 0.11, -0.3, g, 14);
      cyl(0.05, 0.04, M.glass, 0, 0.11, 0.06, g, 14);
      bx(0.02, 0.06, 0.03, M.dark, 0, 0.07, -0.05, g);
      bx(0.02, 0.06, 0.03, M.dark, 0, 0.07, -0.25, g);
      bx(0.05, 0.13, 0.05, M.wood, 0, -0.11, 0.1, g).rotation.x = 0.25;
      bx(0.04, 0.08, 0.07, M.dark, 0, -0.08, -0.15, g);
      g.userData.muzzle.position.set(0, 0.02, -1.17);
      break;
    case 'knife':
      // خنجر عربي منحني (جنبية) — النصل يمتد للأمام (-Z) ومنحني لأعلى
      bx(0.04, 0.05, 0.16, M.leather, 0, 0, 0.05, g);
      bx(0.05, 0.075, 0.03, M.gold, 0, 0, -0.04, g);
      bx(0.05, 0.035, 0.035, M.gold, 0, 0, 0.14, g);
      bx(0.1, 0.025, 0.03, M.gold, 0, 0, -0.065, g);
      const shape = new THREE.Shape();
      shape.moveTo(0, -0.04); shape.quadraticCurveTo(0.18, -0.06, 0.34, 0.07); shape.quadraticCurveTo(0.2, 0.0, 0, 0.04); shape.closePath();
      const bl = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false }), M.steel);
      bl.rotation.y = Math.PI / 2; bl.position.set(-0.006, 0, -0.08);
      g.add(bl);
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.25), M.steel);
      rib.position.set(0, 0.01, -0.2); rib.rotation.x = 0.1; g.add(rib);
      break;
    default: break;
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
  g.add(g.userData.muzzle);
  return g;
}

// ===== الشخصيات =====
const SKIN = new THREE.MeshStandardMaterial({ color: 0xc89868, roughness: 0.8 });
const teamPalette = [
  { robe: 0xe9e1cf, vest: 0x2f7ec4, shemagh: 0xffffff, trim: 0x2f7ec4, pants: 0xc8bfa8 },
  { robe: 0xcbb98f, vest: 0xc4472f, shemagh: 0xb8432f, trim: 0xeee3c8, pants: 0xa8946a },
];

export function buildCharacter(team) {
  const pal = teamPalette[team % 2];
  const root = new THREE.Group();
  const mk = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
  const robeM = mk(pal.robe), vestM = mk(pal.vest), shM = mk(pal.shemagh), trimM = mk(pal.trim), pantsM = mk(pal.pants);

  const legL = new THREE.Group(), legR = new THREE.Group();
  for (const [lg, x] of [[legL, -0.13], [legR, 0.13]]) {
    lg.position.set(x, 0.92, 0);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.92, 8), pantsM);
    up.position.y = -0.46; lg.add(up);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.8 }));
    boot.position.set(0, -0.9, -0.04); lg.add(boot);
    root.add(lg);
  }
  const torso = new THREE.Group(); torso.position.y = 0.92; root.add(torso);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.62, 12), robeM); body.position.y = 0.31; torso.add(body);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.34, 12, 1, true), robeM); skirt.position.y = -0.05; skirt.material.side = THREE.DoubleSide; torso.add(skirt);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.5, 0.36), vestM); vest.position.set(0, 0.36, 0); torso.add(vest);
  const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.09, 12), new THREE.MeshStandardMaterial({ color: 0x7d1f1a, roughness: 0.8 })); sash.position.y = 0.04; torso.add(sash);
  const dagger = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.04), new THREE.MeshStandardMaterial({ color: 0xe0b04a, metalness: 0.8, roughness: 0.3 }));
  dagger.position.set(0, 0.0, -0.31); dagger.rotation.z = 0.5; torso.add(dagger);

  const head = new THREE.Group(); head.position.set(0, 0.75, 0); torso.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), SKIN); face.scale.set(1, 1.1, 1); face.position.y = 0.06; head.add(face);
  const wrap = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), shM); wrap.position.y = 0.1; head.add(wrap);
  const cloth = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.26, 0.3, 12, 1, true), shM); cloth.position.set(0, -0.02, 0.07); cloth.material.side = THREE.DoubleSide; head.add(cloth);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 20), trimM); band.rotation.x = Math.PI / 2; band.position.y = 0.17; head.add(band);
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.1), shM); mask.position.set(0, -0.02, -0.1); head.add(mask);
  const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0x111111 })); eyes.position.set(0, 0.075, -0.145); head.add(eyes);

  const armR = new THREE.Group(); armR.position.set(0.3, 0.55, 0); torso.add(armR);
  const armL = new THREE.Group(); armL.position.set(-0.3, 0.55, 0); torso.add(armL);
  for (const a of [armR, armL]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.55, 8), robeM); m.position.y = -0.27; a.add(m);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), SKIN); h.position.y = -0.56; a.add(h);
  }
  // الأذرع تشير للأمام (السلاح)
  armR.rotation.set(-1.25, 0, -0.1);
  armL.rotation.set(-1.35, 0, 0.55);

  const hand = new THREE.Group(); hand.position.set(0.14, 0.42, -0.42); torso.add(hand);

  root.userData = { legL, legR, torso, head, armR, armL, hand, weapon: null, weaponId: null, walk: 0 };
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return root;
}

export function setCharacterWeapon(ch, id) {
  const u = ch.userData;
  if (u.weaponId === id) return;
  if (u.weapon) u.hand.remove(u.weapon);
  u.weaponId = id;
  const w = buildWeapon(id);
  w.scale.setScalar(id === 'knife' ? 1.4 : 1);
  w.rotation.y = 0;
  u.hand.add(w);
  u.weapon = w;
  if (id === 'knife') {
    u.armR.rotation.set(-1.0, 0, -0.1); u.armL.rotation.set(-0.3, 0, 0.2);
    u.hand.position.set(0.2, 0.45, -0.34);
  } else {
    u.armR.rotation.set(-1.25, 0, -0.1); u.armL.rotation.set(-1.35, 0, 0.55);
    u.hand.position.set(0.14, 0.42, -0.42);
  }
}

export function animateCharacter(ch, dt, speed, pitch) {
  const u = ch.userData;
  u.walk += dt * (2 + speed * 1.6);
  const amp = Math.min(1, speed / 5) * 0.8;
  u.legL.rotation.x = Math.sin(u.walk * 2) * amp;
  u.legR.rotation.x = -Math.sin(u.walk * 2) * amp;
  u.torso.position.y = 0.92 + Math.abs(Math.sin(u.walk * 2)) * 0.03 * Math.min(1, speed / 3);
  u.head.rotation.x = -pitch * 0.7;
}

export function buildBomb() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.34), new THREE.MeshStandardMaterial({ color: 0x3b3b3b, roughness: 0.5, metalness: 0.6 }));
  body.position.y = 0.11; g.add(body);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.23, 0.36), new THREE.MeshStandardMaterial({ color: 0xc4472f, roughness: 0.7 }));
  strap.position.y = 0.11; g.add(strap);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
  led.position.set(0.14, 0.25, 0); g.add(led);
  g.userData.led = led;
  return g;
}

// يد اللاعب بالسلاح (منظور أول)
export function buildViewmodel(id) {
  const root = new THREE.Group();
  const w = buildWeapon(id);
  root.add(w);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.16), SKIN);
  const hand2 = hand.clone();
  if (id === 'knife') {
    hand.position.set(0, -0.02, 0.1); root.add(hand);
  } else {
    hand.position.set(0.0, -0.1, 0.02); root.add(hand);
    hand2.position.set(0.0, -0.045, id === 'sniper' ? -0.55 : id === 'pistol' ? -0.12 : -0.4); root.add(hand2);
  }
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xe9e1cf, roughness: 0.9 }));
  sleeve.rotation.x = Math.PI / 2 - 0.2; sleeve.position.set(0.04, -0.1, 0.38); root.add(sleeve);
  root.traverse((o) => { if (o.isMesh) o.castShadow = false; o.frustumCulled = false; });
  return root;
}
