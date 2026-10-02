// Tutorial do Startup Panic (ADR-007): corre o motor verdadeiro no browser, com o
// cenário `tutorial` do pacote (baralho de CEOs fixo e o jogador a abrir) e a mesma
// UI das mesas (./index.js). Não há cópias de regras: o guia só lê o estado e o
// bot joga as jogadas legais que o próprio jogo escolheria.
import { createMatch, applyMove, viewFor, botMove, translate } from '@bitnik/engine';
import game from '../index.js';
import * as board from './index.js';

const BOT = 'Bot';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function start(el, ctx) {
  // Traduz com a plataforma e, se a chave não vier, com os textos do próprio pacote
  // (a lista de jogos guardada no browser pode ser de uma versão anterior).
  const t = (key, params) => {
    const s = ctx.t(key, params);
    return s === key ? translate(game, ctx.lang?.() || game.defaultLang || 'pt', key, params) : s;
  };
  const seatName = (i) => (i === 0 ? t('tut.you') : BOT);
  let match = null;
  let step = 0;
  let stopped = false;
  let botsDone = false; // o bot jogou e a vez voltou ao jogador
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(() => {
    if (stopped) return;
    try { fn(); } catch (e) { console.error('[tutorial]', e?.stack || e); }
  }, ms));

  const guide = document.createElement('div');
  guide.className = 'sp-guide';
  guide.setAttribute('role', 'region');
  guide.setAttribute('aria-live', 'polite');
  const table = document.createElement('div');
  table.className = 'game-root';
  table.dataset.game = 'startup-panic';
  table.classList.add('tutorial');
  el.append(table);

  const state = () => match.state;
  const eu = () => state().jogadores[0];
  const vez = () => state().ordem[state().pos];

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

  match = createMatch(game, { numPlayers: 2, seed: 'tutorial', options: { scenario: 'tutorial' } });
  board.mount(table, {
    gameId: 'startup-panic', lang: ctx.lang, t, seatName, toast: ctx.toast,
    move: (mv) => play(0, mv),
    announce: () => {}, // sem mensagens da mesa por cima do guia
    afterRender: () => { highlight(); advance(); },
  });
  table.prepend(guide); // dentro da mesa: herda a skin e assenta no --table-bg

  // ─── Passos ──────────────────────────────────────────────
  // `next`: botão para avançar. `done(s)`: avança sozinho quando o estado o diz.
  const abriuGrafico = () => !!table.querySelector('.sp-chartbox');
  const fecharGrafico = () => table.querySelector('.sp-chartbox [data-act="close"]')?.click();
  const STEPS = [
    { id: 'welcome', next: true },
    { id: 'players', target: 'players', next: true },
    { id: 'timeline', target: 'timeline', next: true },
    { id: 'ceo', target: 'top', next: true },
    { id: 'startups', target: 'startups', next: true },
    { id: 'chart', target: 'startups', next: true, done: abriuGrafico },
    { id: 'chart2', next: true, leave: fecharGrafico },
    { id: 'buy', target: 'startups', done: () => state().startups.some((su) => su.acoes[0] > 0) },
    { id: 'endmarket', target: 'bar', done: () => state().fase === 'MANUTENCAO' || vez() !== 0 },
    { id: 'hire', target: 'team', done: () => eu().trab.length > 0 || vez() !== 0 },
    { id: 'levels', target: 'team', next: true },
    { id: 'endturn', target: 'bar', done: () => vez() !== 0 || state().ronda > 1 },
    { id: 'bots', target: 'players log', enter: runBots, done: () => botsDone },
    { id: 'dividends', target: 'team', next: true },
    { id: 'gate', target: 'timeline', next: true },
    { id: 'limits', target: 'players', next: true },
    { id: 'implosion', target: 'startups', next: true },
    { id: 'salaries', target: 'team', next: true },
    { id: 'tips', final: true },
  ];

  function advance() {
    if (!STEPS[step]) return;
    let cur = STEPS[step];
    while (cur && ((cur.done && cur.done()) || (cur.skip && cur.skip()))) {
      cur.leave?.();
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
  }

  function renderGuide() {
    const cur = STEPS[step];
    if (!cur) return;
    const extra = cur.id === 'bots' ? ` ${t('tut.bots.turn', { name: seatName(vez()) })}` : '';
    guide.innerHTML = `
      <div class="sp-guide-head"><small>${esc(t('tut.step', { n: step + 1, total: STEPS.length }))}</small>
        ${cur.final ? '' : `<button class="sp-btn" type="button" data-tut-act="exit">${esc(t('tut.skip'))}</button>`}</div>
      <h3>${esc(t(`tut.${cur.id}.title`))}</h3>
      <p>${esc(t(`tut.${cur.id}.body`))}${esc(extra)}</p>
      <div class="sp-guide-btns">
        ${cur.next ? `<button class="sp-btn primary" type="button" data-tut-act="next">${esc(t('tut.next'))}</button>` : ''}
        ${cur.final ? `<button class="sp-btn" type="button" data-tut-act="exit">${esc(t('tut.exit'))}</button>
          <button class="sp-btn primary" type="button" data-tut-act="real">${esc(t('tut.playReal'))}</button>` : ''}
      </div>`;
    table.style.setProperty('--sp-guide-h', `${guide.offsetHeight}px`); // a mesa deixa espaço ao guia
  }

  /** Destaca as zonas da mesa de que o passo fala e, ao mudar de passo, leva a primeira à vista. */
  let vistoNoPasso = -1;
  function highlight() {
    table.querySelectorAll('.tut-hi').forEach((x) => x.classList.remove('tut-hi'));
    const targets = (STEPS[step]?.target || '').split(' ').filter(Boolean);
    for (const name of targets) table.querySelectorAll(`[data-tut="${name}"]`).forEach((x) => x.classList.add('tut-hi'));
    if (vistoNoPasso !== step) {
      const primeiro = table.querySelector('.tut-hi');
      if (primeiro) { vistoNoPasso = step; primeiro.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }
    }
  }

  // ─── O bot joga o resto da ronda ─────────────────────────
  function runBots() {
    const tick = () => {
      if (match.result) { botsDone = true; advance(); return; }
      const seat = vez();
      if (seat === 0) { botsDone = true; advance(); return; }
      const mv = botMove(game, match, seat);
      const r = mv ? applyMove(game, match, seat, mv) : { ok: false };
      if (r.ok) match = r.match;
      push();
      renderGuide();
      if (!r.ok) { botsDone = true; advance(); return; }
      later(tick, mv.type === 'SP_END_TURN' ? 900 : 1100);
    };
    later(tick, 900);
  }

  guide.addEventListener('click', (e) => {
    const a = e.target.closest('[data-tut-act]')?.dataset.tutAct;
    if (a === 'next') goNext();
    else if (a === 'exit') ctx.exit();
    else if (a === 'real') ctx.playReal?.(2);
  });

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
