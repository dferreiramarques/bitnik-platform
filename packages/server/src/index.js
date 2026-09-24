// @bitnik/server — servidor genérico para pacotes @bitnik/engine.
//
//   createPlatform({ brand, games, storage }).listen(port)
//
// Não sabe nada de nenhum jogo em concreto: recebe pacotes, cria
// mesas públicas (multijogador) e mesas solo privadas (uma instância
// por utilizador, com bots), agenda bots e timers e guarda tudo no
// adaptador de storage. Um deploy por marca/cliente.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { WebSocketServer } from 'ws';
import {
  checkGame, createMatch, applyMove, fireTimer, viewFor, activeSeats, botMove, ENGINE_VERSION,
} from '@bitnik/engine';
import { memoryStorage, fileStorage } from './storage.js';
import { PLATFORM_I18N } from './i18n.js';

export { memoryStorage, fileStorage };

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(here, '..', 'public');
const ENGINE_DIR = dirname(fileURLToPath(import.meta.resolve('@bitnik/engine')));
const CLIENT_FILE = fileURLToPath(import.meta.resolve('@bitnik/client'));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

const id = (n = 9) => randomBytes(n).toString('base64url');
const major = (v) => String(v).split('.')[0];
const cleanName = (s, fallback) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, 24) || fallback;

export function createPlatform({
  brand = { id: 'default', name: 'Bitnik' },
  games = [],
  storage = memoryStorage(),
  botDelayMs = [700, 1400],
  graceMs = 60_000,
  studio = false,
  logger = console,
} = {}) {
  // ─── Jogos ──────────────────────────────────────────────────
  const G = new Map();
  for (const g of games) {
    const problems = checkGame(g);
    if (problems.length) throw new Error(`Pacote ${g?.id}: ${problems.join('; ')}`);
    if (G.has(g.id)) throw new Error(`Jogo repetido: ${g.id}`);
    G.set(g.id, g);
  }

  // ─── Estado em memória ──────────────────────────────────────
  let users = {};                  // token → { userId, name }
  const rooms = new Map();         // roomId → room
  const conns = new Map();         // ws → { user, token, roomId, lang }
  const botTimers = new Map();     // roomId → timeout
  const gameTimers = new Map();    // roomId → Map(key → timeout)
  const graceTimers = new Map();   // userId → timeout
  let now = () => Date.now();
  let closing = false;

  const isOnline = (userId) => [...conns.values()].some((c) => c.user?.userId === userId);
  const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
  const persist = (room) => storage.saveRoom(room);

  // ─── Salas ──────────────────────────────────────────────────
  const emptySeat = () => ({ userId: null, name: '', bot: false, away: false });

  function publicRoomsFor(game) {
    const out = [];
    for (let n = Math.max(2, game.players.min); n <= game.players.max; n++) {
      out.push({
        id: `${game.id}-${n}p`, gameId: game.id, kind: 'public', owner: null,
        name: `${n}`, numPlayers: n, seats: Array.from({ length: n }, emptySeat),
        status: 'waiting', match: null, timerDue: {}, createdAt: now(), updatedAt: now(),
      });
    }
    return out;
  }

  function summary(room, userId) {
    return {
      id: room.id, gameId: room.gameId, kind: room.kind, name: room.name,
      numPlayers: room.numPlayers, status: room.status, updatedAt: room.updatedAt,
      seats: room.seats.map((s) => ({
        name: s.name, bot: s.bot, away: s.away, taken: !!(s.userId || s.bot), isYou: !!userId && s.userId === userId,
      })),
      round: room.match?.state?.round ?? null,
    };
  }

  function roomsFor(userId) {
    const all = [...rooms.values()];
    return {
      public: all.filter((r) => r.kind === 'public').map((r) => summary(r, userId)),
      mine: all.filter((r) => r.kind === 'solo' && r.owner === userId)
        .sort((a, b) => b.updatedAt - a.updatedAt).map((r) => summary(r, userId)),
    };
  }

  function broadcastLobby() {
    for (const [ws, c] of conns) if (c.user) send(ws, { type: 'ROOMS', ...roomsFor(c.user.userId) });
  }

  const seatOf = (room, userId) => room.seats.findIndex((s) => s.userId === userId);

  function roomMessage(room, userId) {
    const game = G.get(room.gameId);
    const seat = seatOf(room, userId);
    const base = { type: 'ROOM', room: summary(room, userId), seat: seat < 0 ? null : seat };
    if (!room.match) return base;
    const v = viewFor(game, room.match, seat < 0 ? null : seat);
    v.legal = v.legal.map((mv) => ({ ...mv, label: game.describeMove?.(mv, v.view) ?? { key: `move.${mv.type}` } }));
    return { ...base, ...v };
  }

  function broadcastRoom(room) {
    for (const [ws, c] of conns) if (c.roomId === room.id && c.user) send(ws, roomMessage(room, c.user.userId));
  }

  function touch(room, { lobby = false } = {}) {
    room.updatedAt = now();
    persist(room);
    broadcastRoom(room);
    if (lobby) broadcastLobby();
  }

  function startMatch(room) {
    const game = G.get(room.gameId);
    room.match = createMatch(game, { numPlayers: room.numPlayers, seed: `${room.id}:${now()}:${id(4)}` });
    room.status = room.match.result ? 'over' : 'playing';
    room.timerDue = {};
    afterChange(room);
  }

  function commit(room, match) {
    const wasOver = room.status === 'over';
    room.match = match;
    room.status = match.result ? 'over' : 'playing';
    afterChange(room, { lobby: !wasOver && room.status === 'over' });
    // Mesa pública acabada sem ninguém ligado: volta a ficar livre.
    if (room.kind === 'public' && room.status === 'over'
      && !room.seats.some((s) => s.userId && isOnline(s.userId))) {
      room.seats = room.seats.map(emptySeat);
      resetPublicIfEmpty(room);
      touch(room, { lobby: true });
    }
  }

  function afterChange(room, { lobby = true } = {}) {
    syncTimers(room);
    scheduleBots(room);
    touch(room, { lobby });
  }

  // ─── Timers do jogo (declarativos no match, executados aqui) ─
  function syncTimers(room) {
    const handles = gameTimers.get(room.id) || new Map();
    for (const h of handles.values()) clearTimeout(h);
    handles.clear();
    const due = {};
    for (const t of room.match?.timers || []) {
      const prev = room.timerDue?.[t.key];
      due[t.key] = prev && prev.seq === t.seq ? prev : { at: now() + t.delayMs, seq: t.seq };
      const wait = Math.max(0, due[t.key].at - now());
      handles.set(t.key, setTimeout(() => onTimer(room.id, t.key), wait));
    }
    room.timerDue = due;
    gameTimers.set(room.id, handles);
  }

  function onTimer(roomId, key) {
    const room = rooms.get(roomId);
    if (!room?.match) return;
    const r = fireTimer(G.get(room.gameId), room.match, key);
    if (r.ok) commit(room, r.match);
    else logger.warn(`[timer] ${roomId} ${key}: ${r.error.code}`);
  }

  // ─── Bots (e lugares ausentes em mesas públicas) ───────────
  const botControls = (room, seat) => room.seats[seat].bot || (room.kind === 'public' && room.seats[seat].away);

  function scheduleBots(room) {
    clearTimeout(botTimers.get(room.id));
    if (room.status !== 'playing') return;
    const game = G.get(room.gameId);
    const seat = activeSeats(game, room.match).find((s) => botControls(room, s));
    if (seat == null) return;
    const [a, b] = botDelayMs;
    botTimers.set(room.id, setTimeout(() => {
      const mv = botMove(game, room.match, seat, room.level);
      if (!mv) return logger.warn(`[bot] ${room.id} lugar ${seat} sem jogada`);
      const r = applyMove(game, room.match, seat, mv);
      if (r.ok) commit(room, r.match);
      else logger.warn(`[bot] ${room.id} lugar ${seat} ${mv.type}: ${r.error.code}`);
    }, a + Math.random() * (b - a)));
  }

  // ─── Presença ───────────────────────────────────────────────
  function markAway(userId, away) {
    for (const room of rooms.values()) {
      const s = seatOf(room, userId);
      if (s < 0) continue;
      if (room.kind === 'public' && room.status === 'waiting' && away) {
        room.seats[s] = emptySeat(); // na sala de espera, liberta o lugar
        touch(room, { lobby: true });
        continue;
      }
      if (room.seats[s].away !== away) {
        room.seats[s].away = away;
        scheduleBots(room);
        touch(room);
      }
    }
  }

  function resetPublicIfEmpty(room) {
    if (room.kind !== 'public' || room.seats.some((s) => s.userId)) return;
    clearTimeout(botTimers.get(room.id));
    room.seats = room.seats.map(emptySeat);
    room.match = null;
    room.status = 'waiting';
    syncTimers(room);
  }

  // ─── Mensagens ──────────────────────────────────────────────
  const fail = (ws, code, params = {}) => send(ws, { type: 'ERROR', code, params });

  const handlers = {
    HELLO(ws, c, { token, name, lang }) {
      let user = token && users[token];
      if (!user) {
        token = id(18);
        user = { userId: id(8), name: cleanName(name, 'Jogador') };
        users[token] = user;
        storage.saveUsers(users);
      }
      Object.assign(c, { user, token, lang: lang || c.lang });
      clearTimeout(graceTimers.get(user.userId));
      markAway(user.userId, false);
      send(ws, {
        type: 'WELCOME', userId: user.userId, token, name: user.name, studio,
        engineVersion: ENGINE_VERSION,
        brand: { id: brand.id, name: brand.name, lang: brand.lang || 'pt' },
        platformI18n: PLATFORM_I18N,
        games: [...G.values()].map((g) => ({
          id: g.id, version: g.version, players: g.players, defaultLang: g.defaultLang, i18n: g.i18n,
        })),
      });
      send(ws, { type: 'ROOMS', ...roomsFor(user.userId) });
    },

    SET_NAME(ws, c, { name }) {
      c.user.name = cleanName(name, c.user.name);
      storage.saveUsers(users);
      for (const room of rooms.values()) {
        const s = seatOf(room, c.user.userId);
        if (s >= 0) { room.seats[s].name = c.user.name; touch(room); }
      }
      broadcastLobby();
    },

    LIST(ws, c) { send(ws, { type: 'ROOMS', ...roomsFor(c.user.userId) }); },

    CREATE_SOLO(ws, c, { gameId, numPlayers, level }) {
      const game = G.get(gameId);
      if (!game) return fail(ws, 'server.UNKNOWN_GAME');
      const n = Number(numPlayers);
      if (!(n >= Math.max(2, game.players.min) && n <= game.players.max)) return fail(ws, 'server.BAD_PLAYERS');
      const room = {
        id: `solo-${id(8)}`, gameId, kind: 'solo', owner: c.user.userId, name: '', numPlayers: n,
        level: level || 'default',
        seats: [{ userId: c.user.userId, name: c.user.name, bot: false, away: false },
          ...Array.from({ length: n - 1 }, (_, i) => ({ userId: null, name: `Bot ${i + 1}`, bot: true, away: false }))],
        status: 'waiting', match: null, timerDue: {}, createdAt: now(), updatedAt: now(),
      };
      rooms.set(room.id, room);
      c.roomId = room.id;
      startMatch(room);
    },

    OPEN(ws, c, { roomId }) {
      const room = rooms.get(roomId);
      if (!room || (room.kind === 'solo' && room.owner !== c.user.userId)) return fail(ws, 'server.ROOM_NOT_FOUND');
      c.roomId = room.id;
      send(ws, roomMessage(room, c.user.userId));
    },

    CLOSE(ws, c) { c.roomId = null; },

    JOIN(ws, c, { roomId }) {
      const room = rooms.get(roomId);
      if (!room || room.kind !== 'public') return fail(ws, 'server.ROOM_NOT_FOUND');
      c.roomId = room.id;
      if (seatOf(room, c.user.userId) >= 0) return send(ws, roomMessage(room, c.user.userId));
      if (room.status !== 'waiting') return fail(ws, 'server.ALREADY_STARTED');
      const free = room.seats.findIndex((s) => !s.userId && !s.bot);
      if (free < 0) return fail(ws, 'server.ROOM_FULL');
      room.seats[free] = { userId: c.user.userId, name: c.user.name, bot: false, away: false };
      touch(room, { lobby: true });
    },

    LEAVE(ws, c, { roomId }) {
      const room = rooms.get(roomId);
      if (!room) return;
      if (c.roomId === roomId) c.roomId = null;
      const s = seatOf(room, c.user.userId);
      if (s < 0 || room.kind !== 'public') return;
      // A meio do jogo, um bot fica com o lugar.
      room.seats[s] = room.status === 'waiting' ? emptySeat() : { ...room.seats[s], userId: null, bot: true };
      resetPublicIfEmpty(room);
      scheduleBots(room);
      touch(room, { lobby: true });
    },

    START(ws, c, { roomId }) {
      const room = rooms.get(roomId);
      if (!room) return fail(ws, 'server.ROOM_NOT_FOUND');
      if (seatOf(room, c.user.userId) < 0) return fail(ws, 'server.NOT_SEATED');
      if (room.status !== 'waiting') return fail(ws, 'server.ALREADY_STARTED');
      let b = 0;
      // Lugares vazios passam a bots.
      room.seats = room.seats.map((s) => (s.userId ? s : { userId: null, name: `Bot ${++b}`, bot: true, away: false }));
      startMatch(room);
    },

    MOVE(ws, c, { roomId, move }) {
      const room = rooms.get(roomId);
      if (!room?.match) return fail(ws, 'server.ROOM_NOT_FOUND');
      const seat = seatOf(room, c.user.userId);
      if (seat < 0) return fail(ws, 'server.NOT_SEATED');
      const game = G.get(room.gameId);
      const r = applyMove(game, room.match, seat, { type: move?.type, payload: move?.payload });
      if (!r.ok) return send(ws, { type: 'ERROR', gameId: game.id, ...r.error });
      commit(room, r.match);
    },

    RESTART(ws, c, { roomId }) {
      const room = rooms.get(roomId);
      if (!room) return fail(ws, 'server.ROOM_NOT_FOUND');
      if (seatOf(room, c.user.userId) < 0) return fail(ws, 'server.NOT_SEATED');
      if (room.status !== 'over') return fail(ws, 'server.NOT_OVER');
      startMatch(room);
    },

    DELETE(ws, c, { roomId }) {
      const room = rooms.get(roomId);
      if (!room || room.kind !== 'solo' || room.owner !== c.user.userId) return fail(ws, 'server.ROOM_NOT_FOUND');
      clearTimeout(botTimers.get(room.id));
      for (const h of gameTimers.get(room.id)?.values() || []) clearTimeout(h);
      rooms.delete(room.id);
      storage.deleteRoom(room.id);
      for (const cc of conns.values()) if (cc.roomId === room.id) cc.roomId = null;
      send(ws, { type: 'ROOMS', ...roomsFor(c.user.userId) });
    },

    PING(ws) { send(ws, { type: 'PONG' }); },
  };

  function onMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return fail(ws, 'server.BAD_MESSAGE'); }
    const c = conns.get(ws);
    const h = handlers[msg?.type];
    if (!h) return fail(ws, 'server.BAD_MESSAGE');
    if (msg.type !== 'HELLO' && msg.type !== 'PING' && !c.user) return fail(ws, 'server.NO_HELLO');
    try { h(ws, c, msg); } catch (e) {
      logger.error('[server]', msg.type, e);
      fail(ws, 'server.INTERNAL');
    }
  }

  function onClose(ws) {
    const c = conns.get(ws);
    conns.delete(ws);
    if (closing || !c?.user || isOnline(c.user.userId)) return;
    const uid = c.user.userId;
    clearTimeout(graceTimers.get(uid));
    const h = setTimeout(() => { if (!isOnline(uid)) markAway(uid, true); }, graceMs);
    h.unref?.();
    graceTimers.set(uid, h);
  }

  // ─── HTTP ───────────────────────────────────────────────────
  const brandHead = () => [
    ...(brand.fonts ? [`<link rel="stylesheet" href="${brand.fonts}">`] : []),
    ...(brand.stylesheets || []).map((h) => `<link rel="stylesheet" href="${h}">`),
    brand.tokens ? `<style>:root{${Object.entries(brand.tokens).map(([k, v]) => `${k}:${v}`).join(';')}}</style>` : '',
  ].join('\n');

  async function serveFile(res, file, type, transform) {
    try {
      let body = await readFile(file, transform ? 'utf8' : undefined);
      if (transform) body = transform(body);
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(404); res.end('404');
    }
  }

  const http = createServer((req, res) => {
    const url = new URL(req.url, 'http://x').pathname;
    if (url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, brand: brand.id, games: [...G.keys()], rooms: rooms.size }));
    }
    if (url === '/' || url === '/index.html') {
      return serveFile(res, join(PUBLIC_DIR, 'app.html'), MIME['.html'], (html) => html
        .replaceAll('{{BRAND_NAME}}', brand.name).replace('{{BRAND_HEAD}}', brandHead())
        .replace('{{LANG}}', brand.lang || 'pt'));
    }
    if (url === '/manifest.webmanifest') {
      res.writeHead(200, { 'Content-Type': MIME['.webmanifest'] });
      return res.end(JSON.stringify({
        name: brand.name, short_name: brand.name, start_url: '/', display: 'standalone',
        background_color: brand.tokens?.['--color-cream'] || '#fbf3e4',
        theme_color: brand.tokens?.['--color-brick'] || '#b8461f',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      }));
    }
    if (url === '/sdk/client.js') return serveFile(res, CLIENT_FILE, MIME['.js']);
    const eng = url.match(/^\/engine\/([a-z0-9]+\.js)$/);
    if (eng) return serveFile(res, join(ENGINE_DIR, eng[1]), MIME['.js']);
    const pub = url.match(/^\/(app\.js|app\.css|icon\.svg)$/);
    if (pub) return serveFile(res, join(PUBLIC_DIR, pub[1]), MIME[extname(pub[1])]);
    res.writeHead(404); res.end('404');
  });

  const wss = new WebSocketServer({ server: http, path: '/ws' });
  wss.on('connection', (ws) => {
    conns.set(ws, { user: null, token: null, roomId: null, lang: null });
    ws.on('message', (raw) => onMessage(ws, raw));
    ws.on('close', () => onClose(ws));
    ws.on('error', () => {});
  });

  // ─── Arranque: carrega o que estava guardado ────────────────
  const ready = (async () => {
    const saved = await storage.load();
    users = saved.users || {};
    for (const room of saved.rooms || []) {
      const game = G.get(room.gameId);
      if (!game) { logger.warn(`[load] ${room.id}: jogo ${room.gameId} não instalado, ignorada`); continue; }
      if (room.match && major(room.match.gameVersion) !== major(game.version)) {
        logger.warn(`[load] ${room.id}: versão ${room.match.gameVersion} incompatível com ${game.version}`);
        if (room.kind === 'solo') { storage.deleteRoom(room.id); continue; }
        room.match = null; room.status = 'waiting';
      }
      if (room.kind === 'public' && room.status === 'waiting') room.seats = room.seats.map(emptySeat);
      // Ninguém está ligado logo após um restart: nas mesas públicas os bots cobrem.
      for (const s of room.seats) if (s.userId) s.away = room.kind === 'public';
      rooms.set(room.id, room);
    }
    for (const game of G.values()) {
      for (const r of publicRoomsFor(game)) if (!rooms.has(r.id)) { rooms.set(r.id, r); persist(r); }
    }
    for (const room of rooms.values()) { syncTimers(room); scheduleBots(room); }
  })();

  return {
    http,
    ready,
    rooms,
    async listen(port = process.env.PORT || 3000) {
      await ready;
      await new Promise((resolve) => http.listen(port, resolve));
      const actual = http.address().port;
      logger.log(`[${brand.name}] ${[...G.keys()].join(', ')} em http://localhost:${actual}`);
      return actual;
    },
    async close() {
      closing = true;
      for (const t of [...botTimers.values(), ...graceTimers.values()]) clearTimeout(t);
      for (const m of gameTimers.values()) for (const t of m.values()) clearTimeout(t);
      for (const ws of wss.clients) ws.terminate();
      await new Promise((resolve) => wss.close(() => { http.close(resolve); http.closeAllConnections?.(); }));
    },
  };
}
