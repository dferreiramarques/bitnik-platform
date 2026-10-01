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
//
// Fase DEFESA: mesma lógica, mas só os Valentões são selecionáveis (até ao
// número de Rapazes a bloquear); "Continuar" bloqueia com os que estiverem
// selecionados (0 ou mais).
//
// Fase COMBO: um lançamento pode dar uma combinação com várias partes (ex.:
// dois Quads, ou Triplo + Duplo) — por isso os dados escolhem-se aos grupos.
// Seleciona-se os dados de uma parte e "Atribuir" fecha-a (fica marcada, com
// contorno próprio); repete-se para a parte seguinte; "Continuar" acende
// quando as partes já atribuídas (mais o que estiver selecionado na hora)
// batem certo com uma das combinações disponíveis. No Joker (7 iguais) isto
// não chega (não há um grupo de dados literal para "Triplo + Duplo"), por
// isso aí volta-se à lista de botões.

import { conjuntos, describeMove } from '../rules.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
// Igual ao MSG_MS do app.js (fila da mensagem da mesa) — não há forma de
// perguntar à plataforma quando a fila esvazia, por isso simula-se aqui a
// mesma fila (só este jogo manda mensagens para esta mesa).
const MSG_MS = 2600;
const EMOJI = { TEMPTRESS: '❤️‍🔥', BOY: '👦🏽', BULLY: '💪🏼' };
const asset = (rel) => new URL(rel, import.meta.url).href;
const CARD_ART = { TEMPTRESS: asset('./cartas/temptress.jpg'), BOY: asset('./cartas/boy.jpg'), BULLY: asset('./cartas/bully.jpg') };
const GROUP_COLORS = 4; // cores de contorno que se repetem, se houver mais partes do que isso (raro)
/** Dado: a face é só CSS (ver [data-face] em nine-oils.css) — a animação
 * mostra as 6 faces em sequência (um "flipbook", com desfoque e um leve
 * sobe-desce) antes de assentar na face lançada. Em COMBO, um botão de
 * verdade (data-die), para escolher a combinação pelos próprios dados sem
 * perder o teclado/leitor de ecrã; `state` é null (livre), 'pending' (a
 * escolher, ainda não atribuído) ou o índice do grupo já atribuído. */
const dieFace = (d, i, state, animate) => {
  let cls = `nof-die${animate ? '' : ' settled'}`;
  if (state === 'pending') cls += ' selected';
  else if (typeof state === 'number') cls += ` grouped group-${state % GROUP_COLORS}`;
  return i != null
    ? `<button class="${cls}" type="button" data-face="${d}" data-die="${i}" aria-pressed="${state != null}" aria-label="${d}"></button>`
    : `<i class="${cls}" data-face="${d}"></i>`;
};

/** Quantos dados cada combinação consome, para ligar uma seleção de dados a
 * uma das opções (ver matchedOpcao). */
const COMBO_DICE = { DOUBLE: 2, QUAD: 4, TRIPLE_DOUBLE: 5, SIX_OF_KIND: 6, PENTA: 5 };
const comboKey = (b) => [...b].sort().join('|');

/** Dados selecionados (de uma ou mais partes já atribuídas) → índice em
 * v.opcoes, ou -1 se ainda não formam nenhuma das combinações disponíveis
 * (ou sobram/faltam dados). */
function matchedOpcao(v, selVals) {
  if (!selVals.length) return -1;
  const candidates = new Set(conjuntos(selVals).filter((b) => b.reduce((n, c) => n + (COMBO_DICE[c] || 0), 0) === selVals.length).map(comboKey));
  return (v.opcoes || []).findIndex((o) => candidates.has(comboKey(o)));
}

/** Uma parte válida por si só (Duplo, Triplo+Duplo, Quad, Penta ou Seis) —
 * o que "Atribuir" exige antes de fechar um grupo. Devolve o tipo (ex.:
 * 'QUAD') ou null. */
function singleCombo(vals) {
  if (!vals.length) return null;
  const hit = conjuntos(vals).find((b) => b.length === 1 && COMBO_DICE[b[0]] === vals.length);
  return hit ? hit[0] : null;
}

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
const fresh = () => ({
  logOpen: false, lastLogSeq: 0, cardInfo: null, pauseTimer: null,
  selected: [], diceSel: [], diceGroups: [], comboOpen: false, wasMine: false, wasDescarte: false, wasBlind: false,
  reveal: null, revealTimer: null, revealHold: false,
  diceAnimatedKey: null, rollShown: false, queueEta: 0,
});
let ui = fresh();

/** Manda a mensagem para a mesa e guarda quando a fila (simulada) fica
 * livre — para a zona de lançar não aparecer por cima de mensagens ainda
 * a mostrar (ver renderCenter). */
function announce(key, params, variant) {
  ui.queueEta = Math.max(ui.queueEta, Date.now()) + MSG_MS;
  ctx.announce(ctx.t(key, params), '', variant);
}

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
  const v = msg.view;
  const mao = v.minhaMao || [];
  if (v.fase === 'CARTAS') {
    ui.selected = ui.selected.includes(i) ? ui.selected.filter((x) => x !== i) : [...ui.selected, i];
  } else if (v.fase === 'DEFESA') {
    // Só Valentões, e nunca mais do que Rapazes a bloquear.
    if (mao[i] !== 'BULLY') return;
    if (ui.selected.includes(i)) ui.selected = ui.selected.filter((x) => x !== i);
    else if (ui.selected.length < (v.rapazes || 0)) ui.selected = [...ui.selected, i];
    else return;
  } else return;
  render();
}

function doRoll() {
  if (msg.view.fase !== 'CARTAS') return;
  const mv = lancarMove(msg.view.minhaMao || []);
  if (mv) { ctx.move({ type: mv.type, payload: mv.payload }); ui.selected = []; }
}

/** DEFESA: "Continuar" bloqueia com os Valentões selecionados (0 ou mais). */
function doDefend() {
  if (msg.view.fase !== 'DEFESA') return;
  const mv = (msg.legal || []).find((m) => m.type === 'DEFENDER' && m.payload.valentoes === ui.selected.length);
  if (mv) { ctx.move({ type: mv.type, payload: mv.payload }); ui.selected = []; }
}

/** COMBO: clicar num dado já atribuído desfaz o grupo todo (para corrigir);
 * clicar num dado livre seleciona-o/tira a seleção da parte em escolha. */
function toggleDie(i) {
  const v = msg.view;
  if (v.fase !== 'COMBO' || !(msg.legal || []).some((m) => m.type === 'ESCOLHER_COMBO')) return;
  const gi = ui.diceGroups.findIndex((g) => g.includes(i));
  if (gi >= 0) { ui.diceGroups = ui.diceGroups.filter((_, x) => x !== gi); render(); return; }
  ui.diceSel = ui.diceSel.includes(i) ? ui.diceSel.filter((x) => x !== i) : [...ui.diceSel, i];
  render();
}

/** COMBO: "Atribuir" fecha a parte selecionada (Duplo, Triplo+Duplo, Quad,
 * Penta ou Seis) como um grupo à parte, para escolher a próxima. */
function assignGroup() {
  const v = msg.view;
  if (v.fase !== 'COMBO' || !ui.diceSel.length) return;
  const sorted = [...v.dados].sort((a, b) => a - b);
  if (!singleCombo(ui.diceSel.map((i) => sorted[i]))) return;
  ui.diceGroups = [...ui.diceGroups, ui.diceSel];
  ui.diceSel = [];
  render();
}

/** COMBO: "Continuar" joga a combinação formada pelas partes já atribuídas
 * mais o que estiver selecionado na hora (não é preciso atribuir a última). */
function doChooseCombo() {
  const v = msg.view;
  if (v.fase !== 'COMBO') return;
  const sorted = [...v.dados].sort((a, b) => a - b);
  const idxs = [...ui.diceGroups.flat(), ...ui.diceSel];
  const idx = matchedOpcao(v, idxs.map((i) => sorted[i]));
  if (idx < 0) return;
  const mv = (msg.legal || []).find((m) => m.type === 'ESCOLHER_COMBO' && m.payload.opcao === idx);
  if (mv) { ctx.move({ type: mv.type, payload: mv.payload }); ui.diceSel = []; ui.diceGroups = []; }
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
    if (l.announce != null) announce(l.announce.key, l.announce.params, l.announce.variant);
    // A carta jogada pelo adversário é informação pública (vai para o descarte):
    // mostra-se a arte uns segundos, como prova do que ele jogou — mas se
    // levar a uma defesa (Rapaz) ou escolha às cegas (2 Valentões), mantém-se
    // visível até essa fase acabar (a seguir abaixo), em vez de 5s fixos.
    if (l.key === 'log.CARTAS' && l.seat !== me && l.params?.cartas?.length) {
      clearTimeout(ui.revealTimer); ui.revealTimer = null;
      ui.reveal = l.params.cartas;
      ui.revealHold = msg.view.fase === 'DEFESA' || msg.view.fase === 'ESCOLHA_CEGA';
      if (!ui.revealHold) ui.revealTimer = setTimeout(() => { ui.reveal = null; render(); }, 5000);
    }
  }
  ui.lastLogSeq = Math.max(ui.lastLogSeq, ...(msg.log || []).map((l) => l.seq ?? 0));
  if (ui.revealHold && msg.view.fase !== 'DEFESA' && msg.view.fase !== 'ESCOLHA_CEGA') {
    ui.reveal = null; ui.revealHold = false;
  }
  // "É a tua vez": só quando passa a sê-lo (não em cada atualização do mesmo turno).
  const mine = me != null && !!msg.active?.includes(me) && !msg.result;
  if (mine && !ui.wasMine) { announce('ui.yourTurn'); ui.rollShown = false; }
  ui.wasMine = mine;
  const descarte = mine && msg.view.fase === 'DESCARTE';
  if (descarte && !ui.wasDescarte) announce('ui.hintDiscard');
  ui.wasDescarte = descarte;
  const blind = mine && msg.view.fase === 'ESCOLHA_CEGA';
  if (blind && !ui.wasBlind) announce('ui.hintBlind');
  ui.wasBlind = blind;
  if (msg.view.fase !== 'CARTAS' && msg.view.fase !== 'DEFESA') ui.selected = [];
  if (msg.view.fase !== 'COMBO') { ui.diceSel = []; ui.diceGroups = []; ui.comboOpen = false; }
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
  if (e.target.closest('[data-act="defend"]')) { doDefend(); return; }
  if (e.target.closest('[data-act="choose-combo"]')) { doChooseCombo(); return; }
  if (e.target.closest('[data-act="assign-dice"]')) { assignGroup(); return; }
  if (e.target.closest('[data-act="combo-toggle"]')) { ui.comboOpen = !ui.comboOpen; render(); return; }
  const die = e.target.closest('[data-die]');
  if (die) { toggleDie(Number(die.dataset.die)); return; }
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
  const cards = v.jogadores.map((j, i) => `<div class="nof-player${i === me ? ' me' : ''}${i === active ? ' active' : ''}">
      <div class="nof-pname"><i class="nof-dot" style="background:var(--game-color-${i + 1})"></i><span>${esc(ctx.seatName(i))}</span></div>
      ${renderBanca(j)}
      ${i === me ? '' : `<div class="nof-pmeta"><span>🂠 ${esc(ctx.t('ui.opponentHand', { n: j.cartas }))}</span></div>`}
    </div>`).join('');
  // A ficha das combinações (fase COMBO) fica encostada aos cartões dos
  // jogadores, ao centro — como a pilha de valores do Catania, mas
  // expansível/colapsável, por cima dos dados (não precisa de espaço próprio).
  return `<div class="nof-players">${cards}${v.fase === 'COMBO' ? renderComboInfo(v) : ''}</div>`;
}

function renderCenter(v, me) {
  if (v.fase === 'FIM') return '';
  const heading = PHASE_MOVE[v.fase] ? `<div class="nof-phase">${esc(ctx.t(PHASE_MOVE[v.fase]))}</div>` : '';
  const showDice = (v.fase === 'PAUSA' || v.fase === 'COMBO') && v.dados?.some(Boolean);
  // No Joker (7 iguais), a opção Triplo+Duplo não corresponde a um grupo de
  // dados literal (usa a mesma face do 7 de um tipo) — aí mantém-se a lista
  // de botões; no resto, a combinação forma-se ao escolher os dados.
  const canChoose = v.fase === 'COMBO' && !v.joker && (msg.legal || []).some((m) => m.type === 'ESCOLHER_COMBO');
  const sortedDados = showDice ? [...v.dados].sort((a, b) => a - b) : [];
  // O lançamento só anima a primeira vez que aparece (ver diceAnimatedKey);
  // voltar a desenhar os mesmos dados (clicar noutro, abrir o registo, etc.)
  // não repete a animação.
  let diceIsNew = false;
  if (showDice) {
    const key = sortedDados.join(',');
    diceIsNew = ui.diceAnimatedKey !== key;
    if (diceIsNew) ui.diceAnimatedKey = key;
  }
  const dice = showDice
    ? `<div class="nof-dice${canChoose ? ' choosing' : ''}">${sortedDados.map((d, i) => {
        let state = null;
        if (canChoose) {
          const gi = ui.diceGroups.findIndex((g) => g.includes(i));
          state = gi >= 0 ? gi : (ui.diceSel.includes(i) ? 'pending' : null);
        }
        return dieFace(d, canChoose ? i : null, state, diceIsNew);
      }).join('')}</div>`
    : '';
  if (v.fase === 'ESCOLHA_CEGA') {
    const opp = me != null ? v.jogadores[1 - me] : null;
    const cards = (msg.legal || []).map((mv, i) => `<button class="nof-card back" type="button" data-idx="${i}" title="${esc(ctx.t(mv.label.key, mv.label.params))}">${i + 1}</button>`).join('');
    return `${heading}<div class="nof-blind">${cards || `<span class="nof-note">${esc(ctx.t('ui.opponentHand', { n: opp?.cartas ?? 0 }))}</span>`}</div>`;
  }
  if (v.fase === 'CARTAS') {
    const canRoll = (msg.legal || []).some((m) => m.type === 'LANCAR');
    if (!canRoll) return ''; // vez do adversário: nada aqui (ver "é a tua vez" e as mensagens da mesa)
    // Só aparece (com fade) depois de a fila de mensagens da mesa esvaziar —
    // com várias mensagens seguidas, isso pode demorar mais do que uma (ver
    // queueEta/announce), por isso o atraso calcula-se, não é fixo.
    const justAppeared = !ui.rollShown;
    ui.rollShown = true;
    const delay = justAppeared ? Math.max(0, ui.queueEta - Date.now()) : 0;
    const style = justAppeared ? ` style="animation-delay:${delay}ms"` : '';
    return `<button class="nof-rollzone${justAppeared ? ' appear' : ''}" type="button" data-act="roll" aria-label="${esc(ctx.t('move.LANCAR'))}"${style}>${heading}</button>`;
  }
  if (v.fase === 'DEFESA') {
    const canDefend = (msg.legal || []).some((m) => m.type === 'DEFENDER');
    if (!canDefend) return '';
    // Seleciona os Valentões na mão (abaixo) e confirma aqui, como nas combinações.
    return `${heading}<div class="nof-combo"><button class="nof-combo-chip" type="button" data-act="defend">${esc(ctx.t('move.CONTINUAR'))}</button></div>`;
  }
  if (v.fase === 'COMBO') return `${heading}${dice}${renderComboConfirm(v)}`;
  return `${heading}${dice}`;
}

/** Logo a seguir aos dados: no Joker, a lista de combinações (botões); no
 * resto, confirma a combinação que os dados selecionados já formam. */
function renderComboConfirm(v) {
  if (!(msg.legal || []).some((m) => m.type === 'ESCOLHER_COMBO')) return '';
  if (v.joker) {
    return `<div class="nof-combo">${(msg.legal || []).map((mv, i) => `
      <button class="nof-combo-chip" type="button" data-idx="${i}">${esc(ctx.t(mv.label.key, mv.label.params))}</button>
    `).join('')}</div>`;
  }
  const sorted = [...v.dados].sort((a, b) => a - b);
  const canAssign = ui.diceSel.length > 0 && singleCombo(ui.diceSel.map((i) => sorted[i])) != null;
  const idxs = [...ui.diceGroups.flat(), ...ui.diceSel];
  const ready = matchedOpcao(v, idxs.map((i) => sorted[i])) >= 0;
  // "Atribuir" só interessa quando há mais do que uma parte em jogo (ex.: dois
  // Quads) — com uma seleção só, "Continuar" já chega.
  const showAssign = ui.diceGroups.length > 0 || canAssign;
  return `<div class="nof-combo">
    ${showAssign ? `<button class="nof-combo-chip" type="button" data-act="assign-dice" ${canAssign ? '' : 'disabled'}>${esc(ctx.t('ui.assignGroup'))}</button>` : ''}
    <button class="nof-combo-chip" type="button" data-act="choose-combo" ${ready ? '' : 'disabled'}>${esc(ctx.t('move.CONTINUAR'))}</button>
  </div>`;
}

/** Ficha expansível/colapsável (como a pilha de valores do Catania): as
 * combinações disponíveis neste lançamento, visíveis aos dois — nunca
 * botões aqui, só informação. Fechada por omissão; com fundo em vidro
 * quando aberta, porque fica por cima dos dados. */
function renderComboInfo(v) {
  if (!v.opcoes?.length) return '';
  const toggle = `<button class="nof-combo-pill" type="button" data-act="combo-toggle" aria-expanded="${ui.comboOpen}">${esc(ctx.t('ui.comboOptions'))} ${ui.comboOpen ? '▴' : '▾'}</button>`;
  if (!ui.comboOpen) return `<div class="nof-combo-dock">${toggle}</div>`;
  const rows = v.opcoes.map((o, i) => {
    const label = describeMove({ type: 'ESCOLHER_COMBO', payload: { opcao: i } }, v);
    return `<div class="nof-combo-info-row">${esc(ctx.t(label.key, label.params))}</div>`;
  });
  return `<div class="nof-combo-dock">${toggle}<div class="nof-combo-info">${rows.join('')}</div></div>`;
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
  const canDefend = v.fase === 'DEFESA' && (msg.legal || []).some((m) => m.type === 'DEFENDER');
  // Um clique seleciona/retira a carta da jogada (CARTAS) ou um Valentão para
  // a defesa (DEFESA); dois cliques abrem os detalhes; no descarte, o X no
  // canto é que descarta.
  const cards = mao.map((c, i) => {
    const selectable = v.fase === 'CARTAS' || (canDefend && c === 'BULLY');
    return `<span class="nof-card-wrap">
    <button class="nof-card face big${selectable && ui.selected.includes(i) ? ' selected' : ''}" type="button" data-card="${i}" aria-label="${esc(ctx.t(`carta.${c}`))}">
      <img src="${esc(CARD_ART[c])}" data-fallback="${esc(c)}" alt="">
    </button>
    ${canDiscard ? `<button class="nof-x-btn" type="button" data-discard="${esc(c)}" title="${esc(ctx.t('move.DESCARTAR'))}" aria-label="${esc(ctx.t('moveLabel.DESCARTAR', { carta: ctx.t(`carta.${c}`) }))}">✕</button>` : ''}
  </span>`;
  }).join('');
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

// Todas as fases têm agora interação própria no centro/mão (rollzone,
// combinações, defesa, descarte, escolha às cegas); a barra só serve os
// espectadores — vez do adversário mostra-se com os dados e as mensagens da
// mesa (ver update()), nunca com um status genérico aqui.
function renderBar(v, me) {
  return me == null ? `<p class="nof-wait">${esc(ctx.t('ui.spectating'))}</p>` : '';
}
