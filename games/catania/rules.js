// Catania — regras puras no contrato @bitnik/engine.
// Fonte: catania-v2/server.js (catHandle, catEndGame) e REGRAS.md.
import { RESOURCES, BLACK_DISCS, RED_DISCS, RED, buildIsland } from './board.js';
import { SCENARIOS } from './scenarios.js';

const top = (pile) => pile.discs[pile.discs.length - 1];
const handTotal = (p) => RESOURCES.reduce((s, r) => s + p.hand[r], 0);
const freshTurn = () => ({ collects: 0, founded: false, firePending: false, visited: [] });

/**
 * Abertura (4.0.0): no primeiro turno do jogo, a 2.ª recolha do 1.º jogador
 * só pode ser de 1 carta. Reduz a vantagem do 1.º lugar (simulação com 10 000
 * partidas: 2j 50,5/49,5; 3j 34,7/32,3/33,0; 4j 25,9/25,3/23,4/25,5).
 */
const openingLimit = (s, seat, t) => s.round === 1 && seat === 0 && t.collects >= 1;

export function setup(ctx) {
  // Cenário fixo (tutorial, pré-visualização, testes): ADR-007.
  const scenario = ctx.options?.scenario;
  if (scenario) {
    const sc = SCENARIOS[scenario];
    if (!sc) throw new Error(`cenário desconhecido: ${scenario}`);
    if (sc.players !== ctx.numPlayers) throw new Error(`o cenário ${scenario} é para ${sc.players} jogadores`);
    return sc.setup(ctx);
  }
  const n = ctx.numPlayers;
  const tower = [...BLACK_DISCS, ...RED_DISCS].sort((a, b) => a - b);
  const hexes = buildIsland(n, ctx.rng);
  const drawn = ctx.rng.shuffle([tower.pop(), tower.pop(), tower.pop(), tower.pop(), tower.pop()]);
  const piles = Object.fromEntries(RESOURCES.map((r, i) => [r, { discs: [drawn[i]], collected: 0 }]));
  const zero = () => Object.fromEntries(RESOURCES.map((r) => [r, 0]));
  return {
    hexes, tower, piles,
    fire: 0, // o Fogo do Etna começa no vulcão (id 0)
    players: Array.from({ length: n }, () => ({ hand: zero(), collected: zero(), villages: [], turn: freshTurn() })),
    cur: 0,
    round: 1,
    phase: 'PLAY', // PLAY → LAST_ROUND → OVER
    trigger: null,
  };
}

/** Vizinhos vazios do fogo (sem trabalhadores de ninguém). */
export const fireTargets = (s) => s.hexes[s.fire].adj.filter((id) => s.hexes[id].workers.length === 0);

function canCollectAt(s, seat, hex) {
  return hex && hex.type !== 'vulcao' && s.fire !== hex.id
    && !hex.workers.some((w) => w !== seat)
    && !s.players[seat].turn.visited.includes(hex.id);
}

function endGame(s) {
  s.phase = 'OVER';
}

export const moves = {
  COLLECT(s, { hex: hexId, take2 = false }, ctx) {
    const p = s.players[ctx.seat];
    const t = p.turn;
    if (t.firePending) return ctx.invalid('err.FIRE_FIRST');
    if (t.founded) return ctx.invalid('err.FOUNDED_LAST');
    if (t.collects >= 2) return ctx.invalid('err.TWO_COLLECTS');
    const hex = s.hexes[hexId];
    if (!hex || hex.type === 'vulcao') return ctx.invalid('err.BAD_HEX');
    if (s.fire === hex.id) return ctx.invalid('err.FIRE_BLOCKS');
    if (hex.workers.some((w) => w !== ctx.seat)) return ctx.invalid('err.OCCUPIED');
    if (t.visited.includes(hex.id)) return ctx.invalid('err.SAME_HEX');
    if (take2 && !s.tower.length) return ctx.invalid('err.TOWER_EMPTY');
    if (take2 && openingLimit(s, ctx.seat, t)) return ctx.invalid('err.OPENING_TAKE2');

    if (!hex.workers.includes(ctx.seat)) hex.workers.push(ctx.seat);
    t.visited.push(hex.id);
    t.collects++;
    const r = hex.type;
    const amt = take2 ? 2 : 1;
    p.hand[r] += amt;
    p.collected[r] += amt;
    s.piles[r].collected += amt;
    if (!take2) {
      ctx.log('log.COLLECT_1', { res: `@res.${r}` });
      return;
    }
    const disc = s.tower.pop();
    s.piles[r].discs.push(disc);
    // A pilha fica em sequência: o mais alto em baixo, o mais baixo em cima.
    s.piles[r].discs.sort((a, b) => b - a);
    ctx.log(RED.has(disc) ? 'log.COLLECT_2_RED' : 'log.COLLECT_2', { res: `@res.${r}`, disc });
    if (RED.has(disc)) t.firePending = true;
  },

  MOVE_FIRE(s, { hex: hexId, stay = false }, ctx) {
    const t = s.players[ctx.seat].turn;
    if (!t.firePending) return ctx.invalid('err.NO_ERUPTION');
    const targets = fireTargets(s);
    if (stay) {
      // Só pode ficar se não houver nenhum vizinho vazio.
      if (targets.length) return ctx.invalid('err.FIRE_MUST_MOVE');
      t.firePending = false;
      ctx.log('log.FIRE_STAYS');
      return;
    }
    if (!s.hexes[s.fire].adj.includes(hexId)) return ctx.invalid('err.NOT_ADJACENT');
    if (!targets.includes(hexId)) return ctx.invalid('err.FIRE_NOT_EMPTY');
    s.fire = hexId;
    t.firePending = false;
    ctx.log('log.FIRE_MOVES');
  },

  FOUND(s, { keep, raise }, ctx) {
    const p = s.players[ctx.seat];
    const t = p.turn;
    if (t.firePending) return ctx.invalid('err.FIRE_FIRST');
    if (t.founded) return ctx.invalid('err.ALREADY_FOUNDED');
    const types = RESOURCES.filter((r) => p.hand[r] > 0);
    if (handTotal(p) < 5) return ctx.invalid('err.NEED_5');
    if (types.length < 2) return ctx.invalid('err.NEED_2_TYPES');
    const max = Math.max(...types.map((r) => p.hand[r]));
    if (!keep || p.hand[keep] !== max) return ctx.invalid('err.KEEP_MAJORITY');
    if (!raise || raise === keep || !(p.hand[raise] > 0)) return ctx.invalid('err.RAISE_MINORITY');

    const cards = p.hand[keep];
    for (const r of RESOURCES) p.hand[r] = 0; // usa a mão toda
    const pile = s.piles[raise];
    if (pile.discs.length > 1) {
      s.tower.push(pile.discs.pop());
      s.tower.sort((a, b) => a - b);
    }
    p.villages.push({ res: keep, cards });
    t.founded = true;
    ctx.log('log.FOUND', { res: `@res.${keep}`, cards, raised: `@res.${raise}` });
    if (p.villages.length >= 3 && s.phase === 'PLAY') {
      s.phase = 'LAST_ROUND';
      s.trigger = ctx.seat;
      ctx.log('log.LAST_ROUND');
    }
  },

  END_TURN(s, _p, ctx) {
    if (s.players[ctx.seat].turn.firePending) return ctx.invalid('err.FIRE_FIRST');
    const next = (ctx.seat + 1) % s.players.length;
    // Ronda completa (3.0.0): a última ronda acaba no último lugar,
    // para todos fazerem o mesmo número de turnos.
    if (s.phase === 'LAST_ROUND' && next === 0) {
      endGame(s);
      ctx.log('log.GAME_OVER');
      return;
    }
    s.cur = next;
    if (next === 0) s.round++;
    for (const h of s.hexes) h.workers = h.workers.filter((w) => w !== next); // os trabalhadores voltam
    s.players[next].turn = freshTurn();
  },
};

export const activePlayers = (s) => (s.phase === 'OVER' ? [] : [s.cur]);

export function score(s, seat) {
  return s.players[seat].villages.reduce((sum, v) => sum + v.cards * top(s.piles[v.res]), 0);
}

export function result(s) {
  if (s.phase !== 'OVER') return null;
  const scores = s.players.map((_, i) => score(s, i));
  const hands = s.players.map(handTotal);
  const best = Math.max(...scores);
  const bestHand = Math.max(...hands.filter((_, i) => scores[i] === best));
  // Desempate: mais cartas na mão; se persistir, partilham a vitória.
  const winners = scores.map((_, i) => i).filter((i) => scores[i] === best && hands[i] === bestHand);
  return { scores, winners, tiebreak: hands };
}

/** Jogadas legais do lugar ativo (alimenta a UI genérica, os bots e a simulação). */
export function enumerate(s, seat) {
  const p = s.players[seat];
  const t = p.turn;
  if (t.firePending) {
    const targets = fireTargets(s);
    return targets.length
      ? targets.map((hex) => ({ type: 'MOVE_FIRE', payload: { hex } }))
      : [{ type: 'MOVE_FIRE', payload: { stay: true } }];
  }
  const out = [];
  if (!t.founded && t.collects < 2) {
    for (const h of s.hexes) {
      if (!canCollectAt(s, seat, h)) continue;
      out.push({ type: 'COLLECT', payload: { hex: h.id, take2: false } });
      if (s.tower.length && !openingLimit(s, seat, t)) out.push({ type: 'COLLECT', payload: { hex: h.id, take2: true } });
    }
  }
  if (!t.founded) {
    const types = RESOURCES.filter((r) => p.hand[r] > 0);
    if (handTotal(p) >= 5 && types.length >= 2) {
      const max = Math.max(...types.map((r) => p.hand[r]));
      for (const keep of types.filter((r) => p.hand[r] === max)) {
        for (const raise of types.filter((r) => r !== keep)) out.push({ type: 'FOUND', payload: { keep, raise } });
      }
    }
  }
  out.push({ type: 'END_TURN', payload: {} });
  return out;
}

/** O que cada lugar vê. As mãos são informação aberta, como no catania-v2. */
export function view(s, seat) {
  return {
    phase: s.phase,
    round: s.round,
    cur: s.cur,
    me: seat,
    fire: s.fire,
    fireTargets: fireTargets(s),
    tower: s.tower.length,
    towerTop: s.tower.at(-1) ?? null,
    piles: Object.fromEntries(RESOURCES.map((r) => [r, { value: top(s.piles[r]), discs: s.piles[r].discs }])),
    hexes: s.hexes.map(({ id, type, px, workers, adj }) => ({ id, type, px, workers, adj })),
    players: s.players.map((p, i) => ({
      hand: p.hand,
      handTotal: handTotal(p),
      villages: p.villages,
      score: score(s, i),
      turn: i === seat ? p.turn : undefined,
    })),
  };
}
