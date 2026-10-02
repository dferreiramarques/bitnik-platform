// Tutorial do Nine Oils (ADR-007, ADR-018): corre o motor verdadeiro no browser, com a
// mesma UI das mesas (./index.js) e a sessão e o guia de passos da plataforma
// (ctx.session, ctx.tour). Sem cópias de regras: o jogador joga um turno a sério,
// contra o bot do jogo.
//
// Para ensinar uma combinação concreta, o primeiro lançamento do jogador sai de um
// roteiro (4-4-4-2-2…) em vez do acaso: depois de a jogada ser aplicada, os dados e a
// análise (`analisar`, das próprias regras) do estado local do tutorial são substituídos.
import game from '../index.js';
import { analisar } from '../rules.js';
import * as board from './index.js';

const garrafas = (j) => j.banca.filter((x) => x === 2).length;
const ROTEIRO = [[4, 4, 4, 2, 2, 6, 1, 3, 5]]; // Triplo + Duplo, com Duplos como alternativa

export function start(el, ctx) {
  const t = (key, params) => ctx.t(key, params);
  const roteiro = ROTEIRO.map((d) => [...d]);
  let botsDone = false;
  let garrafasAdv = 0;

  const sess = ctx.session({
    game, board, el, numPlayers: 2,
    boardCtx: { gameId: 'nine-oils', lang: ctx.lang, t, seatName: (i) => (i === 0 ? t('tut.you') : t('tut.bot')) },
    setup: (s) => { s.vez = 0; s.jogadores[0].mao = ['TEMPTRESS']; s.jogadores[1].mao = []; },
    after: (seat, mv, s) => {
      if (seat === 0 && mv.type === 'LANCAR' && roteiro.length) {
        const dados = roteiro.shift();
        s.dados = dados;
        s.pendente = analisar(dados);
      }
    },
  });
  const s = () => sess.state;
  const eu = () => s().jogadores[0];

  // Dá ao jogador um Rapaz e ao adversário uma garrafa para roubar (e nenhum Valentão).
  function prepararRapaz() {
    sess.tweak((st) => {
      st.jogadores[0].mao = ['BOY'];
      st.jogadores[1].mao = [];
      const b = st.jogadores[1].banca;
      if (!b.includes(2)) { const i = b.indexOf(1); if (i >= 0) { b[i] = 2; st.jogadores[1].reserva--; } }
      garrafasAdv = garrafas(st.jogadores[1]); // dentro do tweak: o guia reavalia o passo ao redesenhar
    });
  }

  const STEPS = [
    { id: 'welcome', next: true },
    { id: 'banca', target: 'banca', next: true },
    { id: 'hand', target: 'hand', next: true },
    { id: 'roll', target: 'center', done: () => s().fase !== 'CARTAS' },
    { id: 'dice', target: 'center', next: true },
    { id: 'choose', target: 'center combos', done: () => garrafas(eu()) >= 1 },
    { id: 'result', target: 'banca', next: true },
    { id: 'bots', target: 'players', enter: () => sess.bots(() => { botsDone = true; }), done: () => botsDone },
    { id: 'boy', target: 'hand center', enter: prepararRapaz, done: () => garrafas(s().jogadores[1]) < garrafasAdv },
    { id: 'defense', target: 'hand', next: true },
    { id: 'limit', target: 'hand', next: true },
    { id: 'tips', final: true },
  ];

  sess.attach(ctx.tour({ host: el, steps: STEPS, t, players: 2 }));
  sess.push();
  return () => sess.stop();
}
