import { defineGame } from '@bitnik/engine';
import pt from './i18n/pt.js';
import en from './i18n/en.js';
import { CORES, criarBaralho, baralhar, porNaMesa, resolver, pontuar, vencedores, coresDe } from './rules.js';

function log(ctx, chave, params) {
  if (ctx && typeof ctx.log === 'function') ctx.log(chave, params || {});
}

function apostou(a) {
  return a !== null && a !== undefined;
}

function terminar(state, ctx) {
  state.fase = 'FIM';
  state.apostas = Array(state.jogadores.length).fill(null);
  const scores = pontuar(state);
  const w = vencedores(scores);
  if (w.length === 1) log(ctx, 'log.FIM', { jogador: w[0] + 1 });
  else log(ctx, 'log.FIM_EMPATE', { jogadores: w.map((i) => i + 1).join(', ') });
}

export default defineGame({
  id: 'capivaras',
  version: '1.0.0',
  players: { min: 2, max: 6 },
  defaultLang: 'pt',
  i18n: { pt, en },

  setup(ctx) {
    const n = ctx.numPlayers;
    if (!Number.isInteger(n) || n < 2 || n > 6) throw new Error('capivaras: numPlayers tem de estar entre 2 e 6');
    const state = {
      fase: 'APOSTAS',
      ronda: 1,
      baralho: baralhar(criarBaralho(), ctx.rng),
      descarte: [],
      mesa: [],
      apostas: Array(n).fill(null),
      jogadores: Array.from({ length: n }, () => ({ apanhadas: [], passaros: 0 })),
      tokenPassaro: null,
      reciclagens: 0,
      revelacao: null
    };
    porNaMesa(state, n);
    return state;
  },

  moves: {
    APOSTAR(state, payload, ctx) {
      if (state.fase !== 'APOSTAS') return ctx.invalid('err.FASE_ERRADA');
      const lugar = ctx.seat;
      if (apostou(state.apostas[lugar])) return ctx.invalid('err.JA_APOSTOU');
      const letra = payload ? payload.carta : undefined;
      if (!state.mesa.some((x) => x.letra === letra)) return ctx.invalid('err.CARTA_INVALIDA');
      state.apostas[lugar] = letra;
      log(ctx, 'log.APOSTOU', { jogador: lugar + 1 });
      if (state.apostas.every(apostou)) {
        const tokenAntes = state.tokenPassaro;
        const { ganhos } = resolver(state);
        for (const x of state.mesa) {
          const w = ganhos[x.letra];
          if (w === null) {
            if (state.revelacao.apostas.some((a) => a === x.letra)) log(ctx, 'log.FUGIRAM', { carta: x.letra });
          } else {
            log(ctx, 'log.GANHOU', { jogador: w + 1, carta: x.letra });
          }
        }
        if (state.tokenPassaro !== tokenAntes && state.tokenPassaro !== null) log(ctx, 'log.TOKEN', { jogador: state.tokenPassaro + 1 });
        ctx.schedule('revelacao', 5000, 'FIM_REVELACAO');
      }
    }
  },

  events: {
    FIM_REVELACAO(state, payload, ctx) {
      if (state.fase !== 'REVELACAO') return;
      const n = state.jogadores.length;
      for (const x of state.mesa) state.descarte.push(x.carta);
      state.mesa = [];
      if (state.baralho.length < n) {
        if ((state.reciclagens || 0) < 1) {
          state.baralho = baralhar(state.descarte, ctx.rng).concat(state.baralho);
          state.descarte = [];
          state.reciclagens = 1;
          log(ctx, 'log.RECICLAGEM', {});
        } else {
          terminar(state, ctx);
          return;
        }
      }
      if (state.baralho.length < n) {
        terminar(state, ctx);
        return;
      }
      porNaMesa(state, n);
      state.apostas = Array(n).fill(null);
      state.revelacao = null;
      state.fase = 'APOSTAS';
      state.ronda = (state.ronda || 1) + 1;
    }
  },

  activePlayers(state) {
    if (state.fase !== 'APOSTAS') return [];
    const r = [];
    state.apostas.forEach((a, s) => { if (!apostou(a)) r.push(s); });
    return r;
  },

  enumerate(state, lugar) {
    if (state.fase !== 'APOSTAS') return [];
    if (apostou(state.apostas[lugar])) return [];
    return state.mesa.map((x) => ({ type: 'APOSTAR', payload: { carta: x.letra } }));
  },

  view(state, lugar) {
    const v = { ...state, baralho: [], baralhoRestante: state.baralho.length };
    // Para a UI genérica: pontos atuais e, no bloco de cada jogador, pássaros (🐦(n) se tiver) e as cores de nenúfar apanhadas.
    const pontos = pontuar(state);
    const bola = { Y: '🟡', R: '🔴', W: '⚪', B: '🔵' };
    v.players = state.jogadores.map((j, i) => ({
      score: pontos[i],
      summary: [j.passaros ? `🐦(${j.passaros})` : '', CORES.filter((c) => coresDe(j).has(c)).map((c) => bola[c]).join('')].filter(Boolean).join(' '),
    }));
    if (state.fase === 'APOSTAS') {
      v.apostas = state.apostas.map((a, s) => (s === lugar ? (apostou(a) ? a : null) : apostou(a)));
    }
    return v;
  },

  result(state) {
    if (state.fase !== 'FIM') return null;
    const scores = pontuar(state);
    return { scores, winners: vencedores(scores) };
  },

  // Rótulo das apostas na UI genérica: o que a carta vale (capivaras, pássaro, nenúfares).
  describeMove(move, view) {
    const x = view && view.mesa ? view.mesa.find((m) => m.letra === (move.payload || {}).carta) : null;
    if (move.type !== 'APOSTAR' || !x) return null;
    const cor = { Y: '🟡', R: '🔴', W: '⚪', B: '🔵' };
    const c = x.carta;
    const extra = (c.passaro ? ' 🐦' : '') + (c.nenufares.length ? ' ' + c.nenufares.map((n) => cor[n] || n).join('') : '');
    return { key: 'moveLabel.APOSTAR', params: { carta: x.letra, capivaras: c.capivaras, extra } };
  },

  bots: {
    default(view, lugar, { rng, legal }) {
      if (!legal || legal.length === 0) return null;
      const eu = view.jogadores[lugar];
      const tenho = coresDe(eu);
      const token = view.tokenPassaro;
      const avaliadas = legal.map((jogada) => {
        const x = view.mesa.find((m) => m.letra === jogada.payload.carta);
        const c = x ? x.carta : { capivaras: 0, passaro: false, nenufares: [] };
        let p = 10 * c.capivaras;
        const novas = new Set(c.nenufares.filter((cor) => CORES.includes(cor) && !tenho.has(cor)));
        p += 8 * novas.size;
        if (c.passaro) {
          if (token === null || token === undefined) p += 20;
          else if (token !== lugar && eu.passaros >= view.jogadores[token].passaros) p += 15;
          else p += 4;
        }
        p += rng.next() * 6;
        return { jogada, p };
      });
      avaliadas.sort((a, b) => b.p - a.p);
      if (avaliadas.length > 1 && rng.chance(0.25)) return avaliadas[1].jogada;
      return avaliadas[0].jogada;
    }
  }
});
