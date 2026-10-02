// Tutorial da Praia das Percebes (ADR-007, ADR-018): corre o motor verdadeiro no browser,
// com a mesma UI das mesas (./index.js) e a sessão e o guia de passos da plataforma
// (ctx.session, ctx.tour). O jogador coloca peças a sério contra o bot do jogo; só a
// peça de cada lição é escolhida (a 1.ª, de 2 banhistas; depois uma prancha).
import game from '../index.js';
import * as board from './index.js';

export function start(el, ctx) {
  const t = (key, params) => ctx.t(key, params);
  let botsDone = false;
  let pecasAntes = 0;

  const sess = ctx.session({
    game, board, el, numPlayers: 2,
    boardCtx: { gameId: 'praia-das-percebes', lang: ctx.lang, t, seatName: (i) => (i === 0 ? t('tut.you') : t('tut.bot')) },
    setup: (s) => { s.vez = 0; s.peca = { id: 900, banhistas: 2, tipo: 'normal' }; },
  });
  const s = () => sess.state;
  const pecas = () => Object.keys(s().tabuleiro).length;

  // A peça da lição seguinte: uma prancha, que dobra os pontos do troço que vigiam.
  function darPrancha() {
    pecasAntes = pecas(); // antes do tweak: ele redesenha e o guia reavalia o passo
    sess.tweak((st) => { if (st.fase === 'COLOCAR' && st.vez === 0) st.peca = { id: 901, banhistas: 1, tipo: 'prancha' }; });
  }

  const STEPS = [
    { id: 'welcome', next: true },
    { id: 'piece', target: 'piece', next: true },
    { id: 'place', target: 'board', done: () => pecas() >= 2 },
    { id: 'lifeguard', target: 'bar', done: () => s().salvaVidas.some((g) => g.jogador === 0) || s().vez !== 0 },
    { id: 'bots', target: 'players', enter: () => sess.bots(() => { botsDone = true; }), done: () => botsDone },
    { id: 'surf', target: 'piece board', enter: darPrancha, done: () => pecas() > pecasAntes },
    { id: 'special', target: 'board', next: true },
    { id: 'score', target: 'players', next: true },
    { id: 'objectives', target: 'objectives', next: true },
    { id: 'end', target: 'players', next: true },
    { id: 'tips', final: true },
  ];

  sess.attach(ctx.tour({ host: el, steps: STEPS, t, players: 2 }));
  sess.push();
  return () => sess.stop();
}
