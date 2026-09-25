// Pacote mínimo usado nos testes da verificação da Forge: cada jogador
// soma 1 ou 2 à sua pontuação; ganha quem chegar primeiro a 5.
import { defineGame } from '@bitnik/engine';
import pt from './i18n/pt.js';
import en from './i18n/en.js';

export default defineGame({
  id: 'corrida-simples',
  version: '0.1.0',
  players: { min: 2, max: 3 },
  i18n: { pt, en },
  setup: (ctx) => ({ pontos: Array(ctx.numPlayers).fill(0), vez: 0 }),
  moves: {
    AVANCAR(s, { passos }, ctx) {
      if (passos !== 1 && passos !== 2) return ctx.invalid('err.PASSOS');
      s.pontos[ctx.seat] += passos;
      s.vez = (s.vez + 1) % s.pontos.length;
    },
  },
  activePlayers: (s) => [s.vez],
  enumerate: () => [{ type: 'AVANCAR', payload: { passos: 1 } }, { type: 'AVANCAR', payload: { passos: 2 } }],
  view: (s) => s,
  result(s) {
    const w = s.pontos.findIndex((p) => p >= 5);
    return w < 0 ? null : { scores: s.pontos, winners: [w] };
  },
});
