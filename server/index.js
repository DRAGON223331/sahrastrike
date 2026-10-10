// سيرفر HTTP (ملفات ثابتة) + WebSocket للعبة
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { Room } from './room.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.ico': 'image/x-icon',
};

const MOUNTS = [
  ['/shared/', path.join(ROOT, 'shared')],
  ['/vendor/three/', path.join(ROOT, 'node_modules', 'three', 'build')],
  ['/assets/', path.join(ROOT, 'assets')],
  ['/', path.join(ROOT, 'client')],
];

function serve(req, res) {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') url = '/index.html';
  for (const [prefix, dir] of MOUNTS) {
    if (!url.startsWith(prefix)) continue;
    const rel = prefix === '/' ? url.slice(1) : url.slice(prefix.length);
    const file = path.resolve(dir, rel);
    if (!file.startsWith(dir + path.sep)) continue;
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
    return;
  }
  res.writeHead(404); res.end('not found');
}

const server = http.createServer(serve);
const wss = new WebSocketServer({ server, maxPayload: 4096 });
const rooms = new Map();

function makeCode() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += L[Math.floor(Math.random() * L.length)];
    if (!rooms.has(c)) return c;
  }
}

function newRoom(opts) {
  const code = makeCode();
  const room = new Room(code, { ...opts, onEmpty: (c) => rooms.delete(c) });
  rooms.set(code, room);
  room.run();
  return room;
}

function findPublic() {
  for (const r of rooms.values()) {
    if (r.mode !== 'public' || r.disposed) continue;
    const hum = r.humans();
    if (hum.length >= 10) continue;
    if (!r.started) return r;
    if (r.list.some((p) => p.bot)) return r;
  }
  return null;
}

wss.on('connection', (ws) => {
  const conn = { room: null, player: null };
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  const fail = (msg) => ws.send(JSON.stringify({ t: 'error', msg }));

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }
    if (!m || typeof m.t !== 'string') return;

    if (!conn.player) {
      let room = null;
      if (m.t === 'bots') {
        room = newRoom({ mode: 'bots', diff: ['easy', 'normal', 'hard'].includes(m.diff) ? m.diff : 'normal' });
      } else if (m.t === 'quick') {
        room = findPublic() || newRoom({ mode: 'public' });
      } else if (m.t === 'create') {
        room = newRoom({ mode: 'private' });
      } else if (m.t === 'join') {
        room = rooms.get(String(m.code || '').toUpperCase().trim());
        if (!room) return fail('الغرفة مش موجودة');
      } else return;
      const p = room.addHuman(ws, m.name);
      if (!p) { if (m.t === 'bots') room.dispose(); return fail('الغرفة ممتلئة'); }
      conn.room = room; conn.player = p;
      if (m.t === 'bots') room.start();
      return;
    }
    conn.room.handle(conn.player, m);
  });

  ws.on('close', () => {
    if (conn.room && conn.player) conn.room.removePlayer(conn.player.id);
  });
  ws.on('error', () => {});
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 15000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`صحراء سترايك شغّالة على: http://localhost:${PORT}`);
});
