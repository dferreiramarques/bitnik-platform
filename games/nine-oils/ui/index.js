// Nine Oils — UI própria (ADR-006, ADR-014), ainda no template vanilla para
// os componentes, mas já com fundo da mesa e dados próprios (design do
// David). Não repete regras: cada clique corresponde sempre a uma jogada de
// `msg.legal`.
//
// Disposição: os dois jogadores em vidro no topo (banca de 6 casas, reserva,
// mão do adversário), o centro com os dados, o registo e a minha mão em
// baixo, e a barra de jogadas (fases sem interação própria no centro/mão).
//
// Fase CARTAS: um clique numa carta da mão seleciona-a (fica destacada, como
// a ir na direção dos dados) ou tira a seleção; dois cliques abrem os
// detalhes; tocar na zona dos dados lança com as cartas selecionadas.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const EMOJI = { TEMPTRESS: '❤️‍🔥', BOY: '👦🏽', BULLY: '💪🏼' };
const asset = (rel) => new URL(rel, import.meta.url).href;
const CARD_ART = { TEMPTRESS: asset('./cartas/temptress.jpg'), BOY: asset('./cartas/boy.jpg'), BULLY: asset('./cartas/bully.jpg') };
/** Dado: a face é só CSS (ver [data-face] em nine-oils.css) — a animação
 * mostra as 6 faces em sequência (um "flipbook", com desfoque e um leve
 * sobe-desce) antes de assentar na face lançada. */
const dieFace = (d) => `<i class="nof-die" data-face="${d}"></i>`;

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
const fresh = () => ({ logOpen: false, lastLogSeq: 0, cardInfo: null, pauseTimer: null, selected: [], wasMine: false, wasDescarte: false, wasBlind: false, reveal: null, revealTimer: null });
let ui = fresh();

function onKeydown(e) {
  if (e.key === 'Escape' && ui.cardInfo) { ui.cardInfo = null; render(); }
}

/** Jogadas de LANCAR por valor das cartas (não por índice: cartas iguais são
 * intercambiáveis), para encontrar a jogada certa para o que está selecionado. */
function lancarMove(mao) {
  const wanted = ui.selected.map((i) => mao[i]).sort().join('|');
  return (msg.legal || []).find((m) => m.type === 'LANCAR' && [...m.payload.cartas].map((i) => mao[i]).sort().join('|') === wanted);
}

function toggleCard(i) {
  if (msg.view.fase !== 'CARTAS') return;
  ui.selected = ui.selected.includes(i) ? ui.selected.filter((x) => x !== i) : [...ui.selected, i];
  render();
}

function doRoll() {
  if (msg.view.fase !== 'CARTAS') return;
  const mv = lancarMove(msg.view.minhaMao || []);
  if (mv) { ctx.move({ type: mv.type, payload: mv.payload }); ui.selected = []; }
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
  root.addEventListener('dblclick', onDblClick);
  root.addEventListener('error', onImgError, true);
  document.addEventListener('keydown', onKeydown);
}

export function unmount() {
  document.removeEventListener('keydown', onKeydown);
  clearTimeout(ui.pauseTimer);
  clearTimeout(ui.revealTimer);
  root?.remove();
  root = null; view = null; msg = null;
  ui = fresh();
}

export function update(next) {
  msg = next;
  const me = mySeat();
  for (const l of msg.log || []) {
    if ((l.seq ?? 0) <= ui.lastLogSeq) continue;
    if (l.announce != null) ctx.announce(ctx.t(l.announce.key, l.announce.params), '', l.announce.variant);
    // A carta jogada pelo adversário é informação pública (vai para o descarte):
    // mostra-se a arte uns segundos, como prova do que ele jogou.
    if (l.key === 'log.CARTAS' && l.seat !== me && l.params?.cartas?.length) {
      clearTimeout(ui.revealTimer);
      ui.reveal = l.params.cartas;
      ui.revealTimer = setTimeout(() => { ui.reveal = null; render(); }, 5000);
    }
  }
  ui.lastLogSeq = Math.max(ui.lastLogSeq, ...(msg.log || []).map((l) => l.seq ?? 0));
  // "É a tua vez": só quando passa a sê-lo (não em cada atualização do mesmo turno).
  const mine = me != null && !!msg.active?.includes(me) && !msg.result;
  if (mine && !ui.wasMine) ctx.announce(ctx.t('ui.yourTurn'));
  ui.wasMine = mine;
  const descarte = mine && msg.view.fase === 'DESCARTE';
  if (descarte && !ui.wasDescarte) ctx.announce(ctx.t('ui.hintDiscard'));
  ui.wasDescarte = descarte;
  const blind = mine && msg.view.fase === 'ESCOLHA_CEGA';
  if (blind && !ui.wasBlind) ctx.announce(ctx.t('ui.hintBlind'));
  ui.wasBlind = blind;
  if (msg.view.fase !== 'CARTAS') ui.selected = [];
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
  if (e.target.closest('[data-close-info]')) { ui.cardInfo = null; render(); return; }
  if (e.target.closest('[data-act="roll"]')) { doRoll(); return; }
  const card = e.target.closest('[data-card]');
  if (card) { if (e.detail > 1) return; toggleCard(Number(card.dataset.card)); return; }
  const bar = e.target.closest('[data-idx]');
  if (bar) { const mv = msg.legal?.[Number(bar.dataset.idx)]; if (mv) ctx.move({ type: mv.type, payload: mv.payload }); return; }
  if (e.target.closest('[data-act="logfold"]')) { ui.logOpen = !ui.logOpen; render(); }
}

function onDblClick(e) {
  const card = e.target.closest('[data-card]');
  if (card) ui.cardInfo = (msg.view.minhaMao || [])[Number(card.dataset.card)];
  else return;
  render();
}

function render() {
  if (!view || !msg) return;
  const v = msg.view;
  const me = mySeat();
  view.innerHTML = `
    ${renderPlayers(v, me)}
    <div class="nof-center">${renderCenter(v, me)}</div>
    <div class="nof-bottom">${renderHand(v, me)}</div>
    ${msg.result ? '' : `<div class="nof-bar">${renderBar(v, me)}</div>`}
    ${ui.reveal ? renderReveal() : ''}
    ${renderLog()}
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
    return `<div class="nof-player${i === me ? ' me' : ''}${i === active ? ' active' : ''}">
      <div class="nof-pname"><i class="nof-dot" style="background:var(--game-color-${i + 1})"></i><span>${esc(ctx.seatName(i))}</span></div>
      ${renderBanca(j)}
      ${i === me ? '' : `<div class="nof-pmeta"><span>🂠 ${esc(ctx.t('ui.opponentHand', { n: j.cartas }))}</span></div>`}
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
  if (v.fase === 'CARTAS') {
    const canRoll = (msg.legal || []).some((m) => m.type === 'LANCAR');
    return `<button class="nof-rollzone" type="button" ${canRoll ? 'data-act="roll"' : 'disabled'} aria-label="${esc(ctx.t('move.LANCAR'))}">${heading}</button>`;
  }
  const combo = v.fase === 'COMBO' ? renderCombo() : '';
  return `${heading}${dice}${combo}`;
}

/** Logo a seguir aos dados (dentro do .nof-center), nunca numa linha à parte. */
function renderCombo() {
  return `<div class="nof-combo">${(msg.legal || []).map((mv, i) => `
    <button class="nof-combo-chip" type="button" data-idx="${i}">${esc(ctx.t(mv.label.key, mv.label.params))}</button>
  `).join('')}</div>`;
}

/** Carta(s) jogada(s) pelo adversário, reveladas uns segundos (ver update()). */
function renderReveal() {
  return `<div class="nof-reveal">${ui.reveal.map((c) => `
    <span class="nof-card face big"><img src="${esc(CARD_ART[c])}" data-fallback="${esc(c)}" alt="${esc(ctx.t(`carta.${c}`))}"></span>
  `).join('')}</div>`;
}

function renderHand(v, me) {
  if (me == null) return '<div></div>';
  const mao = v.minhaMao || [];
  const canDiscard = v.fase === 'DESCARTE' && !!(msg.legal || []).length;
  const canSelect = v.fase === 'CARTAS';
  // Um clique seleciona/retira a carta da jogada (CARTAS); dois cliques abrem
  // os detalhes; no descarte, o X no canto é que descarta.
  const cards = mao.map((c, i) => `<span class="nof-card-wrap">
    <button class="nof-card face big${canSelect && ui.selected.includes(i) ? ' selected' : ''}" type="button" data-card="${i}" aria-label="${esc(ctx.t(`carta.${c}`))}">
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
  const items = ui.logOpen ? [...(msg.log || [])].reverse() : [];
  return `<aside class="nof-log">
    <button class="nof-lbl nof-log-head" data-act="logfold" aria-expanded="${ui.logOpen}">${esc(ctx.t('ui.log'))} ${ui.logOpen ? '▾' : '▸'}</button>
    ${items.length ? `<ol>${items.map((l) => `<li>${l.seat != null ? `<b>${esc(ctx.seatName(l.seat))}</b> ` : ''}${esc(ctx.t(l.key, l.params))}</li>`).join('')}</ol>` : ''}
  </aside>`;
}

function renderBar(v, me) {
  const legal = msg.legal || [];
  if (me == null) return `<p class="nof-wait">${esc(ctx.t('ui.spectating'))}</p>`;
  // Vez do adversário: não há status genérico aqui — mostra-se com os dados
  // (o combo que fez, ou "sem combinação"), a carta revelada, e "é a tua
  // vez" quando o turno passa (ver update()).
  if (v.fase === 'PAUSA' || v.fase === 'CARTAS' || v.fase === 'COMBO' || v.fase === 'DESCARTE' || v.fase === 'ESCOLHA_CEGA' || !legal.length) return '';
  return legal.map((mv, i) => `<button class="nof-move" type="button" data-idx="${i}">${esc(ctx.t(mv.label.key, mv.label.params))}</button>`).join('');
}
