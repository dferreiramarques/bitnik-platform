// Robot Maker — UI própria (ADR-006, ADR-014), no template vanilla: só usa os
// tokens --game-* do skin.json. Não repete regras: cada clique corresponde a
// uma jogada de `msg.legal`; custos e circuitos vêm do `view`.
//
// Disposição: jogadores em vidro no topo, fichas da ronda, o tabuleiro e o
// mercado ao centro, a minha área (robot) em baixo e a barra de jogadas.
import css from './style.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const SLOTS = ['head', 'chest', 'arm', 'port', 'legs'];
const ICON = { head: '🧠', chest: '🦺', arm: '💪', port: '🔌', legs: '🦿', cpu: '⚙️' };
const FAMILIAS = ['bio', 'combat', 'agility', 'shield'];
const TABULEIRO = [
  { id: 'compilador', move: 'COMPILADOR', icon: '🔵', color: '#2f6fb5', cap: 'ui.unlimited' },
  { id: 'optimizador', move: 'OPTIMIZADOR', icon: '🟡', color: '#d29a1e', cap: 'ui.unlimited' },
  { id: 'forja', move: 'FORJA', icon: '🔴', color: '#c0392b', cap: 'ui.exclusive' },
  { id: 'deploy', move: 'DEPLOY', icon: '🟢', color: '#2e8b4f', cap: 'ui.exclusive' },
];

function ensureCss() {
  if (document.getElementById('rm-css')) return;
  const el = document.createElement('style');
  el.id = 'rm-css';
  el.textContent = css;
  document.head.append(el);
}

let root = null;
let layout = null;
let ctx = null;
let msg = null;
const fresh = () => ({ forja: false, logOpen: false, lastLogSeq: 0 });
let ui = fresh();

export function mount(el, context) {
  ctx = context;
  ensureCss();
  root = document.createElement('div');
  root.className = 'rm';
  layout = document.createElement('div');
  layout.className = 'rm-layout';
  root.append(layout);
  el.append(root);
  root.addEventListener('click', onClick);
}

export function unmount() {
  root?.remove();
  root = null; layout = null; msg = null;
  ui = fresh();
}

export function update(next) {
  msg = next;
  for (const l of msg.log || []) {
    if (l.announce == null || (l.seq ?? 0) <= ui.lastLogSeq) continue;
    ctx.announce(ctx.t(l.announce.key, l.announce.params), '', l.announce.variant);
  }
  ui.lastLogSeq = Math.max(ui.lastLogSeq, ...(msg.log || []).map((l) => l.seq ?? 0));
  if (!msg.legal?.some((m) => m.type === 'FORJA')) ui.forja = false;
  render();
}

const mySeat = () => (msg && Number.isInteger(msg.seat) ? msg.seat : null);
const legalMove = (type, payload) => (msg.legal || []).find((m) => m.type === type && JSON.stringify(m.payload ?? {}) === JSON.stringify(payload ?? {}));
const send = (mv) => { if (mv) ctx.move({ type: mv.type, payload: mv.payload }); };

function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  if (act === 'slot') {
    const id = b.dataset.id;
    if (id === 'forja') { ui.forja = true; render(); return; }
    send(legalMove(TABULEIRO.find((s) => s.id === id).move, {}));
  } else if (act === 'buy') send(legalMove('COMPRAR', { peca: b.dataset.id }));
  else if (act === 'forjapick') { ui.forja = false; send(legalMove('FORJA', { peca: b.dataset.id })); }
  else if (act === 'forjacancel') { ui.forja = false; render(); }
  else if (act === 'pass') send(legalMove('PASSAR', {}));
  else if (act === 'market') send(legalMove('IR_AO_MERCADO', {}));
  else if (act === 'logfold') { ui.logOpen = !ui.logOpen; render(); }
}

function render() {
  if (!layout || !msg) return;
  const v = msg.view;
  layout.innerHTML = `
    ${renderPlayers(v)}
    ${renderChips(v)}
    <div class="rm-main">
      <div class="rm-col">${renderBoard(v)}${renderCircuits(v)}</div>
      <div class="rm-col">${renderMarket(v)}</div>
    </div>
    ${renderMine(v)}
    ${msg.result ? '' : renderBar(v)}
    ${renderLog()}
    ${ui.forja ? renderForja(v) : ''}`;
  ctx.afterRender?.(); // o tutorial volta a pôr o destaque
}

const activeSeat = (v) => (v.acabou ? null : v.ordem[v.vez]);

function robotMini(j) {
  return `<div class="rm-mini">${[...SLOTS.map((s) => j.robot[s]), j.cpu.nivel].map((n, i) => `<i class="${n ? `l${n}` : ''}" title="${esc(ctx.t(`slot.${[...SLOTS, 'cpu'][i]}`))}">${n ? `L${n}` : ''}</i>`).join('')}</div>`;
}

function renderPlayers(v) {
  const me = mySeat();
  const act = activeSeat(v);
  return `<div class="rm-players" data-tut="players">${v.jogadores.map((j, i) => {
    const out = v.fim.rondaExtra && v.fim.gatilho === i && !v.acabou;
    const state = out ? ctx.t('ui.sitsOut', { nome: ctx.seatName(i) })
      : i === act ? (i === me ? ctx.t('ui.yourTurn') : ctx.t('ui.turnOf', { nome: ctx.seatName(i) })) : '';
    return `<div class="rm-glass rm-player${i === me ? ' me' : ''}${i === act ? ' active' : ''}${out ? ' out' : ''}">
      <div class="rm-pname"><i class="rm-dot" style="background:var(--game-color-${(i % 4) + 1})"></i><span class="n">${esc(ctx.seatName(i))}</span><span class="pts" title="${esc(ctx.t('ui.estimate'))}">${j.pontos.total}</span></div>
      <div class="rm-pstate">${esc(state) || '&nbsp;'}</div>
      <div class="rm-res"><span>🔧 <b>${j.livres}</b>/${j.workers}</span><span>⬛ <b>${j.l1}</b> L1</span><span>🟨 <b>${j.l2}</b> L2</span><span>🟢 <b>${j.deploy}</b></span></div>
      ${robotMini(j)}
    </div>`;
  }).join('')}</div>`;
}

function renderChips(v) {
  const act = activeSeat(v);
  return `<div class="rm-chips">
    <span class="rm-pill">${esc(ctx.t('ui.roundOf', { n: v.rodada, max: v.maxRondas }))}</span>
    ${v.fim.rondaExtra ? `<span class="rm-pill warn">${esc(ctx.t('ui.finalRound'))}</span>` : ''}
    ${act != null ? `<span class="rm-pill turn">${esc(act === mySeat() ? ctx.t('ui.yourTurn') : ctx.t('ui.turnOf', { nome: ctx.seatName(act) }))}</span>` : ''}
  </div>`;
}

function renderBoard(v) {
  return `<section class="rm-section" data-tut="board"><div class="rm-lbl">${esc(ctx.t('ui.board'))}</div>
    <div class="rm-board">${TABULEIRO.map((s) => {
    const occ = s.id === 'forja' ? v.tabuleiro.forja : s.id === 'deploy' ? v.tabuleiro.deploy : null;
    const can = s.id === 'forja' ? (msg.legal || []).some((m) => m.type === 'FORJA') : !!legalMove(s.move, {});
    const busy = occ != null;
    return `<button class="rm-slot${busy ? ' busy' : ''}" type="button" data-act="slot" data-id="${s.id}" style="--sc:${s.color}" ${can ? '' : 'disabled'}>
      <b>${s.icon} ${esc(ctx.t(`ui.slot.${s.id}`))}</b>
      <span class="fx">${esc(ctx.t(`ui.fx.${s.id}`))}</span>
      <small>${esc(ctx.t(s.cap))}</small>
      ${busy ? `<span class="who">🔧 ${esc(ctx.seatName(occ))}</span>` : ''}
    </button>`;
  }).join('')}</div></section>`;
}

function renderCircuits(v) {
  const dono = (id) => v.jogadores.findIndex((j) => j.circuito === id);
  return `<section class="rm-section" data-tut="circuits"><div class="rm-lbl">${esc(ctx.t('ui.circuits'))}</div>
    <div class="rm-circs">${v.circuitos.map(([id, slots]) => {
    const taken = v.esgotados.includes(id);
    const i = dono(id);
    return `<div class="rm-glass rm-circ${taken ? ' taken' : ''}">
      <b>⚡ ${esc(ctx.t(`circuito.${id}`))}</b>
      <small>${slots.map((s) => esc(ctx.t(`slot.${s}`))).join(' + ')}</small>
      <small>${taken ? `${esc(ctx.t('ui.circuitTaken'))}${i >= 0 ? ` · ${esc(ctx.seatName(i))}` : ''}` : esc(ctx.t('ui.circuitFree'))}</small>
    </div>`;
  }).join('')}</div></section>`;
}

function missing(v, id) {
  const me = mySeat();
  const j = me != null ? v.jogadores[me] : null;
  if (!j) return '';
  const [c1, c2] = v.custos[id];
  const falta = [j.l1 < c1 ? `${c1 - j.l1}×L1` : '', j.l2 < c2 ? `${c2 - j.l2}×L2` : ''].filter(Boolean).join(' + ');
  return falta ? ctx.t('ui.needs', { falta }) : '';
}

function pieceCard(v, id, { stockShown = true } = {}) {
  const [c1, c2, pts] = v.custos[id];
  const stock = v.mercado.stock[id];
  const can = !!legalMove('COMPRAR', { peca: id });
  const cost = [c1 ? `${c1}×L1` : '', c2 ? `${c2}×L2` : ''].filter(Boolean).join(' + ');
  const why = can ? '' : (v.fase === 'trabalho' && activeSeat(v) === mySeat() ? ctx.t('ui.workFirst') : missing(v, id));
  return `<button class="rm-piece${can ? ' buy' : ''}${stock <= 0 ? ' sold' : ''}" type="button" data-act="buy" data-id="${id}" ${can ? '' : 'disabled'} title="${esc(why)}">
    <span class="nm">${esc(ctx.t(`peca.${id}`))}</span>
    <span class="ct">${esc(ctx.t('ui.cost'))}: ${esc(cost)}</span>
    <span class="pt">${pts} pts</span>
    ${stockShown ? `<span class="st">×${stock}</span>` : ''}
  </button>`;
}

function renderMarket(v) {
  const levels = [1, 2, 3].map((n) => `<div class="rm-level">
    <div class="rm-lvhead"><span class="rm-lbl">${esc(ctx.t('ui.level', { n }))}</span><span class="rm-note">${esc(ctx.t('ui.deck', { n: v.mercado.baralho[n] }))}</span></div>
    <div class="rm-cards">${v.mercado.fila[n].map((s) => pieceCard(v, s + n)).join('')}</div>
  </div>`).join('');
  const cpus = [1, 2, 3].map((n) => `<div class="rm-level">
    <div class="rm-lvhead"><span class="rm-lbl">${esc(ctx.t('slot.cpu'))} L${n}</span></div>
    <div class="rm-cards">${FAMILIAS.map((f) => pieceCard(v, f + n)).join('')}${n === 3 ? pieceCard(v, 'omni3') : ''}</div>
  </div>`).join('');
  return `<section class="rm-section" data-tut="market"><div class="rm-lbl">${esc(ctx.t('ui.market'))}</div>${levels}</section>
    <section class="rm-section" data-tut="market"><div class="rm-lbl">${esc(ctx.t('ui.cpus'))}</div>${cpus}</section>`;
}

function renderMine(v) {
  const me = mySeat();
  const j = me != null ? v.jogadores[me] : null;
  if (!j) return '<div></div>';
  const pts = j.pontos;
  const slotInfo = (s) => j.pontos.pecas.find((p) => p.slot === s);
  const cell = (s) => {
    const n = j.robot[s];
    const info = slotInfo(s);
    return `<div class="rm-rslot${n ? ' on' : ''}"><span class="k">${ICON[s]} ${esc(ctx.t(`slot.${s}`))}</span>
      <span class="v">${n ? esc(ctx.t(`peca.${s}${n}`)) : esc(ctx.t('ui.empty'))}</span>
      ${info ? `<span class="p">${info.base}${info.amp ? ` <span class="amp">→ ${info.valor}</span>` : ''} pts</span>` : ''}</div>`;
  };
  const cpuCell = j.cpu.nivel
    ? `<div class="rm-rslot on"><span class="k">${ICON.cpu} ${esc(ctx.t('slot.cpu'))}</span><span class="v">${esc(ctx.t(`peca.${j.cpu.familia}${j.cpu.nivel}`))}</span><span class="p">${pts.cpu} pts${pts.fator !== 1 ? ` · ×${pts.fator}` : ''}</span></div>`
    : `<div class="rm-rslot"><span class="k">${ICON.cpu} ${esc(ctx.t('slot.cpu'))}</span><span class="v">${esc(ctx.t('ui.empty'))}</span></div>`;
  return `<div class="rm-mine" data-tut="mine">
    <div class="rm-mine-head">
      <span class="rm-lbl">${esc(ctx.t('ui.myRobot'))}</span>
      <span>🔧 <b>${j.livres}</b>/${j.workers} ${esc(ctx.t('ui.free'))}</span>
      <span>⬛ <b>${j.l1}</b> L1</span><span>🟨 <b>${j.l2}</b> L2</span>
      <span title="${esc(`${ctx.t('ui.piecesPts')} ${pts.pecas.reduce((a, p) => a + p.valor, 0)} · ${ctx.t('ui.cpuPts')} ${pts.cpu} · ${ctx.t('ui.deployPts')} ${pts.deploy} · ${ctx.t('ui.bonusFull')} ${pts.bonusCompleto} · ${ctx.t('ui.bonusL3')} ${pts.bonusL3}`)}">${esc(ctx.t('ui.estimate'))}: <b>${pts.total}</b></span>
    </div>
    <div class="rm-robot">${SLOTS.map(cell).join('')}${cpuCell}</div>
  </div>`;
}

function renderBar(v) {
  const me = mySeat();
  const act = activeSeat(v);
  const legal = msg.legal || [];
  if (me == null) return `<div class="rm-bar" data-tut="bar"><span class="rm-hint">${esc(ctx.t('ui.spectating'))}</span></div>`;
  if (!legal.length) return `<div class="rm-bar" data-tut="bar"><span class="rm-hint">${esc(ctx.t('ui.waiting', { nome: ctx.seatName(act ?? 0) }))}</span></div>`;
  const j = v.jogadores[me];
  if (v.fase === 'trabalho') {
    return `<div class="rm-bar" data-tut="bar">
    <span class="rm-hint">${esc(ctx.t('ui.phaseWork', { n: j.livres }))}</span>
    ${legalMove('IR_AO_MERCADO', {}) ? `<button class="rm-btn primary" type="button" data-act="market">${esc(ctx.t('ui.goMarket'))}</button>` : ''}
    <button class="rm-btn" type="button" data-act="pass">${esc(ctx.t('ui.pass'))}</button>
  </div>`;
  }
  return `<div class="rm-bar" data-tut="bar">
    <span class="rm-hint">${esc(ctx.t('ui.phaseMarket'))}</span>
    <button class="rm-btn" type="button" data-act="pass">${esc(ctx.t('ui.endTurn'))}</button>
  </div>`;
}

function renderForja(v) {
  const opts = (msg.legal || []).filter((m) => m.type === 'FORJA');
  return `<div class="rm-modal"><div class="rm-modal-box" role="dialog" aria-label="${esc(ctx.t('ui.pickSlot'))}">
    <h3>${esc(ctx.t('ui.pickSlot'))}</h3>
    <div class="rm-cards">${opts.map((m) => {
    const id = `${m.payload.peca}1`;
    return `<button class="rm-piece buy" type="button" data-act="forjapick" data-id="${m.payload.peca}"><span class="nm">${ICON[m.payload.peca]} ${esc(ctx.t(`peca.${id}`))}</span><span class="pt">${v.custos[id][2]} pts</span></button>`;
  }).join('')}</div>
    <button class="rm-btn" type="button" data-act="forjacancel">${esc(ctx.t('ui.cancel'))}</button>
  </div></div>`;
}

function renderLog() {
  const items = ui.logOpen ? [...(msg.log || [])].reverse().slice(0, 12) : [];
  return `<aside class="rm-log">
    <button class="rm-lbl rm-log-head" data-act="logfold" aria-expanded="${ui.logOpen}">${esc(ctx.t('ui.log'))} ${ui.logOpen ? '▾' : '▸'}</button>
    ${items.length ? `<ol>${items.map((l) => `<li>${l.seat != null ? `<b>${esc(ctx.seatName(l.seat))}</b> ` : ''}${esc(ctx.t(l.key, l.params))}</li>`).join('')}</ol>` : ''}
  </aside>`;
}
