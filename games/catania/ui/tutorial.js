// Tutorial do Catania (ADR-007): corre o motor verdadeiro no browser, com
// os cenários do pacote e o mesmo tabuleiro das mesas (./index.js). Não há
// cópias de regras: o guia só lê o estado e os bots escolhem entre as
// jogadas legais, seguindo um guião para mostrar um tipo de jogada cada um.
import { createMatch, applyMove, viewFor, legalMoves, botMove } from '@bitnik/engine';
import game from '../index.js';
import * as board from './index.js';

const BOTS = ['Tales', 'Platão', 'Zenão'];

// Guião da última ronda: o que cada bot prefere fazer (territórios por ordem).
const PLAN = {
  1: [{ collect: [9, 4, 6, 2, 7, 5, 1, 3, 8], take2: false }, { collect: [4, 6, 9, 2, 7, 5, 1, 3, 8], take2: false }],
  2: [{ collect: [5, 10, 4, 9, 2, 7, 6, 1, 3, 8], take2: true }],
  3: [{ collect: [6, 1, 9, 5, 2, 7, 4, 3, 8], take2: false }, { found: true }],
};
const FIRE_PREF = [9, 6, 5, 2, 3, 4, 7, 8, 1, 10, 0];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function start(el, ctx) {
  const t = ctx.t;
  const seatName = (i) => (i === 0 ? t('tut.you') : BOTS[i - 1]);
  let match = null;
  let step = 0;
  let stopped = false;
  let botsDone = false; // os bots jogaram e a vez voltou ao jogador sem o jogo acabar
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(() => {
    if (stopped) return;
    try { fn(); } catch (e) { console.error('[tutorial]', e?.stack || e); }
  }, ms));

  const guide = document.createElement('div');
  guide.className = 'cat-guide';
  guide.setAttribute('role', 'region');
  guide.setAttribute('aria-live', 'polite');
  const table = document.createElement('div');
  table.className = 'game-root';
  table.dataset.game = 'catania';
  el.append(table);

  const load = (scenario) => { match = createMatch(game, { numPlayers: 4, seed: `tutorial:${scenario}`, options: { scenario } }); };
  const view = () => viewFor(game, match, 0).view;

  function push() {
    board.update({ ...viewFor(game, match, 0), seat: 0 });
    highlight();
  }

  function play(seat, mv) {
    const r = applyMove(game, match, seat, mv);
    if (!r.ok) { ctx.toast(t(r.error.code, r.error.params)); return false; }
    match = r.match;
    push();
    advance();
    return true;
  }

  board.mount(table, {
    gameId: 'catania', lang: ctx.lang, t, seatName, toast: ctx.toast,
    move: (mv) => play(0, mv),
    afterRender: () => highlight(),
  });
  table.prepend(guide); // dentro da mesa: herda a skin (tokens --cat-*) e assenta no --table-bg

  // ─── Passos ──────────────────────────────────────────────
  // `next`: botão para avançar. `done(s)`: avança sozinho quando o estado o diz.
  const STEPS = [
    { id: 'welcome', next: true },
    { id: 'players', target: 'players', next: true },
    { id: 'board', target: 'board', next: true },
    { id: 'piles', target: 'piles', next: true },
    { id: 'tower', target: 'tower', next: true },
    { id: 'me', target: 'me', next: true },
    { id: 'actions', target: 'actions', next: true },
    { id: 'jump', next: 'tut.jump.next', leave: () => { load('tutorial-meio'); push(); } },
    { id: 'collect', target: 'actions board', done: (s) => s.players[0].turn.collects > 0 },
    { id: 'fire', target: 'board', skip: (s) => !s.players[0].turn.firePending, done: (s) => !s.players[0].turn.firePending },
    { id: 'found', target: 'actions', done: (s) => s.players[0].turn.founded || s.cur !== 0 },
    { id: 'end', target: 'actions', done: (s) => s.cur !== 0 },
    { id: 'bots', target: 'players log', enter: runBots, done: () => !!match.result || botsDone },
    { id: 'score', next: true, skip: () => !match.result },
    { id: 'tips', final: true },
  ];

  function advance() {
    const s = match.state;
    let cur = STEPS[step];
    while (cur && ((cur.done && cur.done(s)) || (cur.skip && cur.skip(s)))) {
      step++;
      cur = STEPS[step];
      cur?.enter?.();
    }
    renderGuide();
    highlight();
  }

  function goNext() {
    STEPS[step].leave?.();
    step++;
    STEPS[step]?.enter?.();
    advance();
    highlight();
  }

  function scoreText() {
    const r = match.result;
    const v = view();
    const parts = v.players[0].villages.map((x) => `${x.cards}×${v.piles[x.res].value}`).join(' + ');
    const rank = 1 + r.scores.filter((sc, i) => sc > r.scores[0] || (sc === r.scores[0] && r.tiebreak[i] > r.tiebreak[0])).length;
    const ord = ctx.lang() === 'en' ? ['1st', '2nd', '3rd', '4th'][rank - 1] : rank;
    return t('tut.score.body', { parts, score: r.scores[0], rank: ord });
  }

  function renderGuide() {
    const cur = STEPS[step];
    if (!cur) return;
    const body = cur.id === 'score' ? scoreText()
      : cur.id === 'bots' && !match.result ? `${t('tut.bots.body')} ${t('tut.bots.turn', { name: seatName(match.state.cur) })}`
        : t(`tut.${cur.id}.body`);
    const nextLabel = typeof cur.next === 'string' ? t(cur.next) : t('tut.next');
    guide.innerHTML = `
      <div class="cat-guide-head"><small>${t('tut.step', { n: step + 1, total: STEPS.length })}</small>
        ${cur.final ? '' : `<button class="cat-btn" data-tut-act="exit">${t('tut.skip')}</button>`}</div>
      <h3>${esc(t(`tut.${cur.id}.title`))}</h3>
      <p>${esc(body)}</p>
      <div class="cat-mbtns">
        ${cur.next ? `<button class="cat-btn pri" data-tut-act="next">${esc(nextLabel)}</button>` : ''}
        ${cur.final ? `<button class="cat-btn" data-tut-act="exit">${t('tut.exit')}</button>
          <button class="cat-btn pri" data-tut-act="real">${t('tut.playReal')}</button>` : ''}
      </div>`;
  }

  /** Destaca as zonas do tabuleiro de que o passo fala. */
  function highlight() {
    table.querySelectorAll('.tut-hi').forEach((x) => x.classList.remove('tut-hi'));
    const targets = (STEPS[step]?.target || '').split(' ').filter(Boolean);
    for (const name of targets) table.querySelectorAll(`[data-tut="${name}"]`).forEach((x) => x.classList.add('tut-hi'));
  }

  // ─── Bots da última ronda (guião, sempre dentro das jogadas legais) ─
  function scripted(seat, plan) {
    const legal = legalMoves(game, match, seat);
    const t0 = match.state.players[seat].turn;
    if (t0.firePending) {
      const fire = legal.filter((m) => m.type === 'MOVE_FIRE');
      return FIRE_PREF.map((id) => fire.find((m) => m.payload.hex === id)).find(Boolean) || fire[0];
    }
    const next = plan.shift();
    if (!next) return legal.find((m) => m.type === 'END_TURN');
    if (next.collect) {
      const opts = legal.filter((m) => m.type === 'COLLECT' && !!m.payload.take2 === next.take2);
      return next.collect.map((id) => opts.find((m) => m.payload.hex === id)).find(Boolean) || scripted(seat, plan);
    }
    if (next.found) {
      const opts = legal.filter((m) => m.type === 'FOUND');
      // Valoriza de preferência uma pilha com disco por cima (vê-se o disco a voltar à torre).
      return opts.find((m) => match.state.piles[m.payload.raise].discs.length > 1) || opts[0] || scripted(seat, plan);
    }
    return botMove(game, match, seat);
  }

  function runBots() {
    const plans = Object.fromEntries(Object.entries(PLAN).map(([k, v]) => [k, v.slice()]));
    const tick = () => {
      if (match.result) { advance(); return; }
      const seat = match.state.cur;
      if (seat === 0) { botsDone = true; advance(); return; }
      const mv = scripted(seat, plans[seat]) || botMove(game, match, seat);
      const r = applyMove(game, match, seat, mv);
      if (r.ok) match = r.match;
      push();
      renderGuide();
      later(tick, mv?.type === 'END_TURN' ? 900 : 1300);
    };
    later(tick, 900);
  }

  guide.addEventListener('click', (e) => {
    const a = e.target.closest('[data-tut-act]')?.dataset.tutAct;
    if (a === 'next') goNext();
    else if (a === 'exit') ctx.exit();
    else if (a === 'real') ctx.playReal?.(4);
  });

  load('tutorial-inicio');
  push();
  renderGuide();
  highlight();

  return function stop() {
    stopped = true;
    timers.forEach(clearTimeout);
    board.unmount();
    el.replaceChildren();
  };
}

