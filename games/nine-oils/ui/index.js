// Nine Oils — UI própria (ADR-006, ADR-014), no template vanilla: mostra a
// clientes o aspeto de base da plataforma, por isso não define tokens
// próprios (usa só os --game-* do skin.json, cópia do vanilla). Não repete
// regras: cada clique corresponde sempre a uma jogada de `msg.legal`.
//
// Disposição: os dois jogadores em vidro no topo (banca de 6 casas, reserva,
// mão do adversário), o centro com os dados e a jogada pendente, o registo e
// a minha mão em baixo, e a barra de jogadas.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const EMOJI = { TEMPTRESS: '❤️‍🔥', BOY: '👦🏽', BULLY: '💪🏼' };
const asset = (rel) => new URL(rel, import.meta.url).href;
const CARD_ART = { TEMPTRESS: asset('./cartas/temptress.jpg'), BOY: asset('./cartas/boy.jpg'), BULLY: asset('./cartas/bully.jpg') };
/** Padrão de pintas de um dado a 6 faces, numa grelha 3×3 (índices 0-8). */
const DOTS = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const dieFace = (d) => `<i class="nof-die"><span class="nof-die-grid">${Array.from({ length: 9 }, (_, i) => `<i${(DOTS[d] || []).includes(i) ? ' class="on"' : ''}></i>`).join('')}</span></i>`;

function ensureCss() {
  const href = new URL('./nine-oils.css', import.meta.url).href;
  if ([...document.styleSheets].some((s) => s.href === href) || document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

let root = null;
let view = null;
let ctx = null;
let msg = null;
const fresh = () => ({ logOpen: true, lastLogSeq: 0, cardInfo: null, pauseTimer: null });
let ui = fresh();

function onKeydown(e) {
  if (e.key === 'Escape' && ui.cardInfo) { ui.cardInfo = null; render(); }
}

/** Uma <img data-fallback="TIPO"> que falhe a carregar vira o emoji da carta. */
function onImgError(e) {
  const img = e.target;
  if (img.tagName !== 'IMG' || !img.dataset.fallback) return;
  img.replaceWith(Object.assign(document.createElement('span'), { className: 'nof-emoji-fallback', textContent: EMOJI[img.dataset.fallback] ?? '' }));
}

export function mount(el, context) {
  ctx = context;
  ensureCss();
  root = document.createElement('div');
  root.className = 'nof';
  view = document.createElement('div');
  view.className = 'nof-layout';
  root.append(view);
  el.append(root);
  root.addEventListener('click', onClick);
  root.addEventListener('error', onImgError, true);
  document.addEventListener('keydown', onKeydown);
}

export function unmount() {
  document.removeEventListener('keydown', onKeydown);
  clearTimeout(ui.pauseTimer);
  root?.remove();
  root = null; view = null; msg = null;
  ui = fresh();
}

export function update(next) {
  msg = next;
  for (const l of msg.log || []) {
    if (l.announce == null || (l.seq ?? 0) <= ui.lastLogSeq) continue;
    ctx.announce(ctx.t(l.announce.key, l.announce.params), '', l.announce.variant);
  }
  ui.lastLogSeq = Math.max(ui.lastLogSeq, ...(msg.log || []).map((l) => l.seq ?? 0));
  render();
  autoContinue();
}

/** A pausa depois de lançar é só para os dois verem os dados; a plataforma
 * continua sozinha (sem clique) passado um instante, em vez de um botão. */
function autoContinue() {
  const mv = (msg.legal || []).find((m) => m.type === 'CONTINUAR');
  if (msg.view.fase !== 'PAUSA' || !mv) { clearTimeout(ui.pauseTimer); ui.pauseTimer = null; return; }
  if (ui.pauseTimer) return;
  ui.pauseTimer = setTimeout(() => { ui.pauseTimer = null; ctx.move({ type: mv.type, payload: mv.payload }); }, 1100);
}

const mySeat = () => (msg && Number.isInteger(msg.seat) ? msg.seat : null);

function onClick(e) {
  const discard = e.target.closest('[data-discard]');
  if (discard) {
    const carta = discard.dataset.discard;
    const mv = (msg.legal || []).find((m) => m.type === 'DESCARTAR' && (msg.view.minhaMao || [])[m.payload.carta] === carta);
    if (mv) ctx.move({ type: mv.type, payload: mv.payload });
    return;
  }
  const info = e.target.closest('[data-info]');
  if (info) { ui.cardInfo = info.dataset.info; render(); return; }
  if (e.target.closest('[data-close-info]')) { ui.cardInfo = null; render(); return; }
  const bar = e.target.closest('[data-idx]');
  if (bar) { const mv = msg.legal?.[Number(bar.dataset.idx)]; if (mv) ctx.move({ type: mv.type, payload: mv.payload }); return; }
  if (e.target.closest('[data-act="logfold"]')) { ui.logOpen = !ui.logOpen; render(); }
}

function render() {
  if (!view || !msg) return;
  const v = msg.view;
  const me = mySeat();
  view.innerHTML = `
    ${renderPlayers(v, me)}
    <div class="nof-center">${renderCenter(v, me)}</div>
    <div class="nof-bottom">
      ${renderLog()}
      ${renderHand(v, me)}
    </div>
    ${msg.result ? '' : `<div class="nof-bar">${renderBar(v, me)}</div>`}
    <div class="nof-modal-host"></div>`;
  syncCardInfo();
}

/** Modal com a arte e as regras da carta (imagem própria; recua para o emoji se faltar). */
function syncCardInfo() {
  const host = view.querySelector('.nof-modal-host');
  const type = ui.cardInfo;
  if (!host || !type) { if (host) host.innerHTML = ''; return; }
  const effect = ctx.t(`cartaInfo.${type}.effect`).split('|').map((p) => esc(p)).join('<br><br>');
  host.innerHTML = `<div class="nof-modal-backdrop" data-close-info>
    <div class="nof-modal" role="dialog" aria-label="${esc(ctx.t('ui.cardDetails'))}">
      <button class="nof-modal-close" type="button" data-close-info aria-label="${esc(ctx.t('ui.close'))}">✕</button>
      <div class="nof-modal-body">
        <div class="nof-modal-art"><img src="${esc(CARD_ART[type])}" data-fallback="${esc(type)}" alt=""></div>
        <div class="nof-modal-text">
          <div class="nof-modal-name">${esc(ctx.t(`carta.${type}`))}</div>
          <div class="nof-modal-label">${esc(ctx.t('ui.whenToPlay'))}</div>
          <p>${esc(ctx.t(`cartaInfo.${type}.when`))}</p>
          <div class="nof-modal-label">${esc(ctx.t('ui.effect'))}</div>
          <p>${effect}</p>
          <p class="nof-modal-flavor">${esc(ctx.t(`cartaInfo.${type}.flavor`))}</p>
        </div>
      </div>
    </div>
  </div>`;
}

const PHASE_MOVE = { CARTAS: 'move.LANCAR', COMBO: 'move.ESCOLHER_COMBO', DEFESA: 'move.DEFENDER', ESCOLHA_CEGA: 'move.ESCOLHA_CEGA', DESCARTE: 'move.DESCARTAR' };

function activeSeat(v) {
  if (v.fase === 'FIM') return null;
  return v.fase === 'DEFESA' ? 1 - v.vez : v.vez;
}

function slotClass(x) {
  return x === 0 ? 'blocked' : x === 2 ? 'filled' : 'free';
}
const SLOT_ICON = { blocked: '✕', filled: '🧪', free: '' };

function renderBanca(j) {
  return `<div class="nof-banca">${j.banca.map((x) => {
    const cls = slotClass(x);
    return `<i class="nof-slot ${cls}" title="${esc(ctx.t(`ui.slot.${cls}`))}">${SLOT_ICON[cls]}</i>`;
  }).join('')}</div>`;
}

function renderPlayers(v, me) {
  const active = activeSeat(v);
  return `<div class="nof-players">${v.jogadores.map((j, i) => {
    const score = j.banca.filter((x) => x === 2).length;
    return `<div class="nof-player${i === me ? ' me' : ''}${i === active ? ' active' : ''}">
      <div class="nof-pname"><i class="nof-dot" style="background:var(--game-color-${i + 1})"></i><span>${esc(ctx.seatName(i))}</span><b class="nof-score">${score}/6</b></div>
      ${renderBanca(j)}
      <div class="nof-pmeta">
        <span>🧴 ${esc(ctx.t('ui.reserve', { n: j.reserva }))}</span>
        ${i === me ? '' : `<span>🂠 ${esc(ctx.t('ui.opponentHand', { n: j.cartas }))}</span>`}
      </div>
    </div>`;
  }).join('')}</div>`;
}

function renderCenter(v, me) {
  if (v.fase === 'FIM') return '';
  const heading = PHASE_MOVE[v.fase] ? `<div class="nof-phase">${esc(ctx.t(PHASE_MOVE[v.fase]))}</div>` : '';
  const showDice = (v.fase === 'PAUSA' || v.fase === 'COMBO') && v.dados?.some(Boolean);
  const dice = showDice
    ? `<div class="nof-dice">${[...v.dados].sort((a, b) => a - b).map(dieFace).join('')}</div>`
    : '';
  if (v.fase === 'ESCOLHA_CEGA') {
    const opp = me != null ? v.jogadores[1 - me] : null;
    const cards = (msg.legal || []).map((mv, i) => `<button class="nof-card back" type="button" data-idx="${i}" title="${esc(ctx.t(mv.label.key, mv.label.params))}">${i + 1}</button>`).join('');
    return `${heading}<div class="nof-blind">${cards || `<span class="nof-note">${esc(ctx.t('ui.opponentHand', { n: opp?.cartas ?? 0 }))}</span>`}</div>`;
  }
  return `${heading}${dice}`;
}

function renderHand(v, me) {
  if (me == null) return '<div></div>';
  const mao = v.minhaMao || [];
  const canDiscard = v.fase === 'DESCARTE' && !!(msg.legal || []).length;
  // A carta abre sempre os detalhes; no descarte, o X no canto é que descarta.
  const cards = mao.map((c) => `<span class="nof-card-wrap">
    <button class="nof-card face big" type="button" data-info="${esc(c)}" aria-label="${esc(ctx.t('ui.cardDetails'))} — ${esc(ctx.t(`carta.${c}`))}">
      <img src="${esc(CARD_ART[c])}" data-fallback="${esc(c)}" alt="">
    </button>
    ${canDiscard ? `<button class="nof-x-btn" type="button" data-discard="${esc(c)}" title="${esc(ctx.t('move.DESCARTAR'))}" aria-label="${esc(ctx.t('moveLabel.DESCARTAR', { carta: ctx.t(`carta.${c}`) }))}">✕</button>` : ''}
  </span>`).join('');
  return `<div class="nof-hand">
    <div class="nof-lbl">${esc(ctx.t('ui.myHand'))}</div>
    <div class="nof-hand-cards">${cards || `<span class="nof-note">${esc(ctx.t('ui.handEmpty'))}</span>`}</div>
  </div>`;
}

function renderLog() {
  const items = [...(msg.log || [])].reverse().slice(0, ui.logOpen ? 5 : 0);
  return `<aside class="nof-log">
    <button class="nof-lbl nof-log-head" data-act="logfold" aria-expanded="${ui.logOpen}">${esc(ctx.t('ui.log'))} ${ui.logOpen ? '▾' : '▸'}</button>
    ${items.length ? `<ol>${items.map((l) => `<li>${l.seat != null ? `<b>${esc(ctx.seatName(l.seat))}</b> ` : ''}${esc(ctx.t(l.key, l.params))}</li>`).join('')}</ol>` : ''}
  </aside>`;
}

function renderBar(v, me) {
  const legal = msg.legal || [];
  if (v.fase === 'PAUSA') return '';
  if (v.fase === 'ESCOLHA_CEGA') return `<p class="nof-hint">${esc(ctx.t('ui.hintBlind'))}</p>`;
  if (v.fase === 'DESCARTE' && legal.length) return `<p class="nof-hint">${esc(ctx.t('ui.hintDiscard'))}</p>`;
  if (!legal.length) return `<p class="nof-wait">${esc(ctx.t(me == null ? 'ui.spectating' : 'ui.waitingTurn'))}</p>`;
  return legal.map((mv, i) => `<button class="nof-move" type="button" data-idx="${i}">${esc(ctx.t(mv.label.key, mv.label.params))}</button>`).join('');
}
