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
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { WebSocketServer } from 'ws';
import {
  checkGame, createMatch, applyMove, fireTimer, viewFor, activeSeats, botMove, matchIncompatibility, simulate,
  translate, ENGINE_VERSION, playerCounts,
} from '@bitnik/engine';
import { memoryStorage, fileStorage } from './storage.js';
import { PLATFORM_I18N } from './i18n.js';
import { normalizeProject, projectSummary, slugify, normalizeNarration, bumpVersion, mergeTests, testsKey } from './forge.js';
import { verifyPackage, ENGINE_ROOT } from './verify.js';
import { publishProblem, publicationFiles, setVersion, PUBLISH_VERSION } from './publish.js';
import { ANIMATIONS, MAX_FRAMES } from '../public/animation.js'; // a mesma lista que o browser usa

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
// Corpo de /admin/appearance: pode ter fundos/imagens até 400 000 carateres cada, em vários jogos.
// (o omitido em readJson() é só 10 000; sem isto, um fundo em imagem destruía a ligação sem resposta.)
// (com frames de animação, cada imagem pode ter até MAX_FRAMES versões.)
const APPEARANCE_MAX = 8_000_000;

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
  botDelayMs = null, // sem valor explícito, cada jogo pode ter o seu (game.botDelayMs); por omissão, [700, 1400]
  graceMs = 60_000,
  studio = false,
  prototypeDir = null, // Studio: pasta onde a Forge instala os protótipos 0.x (etapa 5)
  gamesDir = null,     // Studio: pasta games/ do repositório, onde "Publicar" grava o jogo 1.0.0
  logger = console,
  adminToken = process.env.ADMIN_TOKEN, // sem token, as rotas /admin não existem
  consoleAtRoot = false, // a consola fica em "/" e o lobby da marca passa para "/<brand.id>" (só com adminToken)
  // Mesas solo esquecidas (ADR-015): ninguém as fecha (não há mesa pública
  // para libertar nem convite para o publisher apagar), por isso limpam-se
  // sozinhas. Acabada (status "over", nada para retomar) ou nunca mais
  // tocada, qualquer que seja o estado: por omissão, 7 e 30 dias.
  soloOverMs = 7 * 24 * 3600_000,
  soloIdleMs = 30 * 24 * 3600_000,
  reapIntervalMs = 3600_000, // de quanto em quanto tempo a limpeza automática verifica
  // Perfil de marca exportado pelo Studio (tab Marcas): dá ao runtime do cliente
  // o nome, a língua, o logótipo e a aparência da marca, e só mostra os jogos
  // escolhidos. As afinações feitas depois na consola do cliente prevalecem.
  profile = null,
} = {}) {
  if (profile) brand = { ...brand, name: profile.name, lang: profile.lang, logo: profile.logo || null };
  // ─── Jogos ──────────────────────────────────────────────────
  const G = new Map();
  const PV = new Map(); // protótipos da Forge: id → Map(versão → jogo); o G tem a mais recente
  for (const g of games) {
    const problems = checkGame(g);
    if (problems.length) throw new Error(`Pacote ${g?.id}: ${problems.join('; ')}`);
    if (G.has(g.id)) throw new Error(`Jogo repetido: ${g.id}`);
    G.set(g.id, g);
  }
  if (profile) for (const id of [...G.keys()]) if (!profile.games.includes(id)) G.delete(id);

  // ─── Service worker (PWA) ─────────────────────────────────────
  // A versão é um hash do conteúdo do que fica em cache e da marca: muda
  // sozinha a cada deploy que mexa no motor, na UI ou num jogo.
  // O design system da Bitnik (v1.0.0) vai na própria plataforma (ADR-017): sem CDN, funciona offline.
  const SHELL = ['app.js', 'app.css', 'appearance.js', 'motion.js', 'animation.js', 'icon.svg', 'tour.js', 'icon-192.png', 'icon-512.png', 'design-system/index.css', 'design-system/tokens.css', 'design-system/base.css', 'design-system/components.css', 'design-system/game-ui.css'];
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
    const home = adminToken && consoleAtRoot ? `/${brand.id}` : '/';
    return { version: hash.digest('hex').slice(0, 12), precache: [home, '/manifest.webmanifest', ...files] };
  })();

  // ─── Estado em memória ──────────────────────────────────────
  let users = {};                  // token → { userId, name }
  const rooms = new Map();         // roomId → room
  const conns = new Map();         // ws → { user, token, roomId, lang }
  const botTimers = new Map();     // roomId → timeout
  const gameTimers = new Map();    // roomId → Map(key → timeout)
  const graceTimers = new Map();   // userId → timeout
  let notices = [];                // avisos do publisher para todos os ligados
  let appearance = profile ? { brand: { tokens: {}, ...profile.appearance?.brand }, games: {}, ...profile.appearance } : { brand: { tokens: {} }, games: {} }; // afinações da consola (ADR-008)
  let appearancePresets = []; // skins nomeadas, guardadas à parte da aparência ativa: { id, target, name, theme, tokens, createdAt }
  let brands = [];                 // perfis de marca: lobbies de clientes em preparação (tab Marcas da consola)
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

  // Mesas a partir de 2 jogadores (a 1 não há mesa: é o modo solo do próprio jogo).
  const tableCounts = (game) => playerCounts(game).filter((n) => n >= 2);

  function publicRoomsFor(game) {
    const out = [];
    for (const n of tableCounts(game)) {
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
      version: room.match?.gameVersion ?? null,
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

  // Uma partida fica presa à versão com que começou: nos protótipos, as versões
  // anteriores continuam carregadas enquanto houver mesas a usá-las.
  function gameFor(room) {
    const g = G.get(room.gameId);
    const v = room.match?.gameVersion;
    return (g?.prototype && v && v !== g.version && PV.get(room.gameId)?.get(v)) || g;
  }

  const seatOf = (room, userId) => room.seats.findIndex((s) => s.userId === userId);

  function roomMessage(room, userId) {
    const game = gameFor(room);
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
      if (rooms.has(room.id)) touch(room, { lobby: true }); else broadcastLobby();
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
    const r = fireTimer(gameFor(room), room.match, key);
    if (r.ok) commit(room, r.match);
    else logger.warn(`[timer] ${roomId} ${key}: ${r.error.code}`);
  }

  // ─── Bots (e lugares ausentes em mesas públicas) ───────────
  const botControls = (room, seat) => room.seats[seat].bot || (shared(room) && room.seats[seat].away);

  function scheduleBots(room) {
    clearTimeout(botTimers.get(room.id));
    if (room.status !== 'playing') return;
    const game = gameFor(room);
    const seat = activeSeats(game, room.match).find((s) => botControls(room, s));
    if (seat == null) return;
    const [a, b] = botDelayMs || game.botDelayMs || [700, 1400];
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
      // Mesa acabada: quem desliga (sem clicar em "Sair") liberta o lugar
      // na mesma (ver resetPublicIfEmpty) — senão ficava presa.
      if (shared(room) && room.status === 'over' && away) {
        room.seats[s] = emptySeat();
        resetPublicIfEmpty(room);
        if (rooms.has(room.id)) touch(room, { lobby: true }); else broadcastLobby();
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
    // Mesa de convite acabada e já sem ninguém: é de uso único, apaga-se.
    if (room.kind === 'invite' && room.status === 'over') return deleteRoom(room);
    clearTimeout(botTimers.get(room.id));
    room.seats = room.seats.map(emptySeat);
    room.match = null;
    room.status = 'waiting';
    syncTimers(room);
  }

  // Mesa pública acabada: quem sai dela (volta ao lobby, desliga) larga o
  // lugar. Sem isto, quem ficava ligado no lobby prendia a mesa a "Ver" para
  // todos — o lugar só se libertava quando o último desligava, e uma mesa
  // acabada que voltava do disco (reinício) nunca mais era libertada.
  function releaseFinishedSeat(room, userId) {
    if (!shared(room) || room.status !== 'over') return;
    const s = seatOf(room, userId);
    if (s < 0) return;
    room.seats[s] = emptySeat();
    resetPublicIfEmpty(room);
    if (rooms.has(room.id)) touch(room, { lobby: true }); else broadcastLobby();
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
    return { appearance, brandTokens: BRAND_TOKENS, games, presets: appearancePresets };
  }

  /** Só os tokens da marca que existem em BRAND_TOKENS, limpos. */
  function cleanBrandTokens(tokens = {}) {
    const out = {};
    for (const [k, v] of Object.entries(tokens)) {
      if (!BRAND_TOKENS[k]) throw new Error(`${k}: token da marca desconhecido`);
      const c = cleanToken(k, BRAND_TOKENS[k], v);
      if (c) out[k] = c;
    }
    return out;
  }

  /** Tema, tokens e miniatura de um jogo, validados contra o skin.json. */
  async function cleanGameConfig(gameId, cfg = {}) {
    const g = G.get(gameId);
    if (!g) throw new Error(`${gameId}: jogo não instalado`);
    const skin = await readPkgJson(g, g.skin);
    const out = { theme: null, tokens: {}, thumbnail: null };
    if (cfg?.theme) {
      if (!g.themes?.[cfg.theme]) throw new Error(`${gameId}: tema ${cfg.theme} não existe`);
      out.theme = cfg.theme;
    }
    for (const [k, v] of Object.entries(cfg?.tokens || {})) {
      const def = skin?.tokens?.[k];
      if (!def) throw new Error(`${gameId}: token ${k} não está no skin.json`);
      const c = cleanToken(k, def.type, v);
      if (c) out.tokens[k] = c;
    }
    // Animação de uma imagem (animation.js): só tokens "image" que já têm imagem,
    // um nome da lista e os frames extra (o frame 1 é o próprio token).
    for (const [k, a] of Object.entries(cfg?.anims || {})) {
      if (skin?.tokens?.[k]?.type !== 'image') throw new Error(`${gameId}: ${k} não é uma imagem do skin.json`);
      if (!ANIMATIONS[a?.name]) throw new Error(`${gameId}: animação ${a?.name} desconhecida`);
      if (!out.tokens[k]) continue;
      const frames = (Array.isArray(a.frames) ? a.frames : []).slice(0, MAX_FRAMES - 1).map((f) => cleanToken(k, 'image', f)).filter(Boolean);
      (out.anims ??= {})[k] = { name: a.name, frames };
    }
    // Não é um token do skin.json (não há CSS por trás) — mesma validação de
    // url() que --table-bg e afins, para aceitar só imagens seguras. Só a
    // miniatura da página da marca: o fundo do lobby é sempre o --table-bg
    // (escurecido, app.css), não depende de nada aqui.
    if (cfg?.thumbnail != null) out.thumbnail = cleanToken(gameId, 'image', cfg.thumbnail);
    return out;
  }

  /** Valida as afinações (marca + jogos); só tokens declarados, só temas que existem. */
  async function cleanAppearance(input = {}) {
    const next = { brand: { tokens: cleanBrandTokens(input.brand?.tokens) }, games: {} };
    for (const [gameId, cfg] of Object.entries(input.games || {})) {
      const out = await cleanGameConfig(gameId, cfg);
      if (out.theme || Object.keys(out.tokens).length || out.thumbnail || out.anims) next.games[gameId] = out;
    }
    return next;
  }

  /** Valida e guarda as afinações. */
  async function setAppearance(input = {}) {
    const next = await cleanAppearance(input);
    // A visibilidade tem o seu próprio endpoint; o editor de aparência não a toca.
    if (appearance.hidden) next.hidden = appearance.hidden;
    appearance = next;
    storage.saveAppearance?.(appearance);
    broadcastAppearance();
    return appearance;
  }

  /** Manda a cada ligado a aparência que lhe corresponde (a global, ou a da marca em pré-visualização). */
  function broadcastAppearance() {
    for (const [ws, c] of conns) if (c.user) send(ws, { type: 'APPEARANCE', appearance: appearanceFor(c) });
  }

  // ─── Marcas (tab Marcas da consola) ───────────────────────────
  // Um perfil é um lobby em preparação para um cliente: identidade (nome,
  // língua, logótipo), jogos escolhidos e aparência (marca + jogos). Vive no
  // Studio; abre-se em /marca/<id> para mostrar ao cliente, e exporta-se
  // como pacote (JSON) que o runtime do cliente carrega (opção `profile`).
  const brandOf = (id) => brands.find((b) => b.id === id) || null;
  const appearanceFor = (c) => {
    const b = c.brandId ? brandOf(c.brandId) : null;
    return b ? { ...b.appearance, hidden: {} } : appearance;
  };

  function cleanImageUrl(name, value) {
    const v = String(value ?? '').trim();
    if (!v) return '';
    if (v.length > 400_000) throw new Error(`${name}: imagem demasiado grande`);
    if (!/^(data:image\/(png|jpeg|webp|gif|svg\+xml)[;,]|https:\/\/|\/(?!\/))/i.test(v) || /[\s"'<>()\\]/.test(v.replace(/^data:[^,]*,/, ''))) throw new Error(`${name}: url não permitido`);
    return v;
  }

  async function cleanBrandProfile(input = {}, id) {
    const name = String(input.name ?? '').replace(/[<>]/g, '').trim().slice(0, 40);
    if (!name) throw new Error('falta o nome da marca');
    const games = [...new Set((input.games || []).map(String))];
    for (const g of games) if (!G.has(g)) throw new Error(`${g}: jogo não instalado`);
    const existing = brandOf(id);
    return {
      id, name, lang: input.lang === 'en' ? 'en' : 'pt',
      logo: cleanImageUrl('logo', input.logo), games,
      appearance: await cleanAppearance(input.appearance),
      createdAt: existing?.createdAt ?? now(), updatedAt: now(),
    };
  }

  async function saveBrand(id, input) {
    if (!/^[a-z0-9][a-z0-9-]{1,31}$/.test(id)) throw new Error('o id da marca tem de ter 2 a 32 letras minúsculas, números ou hífens');
    if (id === brand.id || ['console', 'admin', 'health', 'marca', 'games', 'engine', 'sdk', 'design-system'].includes(id)) throw new Error('id reservado');
    const profile = await cleanBrandProfile(input, id);
    brands = [...brands.filter((b) => b.id !== id), profile].sort((a, b) => a.name.localeCompare(b.name));
    storage.saveBrands?.(brands);
    return profile;
  }

  function deleteBrand(id) {
    const before = brands.length;
    brands = brands.filter((b) => b.id !== id);
    storage.saveBrands?.(brands);
    return brands.length < before;
  }

  /** Esconde/mostra um jogo na página da marca (sobrepõe o `hidden` do pacote); o link direto continua a funcionar. */
  function setGameHidden(gameId, hidden) {
    if (!G.has(gameId)) throw new Error(`${gameId}: jogo não instalado`);
    appearance = { ...appearance, hidden: { ...appearance.hidden, [gameId]: !!hidden } };
    storage.saveAppearance?.(appearance);
    broadcastAppearance();
    return appearance.hidden[gameId];
  }

  /** Guarda a aparência atual de um alvo (marca ou jogo) como skin nomeada, para reaplicar depois. */
  async function saveAppearancePreset(input = {}) {
    const target = String(input.target || '');
    const name = String(input.name ?? '').replace(/[<>]/g, '').trim().slice(0, 40);
    if (!name) throw new Error('falta o nome da skin');
    let tokens; let theme = null;
    if (target === 'brand') {
      tokens = cleanBrandTokens(input.tokens);
    } else {
      ({ tokens, theme } = await cleanGameConfig(target, input));
    }
    const preset = { id: randomBytes(9).toString('base64url'), target, name, theme, tokens, createdAt: now() };
    appearancePresets = [...appearancePresets.filter((p) => !(p.target === target && p.name === name)), preset];
    storage.saveAppearancePresets?.(appearancePresets);
    return preset;
  }

  function deleteAppearancePreset(presetId) {
    const before = appearancePresets.length;
    appearancePresets = appearancePresets.filter((p) => p.id !== presetId);
    storage.saveAppearancePresets?.(appearancePresets);
    return appearancePresets.length < before;
  }

  /** Há uma janela de manutenção ativa para este jogo? */
  const inMaintenance = (gameId) => activeNotices().some((n) => n.maintenance
    && n.maintenance.from <= now() && (!n.maintenance.games || n.maintenance.games.includes(gameId)));

  // ─── Mensagens ──────────────────────────────────────────────
  const fail = (ws, code, params = {}) => send(ws, { type: 'ERROR', code, params });

  const handlers = {
    HELLO(ws, c, { token, name, lang, brand: brandId }) {
      let user = token && users[token];
      if (!user) {
        token = id(18);
        user = { userId: id(8), name: cleanName(name, 'Jogador') };
        users[token] = user;
        storage.saveUsers(users);
      }
      // Pré-visualização de uma marca (/marca/<id>): lobby, jogos e aparência do perfil.
      const profile = brandOf(brandId) || null;
      Object.assign(c, { user, token, lang: lang || c.lang, brandId: profile?.id ?? null });
      clearTimeout(graceTimers.get(user.userId));
      markAway(user.userId, false);
      send(ws, {
        type: 'WELCOME', userId: user.userId, token, name: user.name, studio,
        engineVersion: ENGINE_VERSION,
        brand: profile ? { id: profile.id, name: profile.name, lang: profile.lang, logo: profile.logo || null } : { id: brand.id, name: brand.name, lang: brand.lang || 'pt', logo: brand.logo || null },
        platformI18n: PLATFORM_I18N,
        games: [...G.values()].filter((g) => !profile || profile.games.includes(g.id)).map((g) => ({
          id: g.id, version: g.version, players: g.players, defaultLang: g.defaultLang, i18n: g.i18n,
          prototype: !!g.prototype,
          // Instalado e jogável por link direto, mas fora da lista pública
          // (página da marca) — ex.: uma demonstração do template vanilla.
          hidden: appearanceFor(c).hidden?.[g.id] ?? !!g.hidden,
          ui: gameFileUrl(g, g.ui),
          tutorial: gameFileUrl(g, g.tutorial),
          skin: gameFileUrl(g, g.skin),
          // Miniatura na página da marca (não o fundo do lobby, que é sempre
          // o --table-bg); a consola pode sobrepor a do pacote (Aparência).
          thumbnail: appearanceFor(c).games?.[g.id]?.thumbnail || (g.thumbnail ? `url('${gameFileUrl(g, g.thumbnail)}')` : null),
          rules: g.rules || null,
          themes: Object.fromEntries(Object.entries(g.themes || {}).map(([k, rel]) => [k, gameFileUrl(g, rel)])),
        })),
        notices: activeNotices(),
        appearance: appearanceFor(c),
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
      if (!tableCounts(game).includes(n)) return fail(ws, 'server.BAD_PLAYERS');
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

    CLOSE(ws, c) {
      const room = c.roomId && rooms.get(c.roomId);
      c.roomId = null;
      if (room) releaseFinishedSeat(room, c.user.userId);
    },

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
      const game = gameFor(room);
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
  const brandHead = (profile = null) => [
    ...(brand.fonts ? [`<link rel="stylesheet" href="${brand.fonts}">`] : []),
    ...(brand.stylesheets || []).map((h) => `<link rel="stylesheet" href="${h}">`),
    brand.tokens ? `<style>:root{${Object.entries(brand.tokens).map(([k, v]) => `${k}:${v}`).join(';')}}</style>` : '',
    // Afinações da marca feitas na consola (já validadas); o JS mantém-nas ao vivo.
    `<style id="appearance-brand">:root{${Object.entries((profile ? profile.appearance : appearance).brand.tokens).map(([k, v]) => `${k}:${v}`).join(';')}}</style>`,
    // Pré-visualização de uma marca: o cliente (app.js) diz ao servidor qual é, no HELLO.
    profile ? `<script>window.BRAND_ID=${JSON.stringify(profile.id)}</script>` : '',
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
      id: g.id, name: gameName(g), version: g.version, players: g.players, prototype: !!g.prototype,
      hidden: appearance.hidden?.[g.id] ?? !!g.hidden,
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
    if (!tableCounts(game).includes(n)) throw new Error('número de jogadores inválido');
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

  function soloRoomInfo(r) {
    return { id: r.id, gameId: r.gameId, status: r.status, owner: r.owner, createdAt: r.createdAt, updatedAt: r.updatedAt };
  }

  // Só mesas solo: as públicas libertam-se sozinhas quando ficam vazias
  // (resetPublicIfEmpty) e as de convite são o publisher a apagar, à mão, na
  // consola. Nunca apaga quem está ligado agora — só o dono vê a mesa solo,
  // por isso basta essa verificação (ver onClose/markAway). Nem uma expirada
  // (ADR-004): fica guardada para replay até o dono decidir, sem prazo.
  function reapableSolo(room) {
    if (room.kind !== 'solo' || room.status === 'expired' || isOnline(room.owner)) return false;
    const idleMs = now() - room.updatedAt;
    return (room.status === 'over' && idleMs > soloOverMs) || idleMs > soloIdleMs;
  }

  function reapIdleRooms() {
    const targets = [...rooms.values()].filter(reapableSolo);
    const reaped = targets.map(soloRoomInfo);
    for (const room of targets) deleteRoom(room);
    if (reaped.length) logger.log(`[reap] ${reaped.length} mesa(s) solo esquecida(s) apagada(s)`);
    return reaped;
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

  // ─── Protótipos da Forge (etapa 5) ──────────────────────────
  // Cada instalação fica numa pasta própria (versão + marca de tempo): o import
  // de ESM fica em cache por caminho, por isso uma pasta nova carrega sempre o código novo.
  // A pasta dos protótipos é um "projeto" ESM com o motor ligado (junction), como na
  // verificação. Refaz-se sempre antes de carregar: a ligação pode ter desaparecido.
  async function prepararPrototipos() {
    await mkdir(join(prototypeDir, 'node_modules', '@bitnik'), { recursive: true });
    await writeFile(join(prototypeDir, 'package.json'), JSON.stringify({ name: 'bitnik-prototipos', private: true, type: 'module' }));
    await symlink(ENGINE_ROOT, join(prototypeDir, 'node_modules', '@bitnik', 'engine'), 'junction').catch((e) => { if (e.code !== 'EEXIST') throw e; });
  }

  async function loadPrototype(slug, proto, { latest = true } = {}) {
    const file = join(prototypeDir, slug, proto.folder, 'index.js');
    const game = (await import(pathToFileURL(file).href)).default;
    const problems = checkGame(game);
    if (problems.length) throw new Error(problems.join('; '));
    if (game.id !== slug) throw new Error(`o id do pacote é "${game.id}", devia ser "${slug}"`);
    const current = G.get(slug);
    if (current && !current.prototype) throw new Error(`já existe um jogo publicado com o id "${slug}"`);
    const g = Object.freeze({ ...game, prototype: true });
    if (!PV.has(slug)) PV.set(slug, new Map());
    PV.get(slug).set(g.version, g);
    if (latest) G.set(slug, g);
    return g;
  }

  const versionInUse = (slug, v) => [...rooms.values()].some((r) => r.gameId === slug && r.match?.gameVersion === v);

  async function installPrototype(slug, p) {
    if (!prototypeDir) throw new Error('este servidor não aceita protótipos');
    const b = p.build;
    if (!b?.report?.ok) throw new Error('o pacote ainda não passou a verificação');
    if (b.versaoRegras !== p.version) throw new Error(`o pacote verificado é das regras ${b.versaoRegras}; verifica outra vez com as regras ${p.version}`);
    await prepararPrototipos();
    const folder = `${p.version}-${now().toString(36)}`;
    const dir = join(prototypeDir, slug, folder);
    for (const [rel, content] of Object.entries(b.files)) {
      if (rel.includes('..')) throw new Error(`ficheiro não permitido: ${rel}`);
      await mkdir(dirname(join(dir, rel)), { recursive: true });
      await writeFile(join(dir, rel), String(content));
    }
    const game = await loadPrototype(slug, { folder });
    for (const r of publicRoomsFor(game)) if (!rooms.has(r.id)) { rooms.set(r.id, r); persist(r); }
    // Versões anteriores: ficam as que ainda têm mesas; as outras saem do disco e da memória.
    const entry = { version: p.version, folder, ts: now(), buildTs: b.ts };
    const keep = [];
    for (const x of p.prototypes || []) {
      if (x.version !== p.version && versionInUse(slug, x.version)) keep.push(x);
      else {
        if (x.version !== p.version) PV.get(slug)?.delete(x.version);
        await rm(join(prototypeDir, slug, x.folder), { recursive: true, force: true }).catch(() => {});
      }
    }
    return [...keep, entry];
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
    // Commit das regras (ADR-012/013): fotografia do fluxo, cartões e regras; sobe a versão 0.x.
    const cm = slug.match(/^([a-z0-9-]{1,80})\/commit$/);
    if (cm && req.method === 'POST') {
      const p = forge.get(cm[1]);
      if (!p) return json(res, 404, { error: 'projeto não encontrado' });
      const body = await readJson(req, 10_000);
      const kind = body.kind === 'texto' ? 'texto' : 'regras';
      const version = bumpVersion(p.version, kind);
      const commit = {
        id: `rc${p.ruleCommits.length + 1}`, ts: now(), version, kind, message: String(body.message ?? '').slice(0, 500),
        snapshot: structuredClone({ nodes: p.nodes, edges: p.edges, cards: p.cards, rules: p.rules }),
      };
      const saved = saveForge(cm[1], { ...p, ruleCommits: [...p.ruleCommits, commit] }, p);
      return json(res, 201, { commit, project: saved });
    }
    // Partida narrada colada da IA: { narration } (ou o JSON da IA diretamente).
    const nm = slug.match(/^([a-z0-9-]{1,80})\/narrations$/);
    if (nm && req.method === 'POST') {
      const p = forge.get(nm[1]);
      if (!p) return json(res, 404, { error: 'projeto não encontrado' });
      const body = await readJson(req, FORGE_MAX);
      const input = body.narration ?? body;
      if (!Array.isArray(input.jogadas) || !input.jogadas.length) return json(res, 400, { error: 'a partida não tem jogadas' });
      const narration = normalizeNarration({ ...input, id: `p${p.narrations.length + 1}`, criada: now(), versaoRegras: p.version, aprovada: false });
      const saved = saveForge(nm[1], { ...p, narrations: [...p.narrations, narration] }, p);
      return json(res, 201, { narration, project: saved });
    }
    // Verificação de um pacote gerado (ADR-012/013): { files: { 'index.js': '…', … } }.
    const vm = slug.match(/^([a-z0-9-]{1,80})\/verify$/);
    if (vm && req.method === 'POST') {
      const p = forge.get(vm[1]);
      if (!p) return json(res, 404, { error: 'projeto não encontrado' });
      const body = await readJson(req, FORGE_MAX);
      const report = await verifyPackage({ files: body.files, tests: p.tests?.itens, auxiliares: p.tests?.auxiliares });
      // O pacote tem de ser deste projeto e da versão atual das regras (ADR-013).
      if (report.game) {
        const idOk = report.game.id === vm[1];
        const vOk = report.game.version === p.version;
        const details = [
          ...(idOk ? [] : [`id "${report.game.id}" devia ser "${vm[1]}"`]),
          ...(vOk ? [] : [`versão "${report.game.version}" devia ser "${p.version}" (a das regras)`]),
        ];
        report.steps.push({ id: 'identidade', ok: idOk && vOk, details });
        report.ok = report.steps.every((s) => s.ok);
      }
      const build = { ts: now(), versaoRegras: p.version, files: body.files ?? {}, report, testsKey: testsKey(p.tests) };
      const saved = saveForge(vm[1], { ...p, build }, p);
      return json(res, 200, { report, project: saved });
    }
    // Instalar o pacote verificado como protótipo 0.x no Studio, sem reiniciar.
    const im = slug.match(/^([a-z0-9-]{1,80})\/install$/);
    if (im && req.method === 'POST') {
      const p = forge.get(im[1]);
      if (!p) return json(res, 404, { error: 'projeto não encontrado' });
      try {
        const prototypes = await installPrototype(im[1], p);
        const saved = saveForge(im[1], { ...p, prototypes }, p);
        return json(res, 200, { prototype: saved.prototype, project: saved });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }
    // Publicar o protótipo instalado como jogo 1.0.0 em games/<id>/ (sem Git: o commit vem depois).
    const pm = slug.match(/^([a-z0-9-]{1,80})\/publish$/);
    if (pm && req.method === 'POST') {
      const p = forge.get(pm[1]);
      if (!p) return json(res, 404, { error: 'projeto não encontrado' });
      if (!gamesDir) return json(res, 400, { error: 'este servidor não publica jogos' });
      const problem = publishProblem(p);
      if (problem) return json(res, 400, { error: problem });
      const target = join(gamesDir, pm[1]);
      if (existsSync(target)) return json(res, 409, { error: `já existe a pasta games/${pm[1]}` });
      // Verifica outra vez, já com a versão 1.0.0, antes de escrever.
      const files = publicationFiles(p, pm[1], { engineVersion: ENGINE_VERSION, date: new Date(now()) });
      const pkg = { ...p.build.files, 'index.js': setVersion(p.build.files['index.js'], PUBLISH_VERSION) };
      const report = await verifyPackage({ files: pkg, tests: p.tests?.itens, auxiliares: p.tests?.auxiliares });
      if (!report.ok || report.game?.version !== PUBLISH_VERSION) return json(res, 400, { error: `a versão ${PUBLISH_VERSION} não passou a verificação`, report });
      for (const [rel, content] of Object.entries(files)) {
        await mkdir(dirname(join(target, rel)), { recursive: true });
        await writeFile(join(target, rel), content);
      }
      const published = { version: PUBLISH_VERSION, ts: now(), dir: `games/${pm[1]}`, files: Object.keys(files).sort() };
      const saved = saveForge(pm[1], { ...p, published }, p);
      return json(res, 200, { published, project: saved });
    }
    // Testes colados da IA: { estado, testes: [...] }; os aprovados ficam fixos.
    const tm = slug.match(/^([a-z0-9-]{1,80})\/tests$/);
    if (tm && req.method === 'POST') {
      const p = forge.get(tm[1]);
      if (!p) return json(res, 404, { error: 'projeto não encontrado' });
      const body = await readJson(req, FORGE_MAX);
      const input = body.tests ?? body;
      if (!Array.isArray(input.testes ?? input.itens) || !(input.testes ?? input.itens).length) return json(res, 400, { error: 'a resposta não tem testes' });
      const saved = saveForge(tm[1], { ...p, tests: mergeTests(p.tests, input, p.version) }, p);
      return json(res, 201, { tests: saved.tests, project: saved });
    }
    if (!/^[a-z0-9-]{1,80}$/.test(slug) || !forge.has(slug)) return json(res, 404, { error: 'projeto não encontrado' });
    if (req.method === 'GET') return json(res, 200, { slug, project: forge.get(slug) });
    if (req.method === 'PUT') {
      // Os commits das regras só se criam pelo /commit, e um teste aprovado não muda de conteúdo.
      // A verificação e os protótipos instalados são do servidor: um PUT não lhes mexe.
      const body = await readJson(req, FORGE_MAX);
      const p = forge.get(slug);
      const approved = new Map((p.tests?.itens || []).filter((t) => t.aprovado).map((t) => [t.id, t]));
      const tests = body.tests && {
        ...body.tests,
        itens: (body.tests.itens || []).map((t) => (approved.has(t.id) && t.aprovado ? approved.get(t.id) : t)),
      };
      return json(res, 200, { slug, project: saveForge(slug, { ...body, tests: tests ?? p.tests, ruleCommits: p.ruleCommits, build: p.build, prototypes: p.prototypes, published: p.published }, p) });
    }
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
          : tableCounts(game);
        const results = [];
        for (const n of counts) results.push(await simulateGame(game, { ...body, numPlayers: n }));
        return json(res, 200, { gameId: game.id, version: game.version, results });
      }
      const vis = url.match(/^\/admin\/games\/([\w-]+)\/visibility$/);
      if (vis && req.method === 'PUT') {
        if (!G.has(vis[1])) return json(res, 404, { error: 'jogo não instalado' });
        return json(res, 200, { hidden: setGameHidden(vis[1], (await readJson(req)).hidden) });
      }
      if (url === '/admin/brands' && req.method === 'GET') {
        // A própria marca deste servidor (no Studio, a Bitnik): endereço do lobby e jogos que lá aparecem agora.
        const platform = {
          id: brand.id, name: brand.name, lang: brand.lang || 'pt', logo: brand.logo || null,
          home: adminToken && consoleAtRoot ? `/${brand.id}` : '/',
          games: [...G.values()].filter((g) => !(appearance.hidden?.[g.id] ?? !!g.hidden)).map((g) => g.id),
        };
        return json(res, 200, { platform, brands, games: [...G.values()].map((g) => ({ id: g.id, name: gameName(g), prototype: !!g.prototype })), brandTokens: BRAND_TOKENS, current: appearance });
      }
      const brandMatch = url.match(/^\/admin\/brands\/([a-z0-9-]+)(\/export)?$/);
      if (brandMatch) {
        const [, bid, exp] = brandMatch;
        if (exp && req.method === 'GET') {
          const b = brandOf(bid);
          return b ? json(res, 200, { format: 'bitnik-brand/1', exportedAt: now(), ...b }) : json(res, 404, { error: 'marca inexistente' });
        }
        if (!exp && req.method === 'PUT') return json(res, 200, { brand: await saveBrand(bid, await readJson(req, APPEARANCE_MAX)) });
        if (!exp && req.method === 'DELETE') return json(res, deleteBrand(bid) ? 204 : 404);
      }
      if (url === '/admin/appearance' && req.method === 'GET') return json(res, 200, await appearanceCatalog());
      if (url === '/admin/appearance' && req.method === 'PUT') return json(res, 200, { appearance: await setAppearance(await readJson(req, APPEARANCE_MAX)) });
      if (url === '/admin/appearance/presets' && req.method === 'POST') {
        return json(res, 201, { preset: await saveAppearancePreset(await readJson(req, APPEARANCE_MAX)) });
      }
      const presetMatch = url.match(/^\/admin\/appearance\/presets\/([\w-]+)$/);
      if (presetMatch && req.method === 'DELETE') {
        return json(res, deleteAppearancePreset(presetMatch[1]) ? 204 : 404);
      }
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
      // ─── Mesas solo (ADR-015): limpeza automática por inatividade; a
      // consola lista, apaga uma à mão ou manda limpar já. ───────
      if (url === '/admin/solo-rooms' && req.method === 'GET') {
        const list = [...rooms.values()].filter((r) => r.kind === 'solo').sort((a, b) => a.updatedAt - b.updatedAt).map(soloRoomInfo);
        return json(res, 200, { rooms: list });
      }
      if (url === '/admin/solo-rooms/reap' && req.method === 'POST') {
        return json(res, 200, { reaped: reapIdleRooms() });
      }
      const solo = url.match(/^\/admin\/solo-rooms\/([\w-]+)$/);
      if (solo && req.method === 'DELETE') {
        const room = rooms.get(solo[1]);
        if (!room || room.kind !== 'solo') return json(res, 404, { error: 'mesa não encontrada' });
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
    // Normalmente "/" é o lobby da marca e "/console" é a consola. Com
    // consoleAtRoot (só faz sentido com adminToken), trocam: "/" passa a ser
    // a consola — a ferramenta — e o lobby, o "produto" dela, muda para
    // "/<brand.id>". "/console" continua a funcionar como atalho.
    const consoleAtHome = !!(adminToken && consoleAtRoot);
    const home = consoleAtHome ? `/${brand.id}` : '/';
    const consolePaths = consoleAtHome ? ['/console', '/console/', '/', '/index.html'] : ['/console', '/console/'];
    const homePaths = consoleAtHome ? [home, `${home}/`, `${home}/index.html`] : ['/', '/index.html'];
    if (adminToken && consolePaths.includes(url)) {
      return serveFile(res, join(PUBLIC_DIR, 'console.html'), MIME['.html'], (html) => html
        .replaceAll('{{BRAND_NAME}}', brand.name).replace('{{BRAND_HEAD}}', brandHead())
        .replace('{{LANG}}', brand.lang || 'pt').replace('{{HOME}}', home));
    }
    const marca = url.match(/^\/marca\/([a-z0-9-]+)\/?$/);
    if (marca) {
      const profile = brandOf(marca[1]);
      if (!profile) { res.writeHead(404); return res.end('404'); }
      const escHtml = (x) => String(x).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
      return serveFile(res, join(PUBLIC_DIR, 'app.html'), MIME['.html'], (html) => html
        .replaceAll('{{BRAND_NAME}}', escHtml(profile.name)).replace('{{BRAND_HEAD}}', brandHead(profile))
        .replace('{{LANG}}', profile.lang).replace('href="/icon.svg"', `href="${profile.logo ? escHtml(profile.logo) : '/icon.svg'}"`));
    }
    if (url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, brand: brand.id, games: [...G.keys()], rooms: rooms.size }));
    }
    if (homePaths.includes(url)) {
      return serveFile(res, join(PUBLIC_DIR, 'app.html'), MIME['.html'], (html) => html
        .replaceAll('{{BRAND_NAME}}', brand.name).replace('{{BRAND_HEAD}}', brandHead())
        .replace('{{LANG}}', brand.lang || 'pt'));
    }
    if (url === '/sw.js') {
      return serveFile(res, join(PUBLIC_DIR, 'sw.js'), MIME['.js'], (js) => js
        .replace('{{VERSION}}', sw.version).replace('{{PRECACHE}}', JSON.stringify(sw.precache)));
    }
    if (url === '/manifest.webmanifest') {
      const homeSlash = consoleAtHome ? `${home}/` : home;
      res.writeHead(200, { 'Content-Type': MIME['.webmanifest'] });
      return res.end(JSON.stringify({
        id: homeSlash, scope: homeSlash, lang: brand.lang || 'pt',
        name: brand.name, short_name: brand.name, start_url: homeSlash, display: 'standalone',
        related_applications: [{ platform: 'webapp', url: `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}/manifest.webmanifest` }],
        background_color: brand.tokens?.['--color-cream'] || '#fbf3e4',
        theme_color: brand.tokens?.['--color-brick'] || '#b8461f',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      }));
    }
    if (url === '/documentation' || url === '/documentation/' || url === '/documentation/index.html') {
      return serveFile(res, join(PUBLIC_DIR, 'documentation.html'), MIME['.html'], (html) => html
        .replaceAll('{{BRAND_NAME}}', brand.name).replace('{{BRAND_HEAD}}', brandHead())
        .replace('{{LANG}}', brand.lang || 'pt').replace('{{HOME}}', home));
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
    const ds = url.match(/^\/design-system\/(index|tokens|base|components|game-ui)\.css$/);
    if (ds) return serveFile(res, join(PUBLIC_DIR, 'design-system', `${ds[1]}.css`), MIME['.css']);
    const pub = url.match(/^\/(app\.js|tour\.js|motion\.js|animation\.js|app\.css|icon\.svg|icon-192\.png|icon-512\.png|console\.js|console\.css|appearance\.js|console-appearance\.js|console-brands\.js|design-tokens\.js|console-forge\.js|console-forge-flow\.js|console-forge-play\.js|console-forge-tests\.js|console-forge-code\.js|documentation\.js|documentation\.css)$/);
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
    appearancePresets = Array.isArray(saved.appearancePresets) ? saved.appearancePresets : [];
    brands = Array.isArray(saved.brands) ? saved.brands : [];
    // Normaliza ao carregar: projetos guardados por versões anteriores ganham os campos novos.
    for (const [slug, p] of Object.entries(saved.forge || {})) {
      forge.set(slug, { ...normalizeProject(p), createdAt: p.createdAt ?? now(), updatedAt: p.updatedAt ?? now() });
    }
    // Protótipos instalados antes do restart voltam a entrar (antes das mesas, que precisam do jogo).
    if (prototypeDir && [...forge.values()].some((p) => p.prototypes.length)) {
      await prepararPrototipos().catch((e) => logger.warn(`[load] pasta dos protótipos: ${e.message}`));
    }
    for (const [slug, p] of forge) {
      for (const [i, x] of p.prototypes.entries()) {
        try { await loadPrototype(slug, x, { latest: i === p.prototypes.length - 1 }); } catch (e) { logger.warn(`[load] protótipo ${slug} ${x.version}: ${e.message}`); }
      }
    }
    for (const room of saved.rooms || []) {
      const game = gameFor(room);
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
    // Ninguém está ligado ao arrancar: mesas públicas acabadas voltam a ficar livres.
    for (const room of [...rooms.values()]) {
      if (shared(room) && room.status === 'over') {
        room.seats = room.seats.map(emptySeat);
        resetPublicIfEmpty(room);
        if (rooms.has(room.id)) persist(room);
      }
    }
    for (const room of rooms.values()) { syncTimers(room); scheduleBots(room); }
    reapIdleRooms(); // apanha logo o que ficou à espera enquanto o servidor esteve parado
  })();
  const reapTimer = setInterval(reapIdleRooms, reapIntervalMs);
  reapTimer.unref?.();

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
      clearInterval(reapTimer);
      for (const t of [...botTimers.values(), ...graceTimers.values()]) clearTimeout(t);
      for (const m of gameTimers.values()) for (const t of m.values()) clearTimeout(t);
      for (const ws of wss.clients) ws.terminate();
      await new Promise((resolve) => wss.close(() => { http.close(resolve); http.closeAllConnections?.(); }));
      // O que ficou por gravar (salas, projetos da Forge) chega ao disco antes de sair.
      await storage.flush?.();
    },
  };
}
