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
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { WebSocketServer } from 'ws';
import {
  checkGame, createMatch, applyMove, fireTimer, viewFor, activeSeats, botMove, matchIncompatibility, simulate,
  translate, ENGINE_VERSION,
} from '@bitnik/engine';
import { memoryStorage, fileStorage } from './storage.js';
import { PLATFORM_I18N } from './i18n.js';
import { normalizeProject, projectSummary, slugify } from './forge.js';

export { memoryStorage, fileStorage };

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(here, '..', 'public');
const ENGINE_DIR = dirname(fileURLToPath(import.meta.resolve('@bitnik/engine')));
const CLIENT_FILE = fileURLToPath(import.meta.resolve('@bitnik/client'));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
};

// Ficheiros de um pacote de jogo que o browser pode pedir: as regras (para o
// tutorial correr o motor localmente), a UI e os assets. Nunca os testes.
const GAME_FILE = /^(?!test\/|node_modules\/)(?:[\w-]+\/)*[\w.-]+\.(?:js|css|json|svg|png|webp|jpg|woff2|mp3)$/;
const gameFileUrl = (g, rel) => (rel ? `/games/${g.id}/${String(rel).replace(/^\.\//, '')}` : null);

// ─── Aparência (ADR-008) ───────────────────────────────────────
// Tokens da marca (moldura) que a consola pode afinar, com o tipo de valor.
export const BRAND_TOKENS = {
  '--brand-primary': 'color', '--brand-secondary': 'color', '--brand-accent': 'color',
  '--bg': 'color', '--bg-alt': 'color', '--text': 'color', '--text-muted': 'color', '--border': 'color',
  '--font-display': 'font', '--font-body': 'font', '--radius-md': 'size',
};
const TOKEN_LIMITS = { color: 64, font: 200, size: 32, background: 400_000, image: 400_000 };

/** Valida um valor de token; devolve o valor limpo ou lança um erro com o motivo. */
function cleanToken(name, type, value) {
  const v = String(value ?? '').trim();
  if (!v) return null;
  const max = TOKEN_LIMITS[type] ?? 200;
  if (v.length > max) throw new Error(`${name}: valor demasiado longo`);
  const URL_RE = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
  const urls = [...v.matchAll(URL_RE)].map((m) => m[2]);
  // Fora de url(): nada que feche a declaração ou abra outra regra dentro do <style>.
  if (/[{};<>\\]|\/\*|@import|expression\s*\(|javascript:/i.test(v.replace(URL_RE, 'url()'))) throw new Error(`${name}: valor inválido`);
  if (urls.length && !['background', 'image'].includes(type)) throw new Error(`${name}: só imagens e fundos aceitam url()`);
  for (const u of urls) {
    // Dentro de url(): só imagens em data:, https: ou caminhos do próprio servidor.
    if (/[{}<>\\\n]/.test(u) || !/^(data:image\/(png|jpeg|webp|gif|svg\+xml)[;,]|https:\/\/|\/(?!\/))/i.test(u)) {
      throw new Error(`${name}: url não permitido`);
    }
  }
  return v;
}

/** Ficheiros servíveis de um pacote de jogo (para o service worker guardar). */
function gameFiles(g) {
  if (!g.root) return [];
  const root = fileURLToPath(g.root);
  const out = [];
  const walk = (rel) => {
    for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!['test', 'node_modules'].includes(e.name)) walk(r); } else if (GAME_FILE.test(r)) out.push(r);
    }
  };
  walk('');
  return out.sort();
}

const id = (n = 9) => randomBytes(n).toString('base64url');
const cleanName = (s, fallback) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, 24) || fallback;

export function createPlatform({
  brand = { id: 'default', name: 'Bitnik' },
  games = [],
  storage = memoryStorage(),
  botDelayMs = [700, 1400],
  graceMs = 60_000,
  studio = false,
  logger = console,
  adminToken = process.env.ADMIN_TOKEN, // sem token, as rotas /admin não existem
} = {}) {
  // ─── Jogos ──────────────────────────────────────────────────
  const G = new Map();
  for (const g of games) {
    const problems = checkGame(g);
    if (problems.length) throw new Error(`Pacote ${g?.id}: ${problems.join('; ')}`);
    if (G.has(g.id)) throw new Error(`Jogo repetido: ${g.id}`);
    G.set(g.id, g);
  }

  // ─── Service worker (PWA) ─────────────────────────────────────
  // A versão é um hash do conteúdo do que fica em cache e da marca: muda
  // sozinha a cada deploy que mexa no motor, na UI ou num jogo.
  const SHELL = ['app.js', 'app.css', 'appearance.js', 'icon.svg'];
  const sw = (() => {
    const hash = createHash('sha256').update(JSON.stringify(brand));
    const files = [];
    for (const f of SHELL) { files.push(`/${f}`); hash.update(readFileSync(join(PUBLIC_DIR, f))); }
    hash.update(readFileSync(join(PUBLIC_DIR, 'app.html')));
    hash.update(readFileSync(join(PUBLIC_DIR, 'sw.js')));
    hash.update(readFileSync(CLIENT_FILE));
    files.push('/sdk/client.js');
    for (const f of readdirSync(ENGINE_DIR).filter((x) => /^[a-z0-9]+\.js$/.test(x)).sort()) {
      files.push(`/engine/${f}`);
      hash.update(readFileSync(join(ENGINE_DIR, f)));
    }
    for (const g of G.values()) {
      for (const rel of gameFiles(g)) {
        files.push(`/games/${g.id}/${rel}`);
        hash.update(readFileSync(join(fileURLToPath(g.root), rel)));
      }
    }
    return { version: hash.digest('hex').slice(0, 12), precache: ['/', '/manifest.webmanifest', ...files] };
  })();

  // ─── Estado em memória ──────────────────────────────────────
  let users = {};                  // token → { userId, name }
  const rooms = new Map();         // roomId → room
  const conns = new Map();         // ws → { user, token, roomId, lang }
  const botTimers = new Map();     // roomId → timeout
  const gameTimers = new Map();    // roomId → Map(key → timeout)
  const graceTimers = new Map();   // userId → timeout
  let notices = [];                // avisos do publisher para todos os ligados
  let appearance = { brand: { tokens: {} }, games: {} }; // afinações da consola (ADR-008)
  const forge = new Map();         // slug → projeto da Forge (só no Studio, ADR-009)
  let now = () => Date.now();
  let closing = false;
  const startedAt = now();

  const isOnline = (userId) => [...conns.values()].some((c) => c.user?.userId === userId);
  const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
  const persist = (room) => storage.saveRoom(room);

  // ─── Salas ──────────────────────────────────────────────────
  // Três tipos: 'public' (uma por número de jogadores, no lobby), 'solo'
  // (privada, com bots) e 'invite' (mesa de aprovação: só entra quem tem o
  // link; joga-se como uma pública).
  const emptySeat = () => ({ userId: null, name: '', bot: false, away: false });
  const shared = (room) => room.kind === 'public' || room.kind === 'invite';

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
      expired: room.expired ?? null,
    };
  }

  function roomsFor(userId) {
    const all = [...rooms.values()];
    return {
      public: all.filter((r) => r.kind === 'public').map((r) => summary(r, userId)),
      mine: all.filter((r) => (r.kind === 'solo' && r.owner === userId)
        || (r.kind === 'invite' && r.seats.some((s) => s.userId === userId)))
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
    // Uma partida de versão incompatível não passa pelo view: o estado antigo pode não encaixar.
    if (!room.match || room.status === 'expired') return base;
    const v = viewFor(game, room.match, seat < 0 ? null : seat);
    // Prazos absolutos dos timers, para a UI mostrar contagens decrescentes.
    // `now` deixa o cliente corrigir a diferença de relógio.
    const timers = room.match.timers.map((t) => ({ key: t.key, event: t.event, at: room.timerDue?.[t.key]?.at ?? null }));
    return { ...base, ...v, timers, now: now() };
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
    room.expired = null;
    afterChange(room);
  }

  function commit(room, match) {
    const wasOver = room.status === 'over';
    room.match = match;
    room.status = match.result ? 'over' : 'playing';
    afterChange(room, { lobby: !wasOver && room.status === 'over' });
    // Mesa pública acabada sem ninguém ligado: volta a ficar livre.
    if (shared(room) && room.status === 'over'
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
    for (const t of (room.status === 'expired' ? null : room.match?.timers) || []) {
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
  const botControls = (room, seat) => room.seats[seat].bot || (shared(room) && room.seats[seat].away);

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
      if (shared(room) && room.status === 'waiting' && away) {
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
    if (!shared(room) || room.seats.some((s) => s.userId)) return;
    clearTimeout(botTimers.get(room.id));
    room.seats = room.seats.map(emptySeat);
    room.match = null;
    room.status = 'waiting';
    syncTimers(room);
  }

  // ─── Avisos e janelas de manutenção ─────────────────────────
  // Um runtime é um deploy por publisher: um aviso chega a todos os
  // jogos e jogadores desse publisher. Com `maintenance`, a partir de
  // `from` deixam de começar partidas novas dos jogos indicados (as que
  // decorrem continuam), para o deploy apanhar o mínimo de mesas a meio.
  const activeNotices = () => notices.filter((n) => n.until > now());
  const broadcastNotices = () => {
    for (const [ws, c] of conns) if (c.user) send(ws, { type: 'NOTICES', notices: activeNotices(), now: now() });
  };
  const saveNotices = () => storage.saveNotices?.(notices);

  function notify({ id: nid, level = 'info', key, params = {}, text, at = null, until, maintenance = null } = {}) {
    if (!key && !text) throw new Error('notify: indica key ou text');
    const clean = (s) => String(s ?? '').replace(/[<>]/g, '').slice(0, 500);
    const n = {
      id: nid ? String(nid).replace(/[^\w-]/g, '').slice(0, 40) : id(6),
      level: level === 'warn' ? 'warn' : 'info',
      key: key ? String(key).slice(0, 80) : null,
      params: Object.fromEntries(Object.entries(params || {}).map(([k, v]) => [k, typeof v === 'number' ? v : clean(v)])),
      text: text ? Object.fromEntries(Object.entries(text).map(([l, v]) => [l.slice(0, 5), clean(v)])) : null,
      at: at == null ? null : Number(at),
      until: Number(until ?? at ?? now() + 24 * 3600_000),
      maintenance: maintenance ? {
        games: Array.isArray(maintenance.games) ? maintenance.games.map(String) : null, // null = todos
        from: Number(maintenance.from ?? now()),
      } : null,
      createdAt: now(),
    };
    notices = [...notices.filter((x) => x.id !== n.id && x.until > now()), n];
    saveNotices();
    broadcastNotices();
    return n;
  }

  function clearNotice(nid) {
    const before = notices.length;
    notices = notices.filter((x) => x.id !== nid);
    if (notices.length === before) return false;
    saveNotices();
    broadcastNotices();
    return true;
  }

  // ─── Aparência (afinações do deploy) ───────────────────────
  async function readPkgJson(g, rel) {
    if (!g.root || !rel) return null;
    try { return JSON.parse(await readFile(join(fileURLToPath(g.root), String(rel).replace(/^\.\//, '')), 'utf8')); } catch { return null; }
  }

  async function appearanceCatalog() {
    const games = [];
    for (const g of G.values()) {
      const themes = {};
      for (const [k, rel] of Object.entries(g.themes || {})) themes[k] = await readPkgJson(g, rel);
      games.push({
        id: g.id, name: gameName(g), skin: await readPkgJson(g, g.skin), themes,
        // Para a consola montar a pré-visualização com o motor no browser.
        meta: {
          id: g.id, pkg: g.root ? gameFileUrl(g, 'index.js') : null, ui: gameFileUrl(g, g.ui), skin: gameFileUrl(g, g.skin),
          themes: Object.fromEntries(Object.entries(g.themes || {}).map(([k, rel]) => [k, gameFileUrl(g, rel)])),
          preview: g.preview ?? null,
        },
      });
    }
    return { appearance, brandTokens: BRAND_TOKENS, games };
  }

  /** Valida e guarda as afinações; só tokens declarados, só temas que existem. */
  async function setAppearance(input = {}) {
    const next = { brand: { tokens: {} }, games: {} };
    for (const [k, v] of Object.entries(input.brand?.tokens || {})) {
      if (!BRAND_TOKENS[k]) throw new Error(`${k}: token da marca desconhecido`);
      const c = cleanToken(k, BRAND_TOKENS[k], v);
      if (c) next.brand.tokens[k] = c;
    }
    for (const [id, cfg] of Object.entries(input.games || {})) {
      const g = G.get(id);
      if (!g) throw new Error(`${id}: jogo não instalado`);
      const skin = await readPkgJson(g, g.skin);
      const out = { theme: null, tokens: {} };
      if (cfg?.theme) {
        if (!g.themes?.[cfg.theme]) throw new Error(`${id}: tema ${cfg.theme} não existe`);
        out.theme = cfg.theme;
      }
      for (const [k, v] of Object.entries(cfg?.tokens || {})) {
        const def = skin?.tokens?.[k];
        if (!def) throw new Error(`${id}: token ${k} não está no skin.json`);
        const c = cleanToken(k, def.type, v);
        if (c) out.tokens[k] = c;
      }
      if (out.theme || Object.keys(out.tokens).length) next.games[id] = out;
    }
    appearance = next;
    storage.saveAppearance?.(appearance);
    for (const [ws, c] of conns) if (c.user) send(ws, { type: 'APPEARANCE', appearance });
    return appearance;
  }

  /** Há uma janela de manutenção ativa para este jogo? */
  const inMaintenance = (gameId) => activeNotices().some((n) => n.maintenance
    && n.maintenance.from <= now() && (!n.maintenance.games || n.maintenance.games.includes(gameId)));

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
          ui: gameFileUrl(g, g.ui),
          tutorial: gameFileUrl(g, g.tutorial),
          skin: gameFileUrl(g, g.skin),
          themes: Object.fromEntries(Object.entries(g.themes || {}).map(([k, rel]) => [k, gameFileUrl(g, rel)])),
        })),
        notices: activeNotices(),
        appearance,
        now: now(),
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
      if (inMaintenance(gameId)) return fail(ws, 'server.MAINTENANCE');
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
      if (!room || !shared(room)) return fail(ws, 'server.ROOM_NOT_FOUND');
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
      if (s < 0 || !shared(room)) return;
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
      if (inMaintenance(room.gameId)) return fail(ws, 'server.MAINTENANCE');
      let b = 0;
      // Lugares vazios passam a bots.
      room.seats = room.seats.map((s) => (s.userId ? s : { userId: null, name: `Bot ${++b}`, bot: true, away: false }));
      startMatch(room);
    },

    MOVE(ws, c, { roomId, move, seq }) {
      const room = rooms.get(roomId);
      if (!room?.match) return fail(ws, 'server.ROOM_NOT_FOUND');
      if (room.status === 'expired') return fail(ws, 'server.EXPIRED');
      const seat = seatOf(room, c.user.userId);
      if (seat < 0) return fail(ws, 'server.NOT_SEATED');
      const game = G.get(room.gameId);
      // `seq` é o estado que o jogador viu. Se o jogo já avançou (reenvio
      // após reconexão, clique sobre um estado antigo), a jogada é recusada.
      const r = applyMove(game, room.match, seat, { type: move?.type, payload: move?.payload }, { expectSeq: seq });
      if (!r.ok) {
        if (r.error.code === 'engine.RULE_ERROR') logger.error(`[regras] ${room.id} lugar ${seat}`, r.error.params);
        send(ws, { type: 'ERROR', gameId: game.id, ...r.error });
        if (r.error.code === 'engine.STALE_MOVE') send(ws, roomMessage(room, c.user.userId));
        return;
      }
      commit(room, r.match);
    },

    RESTART(ws, c, { roomId }) {
      const room = rooms.get(roomId);
      if (!room) return fail(ws, 'server.ROOM_NOT_FOUND');
      if (seatOf(room, c.user.userId) < 0) return fail(ws, 'server.NOT_SEATED');
      if (room.status !== 'over' && room.status !== 'expired') return fail(ws, 'server.NOT_OVER');
      if (inMaintenance(room.gameId)) return fail(ws, 'server.MAINTENANCE');
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
    // Afinações da marca feitas na consola (já validadas); o JS mantém-nas ao vivo.
    `<style id="appearance-brand">:root{${Object.entries(appearance.brand.tokens).map(([k, v]) => `${k}:${v}`).join(';')}}</style>`,
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

  // ─── Admin: avisos (Authorization: Bearer ADMIN_TOKEN) ──────
  const authorized = (req) => {
    const got = Buffer.from(String(req.headers.authorization || ''));
    const want = Buffer.from(`Bearer ${adminToken}`);
    return got.length === want.length && timingSafeEqual(got, want);
  };
  const json = (res, status, body) => {
    res.writeHead(status, body === undefined ? {} : { 'Content-Type': 'application/json' });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };

  const readJson = (req, max = 10_000) => new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (d) => { body += d; if (body.length > max) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch (e) { reject(e); } });
  });

  const gameName = (g, lang = brand.lang || 'pt') => translate(g, lang, 'game.name');

  function status() {
    const list = [...rooms.values()];
    const count = (st) => list.filter((r) => r.status === st).length;
    return {
      brand: { id: brand.id, name: brand.name }, studio, engineVersion: ENGINE_VERSION,
      node: process.version, uptimeMs: now() - startedAt,
      games: G.size,
      rooms: { total: list.length, playing: count('playing'), waiting: count('waiting'), over: count('over'), expired: count('expired') },
      online: new Set([...conns.values()].filter((c) => c.user).map((c) => c.user.userId)).size,
    };
  }

  function gameInfo(g) {
    const list = [...rooms.values()].filter((r) => r.gameId === g.id);
    return {
      id: g.id, name: gameName(g), version: g.version, players: g.players,
      author: g.author ?? null, license: g.license ?? null, langs: Object.keys(g.i18n),
      bots: Object.keys(g.bots || {}), enumerate: !!g.enumerate, describeMove: !!g.describeMove,
      events: Object.keys(g.events || {}), problems: checkGame(g),
      rooms: { playing: list.filter((r) => r.status === 'playing').length, total: list.length },
    };
  }

  /**
   * Simulação sem bloquear o servidor: blocos de partidas com uma pausa
   * entre eles, para as mesas a decorrer continuarem a responder.
   */
  async function simulateGame(game, { numPlayers, games = 200, idleRate = 0, seed = 'consola' }) {
    const total = Math.max(1, Math.min(2000, Number(games) || 200));
    const chunk = 25;
    const wins = Array(numPlayers).fill(0);
    let finished = 0; let moves = 0; let timersFired = 0; const failures = [];
    for (let done = 0; done < total; done += chunk) {
      const n = Math.min(chunk, total - done);
      const r = simulate(game, { numPlayers, games: n, seed: `${seed}:${numPlayers}:${done}`, idleRate: Number(idleRate) || 0 });
      finished += r.finished; moves += r.avgMoves * r.finished; timersFired += r.timersFired;
      r.winRateBySeat.forEach((w, i) => { wins[i] += (w / 100) * r.finished; });
      failures.push(...r.failures.slice(0, 5 - failures.length));
      await new Promise((resolve) => setImmediate(resolve));
    }
    return {
      numPlayers, games: total, finished, failures, timersFired,
      avgMoves: Math.round((moves / (finished || 1)) * 10) / 10,
      winRateBySeat: wins.map((w) => Math.round((w / (finished || 1)) * 1000) / 10),
    };
  }

  function inviteInfo(room) {
    const s = summary(room);
    return { ...s, createdAt: room.createdAt, link: `/#/r/${room.id}`, result: room.match?.result ?? null, seq: room.match?.seq ?? 0 };
  }

  function createInvite({ gameId, numPlayers, name }) {
    const game = G.get(gameId);
    if (!game) throw new Error('jogo não instalado');
    const n = Number(numPlayers);
    if (!(n >= Math.max(2, game.players.min) && n <= game.players.max)) throw new Error('número de jogadores inválido');
    const room = {
      id: `inv-${id(9)}`, gameId, kind: 'invite', owner: null, name: cleanName(name, ''), numPlayers: n,
      seats: Array.from({ length: n }, emptySeat),
      status: 'waiting', match: null, timerDue: {}, createdAt: now(), updatedAt: now(),
    };
    rooms.set(room.id, room);
    persist(room);
    return room;
  }

  function deleteRoom(room) {
    clearTimeout(botTimers.get(room.id));
    for (const h of gameTimers.get(room.id)?.values() || []) clearTimeout(h);
    rooms.delete(room.id);
    storage.deleteRoom(room.id);
    for (const [ws, cc] of conns) {
      if (cc.roomId !== room.id) continue;
      cc.roomId = null;
      fail(ws, 'server.ROOM_NOT_FOUND');
    }
    broadcastLobby();
  }

  // ─── Forge: projetos guardados no storage do Studio ─────────
  const FORGE_MAX = 2_000_000; // um projeto grande (fluxo, cartões, regras e histórico) cabe à vontade
  function uniqueSlug(name) {
    const base = slugify(name);
    let slug = base;
    for (let i = 2; forge.has(slug); i++) slug = `${base}-${i}`;
    return slug;
  }
  function saveForge(slug, input, existing) {
    const p = { ...normalizeProject(input), createdAt: existing?.createdAt ?? now(), updatedAt: now() };
    forge.set(slug, p);
    storage.saveForgeProject?.(slug, p);
    return p;
  }
  async function forgeRoute(req, res, url) {
    const slug = decodeURIComponent(url.slice('/admin/forge/'.length));
    if (url === '/admin/forge' && req.method === 'GET') {
      return json(res, 200, { projects: [...forge].map(([s, p]) => projectSummary(s, p)).sort((a, b) => b.updatedAt - a.updatedAt) });
    }
    // Criar um projeto novo ou importar um do Rule Forge: { gameName } ou { project }.
    if (url === '/admin/forge' && req.method === 'POST') {
      const body = await readJson(req, FORGE_MAX);
      const input = body.project && typeof body.project === 'object' ? body.project : { gameName: body.gameName };
      const s = uniqueSlug(input.gameName);
      const p = saveForge(s, input);
      return json(res, 201, { slug: s, project: p });
    }
    if (!/^[a-z0-9-]{1,80}$/.test(slug) || !forge.has(slug)) return json(res, 404, { error: 'projeto não encontrado' });
    if (req.method === 'GET') return json(res, 200, { slug, project: forge.get(slug) });
    if (req.method === 'PUT') return json(res, 200, { slug, project: saveForge(slug, await readJson(req, FORGE_MAX), forge.get(slug)) });
    if (req.method === 'DELETE') {
      forge.delete(slug);
      storage.deleteForgeProject?.(slug);
      return json(res, 204);
    }
    return json(res, 405, { error: 'método não suportado' });
  }

  async function admin(req, res, url) {
    if (!authorized(req)) return json(res, 401, { error: 'unauthorized' });
    try {
      if (url === '/admin/status' && req.method === 'GET') return json(res, 200, status());
      if (url === '/admin/games' && req.method === 'GET') return json(res, 200, { games: [...G.values()].map(gameInfo) });
      const sim = url.match(/^\/admin\/games\/([\w-]+)\/simulate$/);
      if (sim && req.method === 'POST') {
        const game = G.get(sim[1]);
        if (!game) return json(res, 404, { error: 'jogo não instalado' });
        const body = await readJson(req);
        const counts = body.numPlayers ? [Number(body.numPlayers)]
          : Array.from({ length: game.players.max - Math.max(2, game.players.min) + 1 }, (_, i) => Math.max(2, game.players.min) + i);
        const results = [];
        for (const n of counts) results.push(await simulateGame(game, { ...body, numPlayers: n }));
        return json(res, 200, { gameId: game.id, version: game.version, results });
      }
      if (url === '/admin/appearance' && req.method === 'GET') return json(res, 200, await appearanceCatalog());
      if (url === '/admin/appearance' && req.method === 'PUT') return json(res, 200, { appearance: await setAppearance(await readJson(req)) });
      // ─── Forge (ADR-009): projetos de jogo, só no Studio ─────
      if (url === '/admin/forge' || url.startsWith('/admin/forge/')) {
        if (!studio) return json(res, 404, { error: 'a Forge só existe no Studio' });
        return forgeRoute(req, res, url);
      }
      if (url === '/admin/tables' && req.method === 'GET') {
        return json(res, 200, { tables: [...rooms.values()].filter((r) => r.kind === 'invite').sort((a, b) => b.createdAt - a.createdAt).map(inviteInfo) });
      }
      if (url === '/admin/tables' && req.method === 'POST') {
        const room = createInvite(await readJson(req));
        broadcastLobby();
        return json(res, 201, inviteInfo(room));
      }
      const tbl = url.match(/^\/admin\/tables\/([\w-]+)$/);
      if (tbl && req.method === 'DELETE') {
        const room = rooms.get(tbl[1]);
        if (!room || room.kind !== 'invite') return json(res, 404, { error: 'mesa não encontrada' });
        deleteRoom(room);
        return json(res, 204);
      }
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
    if (url === '/admin/notices' && req.method === 'GET') return json(res, 200, { notices: activeNotices() });
    if (url === '/admin/notices' && req.method === 'POST') {
      try { return json(res, 201, notify(await readJson(req))); } catch (e) { return json(res, 400, { error: e.message }); }
    }
    const del = url.match(/^\/admin\/notices\/([\w-]+)$/);
    if (del && req.method === 'DELETE') return json(res, clearNotice(del[1]) ? 204 : 404);
    return json(res, 404, { error: 'not found' });
  }

  const http = createServer((req, res) => {
    const url = new URL(req.url, 'http://x').pathname;
    if (adminToken && url.startsWith('/admin/')) return admin(req, res, url);
    if (adminToken && (url === '/console' || url === '/console/')) {
      return serveFile(res, join(PUBLIC_DIR, 'console.html'), MIME['.html'], (html) => html
        .replaceAll('{{BRAND_NAME}}', brand.name).replace('{{BRAND_HEAD}}', brandHead())
        .replace('{{LANG}}', brand.lang || 'pt'));
    }
    if (url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, brand: brand.id, games: [...G.keys()], rooms: rooms.size }));
    }
    if (url === '/' || url === '/index.html') {
      return serveFile(res, join(PUBLIC_DIR, 'app.html'), MIME['.html'], (html) => html
        .replaceAll('{{BRAND_NAME}}', brand.name).replace('{{BRAND_HEAD}}', brandHead())
        .replace('{{LANG}}', brand.lang || 'pt'));
    }
    if (url === '/sw.js') {
      return serveFile(res, join(PUBLIC_DIR, 'sw.js'), MIME['.js'], (js) => js
        .replace('{{VERSION}}', sw.version).replace('{{PRECACHE}}', JSON.stringify(sw.precache)));
    }
    if (url === '/manifest.webmanifest') {
      res.writeHead(200, { 'Content-Type': MIME['.webmanifest'] });
      return res.end(JSON.stringify({
        id: '/', scope: '/', lang: brand.lang || 'pt',
        name: brand.name, short_name: brand.name, start_url: '/', display: 'standalone',
        background_color: brand.tokens?.['--color-cream'] || '#fbf3e4',
        theme_color: brand.tokens?.['--color-brick'] || '#b8461f',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      }));
    }
    if (url === '/sdk/client.js') return serveFile(res, CLIENT_FILE, MIME['.js']);
    const gf = url.match(/^\/games\/([\w-]+)\/(.+)$/);
    if (gf) {
      const g = G.get(gf[1]);
      const rel = decodeURIComponent(gf[2]);
      if (!g?.root || rel.includes('..') || !GAME_FILE.test(rel)) { res.writeHead(404); return res.end('404'); }
      return serveFile(res, join(fileURLToPath(g.root), rel), MIME[extname(rel)]);
    }
    const eng = url.match(/^\/engine\/([a-z0-9]+\.js)$/);
    if (eng) return serveFile(res, join(ENGINE_DIR, eng[1]), MIME['.js']);
    const pub = url.match(/^\/(app\.js|app\.css|icon\.svg|console\.js|console\.css|appearance\.js|console-appearance\.js|design-tokens\.js)$/);
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
    notices = (saved.notices || []).filter((n) => n.until > now());
    if (saved.appearance) appearance = { brand: { tokens: {} }, games: {}, ...saved.appearance };
    for (const [slug, p] of Object.entries(saved.forge || {})) forge.set(slug, p);
    for (const room of saved.rooms || []) {
      const game = G.get(room.gameId);
      if (!game) { logger.warn(`[load] ${room.id}: jogo ${room.gameId} não instalado, ignorada`); continue; }
      const inc = room.match && room.status !== 'expired' && matchIncompatibility(game, room.match);
      if (inc) {
        logger.warn(`[load] ${room.id}: ${inc.reason} ${inc.from} incompatível com ${inc.to}`);
        if (room.kind === 'solo') {
          // Fica em "As minhas mesas" com o aviso; o match fica guardado para replay.
          room.status = 'expired'; room.expired = inc; room.timerDue = {};
          persist(room);
        } else {
          room.match = null; room.status = 'waiting';
        }
      }
      if (shared(room) && room.status === 'waiting') room.seats = room.seats.map(emptySeat);
      // Ninguém está ligado logo após um restart: nas mesas públicas os bots cobrem.
      for (const s of room.seats) if (s.userId) s.away = shared(room);
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
    notify,
    clearNotice,
    setAppearance,
    serviceWorker: sw,
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
