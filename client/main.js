// عميل اللعبة: رسم، تحكم، شبكة، واجهة
import * as THREE from 'three';
import { MAP } from '/shared/map.js';
import { WEAPONS, WEAPON_INDEX, ARMOR } from '/shared/weapons.js';
import { stepPlayer, P } from '/shared/physics.js';
import { buildWorld } from './world.js';
import { buildCharacter, setCharacterWeapon, animateCharacter, buildBomb, buildViewmodel } from './models.js';
import * as snd from './audio.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

// ===== الإعدادات =====
const settings = {
  sens: parseFloat(store.get('sens', '1')),
  vol: parseFloat(store.get('vol', '0.6')),
  shadows: store.get('shadows', '1') === '1',
};
$('setSens').value = settings.sens; $('setVol').value = settings.vol; $('setShadows').checked = settings.shadows;
$('nameInput').value = store.get('name', '');
$('setSens').oninput = (e) => { settings.sens = +e.target.value; store.set('sens', settings.sens); };
$('setVol').oninput = (e) => { settings.vol = +e.target.value; store.set('vol', settings.vol); snd.setVolume(settings.vol); };
$('setShadows').onchange = (e) => { settings.shadows = e.target.checked; store.set('shadows', e.target.checked ? '1' : '0'); };

// ===== Three =====
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = settings.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(78, 1, 0.05, 700);
camera.rotation.order = 'YXZ';
scene.add(camera);
const world = buildWorld(scene, renderer, settings.shadows);
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

// ===== الحالة =====
const S = {
  ws: null, inGame: false, id: 0, team: 0, mode: '', code: '',
  hud: null, me: null, roster: new Map(), names: new Map(), remotes: new Map(),
  pos: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true },
  yaw: 0, pitch: 0, keys: {}, mouseL: false, mouseR: false,
  recoil: 0, sendT: 0, buyOpen: false, tabOpen: false, spectateId: null,
  lastShotAt: 0, stepT: 0, bobT: 0, swing: 0, flash: 0, shake: 0,
  fovBase: 78, vmId: null, vm: null, lobby: null, speed: 0, endUntil: 0, lastBeep: 0,
};
const tmpV = new THREE.Vector3();

// ===== أدوات الشبكة =====
function send(o) { if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(o)); }
function showScreen(id) {
  for (const s of ['menu', 'lobby']) $(s).classList.toggle('hidden', s !== id);
}
function connect(first) {
  snd.init();
  $('menuError').textContent = '';
  const name = $('nameInput').value.trim() || 'لاعب' + Math.floor(Math.random() * 900 + 100);
  store.set('name', $('nameInput').value.trim());
  $('loading').classList.remove('hidden');
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}`);
  S.ws = ws;
  ws.onopen = () => send({ ...first, name });
  ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } onMsg(m); };
  ws.onclose = () => {
    $('loading').classList.add('hidden');
    if (S.ws === ws) { S.ws = null; leaveToMenu('انقطع الاتصال بالسيرفر'); }
  };
  ws.onerror = () => {};
}
function leaveToMenu(err = '') {
  S.inGame = false; S.hud = null; S.me = null;
  for (const r of S.remotes.values()) scene.remove(r.obj);
  S.remotes.clear(); S.roster.clear();
  document.exitPointerLock?.();
  for (const id of ['hud', 'buy', 'scoreboard', 'endscreen', 'pause', 'loading']) $(id).classList.add('hidden');
  showScreen('menu');
  $('menuError').textContent = err;
}
$('btnBots').onclick = () => connect({ t: 'bots', diff: document.querySelector('input[name=diff]:checked').value });
$('btnQuick').onclick = () => connect({ t: 'quick' });
$('btnCreate').onclick = () => connect({ t: 'create' });
$('btnJoin').onclick = () => {
  const c = $('codeInput').value.trim();
  if (c.length < 4) { $('menuError').textContent = 'اكتب كود الغرفة (4 حروف)'; return; }
  connect({ t: 'join', code: c });
};
$('btnStart').onclick = () => send({ t: 'start' });
$('btnLeave').onclick = () => { const w = S.ws; S.ws = null; w?.close(); leaveToMenu(); };

// ===== الرسائل =====
function nameOf(id) { return S.names.get(id) || '؟'; }
function teamOf(id) { const r = S.roster.get(id); return r ? r.team : 0; }

function onMsg(m) {
  switch (m.t) {
    case 'error': $('loading').classList.add('hidden'); $('menuError').textContent = m.msg; if (S.ws) { S.ws.close(); S.ws = null; } break;
    case 'joined':
      $('loading').classList.add('hidden');
      S.id = m.id; S.team = m.team; S.mode = m.mode; S.code = m.code;
      if (m.mode !== 'bots') showScreen('lobby');
      break;
    case 'lobby': onLobby(m); break;
    case 'roster':
      S.roster.clear();
      for (const p of m.players) { S.roster.set(p.id, p); S.names.set(p.id, p.name); }
      refreshScoreboard();
      break;
    case 'spawn':
      enterGame();
      Object.assign(S.pos, { x: m.x, y: m.y, z: m.z, vx: 0, vy: 0, vz: 0, grounded: true });
      S.yaw = m.yaw; S.pitch = 0; S.spectateId = null;
      $('spectate').classList.add('hidden');
      break;
    case 'fix': Object.assign(S.pos, { x: m.x, y: m.y, z: m.z, vx: 0, vz: 0 }); break;
    case 'snap': onSnap(m); break;
    case 'hud': onHud(m); break;
    case 'shot': onShot(m); break;
    case 'swing': onSwing(m); break;
    case 'reload': { const r = S.remotes.get(m.id); if (m.id === S.id) snd.reload(0, 0.6); else if (r) soundAt(snd.reload, r.obj.position.x, r.obj.position.z, 20); break; }
    case 'hit': onHurt(m); break;
    case 'hm': {
      const h = $('hitmarker'); h.classList.remove('on', 'head'); void h.offsetWidth;
      h.classList.add('on'); if (m.head) h.classList.add('head');
      setTimeout(() => h.classList.remove('on'), 90);
      snd.hit(m.head); if (m.kill) snd.kill();
      break;
    }
    case 'kill': onKill(m); break;
    case 'ev': onEvent(m); break;
    case 'roundend': onRoundEnd(m); break;
    case 'matchend': {
      const win = m.win === S.team;
      $('endTitle').textContent = win ? 'فوز ساحق!' : 'خسارة';
      $('endScore').textContent = `${m.score[S.team]} - ${m.score[S.team ^ 1]}`;
      $('endscreen').classList.remove('hidden');
      setTimeout(() => $('endscreen').classList.add('hidden'), 11000);
      break;
    }
    default: break;
  }
}

function onLobby(m) {
  S.lobby = m;
  $('lobbyCode').textContent = m.mode === 'public' ? 'مباراة سريعة' : m.code;
  $('lobbyInfo').textContent = m.mode === 'public'
    ? (m.countdown !== null ? `بتبدأ بعد ${m.countdown} ثانية (الباقي بوتات)` : 'في انتظار لاعبين…')
    : 'ابعت الكود لأصحابك — الغرفة بتاخد 5 ضد 5';
  for (const t of [0, 1]) {
    const ul = $('lobbyT' + t); ul.innerHTML = '';
    for (const p of m.players.filter((x) => x.team === t)) {
      const li = document.createElement('li'); li.textContent = p.name + (p.bot ? ' 🤖' : '') + (p.id === m.host ? ' 👑' : '');
      if (p.id === S.id) li.className = 'me'; ul.appendChild(li);
    }
  }
  $('btnStart').classList.toggle('hidden', !(m.host === S.id && m.mode !== 'public' && !m.started));
}

function enterGame() {
  if (S.inGame) return;
  S.inGame = true;
  $('menu').classList.add('hidden'); $('lobby').classList.add('hidden'); $('loading').classList.add('hidden');
  $('hud').classList.remove('hidden');
  requestLock();
}

function requestLock() {
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
}

// ===== لقطات السيرفر =====
function ensureRemote(id) {
  let r = S.remotes.get(id);
  if (r) return r;
  const team = teamOf(id);
  const obj = buildCharacter(team);
  scene.add(obj);
  r = { obj, tx: 0, ty: 0, tz: 0, yaw: 0, pitch: 0, alive: true, w: -1, speed: 0, team, stepT: 0, init: false };
  S.remotes.set(id, r);
  return r;
}

function onSnap(m) {
  S.me = m.me;
  S.team = m.me.team;
  const seen = new Set();
  for (const a of m.p) {
    const [id, x, y, z, yaw, pitch, alive, w, rl, speed] = a;
    seen.add(id);
    if (id === S.id) continue;
    const r = ensureRemote(id);
    const rt = teamOf(id);
    if (rt !== r.team) { scene.remove(r.obj); S.remotes.delete(id); continue; }
    r.tx = x; r.ty = y; r.tz = z; r.yaw = yaw; r.pitch = pitch; r.alive = !!alive; r.speed = speed;
    if (!r.init) { r.obj.position.set(x, y, z); r.init = true; }
    if (r.w !== w) { r.w = w; setCharacterWeapon(r.obj, WEAPON_INDEX[w]); }
  }
  for (const [id, r] of S.remotes) if (!seen.has(id)) { scene.remove(r.obj); S.remotes.delete(id); }
  updateVitals();
}

function updateVitals() {
  const me = S.me; if (!me) return;
  $('hpVal').textContent = Math.max(0, Math.ceil(me.hp));
  $('hpVal').parentElement.classList.toggle('low', me.hp <= 30);
  $('armorVal').textContent = me.armor;
  $('cashVal').textContent = me.credits;
  const w = WEAPONS[me.w];
  $('wepName').textContent = w.name;
  $('ammoVal').innerHTML = w.melee ? '<b>—</b>' : `<b>${me.mag}</b> / ${me.res}`;
  $('bombIcon').classList.toggle('hidden', !me.hasBomb);
  const showBuy = me.canBuy && me.alive;
  $('buyHint').classList.toggle('hidden', !showBuy || S.buyOpen);
  $('buyCash').textContent = `$${me.credits}`;
  if (S.buyOpen) refreshBuy();
  const pr = $('progress');
  if (me.use > 0 && me.alive) {
    pr.classList.remove('hidden'); pr.firstElementChild.style.width = Math.min(100, me.use * 100) + '%';
    pr.lastElementChild.textContent = S.hud && S.hud.bomb.state === 'planted' ? 'جارٍ فك القنبلة…' : 'جارٍ زرع القنبلة…';
  } else pr.classList.add('hidden');
  const reloadingNow = me.rl > 0;
  if (reloadingNow && !S.reloadShown) { S.reloadShown = true; }
  if (!reloadingNow) S.reloadShown = false;
  $('crosshair').classList.toggle('hide', !me.alive || (me.w === 'sniper' && S.mouseR));
  if (!me.alive) spectateInfo();
}

function onHud(m) {
  const prev = S.hud;
  S.hud = m;
  if (!S.inGame) enterGame();
  const t = Math.ceil(m.bomb.state === 'planted' ? m.bomb.timer : m.left);
  S.timerBase = { v: m.bomb.state === 'planted' ? m.bomb.timer : m.left, at: performance.now(), planted: m.bomb.state === 'planted', run: m.phase === 'buy' || m.phase === 'live' };
  const mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
  $('timer').textContent = `${mm}:${ss}`;
  $('scoreUs').textContent = m.score[S.team]; $('scoreThem').textContent = m.score[S.team ^ 1];
  $('aliveUs').textContent = m.alive[S.team]; $('aliveThem').textContent = m.alive[S.team ^ 1];
  $('roundInfo').textContent = `الجولة ${m.round} / 13` + (m.phase === 'buy' ? ' · شراء' : '');
  $('sideInfo').textContent = m.atk === S.team ? 'مهاجمين (زرع القنبلة)' : 'مدافعين';
  $('timer').classList.toggle('red', m.bomb.state === 'planted' || (m.phase === 'live' && m.left < 10));
  if (prev && prev.phase !== m.phase && m.phase === 'live' && S.buyOpen) closeBuy();
  S.bombState = m.bomb;
  updateBombMesh();
  refreshScoreboard();
}

setInterval(() => {
  const b = S.timerBase; if (!b || !b.run) return;
  const left = Math.max(0, b.v - (performance.now() - b.at) / 1000);
  const t = Math.ceil(left);
  $('timer').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  if (b.planted && S.hud) {
    // صفير القنبلة يسرع كل ما الوقت يقل
    const now = performance.now();
    const gap = left < 5 ? 250 : left < 10 ? 500 : 1000;
    if (now - S.lastBeep > gap) { S.lastBeep = now; const bm = S.hud.bomb; const d = Math.hypot(S.pos.x - bm.x, S.pos.z - bm.z); snd.beep(0, Math.max(0.15, 1 - d / 60)); if (bombMesh) bombMesh.userData.led.visible = true; setTimeout(() => { if (bombMesh) bombMesh.userData.led.visible = false; }, 100); }
  }
}, 100);

// ===== قنبلة =====
let bombMesh = null;
function updateBombMesh() {
  const b = S.bombState;
  const show = b && (b.state === 'dropped' || b.state === 'planted');
  if (show && !bombMesh) { bombMesh = buildBomb(); scene.add(bombMesh); }
  if (bombMesh) {
    bombMesh.visible = !!show;
    if (show) bombMesh.position.set(b.x, 0, b.z);
  }
}

// ===== مؤثرات =====
const fx = [];
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
function addFx(obj, life, update) { scene.add(obj); fx.push({ obj, life, max: life, update }); }

function onShot(m) {
  const mine = m.id === S.id;
  const from = new THREE.Vector3(m.ox, m.oy, m.oz);
  const to = new THREE.Vector3(m.hx, m.hy, m.hz);
  if (mine) {
    // الطلقة من الماسورة اليمين
    camera.updateMatrixWorld();
    from.copy(tmpV.set(0.18, -0.14, -0.7).applyMatrix4(camera.matrixWorld));
    S.recoil = Math.min(1, S.recoil + (WEAPONS[m.w].kick || 0.01) * 12);
    S.flash = 0.05; S.shake = Math.min(1, S.shake + 0.35 * (m.w === 'sniper' ? 2 : 1));
    snd.shot(m.w, 0, 0.9);
  } else {
    const r = S.remotes.get(m.id);
    if (r) { from.y -= 0.2; }
    soundAt((pan, g) => snd.shot(m.w, pan, g), m.ox, m.oz, 70);
  }
  const dir = to.clone().sub(from);
  const len = dir.length();
  if (len > 1.5) {
    const g = new THREE.BufferGeometry().setFromPoints([from, from.clone().add(dir.clone().multiplyScalar(Math.min(1, 18 / len)))]);
    const line = new THREE.Line(g, tracerMat.clone());
    addFx(line, 0.07, (o, k) => { o.material.opacity = k; });
  }
  if (m.k === 0) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), new THREE.MeshBasicMaterial({ color: 0xe8d4a0, transparent: true, opacity: 0.8 }));
    p.position.copy(to);
    addFx(p, 0.35, (o, k) => { o.scale.setScalar(1 + (1 - k) * 3); o.material.opacity = k * 0.7; });
  } else {
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 4), new THREE.MeshBasicMaterial({ color: 0xaa1a10 }));
      p.position.copy(to); const v = new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3);
      addFx(p, 0.4, (o, k, dt) => { v.y -= 9 * dt; o.position.addScaledVector(v, dt); });
    }
  }
}

function onSwing(m) {
  if (m.id === S.id) { S.swing = 1; snd.knife(0, 0.8); return; }
  const r = S.remotes.get(m.id);
  if (r) soundAt(snd.knife, r.obj.position.x, r.obj.position.z, 20);
}

function onHurt(m) {
  snd.hurt();
  S.shake = Math.min(1, S.shake + 0.4);
  const el = $('dmgind');
  const dx = m.ax - S.pos.x, dz = m.az - S.pos.z;
  const ang = Math.atan2(dx, -dz) + S.yaw; // زاوية المهاجم نسبة لاتجاه النظر
  el.firstElementChild.style.transform = `rotate(${ang}rad)`;
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  setTimeout(() => el.classList.remove('on'), 120);
}

function soundAt(fn, x, z, maxD) {
  const dx = x - S.pos.x, dz = z - S.pos.z, d = Math.hypot(dx, dz);
  if (d > maxD) return;
  const rx = Math.cos(S.yaw), rz = -Math.sin(S.yaw);
  const pan = d > 0.1 ? (dx * rx + dz * rz) / d : 0;
  fn(pan, Math.max(0.05, 1 - d / maxD));
}

function onKill(m) {
  const feed = $('killfeed');
  const div = document.createElement('div');
  const kt = teamOf(m.k), vt = teamOf(m.v);
  const cls = (t) => (t === S.team ? 'us' : 'them');
  const wname = m.w === 'bomb' ? 'القنبلة' : (WEAPONS[m.w]?.name || '');
  div.innerHTML = `<span class="${cls(kt)}">${esc(nameOf(m.k))}</span><span class="w">${wname}${m.h ? ' · رأس' : ''}</span><span class="${cls(vt)}">${esc(nameOf(m.v))}</span>`;
  if (m.k === S.id || m.v === S.id) div.className = 'mine';
  feed.appendChild(div);
  setTimeout(() => div.remove(), 6000);
  while (feed.children.length > 6) feed.firstChild.remove();
  const r = S.remotes.get(m.v);
  if (r) { r.alive = false; }
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

let msgTimer = 0;
function banner(text, sub = '', ms = 2200, color = '') {
  const el = $('msg'); el.textContent = text; el.style.color = color; el.classList.add('on');
  $('submsg').textContent = sub;
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => { el.classList.remove('on'); $('submsg').textContent = ''; }, ms);
}

function onEvent(m) {
  switch (m.e) {
    case 'roundstart': snd.roundStart(); banner(`الجولة ${m.round}`, 'وقت الشراء — اضغط B', 2600); break;
    case 'halftime': snd.roundStart(); banner('تبديل الجهات', 'الاقتصاد اتصفّر', 3000); break;
    case 'live': snd.beep(0, 0.8); banner('ابدأوا!', '', 1200); break;
    case 'plant': snd.plantSound(); banner(`القنبلة اتزرعت — موقع ${m.site}`, S.hud && S.hud.atk === S.team ? 'دافعوا عنها!' : 'فكّوها بسرعة!', 3000, '#ff9a5a'); break;
    case 'defuse': snd.defuseSound(); break;
    case 'drop': banner('القنبلة وقعت!', '', 1500); break;
    case 'pickup': break;
    case 'explode': snd.explosion(); explosionFx(m.x, m.z); break;
    default: break;
  }
}

function onRoundEnd(m) {
  const win = m.win === S.team;
  const reasonTxt = { elim: 'تم القضاء على الفريق', time: 'انتهى الوقت', defuse: 'تم فك القنبلة', explode: 'انفجرت القنبلة' }[m.reason] || '';
  banner(win ? 'فزت بالجولة' : 'خسرت الجولة', reasonTxt, 4000, win ? '#7be07b' : '#ff7e5f');
  if (S.buyOpen) closeBuy();
}

function explosionFx(x, z) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9 }));
  s.position.set(x, 1.2, z);
  addFx(s, 1.2, (o, k) => { const e = 1 - k; o.scale.setScalar(1 + e * 11); o.material.opacity = k * 0.8; });
  const l = new THREE.PointLight(0xffa040, 90, 60); l.position.set(x, 3, z);
  addFx(l, 0.8, (o, k) => { o.intensity = 90 * k; });
  S.shake = 1;
}

// ===== شراء =====
const BUYS = [
  { key: '1', id: 'rifle', cat: 'سلاح رئيسي' }, { key: '2', id: 'smg', cat: 'سلاح رئيسي' },
  { key: '3', id: 'sniper', cat: 'سلاح رئيسي' }, { key: '4', id: 'armor', cat: 'حماية' },
];
function openBuy() {
  if (!S.me || !S.me.canBuy || !S.me.alive) return;
  S.buyOpen = true; $('buy').classList.remove('hidden');
  document.exitPointerLock?.();
  S.mouseL = S.mouseR = false; send({ t: 'fire', on: false });
  refreshBuy();
}
function closeBuy() { S.buyOpen = false; $('buy').classList.add('hidden'); requestLock(); }
function refreshBuy() {
  const wrap = $('buyItems');
  if (!wrap.children.length) {
    for (const b of BUYS) {
      const d = document.createElement('div'); d.className = 'item'; d.dataset.id = b.id;
      d.onclick = () => doBuy(b.id); wrap.appendChild(d);
    }
  }
  const me = S.me;
  [...wrap.children].forEach((d, i) => {
    const b = BUYS[i]; const w = WEAPONS[b.id];
    const price = b.id === 'armor' ? ARMOR.price : w.price;
    const own = b.id === 'armor' ? me.armor >= ARMOR.value : me.primary === b.id;
    const desc = b.id === 'armor' ? 'درع +50' : `ضرر ${w.dmg} · رأس ${w.head} · ${w.auto ? 'أوتوماتيك' : 'طلقة'} · ذخيرة ${w.mag}`;
    d.innerHTML = `<div class="k">[${b.key}] ${b.cat}</div><div class="n">${b.id === 'armor' ? 'الدرع' : w.name}</div><div class="p">$${price}</div><div class="d">${desc}</div>`;
    d.classList.toggle('off', me.credits < price && !own);
    d.classList.toggle('own', own);
  });
}
function doBuy(id) { send({ t: 'buy', item: id }); snd.buy(); }

// ===== مدخلات =====
window.addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (!S.inGame) return;
  const k = e.code;
  if (S.keys[k]) return;
  S.keys[k] = true;
  if (k === 'KeyB') { e.preventDefault(); S.buyOpen ? closeBuy() : openBuy(); return; }
  if (S.buyOpen) {
    const b = BUYS.find((x) => 'Digit' + x.key === k);
    if (b) doBuy(b.id);
    if (k === 'Escape') closeBuy();
    return;
  }
  if (k === 'Tab') { e.preventDefault(); S.tabOpen = true; $('scoreboard').classList.remove('hidden'); refreshScoreboard(); }
  if (k === 'KeyR') send({ t: 'reload' });
  if (k === 'Digit1') send({ t: 'slot', s: 0 });
  if (k === 'Digit2') send({ t: 'slot', s: 1 });
  if (k === 'Digit3') send({ t: 'slot', s: 2 });
  if (k === 'KeyE') send({ t: 'use', on: true });
  if (k === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  S.keys[e.code] = false;
  if (e.code === 'Tab') { S.tabOpen = false; $('scoreboard').classList.add('hidden'); }
  if (e.code === 'KeyE' && S.inGame) send({ t: 'use', on: false });
});
window.addEventListener('blur', () => { S.keys = {}; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas || !S.me || !S.me.alive) return;
  const k = 0.0022 * settings.sens * (S.scoped ? 0.35 : 1);
  S.yaw -= e.movementX * k;
  S.pitch = Math.max(-1.5, Math.min(1.5, S.pitch - e.movementY * k));
});
canvas.addEventListener('mousedown', (e) => {
  snd.init();
  if (!S.inGame || S.buyOpen) return;
  if (document.pointerLockElement !== canvas) { requestLock(); return; }
  if (e.button === 0) {
    if (S.me && !S.me.alive) { cycleSpectate(); return; }
    S.mouseL = true; send({ t: 'fire', on: true });
  }
  if (e.button === 2) {
    S.mouseR = true;
    if (S.me && S.me.w === 'sniper') send({ t: 'scope', on: true });
    else if (S.me && S.me.w === 'knife') send({ t: 'melee', alt: true });
  }
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0 && S.mouseL) { S.mouseL = false; send({ t: 'fire', on: false }); }
  if (e.button === 2 && S.mouseR) { S.mouseR = false; send({ t: 'scope', on: false }); }
});
window.addEventListener('wheel', (e) => {
  if (!S.inGame || !S.me || S.buyOpen) return;
  const order = [S.me.primary ? 0 : null, 1, 2].filter((x) => x !== null);
  const i = order.indexOf(S.me.slot);
  const n = order[(i + (e.deltaY > 0 ? 1 : -1) + order.length) % order.length];
  send({ t: 'slot', s: n });
});
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  $('pause').classList.toggle('hidden', locked || !S.inGame || S.buyOpen || !!$('endscreen').offsetParent);
  if (!locked) { S.mouseL = S.mouseR = false; if (S.ws) { send({ t: 'fire', on: false }); send({ t: 'scope', on: false }); } }
});
$('pause').addEventListener('click', requestLock);

function cycleSpectate() {
  const mates = [...S.remotes.entries()].filter(([id, r]) => r.alive && r.team === S.team).map(([id]) => id);
  if (!mates.length) { S.spectateId = null; return; }
  const i = mates.indexOf(S.spectateId);
  S.spectateId = mates[(i + 1) % mates.length];
}
function spectateInfo() {
  const el = $('spectate');
  el.classList.remove('hidden');
  if (S.spectateId !== null) {
    const r = S.remotes.get(S.spectateId);
    if (!r || !r.alive) S.spectateId = null;
  }
  if (S.spectateId === null) cycleSpectate();
  el.textContent = S.spectateId !== null ? `بتتفرج على: ${nameOf(S.spectateId)} (اضغط ضغطة يسار للتبديل)` : 'انت خرجت من الجولة';
}

// ===== لوحة النتائج =====
function refreshScoreboard() {
  if (!S.tabOpen && !S.hud) return;
  if (!S.tabOpen) return;
  const rows = (team, el) => {
    const list = [...S.roster.values()].filter((p) => p.team === team).sort((a, b) => b.k - a.k);
    el.innerHTML = '<tr><th>اللاعب</th><th>قتل</th><th>موت</th></tr>' + list.map((p) =>
      `<tr class="${p.id === S.id ? 'me' : ''}"><td>${esc(p.name)}${p.bot ? ' 🤖' : ''}</td><td>${p.k}</td><td>${p.d}</td></tr>`).join('');
  };
  rows(S.team, $('sbUs')); rows(S.team ^ 1, $('sbThem'));
}

// ===== الخريطة المصغرة =====
const mm = $('minimap').getContext('2d');
const MS = 2.4;
function drawMinimap() {
  const W = 200, H = 150;
  mm.clearRect(0, 0, W, H);
  const tx = (x) => (x + 40) * (W / 80), tz = (z) => (z + 30) * (H / 60);
  mm.fillStyle = 'rgba(200,160,100,0.25)'; mm.fillRect(0, 0, W, H);
  for (const b of MAP.boxes) {
    if (b.kind === 'outer') continue;
    mm.fillStyle = b.kind === 'crate' || b.kind === 'low' ? '#8a6a3a' : '#5a4022';
    mm.fillRect(tx(b.minX), tz(b.minZ), (b.maxX - b.minX) * (W / 80), (b.maxZ - b.minZ) * (H / 60));
  }
  mm.font = 'bold 14px sans-serif'; mm.textAlign = 'center'; mm.textBaseline = 'middle';
  for (const [k, s] of Object.entries(MAP.sites)) {
    mm.strokeStyle = '#e0b04a'; mm.lineWidth = 1.5; mm.beginPath(); mm.arc(tx(s.x), tz(s.z), s.r * (W / 80), 0, 7); mm.stroke();
    mm.fillStyle = '#e0b04a'; mm.fillText(k, tx(s.x), tz(s.z));
  }
  const b = S.bombState;
  if (b && (b.state === 'planted' || b.state === 'dropped')) {
    mm.fillStyle = b.state === 'planted' && Math.floor(performance.now() / 300) % 2 ? '#ff2a1a' : '#ff9a5a';
    mm.beginPath(); mm.arc(tx(b.x), tz(b.z), 4, 0, 7); mm.fill();
  }
  for (const [id, r] of S.remotes) {
    if (!r.alive || r.team !== S.team) continue;
    mm.fillStyle = '#6cc2ff'; mm.beginPath(); mm.arc(tx(r.obj.position.x), tz(r.obj.position.z), 3.5, 0, 7); mm.fill();
  }
  if (S.me && S.me.alive) {
    mm.save(); mm.translate(tx(S.pos.x), tz(S.pos.z)); mm.rotate(-S.yaw);
    mm.fillStyle = '#ffe06a'; mm.beginPath(); mm.moveTo(0, -6); mm.lineTo(4.5, 5); mm.lineTo(-4.5, 5); mm.closePath(); mm.fill();
    mm.restore();
  }
}

// ===== مجسم السلاح بمنظور أول =====
function updateViewmodel() {
  const id = S.me && S.me.alive ? S.me.w : null;
  if (id !== S.vmId) {
    if (S.vm) camera.remove(S.vm);
    S.vm = id ? buildViewmodel(id) : null;
    S.vmId = id;
    if (S.vm) { camera.add(S.vm); S.vm.userData.t0 = performance.now(); }
  }
}

// ===== الحلقة الرئيسية =====
const clock = new THREE.Clock();
let sendAcc = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  world.update(t);

  if (S.inGame && S.me) {
    const alive = S.me.alive;
    // حركة اللاعب المحلية
    if (alive && !S.buyOpen) {
      const k = S.keys;
      const inp = {
        fwd: (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), str: (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0),
        yaw: S.yaw, walk: !!(k.ShiftLeft || k.ShiftRight), jump: !!k.Space,
      };
      if (S.hud && S.hud.phase === 'post' && false) { inp.fwd = inp.str = 0; }
      stepPlayer(S.pos, inp, dt, MAP.boxes);
    } else if (alive) { S.pos.vx = S.pos.vz = 0; }
    if (S.hud && S.hud.phase === 'buy') {
      const atk = S.hud.atk === S.team;
      if (atk) S.pos.x = Math.min(S.pos.x, -MAP.buyZoneX); else S.pos.x = Math.max(S.pos.x, MAP.buyZoneX);
    }
    S.speed = Math.hypot(S.pos.vx, S.pos.vz);
    sendAcc += dt;
    if (alive && sendAcc >= 0.05) {
      sendAcc = 0;
      send({ t: 's', x: +S.pos.x.toFixed(3), y: +S.pos.y.toFixed(3), z: +S.pos.z.toFixed(3), yaw: +S.yaw.toFixed(4), pitch: +S.pitch.toFixed(4) });
    }
    // خطوات
    if (alive && S.pos.grounded && S.speed > 3.5) {
      S.stepT -= dt * (S.speed / 5.4);
      if (S.stepT <= 0) { S.stepT = 0.38; snd.step(0, 0.25); }
    }
  }

  updateRemotes(dt);
  updateViewmodel();
  updateCamera(dt, t);
  updateFx(dt);
  drawMinimap();
  renderer.shadowMap.enabled = settings.shadows;
  renderer.render(scene, camera);
}

function updateRemotes(dt) {
  const k = Math.min(1, dt * 14);
  for (const [id, r] of S.remotes) {
    r.obj.visible = r.alive;
    if (!r.alive) continue;
    r.obj.position.x += (r.tx - r.obj.position.x) * k;
    r.obj.position.y += (r.ty - r.obj.position.y) * k;
    r.obj.position.z += (r.tz - r.obj.position.z) * k;
    let dy = r.yaw - r.obj.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    r.obj.rotation.y += dy * k;
    animateCharacter(r.obj, dt, r.speed, r.pitch);
    if (r.speed > 3.5 && dt) {
      r.stepT -= dt;
      if (r.stepT <= 0) { r.stepT = 0.4; soundAt((p, g) => snd.step(p, g * 0.5), r.obj.position.x, r.obj.position.z, 22); }
    }
  }
}

function updateCamera(dt, t) {
  let px = S.pos.x, py = S.pos.y + P.EYE, pz = S.pos.z, yaw = S.yaw, pitch = S.pitch;
  const me = S.me;
  const alive = !me || me.alive;
  if (!alive && S.spectateId !== null) {
    const r = S.remotes.get(S.spectateId);
    if (r && r.alive) { px = r.obj.position.x; py = r.obj.position.y + P.EYE; pz = r.obj.position.z; yaw = r.obj.rotation.y; pitch = r.pitch; }
  } else if (!alive) {
    py = S.pos.y + 0.4;
  }
  // قناص
  S.scoped = !!(me && me.alive && me.w === 'sniper' && S.mouseR && !me.rl);
  const targetFov = S.scoped ? 26 : S.fovBase;
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 14);
  camera.updateProjectionMatrix();
  $('scope').classList.toggle('on', camera.fov < 40);
  // ارتداد/اهتزاز/تمايل
  S.recoil = Math.max(0, S.recoil - dt * 7);
  S.shake = Math.max(0, S.shake - dt * 4);
  const bob = alive && S.pos.grounded ? Math.sin(t * 11) * 0.025 * Math.min(1, S.speed / 5) : 0;
  const sh = S.shake * 0.01;
  camera.position.set(px + (Math.random() - 0.5) * sh, py + bob + (Math.random() - 0.5) * sh, pz + (Math.random() - 0.5) * sh);
  camera.rotation.set(pitch + S.recoil * 0.05, yaw, 0);
  // مجسم السلاح
  if (S.vm) {
    const vm = S.vm;
    S.swing = Math.max(0, S.swing - dt * 4);
    const drawK = Math.min(1, (performance.now() - (vm.userData.t0 || 0)) / 250);
    const sway = Math.sin(t * 11) * 0.006 * Math.min(1, S.speed / 5);
    const scopedHide = S.scoped;
    vm.visible = !scopedHide;
    const kick = S.recoil * 0.06;
    const isKnife = S.vmId === 'knife';
    vm.position.set(isKnife ? 0.2 : 0.18, (isKnife ? -0.2 : -0.17) + sway - (1 - drawK) * 0.3, isKnife ? -0.4 : -0.38 + kick);
    vm.rotation.set(S.recoil * 0.12 + (isKnife ? -S.swing * 1.1 : 0), isKnife ? 0.3 + S.swing * 0.7 : 0.02, isKnife ? -0.15 : 0);
    vm.scale.setScalar(S.vmId === 'pistol' ? 0.75 : S.vmId === 'knife' ? 1 : 0.85);
    if (S.me && S.me.rl > 0 && !isKnife) { vm.rotation.x += 0.35; vm.position.y -= 0.08; }
  }
  $('crosshair').style.setProperty('--g', (5 + S.speed * 1.8 + S.recoil * 14) + 'px');
}

function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.life -= dt;
    if (f.life <= 0) { scene.remove(f.obj); f.obj.geometry?.dispose?.(); f.obj.material?.dispose?.(); fx.splice(i, 1); continue; }
    f.update(f.obj, f.life / f.max, dt);
  }
}

// تعطيل اختصارات المتصفح المزعجة أثناء اللعب
window.addEventListener('keydown', (e) => {
  if (S.inGame && ['Space', 'Tab', 'F3'].includes(e.code)) e.preventDefault();
}, { capture: true });
window.addEventListener('beforeunload', () => { try { S.ws?.close(); } catch { /* ignore */ } });

// واجهة اختبار (للمطورين)
window.__game = { S, send, THREE, scene, camera };
frame();
