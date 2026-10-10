// ذكاء البوتات: إدراك، تصويب، حركة، أهداف حسب الجانب (مهاجم/مدافع)
import { MAP } from '../shared/map.js';
import { WEAPONS } from '../shared/weapons.js';
import { stepPlayer, hasLOS, angDiff, P } from '../shared/physics.js';
import { findPath, nearestWalkable } from './nav.js';

const DIFF = {
  easy: { react: 0.55, aim: 0.045, turn: 4.5 },
  normal: { react: 0.38, aim: 0.028, turn: 6.5 },
  hard: { react: 0.25, aim: 0.015, turn: 9 },
};

export function botInit(p, diff = 'normal') {
  p.ai = {
    diff: DIFF[diff] || DIFF.normal,
    path: [], pi: 0, goalKey: '', repathAt: 0,
    thinkT: Math.random() * 0.1,
    target: null, seenAt: -99, reactAt: 0, lastKnown: null,
    mode: 'stand', modeT: 0.3, strafe: Math.random() < 0.5 ? 1 : -1,
    stuckT: 0, lx: 0, lz: 0, checkT: 0.5,
    alert: null, burstOn: true, burstT: 0.3,
    slot: 0, wantUse: false, goal: null, viaDone: false,
  };
}

export function botReset(p, slot) {
  const ai = p.ai;
  ai.path = []; ai.pi = 0; ai.goalKey = ''; ai.target = null; ai.seenAt = -99;
  ai.lastKnown = null; ai.alert = null; ai.slot = slot; ai.wantUse = false; ai.goal = null; ai.viaDone = false;
  ai.stuckT = 0; ai.lx = p.x; ai.lz = p.z;
}

export function botBuy(room, p) {
  const c = p.credits;
  if (!p.primary) {
    if (c >= 3300) { room.buy(p, 'rifle'); room.buy(p, 'armor'); }
    else if (c >= 5000 && Math.random() < 0.15) { room.buy(p, 'sniper'); }
    else if (c >= 1500) { room.buy(p, 'smg'); room.buy(p, 'armor'); }
  } else if (p.armor < 50 && p.credits >= 400) {
    room.buy(p, 'armor');
  }
}

function perceive(room, p) {
  const ai = p.ai;
  const eyeY = p.y + P.EYE;
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  let best = null, bd = 1e9;
  for (const e of room.list) {
    if (!e.alive || e.team === p.team) continue;
    const dx = e.x - p.x, dz = e.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 70) continue;
    const dot = (dx * fx + dz * fz) / (d || 1);
    const heard = e.firedAt && room.time - e.firedAt < 0.6 && d < 25;
    if (dot < 0.35 && d > 7 && !heard) continue;
    if (!hasLOS(MAP.boxes, p.x, eyeY, p.z, e.x, e.y + 1.3, e.z)) continue;
    if (d < bd) { bd = d; best = e; }
  }
  if (best) {
    if (ai.target !== best.id) {
      ai.target = best.id;
      ai.reactAt = room.time + ai.diff.react * (0.7 + Math.random() * 0.6);
    }
    ai.seenAt = room.time;
    ai.lastKnown = { x: best.x, z: best.z };
  } else if (ai.target !== null && room.time - ai.seenAt > 1.2) {
    ai.target = null;
    if (ai.lastKnown) ai.alert = { x: ai.lastKnown.x, z: ai.lastKnown.z, t: room.time };
  }
}

function pickSpot(list, i) {
  const s = list[i % list.length];
  const w = nearestWalkable(s[0], s[1]);
  return { x: w.x, z: w.z };
}

function decide(room, p) {
  const ai = p.ai;
  const side = room.sideOf(p);
  const b = room.bomb;
  let goal = null, key = '';
  ai.wantUse = false;
  const engaged = ai.target !== null && room.time - ai.seenAt < 0.5;

  const siteObj = MAP.sites[room.plan.site];
  const carrierAtSite = side === 'atk' && b.state === 'carried' && b.carrier === p.id &&
    Math.hypot(p.x - siteObj.x, p.z - siteObj.z) < siteObj.r;
  if (ai.alert && room.time - ai.alert.t < 4 && !engaged && !carrierAtSite && b.state !== 'planted') {
    goal = ai.alert; key = `al${Math.round(goal.x)},${Math.round(goal.z)}`;
  } else if (side === 'atk') {
    const site = room.plan.site;
    const via = site === 'A' ? [-23, -17] : [-23, 17];
    if (!ai.viaDone && b.state !== 'planted' && b.state !== 'dropped') {
      if (Math.hypot(p.x - via[0], p.z - via[1]) < 3 || p.x > -22) ai.viaDone = true;
      else { goal = { x: via[0], z: via[1] }; key = 'via' + site; }
    }
    if (goal) { /* في طريقه للنقطة الوسيطة */ }
    else if (b.state === 'carried' && b.carrier === p.id) {
      const s = MAP.sites[site];
      const w = nearestWalkable(s.x, s.z);
      goal = { x: w.x, z: w.z }; key = 'plant' + site;
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      if (d < s.r * 0.8 && !engaged) ai.wantUse = true;
    } else if (b.state === 'dropped') {
      let nearest = null, nd = 1e9;
      for (const o of room.list) {
        if (!o.alive || room.sideOf(o) !== 'atk') continue;
        const d = Math.hypot(o.x - b.x, o.z - b.z);
        if (d < nd) { nd = d; nearest = o; }
      }
      if (nearest === p) { goal = { x: b.x, z: b.z }; key = 'pickup'; }
    }
    if (!goal) {
      if (b.state === 'planted') {
        goal = pickSpot(MAP.holds[b.site || site], ai.slot); key = 'guard' + ai.slot;
      } else {
        goal = pickSpot(MAP.siteSpots[site], ai.slot); key = 'site' + site + ai.slot;
      }
    }
  } else {
    if (b.state === 'planted') {
      goal = { x: b.x, z: b.z }; key = 'defuse';
      const d = Math.hypot(p.x - b.x, p.z - b.z);
      if (d < 2.0 && !engaged) ai.wantUse = true;
    } else {
      const roles = ['A', 'B', 'M', 'A', 'B'];
      const role = roles[ai.slot % roles.length];
      const idx = Math.floor(ai.slot / roles.length) + (ai.slot % 2);
      goal = pickSpot(MAP.holds[role], idx); key = 'hold' + role + idx;
    }
  }
  ai.goal = goal;
  if (goal && (key !== ai.goalKey || (ai.path.length === 0 && room.time > ai.repathAt))) {
    ai.goalKey = key;
    ai.repathAt = room.time + 0.7;
    const path = findPath(p.x, p.z, goal.x, goal.z);
    ai.path = path || [];
    ai.pi = 0;
  }
  p.using = ai.wantUse;
}

export function botThink(room, p, dt) {
  const ai = p.ai;
  if (!p.alive) return;
  if (room.phase !== 'live') {
    p.firing = false; p.using = false; p.speed = 0;
    return;
  }
  ai.thinkT -= dt;
  if (ai.thinkT <= 0) {
    ai.thinkT = 0.1;
    perceive(room, p);
    decide(room, p);
  }

  const now = room.time;
  const target = ai.target !== null ? room.players.get(ai.target) : null;
  const wid = room.curId(p);
  const w = WEAPONS[wid];
  const tdist = target ? Math.hypot(target.x - p.x, target.z - p.z) : 0;
  // لا يدخل في تبادل نيران بعيد (> 26م) إلا بالقناصة، بل يكمل تقدمه
  const engaged = target && target.alive && now - ai.seenAt < 0.5 && (wid === 'sniper' || tdist <= 26);
  let wantFire = false;
  let moveX = 0, moveZ = 0, moving = false;

  if (engaged) {
    const dx = target.x - p.x, dz = target.z - p.z;
    const dist = Math.hypot(dx, dz);
    const yawT = Math.atan2(-dx, -dz);
    const pitchT = Math.atan2(target.y + 1.4 - (p.y + P.EYE), dist);
    const k = Math.min(1, dt * ai.diff.turn);
    p.yaw += angDiff(p.yaw, yawT) * k;
    p.pitch += angDiff(p.pitch, pitchT) * k;
    const err = Math.hypot(angDiff(p.yaw, yawT) * Math.cos(p.pitch), angDiff(p.pitch, pitchT));
    p.aimNoise = ai.diff.aim * (1 + dist / 25);

    ai.modeT -= dt;
    if (ai.modeT <= 0) {
      if (ai.mode === 'stand') { ai.mode = 'strafe'; ai.modeT = 0.3 + Math.random() * 0.35; if (Math.random() < 0.5) ai.strafe *= -1; }
      else { ai.mode = 'stand'; ai.modeT = 0.3 + Math.random() * 0.3; }
    }
    if (wid === 'sniper' || wid === 'pistol') ai.mode = 'stand';
    if (ai.mode === 'strafe') {
      const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      moveX = rx * ai.strafe; moveZ = rz * ai.strafe; moving = true;
    }
    if (now >= ai.reactAt && err < 0.07) {
      if (!w.melee) {
        wantFire = ai.mode === 'stand' || dist < 9;
        if (w.auto && dist > 18) {
          ai.burstT -= dt;
          if (ai.burstT <= 0) {
            ai.burstOn = !ai.burstOn;
            ai.burstT = ai.burstOn ? 0.25 + Math.random() * 0.2 : 0.2 + Math.random() * 0.2;
          }
          if (!ai.burstOn) wantFire = false;
        }
      }
    }
    if (wid === 'sniper') p.scoped = dist > 15;
  } else {
    p.aimNoise = 0;
    p.scoped = false;
    // الحركة على المسار
    if (ai.using) { /* placeholder */ }
    if (!p.using && ai.path.length && ai.pi < ai.path.length) {
      const wp = ai.path[ai.pi];
      const dx = wp.x - p.x, dz = wp.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.9) ai.pi++;
      else {
        moveX = dx / d; moveZ = dz / d; moving = true;
        const yawT = Math.atan2(-dx, -dz);
        p.yaw += angDiff(p.yaw, yawT) * Math.min(1, dt * 8);
        p.pitch += (0 - p.pitch) * Math.min(1, dt * 5);
      }
    }
  }

  // اكتشاف التعليق
  ai.checkT -= dt;
  if (ai.checkT <= 0) {
    ai.checkT = 0.5;
    const moved = Math.hypot(p.x - ai.lx, p.z - ai.lz);
    if (moving && moved < 0.25) ai.stuckT += 0.5; else ai.stuckT = 0;
    ai.lx = p.x; ai.lz = p.z;
    if (ai.stuckT >= 1.5) {
      ai.stuckT = 0;
      ai.goalKey = '';
      ai.repathAt = 0;
      ai.path = [];
      ai.pi = 0;
    }
  }

  // تحويل لاتجاه محلي
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  const inp = {
    fwd: moveX * fx + moveZ * fz,
    str: moveX * rx + moveZ * rz,
    yaw: p.yaw, walk: false, jump: false,
  };
  stepPlayer(p, inp, dt, MAP.boxes);
  p.speed = Math.hypot(p.vx, p.vz);
  p.firing = wantFire;
}
