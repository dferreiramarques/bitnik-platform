// Guia de tutorial partilhado pelos jogos (ADR-007, ADR-018): um cartão com o passo
// atual, destaque das zonas de que o passo fala e botões Seguinte/Sair. Os pacotes
// não importam isto (só podem importar o motor): recebem-no por `ctx.tour(...)`.
//
// Um passo:
//   id      texto: t(`tut.${id}.title`) e t(`tut.${id}.body`), nas duas línguas do jogo
//   target  zonas a destacar: nomes de [data-tut="..."] da UI do jogo, separados por espaço
//   next    mostra o botão "Seguinte"
//   done    () => boolean: avança sozinho quando o estado do jogo o diz
//   skip    () => boolean: salta o passo se já não faz sentido
//   enter / leave   chamados ao entrar / sair do passo (ex.: pôr os bots a jogar)
//   final   último passo: "Sair" e "Jogar a sério" em vez de "Seguinte"

import { createMatch, applyMove, fireTimer, viewFor, botMove, activeSeats } from '/engine/index.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * @param {object} o
 * @param {HTMLElement} o.host    onde o cartão se põe (a área do tutorial)
 * @param {Array} o.steps
 * @param {(key: string, params?: object) => string} o.t    textos do jogo
 * @param {(key: string, params?: object) => string} o.ui   textos da plataforma (tour.*)
 * @param {() => void} o.exit
 * @param {(n: number) => void} [o.playReal]  começa uma mesa a sério com n lugares
 * @param {number} [o.players]    lugares da mesa a sério (por omissão, 2)
 * @param {(step: object) => string} [o.extra]  texto a acrescentar ao corpo do passo
 */
export function createTour({ host, steps, t, ui, exit, playReal, players = 2, extra = () => '' }) {
  const guide = document.createElement('div');
  guide.className = 'tour-guide';
  guide.setAttribute('role', 'region');
  guide.setAttribute('aria-live', 'polite');
  host.append(guide);
  let step = 0;
  let vistoNoPasso = -1;

  function highlight() {
    host.querySelectorAll('.tour-hi').forEach((x) => x.classList.remove('tour-hi'));
    const names = (steps[step]?.target || '').split(' ').filter(Boolean);
    for (const name of names) host.querySelectorAll(`[data-tut="${name}"]`).forEach((x) => x.classList.add('tour-hi'));
    // O cartão fica na metade do ecrã oposta à da primeira zona destacada, para não a tapar.
    const first = host.querySelector('.tour-hi');
    const box = host.getBoundingClientRect();
    const r = first?.getBoundingClientRect();
    // Sem zona destacada, o cartão fica ao meio (a mesa costuma estar vazia aí).
    guide.dataset.pos = !r || !box.height ? 'mid' : r.top + r.height / 2 - box.top > box.height * 0.45 ? 'top' : 'bottom';
    if (first && vistoNoPasso !== step) { vistoNoPasso = step; first.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }
  }

  function render() {
    const cur = steps[step];
    if (!cur) return;
    const body = `${t(`tut.${cur.id}.body`)}${extra(cur) ? ` ${extra(cur)}` : ''}`;
    guide.innerHTML = `
      <div class="tour-head"><small>${esc(ui('tour.step', { n: step + 1, total: steps.length }))}</small>
        ${cur.final ? '' : `<button class="tour-btn" type="button" data-tour="exit">${esc(ui('tour.skip'))}</button>`}</div>
      <h3>${esc(t(`tut.${cur.id}.title`))}</h3>
      <p>${esc(body)}</p>
      ${cur.done && !cur.next && !cur.final ? `<p class="tour-wait">${esc(ui('tour.act'))}</p>` : ''}
      <div class="tour-btns">
        ${cur.next ? `<button class="tour-btn primary" type="button" data-tour="next">${esc(ui('tour.next'))}</button>` : ''}
        ${cur.final ? `<button class="tour-btn" type="button" data-tour="exit">${esc(ui('tour.exit'))}</button>
          ${playReal ? `<button class="tour-btn primary" type="button" data-tour="real">${esc(ui('tour.playReal'))}</button>` : ''}` : ''}
      </div>`;
  }

  /** Reavalia o passo (o jogo mudou): avança os que já estão feitos e redesenha. */
  function refresh() {
    let cur = steps[step];
    while (cur && ((cur.done && cur.done()) || (cur.skip && cur.skip()))) {
      cur.leave?.();
      step++;
      cur = steps[step];
      cur?.enter?.();
    }
    render();
    highlight();
  }

  function goNext() {
    steps[step]?.leave?.();
    step++;
    steps[step]?.enter?.();
    refresh();
  }

  guide.addEventListener('click', (e) => {
    const a = e.target.closest('[data-tour]')?.dataset.tour;
    if (a === 'next') goNext();
    else if (a === 'exit') exit();
    else if (a === 'real') playReal?.(players);
  });

  steps[0]?.enter?.();
  refresh();

  return {
    refresh,
    get step() { return step; },
    stop() { guide.remove(); host.querySelectorAll('.tour-hi').forEach((x) => x.classList.remove('tour-hi')); },
  };
}

/**
 * A partida local do tutorial: o motor verdadeiro no browser, o jogador no lugar 0 e o
 * bot do jogo nos outros. O pacote dá os passos e, se quiser ensinar uma situação
 * concreta, um `setup` (muda o estado inicial) e um `after` (muda o estado depois de
 * uma jogada). Entregue ao pacote por `ctx.session(...)`.
 *
 * @param {object} o
 * @param {object} o.game      o pacote do jogo
 * @param {object} o.board     a UI do jogo (mount/update/unmount)
 * @param {HTMLElement} o.el
 * @param {object} o.boardCtx  o ctx da UI do jogo (gameId, lang, t, seatName, toast, announce, …)
 * @param {number} [o.numPlayers]
 * @param {string} [o.seed]
 * @param {object} [o.options]  opções do match (ex.: { scenario })
 * @param {(state: object) => void} [o.setup]
 * @param {(seat: number, move: object, state: object) => void} [o.after]
 * @param {number} [o.botMs]    pausa entre jogadas do bot
 * @param {() => boolean} [o.hold]  enquanto for verdade, os timers do jogo esperam (ex.: a revelação de uma ronda, até o guia a explicar)
 * @param {number} [o.timerMs]  tempo máximo de um timer do jogo (por omissão, 3500 ms)
 */
export function createSession({ game, board, el, boardCtx, numPlayers = 2, seed = 'tutorial', options, setup, after, botMs = 1100, hold, timerMs = 3500 }) {
  const tweakMatch = (m, fn) => { const c = structuredClone(m); fn(c.state); return c; };
  let match = createMatch(game, { numPlayers, seed, ...(options ? { options } : {}) });
  if (setup) match = tweakMatch(match, setup);
  let stopped = false;
  let tour = null;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(() => {
    if (stopped) return;
    try { fn(); } catch (e) { console.error('[tutorial]', e?.stack || e); }
  }, ms));

  // Os timers declarativos do jogo (ctx.schedule) correm aqui, como no servidor.
  const agendados = new Set();
  function syncTimers() {
    for (const tm of match.timers || []) {
      const id = `${tm.key}:${tm.seq}`;
      if (agendados.has(id)) continue;
      agendados.add(id);
      const fire = () => {
        if (hold?.()) { later(fire, 400); return; }
        const r = fireTimer(game, match, tm.key);
        if (r.ok) { match = r.match; api.push(); }
      };
      later(fire, Math.min(tm.delayMs, timerMs));
    }
  }

  const api = {
    get match() { return match; },
    get state() { return match.state; },
    /** Liga o guia: passa a redesenhar-se a cada mudança do jogo. */
    attach(t) { tour = t; },
    /** Muda o estado local (cenário do passo) e redesenha. */
    tweak(fn) { match = tweakMatch(match, fn); api.push(); },
    push() {
      board.update({ ...viewFor(game, match, 0), seat: 0 });
      syncTimers();
      tour?.refresh();
    },
    play(seat, mv) {
      const r = applyMove(game, match, seat, mv);
      if (!r.ok) { boardCtx.toast?.(boardCtx.t(r.error.code, r.error.params)); return false; }
      match = r.match;
      if (after) match = tweakMatch(match, (st) => after(seat, mv, st));
      api.push();
      return true;
    },
    /** Os bots jogam, jogada a jogada, até não haver bots a quem caiba jogar (a vez voltou ao jogador, ou o jogo acabou); depois `done()`. */
    bots(done) {
      const tick = () => {
        const seat = match.result ? undefined : activeSeats(game, match).find((x) => x !== 0);
        if (seat === undefined) { done?.(); api.push(); return; }
        const mv = botMove(game, match, seat);
        const r = mv ? applyMove(game, match, seat, mv) : { ok: false };
        if (!r.ok) { done?.(); api.push(); return; }
        match = r.match;
        api.push();
        later(tick, botMs);
      };
      later(tick, 900);
    },
    later,
    stop() {
      stopped = true;
      timers.forEach(clearTimeout);
      tour?.stop();
      board.unmount();
      el.replaceChildren();
    },
  };

  board.mount(el, { ...boardCtx, announce: () => {}, move: (mv) => api.play(0, mv), afterRender: () => tour?.refresh() });
  return api;
}
