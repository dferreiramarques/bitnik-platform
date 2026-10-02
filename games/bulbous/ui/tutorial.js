// Tutorial do Bulbous (ADR-007, ADR-018): corre o motor verdadeiro no browser, com a mesma
// UI das mesas (./index.js) e a sessão e o guia de passos da plataforma (ctx.session,
// ctx.tour). Joga-se a 2, contra o bot do jogo, as primeiras vazas: escolher as Baelfungious,
// declarar a sequência da ronda e apostar. A mão do jogador é a da lição (números altos nas
// suas duas cores, um ×2 e um Joker) e é ele o Governante da ronda.
import game from '../index.js';
import * as board from './index.js';

/** A mão da lição: números altos nas duas cores do jogador, um ×2 e o Joker do seu símbolo. */
function darMao(s) {
  const eu = s.jogadores[0];
  const cores = [...new Set(eu.baelfs.map((b) => b.cor))];
  const todas = [...eu.mao, ...s.jogadores[1].mao, ...s.baralho];
  const quer = [];
  cores.forEach((cor, i) => {
    for (const valor of i === 0 ? [9, 7, 5] : [9, 7, 5, 3]) quer.push(todas.find((c) => c.tipo === 'numero' && c.cor === cor && c.valor === valor));
  });
  quer.push(todas.find((c) => c.tipo === 'duplo' && c.cor === cores[0]));
  quer.push(todas.find((c) => c.tipo === 'joker' && c.simbolo === eu.simbolo));
  const ids = new Set(quer.map((c) => c.id));
  const sobras = eu.mao.filter((c) => !ids.has(c.id));
  // As cartas pedidas que estavam noutro sítio (mão do bot, baralho) trocam com as que sobram da mão do jogador.
  for (const lugar of [s.jogadores[1].mao, s.baralho]) {
    for (let i = 0; i < lugar.length; i++) if (ids.has(lugar[i].id)) lugar[i] = sobras.pop();
  }
  eu.mao = quer;
}

export function start(el, ctx) {
  const t = (key, params) => ctx.t(key, params);
  let botsDone = false;

  const sess = ctx.session({
    game, board, el, numPlayers: 2,
    boardCtx: { gameId: 'bulbous', lang: ctx.lang, t, seatName: (i) => (i === 0 ? t('tut.you') : t('tut.bot')) },
    setup: (s) => { s.governante = 0; darMao(s); },
  });
  const s = () => sess.state;
  const agiu = () => s().fase !== 'ACOES' || s().vazaNum > 0 || s().vaza?.acoes[0] != null;

  const STEPS = [
    { id: 'welcome', next: true },
    { id: 'hand', target: 'hand', next: true },
    { id: 'choose', target: 'center', enter: () => sess.bots(), done: () => s().fase !== 'ESCOLHER' },
    { id: 'sequence', target: 'center bar', done: () => s().fase !== 'SEQUENCIA' },
    { id: 'bet', target: 'hand bar', done: agiu },
    { id: 'bots', target: 'center', enter: () => sess.bots(() => { botsDone = true; }), done: () => botsDone },
    { id: 'reveal', target: 'center mine', next: true },
    { id: 'special', target: 'hand bar', next: true },
    { id: 'rounds', target: 'players', next: true },
    { id: 'score', target: 'players mine', next: true },
    { id: 'tips', final: true },
  ];

  sess.attach(ctx.tour({ host: el, steps: STEPS, t, players: 2 }));
  sess.push();
  return () => sess.stop();
}
