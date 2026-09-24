// Bot do Catania, portado de catBot (catania-v2) com RNG determinístico.
import { RESOURCES } from './board.js';
import { fireTargets } from './rules.js';

const topOf = (s, r) => s.piles[r].discs[s.piles[r].discs.length - 1];

export function defaultBot(s, seat, { rng }) {
  const p = s.players[seat];
  const t = p.turn;

  if (t.firePending) {
    const free = fireTargets(s);
    return free.length
      ? { type: 'MOVE_FIRE', payload: { hex: rng.pick(free) } }
      : { type: 'MOVE_FIRE', payload: { stay: true } };
  }

  if (!t.founded && (t.collects < 1 || (t.collects < 2 && rng.chance(0.6)))) {
    const avail = s.hexes.filter((h) => h.type !== 'vulcao' && s.fire !== h.id
      && !h.workers.some((w) => w !== seat) && !t.visited.includes(h.id));
    if (avail.length) {
      // Prefere o recurso mais barato (valor atual mais baixo).
      avail.sort((a, b) => topOf(s, a.type) - topOf(s, b.type));
      return { type: 'COLLECT', payload: { hex: avail[0].id, take2: s.tower.length > 2 && rng.chance(0.38) } };
    }
  }

  if (!t.founded) {
    const types = RESOURCES.filter((r) => p.hand[r] > 0);
    const total = types.reduce((sum, r) => sum + p.hand[r], 0);
    if (types.length >= 2 && total >= 5 && rng.chance(0.55)) {
      const sorted = types.slice().sort((a, b) => p.hand[b] - p.hand[a]);
      const keep = sorted[0];
      // Valoriza a minoria com o valor mais baixo (maior ganho).
      const raise = sorted.slice(1).sort((a, b) => topOf(s, a) - topOf(s, b))[0];
      return { type: 'FOUND', payload: { keep, raise } };
    }
  }

  return { type: 'END_TURN', payload: {} };
}
