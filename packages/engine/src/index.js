// @bitnik/engine — motor de jogos por turnos.
//
// Um jogo é um objeto (ver docs/CONTRATO.md) com regras puras:
// sem rede, sem relógio, sem Math.random. O motor trata da seed,
// do registo de jogadas, dos timers declarativos e do replay.
// O match resultante é JSON puro: pode ser guardado e retomado.

import { createRng, seedFrom } from './rng.js';
import { translate, i18nGaps, ENGINE_I18N } from './i18n.js';

export { createRng, seedFrom, translate, i18nGaps, ENGINE_I18N };

export const ENGINE_VERSION = '0.1.0';
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
  const { min, max } = game.players;
  if (!(numPlayers >= min && numPlayers <= max)) {
    throw new Error(`${game.id}: ${numPlayers} jogadores fora de [${min}, ${max}]`);
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

/** Refaz um match a partir da seed e das jogadas. Útil para testes e bugs. */
export function replay(game, { seed, numPlayers, options, moves }) {
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

/** O que um lugar (ou espectador, seat=null) pode ver. */
export function viewFor(game, match, seat) {
  return {
    gameId: match.gameId,
    seq: match.seq,
    view: game.view(match.state, seat),
    active: activeSeats(game, match),
    legal: seat == null ? [] : legalMoves(game, match, seat),
    log: match.log.slice(-40),
    result: match.result,
  };
}

/** Escolhe a jogada de um bot. O RNG deriva da seed e do seq: determinístico. */
export function botMove(game, match, seat, level = 'default') {
  const bot = game.bots?.[level] || game.bots?.default;
  const rng = createRng(seedFrom(`${match.seed}:${match.seq}:${seat}`));
  if (bot) return bot(match.state, seat, { rng, numPlayers: match.numPlayers });
  const legal = legalMoves(game, match, seat);
  return legal.length ? rng.pick(legal) : null;
}

export { simulate } from './simulate.js';
