// Tutorial das Capivaras (ADR-007, ADR-018): corre o motor verdadeiro no browser, com a
// mesma UI das mesas (./index.js) e a sessão e o guia de passos da plataforma
// (ctx.session, ctx.tour). Joga-se uma ronda a sério contra dois bots; a mesa dessa ronda
// é a da lição e os dois bots já apostaram na carta A (por isso ela "foge" a toda a gente).
// A revelação espera pelo guia (hold): a ronda seguinte só começa no último passo.
import game from '../index.js';
import * as board from './index.js';

const MESA = [
  { letra: 'A', carta: { id: 't1', capivaras: 5, passaro: true, nenufares: [] } },
  { letra: 'B', carta: { id: 't2', capivaras: 3, passaro: false, nenufares: ['Y'] } },
  { letra: 'C', carta: { id: 't3', capivaras: 2, passaro: true, nenufares: ['R'] } },
];

export function start(el, ctx) {
  const t = (key, params) => ctx.t(key, params);
  let tour = null;

  const sess = ctx.session({
    game, board, el, numPlayers: 3,
    boardCtx: { gameId: 'capivaras', lang: ctx.lang, t, seatName: (i) => (i === 0 ? t('tut.you') : `${t('tut.bot')} ${i}`) },
    setup: (s) => { s.mesa = structuredClone(MESA); s.apostas = [null, 'A', 'A']; },
    hold: () => !!tour && tour.step < STEPS.length - 1,
  });
  const s = () => sess.state;
  const apostou = () => s().fase !== 'APOSTAS' || s().apostas[0] != null;
  // O que aconteceu à aposta do jogador, para o passo da revelação.
  const resultado = () => {
    const r = s().revelacao;
    if (!r) return '';
    const letra = r.apostas[0];
    return t(r.ganhos[letra] === 0 ? 'tut.reveal.won' : 'tut.reveal.lost', { carta: letra });
  };

  const STEPS = [
    { id: 'welcome', next: true },
    { id: 'table', target: 'table', next: true },
    { id: 'bet', target: 'table bar', done: apostou },
    { id: 'reveal', target: 'table', next: true },
    { id: 'score', target: 'players', next: true },
    { id: 'lilies', target: 'me', next: true },
    { id: 'bird', target: 'chips', next: true },
    { id: 'deck', target: 'chips', next: true },
    { id: 'tips', final: true },
  ];

  tour = ctx.tour({ host: el, steps: STEPS, t, players: 3, extra: (cur) => (cur.id === 'reveal' ? resultado() : '') });
  sess.attach(tour);
  sess.push();
  return () => sess.stop();
}
