// غرفة المباراة: جولات، اقتصاد، قنبلة، أسلحة، إطلاق نار (hitscan)، بوتات
import { MAP, siteAt } from '../shared/map.js';
import { WEAPONS, WEAPON_INDEX, ARMOR } from '../shared/weapons.js';
import { P, rayWorld, rayPlayer, hasLOS } from '../shared/physics.js';
import { botInit, botReset, botThink, botBuy } from './bots.js';

const TICK = 30;
const BUY_TIME = 15, LIVE_TIME = 100, POST_TIME = 5, OVER_TIME = 12;
const PLANT_TIME = 4, DEFUSE_TIME = 7, FUSE_TIME = 40;
const WIN_ROUNDS = 7, HALF = 6;
const START_CREDITS = 800, MAX_CREDITS = 9000;
const NAMES = ['سالم', 'ناصر', 'خالد', 'فهد', 'يوسف', 'عمر', 'طارق', 'زياد', 'رامي', 'ماجد',
  'حمزة', 'كريم', 'سعيد', 'وليد', 'هاني', 'بدر', 'مازن', 'سلطان', 'أنس', 'جاسم'];

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

function makePlayer(id, name, team, bot) {
  return {
    id, name, team, bot, ws: null,
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true, yaw: 0, pitch: 0,
    hp: 100, armor: 0, alive: false, credits: START_CREDITS,
    primary: null, slot: 1, ammo: {}, nextFire: 0, reloadEnd: 0,
    firing: false, scoped: false, spray: 0, lastShot: 0, speed: 0,
    kills: 0, deaths: 0, using: false, useT: 0, lastStateT: 0, lastFix: 0,
    aimNoise: 0, firedAt: 0, ai: null,
  };
}

export class Room {
  constructor(code, opts = {}) {
    this.code = code;
    this.mode = opts.mode || 'private';
    this.diff = opts.diff || 'normal';
    this.onEmpty = opts.onEmpty || (() => {});
    this.players = new Map();
    this.list = [];
    this.nextId = 1;
    this.time = 0;
    this.phase = 'lobby';
    this.timer = 0;
    this.round = 0;
    this.score = [0, 0];
    this.attackerTeam = 0;
    this.lossStreak = [0, 0];
    this.bomb = { state: 'none', x: 0, y: 0, z: 0, carrier: null, site: null, timer: 0 };
    this.plan = { site: 'A' };
    this.hostId = null;
    this.started = false;
    this.matchOver = false;
    this.lobbyTimer = null;
    this.lastTick = Date.now();
    this.tickN = 0;
    this.hudT = 0; this.rosterT = 0; this.lobbyT = 0;
    this.interval = null;
    this.disposed = false;
  }

  run() {
    this.interval = setInterval(() => {
      const nowMs = Date.now();
      const dt = Math.min(0.1, (nowMs - this.lastTick) / 1000);
      this.lastTick = nowMs;
      this.update(dt);
    }, 1000 / TICK);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.interval) clearInterval(this.interval);
    this.onEmpty(this.code);
  }

  // ===== أدوات =====
  sideOf(p) { return p.team === this.attackerTeam ? 'atk' : 'def'; }
  curId(p) {
    if (p.slot === 0 && p.primary) return p.primary;
    if (p.slot === 2) return 'knife';
    return 'pistol';
  }
  send(p, obj) {
    if (p.ws && p.ws.readyState === 1) p.ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj));
  }
  broadcast(obj) {
    const s = JSON.stringify(obj);
    for (const p of this.list) if (!p.bot) this.send(p, s);
  }
  humans() { return this.list.filter((p) => !p.bot); }

  // ===== اللاعبون =====
  addBot(team) {
    const used = new Set(this.list.map((p) => p.name));
    let name = NAMES.find((n) => !used.has(n)) || ('بوت' + this.nextId);
    const p = makePlayer(this.nextId++, name, team, true);
    botInit(p, this.diff);
    this.resetLoadout(p);
    this.players.set(p.id, p);
    this.list.push(p);
    return p;
  }

  addHuman(ws, name) {
    const cnt = [0, 0];
    this.humans().forEach((p) => cnt[p.team]++);
    const team = cnt[0] <= cnt[1] ? 0 : 1;
    if (cnt[team] >= 5) return null;
    let replaced = null;
    if (this.started) {
      const bots = this.list.filter((p) => p.bot && p.team === team);
      replaced = bots.find((b) => !b.alive) || bots[0];
      if (!replaced) return null;
      this.removePlayer(replaced.id, true);
    }
    const clean = String(name || 'لاعب').slice(0, 14).replace(/[<>]/g, '') || 'لاعب';
    const p = makePlayer(this.nextId++, clean, team, false);
    p.ws = ws;
    this.resetLoadout(p);
    this.players.set(p.id, p);
    this.list.push(p);
    if (this.hostId === null) this.hostId = p.id;
    this.send(p, { t: 'joined', id: p.id, code: this.code, mode: this.mode, team });
    if (this.started && this.phase === 'buy') this.spawnPlayer(p);
    if (this.mode === 'public' && !this.started && this.lobbyTimer === null) this.lobbyTimer = 15;
    this.sendLobby();
    this.sendRoster();
    return p;
  }

  removePlayer(id, replacing = false) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    this.list = this.list.filter((x) => x !== p);
    if (replacing) return;
    if (this.bomb.carrier === id) this.dropBomb(p);
    if (!p.bot && this.started) {
      const b = this.addBot(p.team);
      Object.assign(b, {
        x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, hp: p.hp, armor: p.armor, alive: p.alive,
        primary: p.primary, ammo: { ...p.ammo }, credits: p.credits, slot: p.slot, kills: p.kills, deaths: p.deaths,
      });
      botReset(b, this.list.filter((x) => x.team === b.team).length - 1);
      if (this.bomb.carrier === null && this.bomb.state === 'dropped') { /* يبقى مسقوطاً */ }
    }
    if (this.hostId === id) {
      const h = this.humans()[0];
      this.hostId = h ? h.id : null;
    }
    if (this.humans().length === 0 && !this.testMode) this.dispose();
    else { this.sendLobby(); this.sendRoster(); }
  }

  resetLoadout(p) {
    p.primary = null; p.armor = 0; p.slot = 1;
    p.ammo = { pistol: { mag: WEAPONS.pistol.mag, res: WEAPONS.pistol.reserve } };
    p.reloadEnd = 0; p.firing = false; p.scoped = false;
  }

  giveWeapon(p, id) {
    const w = WEAPONS[id];
    p.primary = id;
    p.ammo[id] = { mag: w.mag, res: w.reserve };
  }

  buy(p, item) {
    if (this.phase !== 'buy' || !p.alive) return false;
    const zone = MAP.buyZoneX;
    if (this.sideOf(p) === 'atk' ? p.x > -zone + 0.5 : p.x < zone - 0.5) return false;
    if (item === 'armor') {
      if (p.armor >= ARMOR.value || p.credits < ARMOR.price) return false;
      p.credits -= ARMOR.price; p.armor = ARMOR.value;
      return true;
    }
    const w = WEAPONS[item];
    if (!w || w.slot !== 0 || p.credits < w.price || p.primary === item) return false;
    p.credits -= w.price;
    this.giveWeapon(p, item);
    p.slot = 0; p.reloadEnd = 0;
    p.nextFire = this.time + w.draw;
    return true;
  }

  // ===== المباراة =====
  start() {
    if (this.started) return;
    this.started = true;
    this.lobbyTimer = null;
    this.fillBots();
    this.resetMatch();
    this.nextRound();
  }

  fillBots() {
    for (const team of [0, 1]) {
      while (this.list.filter((p) => p.team === team).length < 5) this.addBot(team);
    }
  }

  resetMatch() {
    this.score = [0, 0]; this.round = 0; this.attackerTeam = 0;
    this.lossStreak = [0, 0]; this.matchOver = false;
    for (const p of this.list) {
      p.kills = 0; p.deaths = 0; p.credits = START_CREDITS;
      this.resetLoadout(p); p.alive = false;
    }
  }

  spawnPlayer(p) {
    const side = this.sideOf(p);
    const mates = this.list.filter((x) => x.team === p.team);
    const idx = Math.max(0, mates.indexOf(p)) % 5;
    const sp = MAP.spawns[side][idx];
    p.x = sp[0]; p.z = sp[1]; p.y = 0;
    p.vx = p.vy = p.vz = 0; p.grounded = true;
    p.yaw = side === 'atk' ? -Math.PI / 2 : Math.PI / 2;
    p.pitch = 0;
    p.hp = 100; p.alive = true; p.firing = false; p.using = false; p.useT = 0;
    p.scoped = false; p.reloadEnd = 0; p.speed = 0; p.lastStateT = this.time;
    for (const id of Object.keys(p.ammo)) {
      const w = WEAPONS[id];
      p.ammo[id] = { mag: w.mag, res: w.reserve };
    }
    p.slot = p.primary ? 0 : 1;
    p.nextFire = this.time + 0.4;
    this.send(p, { t: 'spawn', x: p.x, y: p.y, z: p.z, yaw: p.yaw });
  }

  nextRound() {
    this.round++;
    const halftime = this.round === HALF + 1;
    if (halftime) {
      this.attackerTeam ^= 1;
      this.lossStreak = [0, 0];
      for (const p of this.list) { this.resetLoadout(p); p.credits = START_CREDITS; }
    }
    for (const p of this.list) {
      if (!p.alive && this.round > 1 && !halftime) {
        // مات في الجولة السابقة: يفقد السلاح الرئيسي والدرع
        p.primary = null; p.armor = 0;
      }
    }
    for (const team of [0, 1]) {
      this.list.filter((p) => p.team === team).forEach((p) => this.spawnPlayer(p));
    }
    // القنبلة
    const atk = this.list.filter((p) => this.sideOf(p) === 'atk');
    const carrier = atk[Math.floor(Math.random() * atk.length)];
    this.bomb = { state: 'carried', x: 0, y: 0, z: 0, carrier: carrier ? carrier.id : null, site: null, timer: 0 };
    this.plan = { site: Math.random() < 0.5 ? 'A' : 'B' };
    for (const team of [0, 1]) {
      this.list.filter((p) => p.team === team).forEach((p, i) => { if (p.bot) botReset(p, i); });
    }
    this.phase = 'buy';
    this.timer = BUY_TIME;
    for (const p of this.list) if (p.bot) botBuy(this, p);
    this.broadcast({ t: 'ev', e: halftime ? 'halftime' : 'roundstart', round: this.round });
    this.sendHud(); this.sendRoster();
  }

  startLive() {
    this.phase = 'live';
    this.timer = LIVE_TIME;
    this.broadcast({ t: 'ev', e: 'live' });
    this.sendHud();
  }

  endRound(win, reason) {
    if (this.phase !== 'live') return;
    this.phase = 'post';
    this.timer = POST_TIME;
    this.score[win]++;
    const lose = win ^ 1;
    this.lossStreak[win] = 0;
    this.lossStreak[lose] = Math.min(3, this.lossStreak[lose] + 1);
    for (const p of this.list) {
      const bonus = p.team === win ? 3000 : 1900 + (this.lossStreak[p.team] - 1) * 500;
      p.credits = Math.min(MAX_CREDITS, p.credits + bonus);
      p.firing = false; p.using = false;
    }
    this.matchOver = this.score[win] >= WIN_ROUNDS;
    this.broadcast({ t: 'roundend', win, reason, score: this.score, atk: this.attackerTeam, over: this.matchOver });
    this.sendHud(); this.sendRoster();
  }

  // ===== السلاح =====
  tryFire(p) {
    const now = this.time;
    if (!p.alive || p.reloadEnd || now < p.nextFire) return;
    const id = this.curId(p);
    const w = WEAPONS[id];
    if (w.melee) { this.melee(p, false); return; }
    const a = p.ammo[id];
    if (!a) return;
    if (a.mag <= 0) {
      if (a.res > 0) this.startReload(p);
      else {
        p.firing = false;
        const alt = ['pistol', 'knife'].find((x) => x !== id && (x === 'knife' || (p.ammo[x] && (p.ammo[x].mag > 0 || p.ammo[x].res > 0))));
        if (alt) this.setSlot(p, alt === 'knife' ? 2 : 1);
      }
      return;
    }
    a.mag--;
    p.nextFire = now + w.interval;
    if (now - p.lastShot > 0.4) p.spray = 0;
    const moving = Math.min(1, p.speed / P.RUN);
    let spread = w.spread + w.moveSpread * moving + p.spray;
    if (id === 'sniper' && !p.scoped) spread = w.unscopedSpread;
    p.spray = Math.min(w.sprayMax, p.spray + w.sprayAdd);
    p.lastShot = now; p.firedAt = now;
    if (!w.auto) p.firing = false;
    const noise = spread + (p.aimNoise || 0);
    const ang = Math.random() * Math.PI * 2, rad = Math.sqrt(Math.random()) * noise;
    this.hitscan(p, w, p.yaw + Math.cos(ang) * rad, p.pitch + Math.sin(ang) * rad);
    if (a.mag === 0 && a.res > 0) this.startReload(p);
  }

  hitscan(p, w, yaw, pitch) {
    const ox = p.x, oy = p.y + P.EYE, oz = p.z;
    const cp = Math.cos(pitch);
    const dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp;
    let wt = rayWorld(MAP.boxes, ox, oy, oz, dx, dy, dz);
    if (dy < 0) { const tg = -oy / dy; if (tg < wt) wt = tg; }
    let best = null, bt = wt;
    for (const e of this.list) {
      if (!e.alive || e.team === p.team) continue;
      const h = rayPlayer(ox, oy, oz, dx, dy, dz, e.x, e.y, e.z);
      if (h && h.t < bt) { bt = h.t; best = { e, head: h.head }; }
    }
    const t = Math.min(bt, 120);
    const kind = best ? (best.head ? 2 : 1) : 0;
    this.broadcast({
      t: 'shot', id: p.id, w: w.id, k: kind,
      ox: r2(ox), oy: r2(oy), oz: r2(oz), hx: r2(ox + dx * t), hy: r2(oy + dy * t), hz: r2(oz + dz * t),
    });
    // البوتات تسمع الطلقات
    for (const b of this.list) {
      if (!b.bot || !b.alive || b.team === p.team || (b.ai && b.ai.target !== null)) continue;
      if (Math.hypot(b.x - ox, b.z - oz) < 38) b.ai.alert = { x: ox, z: oz, t: this.time };
    }
    if (best) this.damage(best.e, p, best.head ? w.head : w.dmg, w.id, best.head);
  }

  melee(p, alt) {
    const w = WEAPONS.knife;
    const now = this.time;
    if (!p.alive || now < p.nextFire) return;
    p.nextFire = now + (alt ? w.altRate : w.rate);
    p.firedAt = now;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    let best = null, bd = 1e9;
    for (const e of this.list) {
      if (!e.alive || e.team === p.team) continue;
      const dx = e.x - p.x, dz = e.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > w.range + 0.4 || Math.abs(e.y - p.y) > 1.5) continue;
      if ((dx * fx + dz * fz) / (d || 1) < 0.5) continue;
      if (!hasLOS(MAP.boxes, p.x, p.y + P.EYE, p.z, e.x, e.y + 1.2, e.z)) continue;
      if (d < bd) { bd = d; best = e; }
    }
    this.broadcast({ t: 'swing', id: p.id, alt: alt ? 1 : 0, hit: best ? 1 : 0 });
    if (best) {
      // طعنة من الخلف
      const vfx = -Math.sin(best.yaw), vfz = -Math.cos(best.yaw);
      const dx = best.x - p.x, dz = best.z - p.z, d = Math.hypot(dx, dz) || 1;
      const back = (vfx * dx + vfz * dz) / d > 0.3;
      const dmg = back ? w.backDmg : (alt ? w.altDmg : w.dmg);
      this.damage(best, p, dmg, 'knife', false);
    }
  }

  damage(v, att, dmg, wid, head) {
    if (!v.alive) return;
    let d = dmg;
    if (v.armor > 0) {
      const ab = Math.min(v.armor, d * 0.66);
      v.armor -= ab; d -= ab;
    }
    d = Math.round(d);
    v.hp -= d;
    const dead = v.hp <= 0;
    this.send(v, { t: 'hit', amt: d, head: head ? 1 : 0, ax: r2(att.x), az: r2(att.z) });
    this.send(att, { t: 'hm', head: head ? 1 : 0, kill: dead ? 1 : 0 });
    if (dead) {
      v.hp = 0; v.alive = false; v.firing = false; v.using = false; v.useT = 0; v.scoped = false;
      v.deaths++;
      if (att !== v) { att.kills++; att.credits = Math.min(MAX_CREDITS, att.credits + 200); }
      if (this.bomb.carrier === v.id) this.dropBomb(v);
      this.broadcast({ t: 'kill', k: att.id, v: v.id, w: wid, h: head ? 1 : 0 });
    }
  }

  startReload(p) {
    const id = this.curId(p);
    const w = WEAPONS[id];
    if (w.melee || p.reloadEnd) return;
    const a = p.ammo[id];
    if (!a || a.mag >= w.mag || a.res <= 0) return;
    p.reloadEnd = this.time + w.reload;
    p.reloadId = id;
    p.scoped = false;
    this.broadcast({ t: 'reload', id: p.id, w: id });
  }

  setSlot(p, s) {
    if (!p.alive || p.slot === s) return;
    if (s === 0 && !p.primary) return;
    if (s < 0 || s > 2) return;
    p.slot = s;
    p.reloadEnd = 0; p.firing = false; p.scoped = false;
    p.nextFire = Math.max(p.nextFire, this.time + WEAPONS[this.curId(p)].draw);
  }

  // ===== القنبلة =====
  dropBomb(p) {
    this.bomb = { ...this.bomb, state: 'dropped', carrier: null, x: p.x, y: p.y, z: p.z };
    this.broadcast({ t: 'ev', e: 'drop' });
  }

  handleUse(p, dt) {
    const b = this.bomb;
    if (!p.using || this.phase !== 'live' || !p.alive || p.speed > 1.2) { p.useT = 0; return; }
    const side = this.sideOf(p);
    if (side === 'atk' && b.state === 'carried' && b.carrier === p.id) {
      const site = siteAt(p.x, p.z);
      if (!site) { p.useT = 0; return; }
      p.useT += dt;
      if (p.useT >= PLANT_TIME) {
        p.useT = 0; p.using = false;
        this.bomb = { state: 'planted', x: p.x, y: p.y, z: p.z, carrier: null, site, timer: FUSE_TIME };
        this.broadcast({ t: 'ev', e: 'plant', site });
        this.timer = 0; // الوقت العادي ينتهي، القنبلة تحكم
        this.sendHud();
      }
    } else if (side === 'def' && b.state === 'planted') {
      if (Math.hypot(p.x - b.x, p.z - b.z) > 2.4) { p.useT = 0; return; }
      p.useT += dt;
      if (p.useT >= DEFUSE_TIME) {
        p.useT = 0; p.using = false;
        this.bomb.state = 'defused';
        this.broadcast({ t: 'ev', e: 'defuse' });
        this.endRound(p.team, 'defuse');
      }
    } else p.useT = 0;
  }

  explode() {
    const b = this.bomb;
    b.state = 'exploded';
    this.broadcast({ t: 'ev', e: 'explode', x: r2(b.x), z: r2(b.z) });
    for (const p of this.list) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - b.x, p.z - b.z);
      if (d < 14) {
        const dmg = d < 8 ? 999 : 100 * (1 - (d - 8) / 6);
        const killer = this.list.find((x) => this.sideOf(x) === 'atk') || p;
        if (dmg > 0) {
          p.hp -= dmg;
          if (p.hp <= 0) { p.hp = 0; p.alive = false; p.deaths++; p.firing = false; this.broadcast({ t: 'kill', k: killer.id, v: p.id, w: 'bomb', h: 0 }); }
        }
      }
    }
    this.endRound(this.attackerTeam, 'explode');
  }

  checkEnd() {
    if (this.phase !== 'live') return;
    const atkTeam = this.attackerTeam, defTeam = atkTeam ^ 1;
    const aa = this.list.filter((p) => p.team === atkTeam && p.alive).length;
    const da = this.list.filter((p) => p.team === defTeam && p.alive).length;
    const b = this.bomb;
    if (b.state === 'planted') {
      if (b.timer <= 0) { this.explode(); return; }
      if (da === 0) this.endRound(atkTeam, 'elim');
      return;
    }
    if (aa === 0) this.endRound(defTeam, 'elim');
    else if (da === 0) this.endRound(atkTeam, 'elim');
    else if (this.timer <= 0) this.endRound(defTeam, 'time');
  }

  // ===== الحلقة =====
  update(dt) {
    this.time += dt;
    this.tickN++;
    if (!this.started) {
      if (this.mode === 'public' && this.lobbyTimer !== null) {
        this.lobbyTimer -= dt;
        if (this.lobbyTimer <= 0 || this.humans().length >= 10) this.start();
      }
      this.lobbyT -= dt;
      if (this.lobbyT <= 0) { this.lobbyT = 1; this.sendLobby(); }
      return;
    }

    if (this.phase === 'buy') {
      this.timer -= dt;
      if (this.timer <= 0) this.startLive();
    } else if (this.phase === 'live') {
      if (this.bomb.state === 'planted') this.bomb.timer -= dt;
      else this.timer -= dt;
    } else if (this.phase === 'post') {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this.matchOver) {
          this.phase = 'over'; this.timer = OVER_TIME;
          this.broadcast({ t: 'matchend', win: this.score[0] > this.score[1] ? 0 : 1, score: this.score });
        } else this.nextRound();
      }
    } else if (this.phase === 'over') {
      this.timer -= dt;
      if (this.timer <= 0) { this.resetMatch(); this.nextRound(); }
    }

    for (const p of this.list) {
      if (!p.alive) continue;
      if (p.bot) botThink(this, p, dt);
      // إعادة التعبئة
      if (p.reloadEnd && this.time >= p.reloadEnd) {
        const a = p.ammo[p.reloadId];
        const w = WEAPONS[p.reloadId];
        if (a && w) {
          const take = Math.min(w.mag - a.mag, a.res);
          a.mag += take; a.res -= take;
        }
        p.reloadEnd = 0;
      }
      if (p.firing && (this.phase === 'live' || this.phase === 'post')) this.tryFire(p);
      this.handleUse(p, dt);
      // التقاط القنبلة
      if (this.bomb.state === 'dropped' && this.sideOf(p) === 'atk' && this.phase === 'live') {
        if (Math.hypot(p.x - this.bomb.x, p.z - this.bomb.z) < 1.5) {
          this.bomb = { ...this.bomb, state: 'carried', carrier: p.id };
          this.broadcast({ t: 'ev', e: 'pickup' });
        }
      }
    }
    this.checkEnd();

    this.sendSnap();
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.5; this.sendHud(); }
    this.rosterT -= dt;
    if (this.rosterT <= 0) { this.rosterT = 1.5; this.sendRoster(); }
  }

  // ===== الإرسال =====
  sendSnap() {
    if (!this.humans().length) return;
    const arr = this.list.map((p) => [
      p.id, r2(p.x), r2(p.y), r2(p.z), r3(p.yaw), r3(p.pitch), p.alive ? 1 : 0,
      WEAPON_INDEX.indexOf(this.curId(p)), p.reloadEnd ? 1 : 0, Math.round(p.speed * 10) / 10,
    ]);
    const base = JSON.stringify(arr);
    for (const p of this.humans()) {
      const id = this.curId(p);
      const a = p.ammo[id] || { mag: 0, res: 0 };
      const b = this.bomb;
      const need = this.sideOf(p) === 'atk' ? PLANT_TIME : DEFUSE_TIME;
      const me = {
        hp: p.hp, armor: Math.round(p.armor), credits: p.credits, slot: p.slot, w: id,
        mag: a.mag, res: a.res, primary: p.primary, alive: p.alive ? 1 : 0,
        rl: p.reloadEnd ? r2(p.reloadEnd - this.time) : 0,
        use: r2(p.useT / need), hasBomb: b.carrier === p.id ? 1 : 0,
        canBuy: this.phase === 'buy' ? 1 : 0, team: p.team,
      };
      this.send(p, `{"t":"snap","p":${base},"me":${JSON.stringify(me)}}`);
    }
  }

  sendHud() {
    const b = this.bomb;
    const alive = [0, 0];
    for (const p of this.list) if (p.alive) alive[p.team]++;
    this.broadcast({
      t: 'hud', phase: this.phase, left: Math.max(0, r2(this.timer)), round: this.round, score: this.score,
      atk: this.attackerTeam, alive,
      bomb: { state: b.state, x: r2(b.x), z: r2(b.z), site: b.site, timer: Math.max(0, r2(b.timer)), carrier: b.carrier },
    });
  }

  sendRoster() {
    this.broadcast({
      t: 'roster',
      players: this.list.map((p) => ({ id: p.id, name: p.name, team: p.team, bot: p.bot ? 1 : 0, k: p.kills, d: p.deaths })),
    });
  }

  sendLobby() {
    this.broadcast({
      t: 'lobby', code: this.code, mode: this.mode, host: this.hostId, started: this.started,
      countdown: this.lobbyTimer !== null ? Math.max(0, Math.ceil(this.lobbyTimer)) : null,
      players: this.list.map((p) => ({ id: p.id, name: p.name, team: p.team, bot: p.bot ? 1 : 0 })),
    });
  }

  // ===== رسائل اللاعبين =====
  handle(p, m) {
    switch (m.t) {
      case 's': {
        if (!p.alive || !Number.isFinite(m.x) || !Number.isFinite(m.z)) return;
        const dtm = Math.max(0.016, this.time - p.lastStateT);
        const dist = Math.hypot(m.x - p.x, m.z - p.z);
        if (dist > P.RUN * 1.6 * dtm + 0.8) {
          if (this.time - p.lastFix > 0.3) {
            p.lastFix = this.time;
            this.send(p, { t: 'fix', x: p.x, y: p.y, z: p.z });
          }
        } else {
          p.speed = p.speed * 0.6 + (dist / dtm) * 0.4;
          p.x = Math.max(P.MINX, Math.min(P.MAXX, m.x));
          p.z = Math.max(P.MINZ, Math.min(P.MAXZ, m.z));
          p.y = Math.max(0, Math.min(6, Number(m.y) || 0));
          if (this.phase === 'buy') {
            const zone = MAP.buyZoneX;
            if (this.sideOf(p) === 'atk') p.x = Math.min(p.x, -zone);
            else p.x = Math.max(p.x, zone);
          }
        }
        p.lastStateT = this.time;
        if (Number.isFinite(m.yaw)) p.yaw = m.yaw;
        if (Number.isFinite(m.pitch)) p.pitch = Math.max(-1.55, Math.min(1.55, m.pitch));
        break;
      }
      case 'fire': p.firing = !!m.on && p.alive; break;
      case 'reload': if (p.alive) this.startReload(p); break;
      case 'slot': this.setSlot(p, m.s | 0); break;
      case 'buy': this.buy(p, String(m.item)); break;
      case 'use': p.using = !!m.on; if (!m.on) p.useT = 0; break;
      case 'melee': if (p.alive && this.curId(p) === 'knife') this.melee(p, !!m.alt); break;
      case 'scope': p.scoped = !!m.on && p.alive && this.curId(p) === 'sniper' && !p.reloadEnd; break;
      case 'start': if (p.id === this.hostId && !this.started) this.start(); break;
      default: break;
    }
  }
}
