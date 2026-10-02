// Tutorial do Robot Maker (ADR-007, ADR-018): corre o motor verdadeiro no browser, com a mesma
// UI das mesas (./index.js) e a sessão e o guia de passos da plataforma (ctx.session,
// ctx.tour). Joga-se a 2, contra o bot do jogo: uma ronda completa (Forja e compra) e o início
// da seguinte. O jogador começa com 2 L1 para poder comprar logo na primeira ronda.
import game from '../index.js';
import * as board from './index.js';

export function start(el, ctx) {
  const t = (key, params) => ctx.t(key, params);
  let botsDone = false;
  let ronda0 = 1;

  const sess = ctx.session({
    game, board, el, numPlayers: 2,
    boardCtx: { gameId: 'robot-maker', lang: ctx.lang, t, seatName: (i) => (i === 0 ? t('tut.you') : t('tut.bot')) },
    setup: (s) => { s.vez = 0; s.jogadores[0].l1 = 2; },
  });
  const s = () => sess.state;

  const STEPS = [
    { id: 'welcome', next: true },
    { id: 'board', target: 'board', next: true },
    { id: 'work', target: 'board bar', done: () => s().fase !== 'trabalho' },
    { id: 'market', target: 'market bar', done: () => s().fase !== 'mercado' },
    { id: 'bots', target: 'players', enter: () => sess.bots(() => { botsDone = true; }), done: () => botsDone },
    { id: 'round2', target: 'board bar', enter: () => { ronda0 = s().rodada; }, done: () => s().rodada > ronda0 || s().fase !== 'trabalho' },
    { id: 'circuits', target: 'circuits', next: true },
    { id: 'mine', target: 'mine', next: true },
    { id: 'end', target: 'players', next: true },
    { id: 'tips', final: true },
  ];

  sess.attach(ctx.tour({ host: el, steps: STEPS, t, players: 2 }));
  sess.push();
  return () => sess.stop();
}
