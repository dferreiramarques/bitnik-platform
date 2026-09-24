// Jogo mínimo usado nos testes do motor: cada jogador lança um dado
// para avançar; quem chega a 10 ganha. Tem um timer de turno.
import { defineGame } from '../../src/index.js';

export default defineGame({
  id: 'race',
  version: '0.0.1',
  players: { min: 2, max: 4 },
  i18n: {
    pt: { 'game.name': 'Corrida', 'move.ROLL': 'Lançar', 'log.ROLL': 'Saiu {n}', 'err.NOPE': 'Não' },
    en: { 'game.name': 'Race', 'move.ROLL': 'Roll', 'log.ROLL': 'Rolled {n}', 'err.NOPE': 'No' },
  },
  setup(ctx) {
    ctx.schedule('turn', 10000, 'TIMEOUT');
    return { pos: Array(ctx.numPlayers).fill(0), cur: 0, timeouts: 0 };
  },
  moves: {
    ROLL(s, p, ctx) {
      if (p.cheat) return ctx.invalid('err.NOPE');
      const n = 1 + ctx.rng.int(6);
      s.pos[s.cur] += n;
      ctx.log('log.ROLL', { n });
      s.cur = (s.cur + 1) % s.pos.length;
      ctx.schedule('turn', 10000, 'TIMEOUT');
    },
  },
  events: {
    TIMEOUT(s, p, ctx) {
      s.timeouts++;
      s.cur = (s.cur + 1) % s.pos.length;
      ctx.schedule('turn', 10000, 'TIMEOUT');
    },
  },
  activePlayers: (s) => [s.cur],
  enumerate: () => [{ type: 'ROLL' }],
  view: (s) => s,
  result(s) {
    const w = s.pos.findIndex((x) => x >= 10);
    return w < 0 ? null : { scores: s.pos, winners: [w] };
  },
});
