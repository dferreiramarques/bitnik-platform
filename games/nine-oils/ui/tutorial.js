// Tutorial do Nine Oils (ADR-007, ADR-018): corre o motor verdadeiro no browser, com a
// mesma UI das mesas (./index.js) e o guia de passos da plataforma (ctx.tour). Sem
// cópias de regras: o jogador joga um turno a sério, contra o bot do jogo.
//
// Para ensinar uma combinação concreta, o primeiro lançamento do jogador sai de um
// roteiro (4-4-4-2-2…) em vez do acaso: depois de a jogada ser aplicada, os dados e a
// análise (`analisar`, das próprias regras) do estado local do tutorial são substituídos.
import { createMatch, applyMove, viewFor, botMove, activeSeats } from '@bitnik/engine';
import game from '../index.js';
import { analisar } from '../rules.js';
import * as board from './index.js';

const tweak = (m, fn) => { const c = structuredClone(m); fn(c.state); return c; };
const garrafas = (j) => j.banca.filter((x) => x === 2).length;
const ROTEIRO = [[4, 4, 4, 2, 2, 6, 1, 3, 5]]; // Triplo + Duplo, com Duplos como alternativa

export function start(el, ctx) {
  const t = (key, params) => ctx.t(key, params);
  const seatName = (i) => (i === 0 ? t('tut.you') : t('tut.bot'));
  const roteiro = ROTEIRO.map((d) => [...d]);
  let stopped = false;
  let botsDone = false;
  let garrafasAdv = 0;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(() => {
    if (stopped) return;
    try { fn(); } catch (e) { console.error('[tutorial]', e?.stack || e); }
  }, ms));

  let match = createMatch(game, { numPlayers: 2, seed: 'tutorial' });
  match = tweak(match, (s) => { s.vez = 0; s.jogadores[0].mao = ['TEMPTRESS']; s.jogadores[1].mao = []; });
  const s = () => match.state;
  const eu = () => s().jogadores[0];

  let tour = null;
  function push() {
    board.update({ ...viewFor(game, match, 0), seat: 0 });
    tour?.refresh();
  }

  function play(seat, mv) {
    const r = applyMove(game, match, seat, mv);
    if (!r.ok) { ctx.toast(t(r.error.code, r.error.params)); return false; }
    match = r.match;
    if (seat === 0 && mv.type === 'LANCAR' && roteiro.length) {
      const dados = roteiro.shift();
      match = tweak(match, (st) => { st.dados = dados; st.pendente = analisar(dados); });
    }
    push();
    return true;
  }

  board.mount(el, {
    gameId: 'nine-oils', lang: ctx.lang, t, seatName, toast: ctx.toast,
    move: (mv) => play(0, mv),
    announce: () => {}, // sem mensagens da mesa por cima do guia
    afterRender: () => tour?.refresh(), // a UI redesenha-se a cada clique: volta a pôr o destaque
  });

  // O adversário joga o turno dele, jogada a jogada, até a vez voltar ao jogador.
  function runBots() {
    const tick = () => {
      if (match.result || activeSeats(game, match)[0] === 0) { botsDone = true; push(); return; }
      const seat = activeSeats(game, match)[0];
      const mv = botMove(game, match, seat);
      const r = mv ? applyMove(game, match, seat, mv) : { ok: false };
      if (!r.ok) { botsDone = true; push(); return; }
      match = r.match;
      push();
      later(tick, 1100);
    };
    later(tick, 900);
  }

  // Dá ao jogador um Rapaz e ao adversário uma garrafa para roubar (e nenhum Valentão).
  function prepararRapaz() {
    match = tweak(match, (st) => {
      st.jogadores[0].mao = ['BOY'];
      st.jogadores[1].mao = [];
      const b = st.jogadores[1].banca;
      if (!b.includes(2)) { const i = b.indexOf(1); if (i >= 0) { b[i] = 2; st.jogadores[1].reserva--; } }
    });
    garrafasAdv = garrafas(s().jogadores[1]);
    board.update({ ...viewFor(game, match, 0), seat: 0 });
  }

  const STEPS = [
    { id: 'welcome', next: true },
    { id: 'banca', target: 'banca', next: true },
    { id: 'hand', target: 'hand', next: true },
    { id: 'roll', target: 'center', done: () => s().fase !== 'CARTAS' },
    { id: 'dice', target: 'center', next: true },
    { id: 'choose', target: 'center combos', done: () => garrafas(eu()) >= 1 },
    { id: 'result', target: 'banca', next: true },
    { id: 'bots', target: 'players', enter: runBots, done: () => botsDone },
    { id: 'boy', target: 'hand center', enter: prepararRapaz, done: () => garrafas(s().jogadores[1]) < garrafasAdv },
    { id: 'defense', target: 'hand', next: true },
    { id: 'limit', target: 'hand', next: true },
    { id: 'tips', final: true },
  ];

  tour = ctx.tour({ host: el, steps: STEPS, t, players: 2 });
  push();

  return function stop() {
    stopped = true;
    timers.forEach(clearTimeout);
    tour?.stop();
    board.unmount();
    el.replaceChildren();
  };
}
