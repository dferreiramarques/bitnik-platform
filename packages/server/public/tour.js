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
