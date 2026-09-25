// @bitnik/engine — motor de jogos por turnos.
//
// Um jogo é um objeto (ver docs/CONTRATO.md) com regras puras:
// sem rede, sem relógio, sem Math.random. O motor trata da seed,
// do registo de jogadas, dos timers declarativos e do replay.
// O match resultante é JSON puro: pode ser guardado e retomado.

import { createRng, seedFrom } from './rng.js';
import { translate, i18nGaps, ENGINE_I18N } from './i18n.js';
import { checkPurity } from './purity.js';

export { createRng, seedFrom, translate, i18nGaps, ENGINE_I18N, checkPurity };

export const ENGINE_VERSION = '0.2.1';
const INVALID = Symbol('invalid');
const LOG_CAP = 200;

// ─── Definição e validação de jogos ────────────────────────────

const REQUIRED = ['id', 'version', 'players', 'setup', 'moves', 'activePlayers', 'view', 'result'];

/** Valida a forma de um pacote de jogo. Devolve a lista de problemas. */
export function checkGame(game) {
  const problems = [];
  for (const k of REQUIRED) if (game?.[k] == null) problems.push(`falta "${k}"`);
  if (problems.length) return problems;
  const { min, max } = game.players;
  if (!(min >= 1 && max >= min)) problems.push('players.min/max inválidos');
  const { counts } = game.players;
  if (counts != null && (!Array.isArray(counts) || !counts.length || counts.some((n) => !Number.isInteger(n) || n < min || n > max))) {
    problems.push('players.counts tem de ser uma lista de números entre min e max');
  }
  if (!game.i18n || !Object.keys(game.i18n).length) problems.push('falta i18n');
  for (const gap of i18nGaps(game)) problems.push(`i18n sem chave ${gap}`);
  for (const [name, fn] of Object.entries(game.moves)) {
    if (typeof fn !== 'function') problems.push(`move ${name} não é função`);
    if (name.startsWith('@')) problems.push(`move ${name} não pode começar por @`);
  }
  return problems;
}

/** Açúcar para os pacotes: valida no import e devolve o jogo congelado. */
export function defineGame(game) {
  const problems = checkGame(game);
  if (problems.length) throw new Error(`Jogo "${game?.id}" inválido: ${problems.join('; ')}`);
  return Object.freeze({ defaultLang: 'pt', events: {}, bots: {}, enumerate: null, ...game });
}

/**
 * Números de jogadores aceites: `players.counts` (ex.: [2, 4] num jogo que não
 * se joga a 3) ou, sem ela, todos de `min` a `max`.
 */
export function playerCounts(game) {
  const { min, max, counts } = game.players;
  if (Array.isArray(counts)) return [...new Set(counts)].sort((a, b) => a - b);
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

// ─── Versões ────────────────────────────────────────────────────

const parseVersion = (v) => String(v).split('.').map((n) => parseInt(n, 10) || 0);

/**
 * Semver à letra: uma versão guardada `a` é compatível com a instalada `b`
 * se o primeiro número não nulo for igual (1.x ↔ 1.y; 0.2.x ↔ 0.2.y; 0.0.3 só ↔ 0.0.3).
 */
export function compatibleVersions(a, b) {
  const [A, B] = [parseVersion(a), parseVersion(b)];
  for (let i = 0; i < 3; i++) {
    if (A[i] !== B[i]) return false;
    if (A[i] > 0) return true;
  }
  return true;
}

/**
 * Diz se um match guardado pode ser retomado com o jogo e o motor instalados.
 * @returns {null | {reason:'game'|'engine', from:string, to:string}}
 */
export function matchIncompatibility(game, match) {
  if (!compatibleVersions(match.gameVersion, game.version)) {
    return { reason: 'game', from: String(match.gameVersion), to: game.version };
  }
  if (!compatibleVersions(match.engineVersion ?? '0.0.0', ENGINE_VERSION)) {
    return { reason: 'engine', from: String(match.engineVersion), to: ENGINE_VERSION };
  }
  return null;
}

// ─── Contexto passado às regras ─────────────────────────────────

function makeCtx({ game, match, seat, rng, logs, timerOps }) {
  return {
    seat,
    rng,
    numPlayers: match.numPlayers,
    options: match.options,
    /** Regista uma entrada de log traduzível. */
    log: (key, params = {}) => logs.push({ key, params, seat }),
    /** Agenda um evento do jogo. Uma key repetida substitui o timer anterior. */
    schedule: (key, delayMs, event, payload = {}) => timerOps.push({ op: 'set', key, delayMs, event, payload }),
    cancel: (key) => timerOps.push({ op: 'cancel', key }),
    /** Devolve este valor numa move para a recusar sem alterar nada. */
    invalid: (code, params = {}) => ({ [INVALID]: true, code, params }),
    game,
  };
}

function applyTimerOps(timers, ops, seq) {
  let out = timers.slice();
  for (const o of ops) {
    out = out.filter((t) => t.key !== o.key);
    if (o.op === 'set') out.push({ key: o.key, delayMs: o.delayMs, event: o.event, payload: o.payload, seq });
  }
  return out;
}

// ─── Ciclo de vida do match ─────────────────────────────────────

/**
 * Cria um match novo. O resultado é JSON serializável.
 * @param {object} game
 * @param {{numPlayers:number, seed?:number|string, options?:object}} opts
 */
export function createMatch(game, { numPlayers, seed, options = {} }) {
  if (!playerCounts(game).includes(numPlayers)) {
    throw new Error(`${game.id}: ${numPlayers} jogadores não é aceite (${playerCounts(game).join(', ')})`);
  }
  const s = seedFrom(seed ?? `${Date.now()}-${Math.random()}`);
  const rng = createRng(s);
  const logs = [];
  const timerOps = [];
  const base = { numPlayers, options };
  const ctx = makeCtx({ game, match: base, seat: null, rng, logs, timerOps });
  const state = game.setup(ctx);
  return {
    gameId: game.id,
    gameVersion: game.version,
    engineVersion: ENGINE_VERSION,
    seed: s,
    numPlayers,
    options,
    rng: rng.state,
    seq: 0,
    state,
    moves: [],
    log: logs,
    timers: applyTimerOps([], timerOps, 0),
    result: game.result(state) ?? null,
  };
}

function commit(game, match, { state, rng, record, logs, timerOps }) {
  const seq = match.seq + 1;
  return {
    ...match,
    state,
    rng: rng.state,
    seq,
    moves: [...match.moves, record],
    log: [...match.log, ...logs.map((l) => ({ ...l, seq }))].slice(-LOG_CAP),
    timers: applyTimerOps(match.timers, timerOps, seq),
    result: game.result(state) ?? null,
  };
}

function run(game, match, seat, fn, payload, record) {
  const state = structuredClone(match.state);
  const rng = createRng(match.rng);
  const logs = [];
  const timerOps = [];
  const ctx = makeCtx({ game, match, seat, rng, logs, timerOps });
  let r;
  // Um bug nas regras recusa a jogada como outra qualquer: a cópia é
  // descartada e o match fica intacto (tudo-ou-nada).
  try { r = fn(state, payload ?? {}, ctx); } catch (e) {
    return { ok: false, error: { code: 'engine.RULE_ERROR', params: { type: record.type, message: String(e?.message ?? e) } } };
  }
  if (r && r[INVALID]) return { ok: false, error: { code: r.code, params: r.params } };
  const next = commit(game, match, { state, rng, record, logs, timerOps });
  // Um jogo terminado não deixa timers pendurados.
  if (next.result) next.timers = [];
  return { ok: true, match: next };
}

/**
 * Aplica uma jogada. Não altera o match recebido.
 * Com `expectSeq`, só aceita a jogada se o match ainda estiver nesse seq
 * (a jogada foi pensada sobre o estado atual, não sobre um antigo).
 * @returns {{ok:true, match:object} | {ok:false, error:{code:string, params:object}}}
 */
export function applyMove(game, match, seat, move, { expectSeq } = {}) {
  if (expectSeq != null && expectSeq !== match.seq) {
    return { ok: false, error: { code: 'engine.STALE_MOVE', params: { seq: expectSeq, current: match.seq } } };
  }
  if (match.result) return { ok: false, error: { code: 'engine.GAME_OVER', params: {} } };
  const fn = game.moves[move?.type];
  if (!fn) return { ok: false, error: { code: 'engine.UNKNOWN_MOVE', params: { type: String(move?.type) } } };
  if (!game.activePlayers(match.state).includes(seat)) {
    return { ok: false, error: { code: 'engine.NOT_ACTIVE', params: {} } };
  }
  return run(game, match, seat, fn, move.payload, { seat, type: move.type, payload: move.payload ?? {} });
}

/** Dispara o timer com esta key (chamado pelo servidor quando o tempo acaba). */
export function fireTimer(game, match, key) {
  const t = match.timers.find((x) => x.key === key);
  if (!t) return { ok: false, error: { code: 'engine.UNKNOWN_EVENT', params: { event: key } } };
  const fn = game.events?.[t.event];
  if (!fn) return { ok: false, error: { code: 'engine.UNKNOWN_EVENT', params: { event: t.event } } };
  const without = { ...match, timers: match.timers.filter((x) => x.key !== key) };
  return run(game, without, null, fn, t.payload, { seat: null, type: `@${t.event}`, key, payload: t.payload });
}

/**
 * Refaz um match a partir da seed e das jogadas. Útil para testes e bugs.
 * Só é garantido com a versão exata: um patch que corrija um bug pode fazer
 * uma partida antiga divergir. Nesse caso avisa por `onWarn`.
 */
export function replay(game, { seed, numPlayers, options, moves, gameVersion }, { onWarn = console.warn } = {}) {
  if (gameVersion != null && gameVersion !== game.version) {
    onWarn(`replay: partida da versão ${gameVersion} refeita com ${game.version}; pode divergir`);
  }
  let m = createMatch(game, { seed, numPlayers, options });
  for (const mv of moves) {
    const r = mv.type.startsWith('@') ? fireTimer(game, m, mv.key) : applyMove(game, m, mv.seat, mv);
    if (!r.ok) throw new Error(`replay falhou na jogada ${m.seq + 1}: ${r.error.code}`);
    m = r.match;
  }
  return m;
}

// ─── Leitura ────────────────────────────────────────────────────

/** Lugares que podem jogar agora. */
export const activeSeats = (game, match) => (match.result ? [] : game.activePlayers(match.state));

/** Jogadas legais para um lugar (se o jogo implementar enumerate). */
export function legalMoves(game, match, seat) {
  if (match.result || !game.enumerate) return [];
  if (!activeSeats(game, match).includes(seat)) return [];
  return game.enumerate(match.state, seat);
}

/**
 * Rótulo legível de uma jogada, `{ key, params }`, para a UI genérica e o
 * histórico. Ordem: `describeMove` do pacote; senão `moveLabel.TIPO` com o
 * payload como parâmetros (se a chave existir); senão `move.TIPO`.
 * Nunca lança: um bug no `describeMove` não pode partir a mesa.
 */
export function describeMove(game, move, view) {
  try {
    const label = game.describeMove?.(move, view);
    if (label?.key) return { key: label.key, params: label.params ?? {} };
  } catch { /* cai no rótulo por convenção */ }
  const key = `moveLabel.${move.type}`;
  if (key in (game.i18n?.[game.defaultLang || 'pt'] ?? {})) return { key, params: { ...move.payload } };
  return { key: `move.${move.type}`, params: {} };
}

/** O que um lugar (ou espectador, seat=null) pode ver, com as jogadas legais já rotuladas. */
export function viewFor(game, match, seat) {
  const view = game.view(match.state, seat);
  const legal = seat == null ? [] : legalMoves(game, match, seat);
  return {
    gameId: match.gameId,
    seq: match.seq,
    view,
    active: activeSeats(game, match),
    legal: legal.map((mv) => ({ ...mv, label: describeMove(game, mv, view) })),
    log: match.log.slice(-40),
    result: match.result,
  };
}

/**
 * Escolhe a jogada de um bot. O RNG deriva da seed, do seq e do lugar:
 * determinístico, e não gasta o RNG do match (trocar um humano por um
 * bot não muda os dados nem os baralhos).
 * O bot vê o mesmo que um humano nesse lugar: `view(state, seat)`.
 */
export function botMove(game, match, seat, level = 'default') {
  const bot = game.bots?.[level] || game.bots?.default;
  const rng = createRng(seedFrom(`${match.seed}:${match.seq}:${seat}`));
  const legal = legalMoves(game, match, seat);
  if (bot) return bot(game.view(match.state, seat), seat, { rng, legal, numPlayers: match.numPlayers });
  return legal.length ? rng.pick(legal) : null;
}

export { simulate } from './simulate.js';
