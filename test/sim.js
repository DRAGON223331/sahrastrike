// محاكاة مباراة بوتات ضد بوتات بسرعة + فحص اتصال الخريطة
import { Room } from '../server/room.js';
import { findPath, nearestWalkable, NAV } from '../server/nav.js';
import { MAP } from '../shared/map.js';

let failed = 0;
const ok = (c, msg) => { if (!c) { failed++; console.log('✗', msg); } else console.log('✓', msg); };

// 1) اتصال الخريطة
const pts = {
  atkSpawn: [-35, 0], defSpawn: [35, 0], A: [18, -17], B: [18, 17],
};
for (const [a, b] of [['atkSpawn', 'A'], ['atkSpawn', 'B'], ['defSpawn', 'A'], ['defSpawn', 'B'], ['atkSpawn', 'defSpawn']]) {
  const p = findPath(pts[a][0], pts[a][1], pts[b][0], pts[b][1]);
  ok(p && p.length > 0, `مسار ${a} -> ${b}`);
}
for (const [k, list] of Object.entries(MAP.siteSpots)) {
  for (const s of list) {
    const w = nearestWalkable(s[0], s[1]);
    if (Math.hypot(w.x - s[0], w.z - s[1]) > 1.6) console.log('  (تنبيه) نقطة موقع', k, s, 'اتنقلت إلى', w.x, w.z);
  }
}
for (const [k, list] of Object.entries(MAP.holds)) {
  for (const s of list) {
    const w = nearestWalkable(s[0], s[1]);
    if (Math.hypot(w.x - s[0], w.z - s[1]) > 1.6) console.log('  (تنبيه) نقطة تمركز', k, s, 'اتنقلت إلى', w.x, w.z);
  }
}
let walk = 0; for (let i = 0; i < NAV.blocked.length; i++) if (!NAV.blocked[i]) walk++;
console.log(`  الخلايا السالكة: ${walk}/${NAV.blocked.length}`);

// 2) مباراة كاملة بوتات فقط
const room = new Room('TEST', { mode: 'bots', diff: 'normal' });
room.testMode = true;
const events = { kill: 0, plant: 0, defuse: 0, explode: 0, roundend: 0, shot: 0, matchend: 0 };
const reasons = {};
const origBroadcast = room.broadcast.bind(room);
room.broadcast = (o) => {
  if (o.t === 'kill') events.kill++;
  if (o.t === 'shot') events.shot++;
  if (o.t === 'ev' && events[o.e] !== undefined) events[o.e]++;
  if (o.t === 'roundend') { events.roundend++; reasons[o.reason] = (reasons[o.reason] || 0) + 1; }
  if (o.t === 'matchend') events.matchend++;
  origBroadcast(o);
};
room.started = true;
room.fillBots();
room.resetMatch();
room.nextRound();
ok(room.list.length === 10, 'عشر لاعبين (5 ضد 5)');

const DT = 1 / 30;
const t0 = Date.now();
let ticks = 0;
const MAXT = 60 * 30 * 12; // 12 دقيقة لعب
while (ticks < MAXT && events.matchend === 0) { room.update(DT); ticks++; }
const secs = (Date.now() - t0) / 1000;
console.log(`  محاكاة ${(ticks * DT / 60).toFixed(1)} دقيقة لعب في ${secs.toFixed(1)} ثانية`);
console.log('  أحداث:', JSON.stringify(events), 'أسباب:', JSON.stringify(reasons), 'النتيجة:', room.score);
ok(events.roundend >= 7, 'اتلعبت 7 جولات على الأقل');
ok(events.matchend === 1, 'المباراة خلصت');
ok(events.kill > 10, 'في قتلات');
ok(events.plant > 0, 'القنبلة اتزرعت مرة على الأقل');
ok(events.defuse + events.explode > 0, 'القنبلة اتفككت أو انفجرت');
ok(Math.max(...room.score) === 7, 'الفريق الفايز وصل لـ 7');
for (const p of room.list) ok(Number.isFinite(p.x) && Number.isFinite(p.z), `إحداثيات سليمة للاعب ${p.name}`);
process.exitCode = failed ? 1 : 0;
console.log(failed ? `فشل ${failed}` : 'كل الاختبارات نجحت');
