// Catania — UI própria (ADR-006, ADR-014). A plataforma monta este módulo na
// mesa, que ocupa o ecrã inteiro: `mount(el, ctx)` uma vez e `update(msg)` a
// cada estado (ROOM). Não repete regras: cada clique corresponde a uma jogada
// legal que já veio do servidor em `msg.legal`. As cores vêm dos tokens --cat-*
// e --game-* (skin.json), que a plataforma aplica por camadas.
//
// Disposição (design/figma/TEMPLATE.md): jogadores em vidro no topo, fichas da
// ronda e da torre, tabuleiro centrado com zoom (dois dedos, roda, botões),
// pilhas flutuantes à direita, registo flutuante à esquerda, a minha área e a
// barra de ações em baixo. No telemóvel na vertical e na horizontal, o CSS
// reorganiza as mesmas peças.
import { ICONS } from './icons.js';
import { sfx } from './sounds.js';

const RES = ['cereais', 'vinho', 'peixe', 'calcario', 'azeite'];
const RED = new Set([9, 7, 5, 3, 1]);
const R = 62;
const W3 = Math.sqrt(3) * R;
const ZOOM = { min: 0.6, max: 3 };
const MSG_MS = 2600;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const img = (key, size = 24) => `<img src="${ICONS[key]}" width="${size}" height="${size}" alt="">`;
const hexPts = (cx, cy, r) => Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i - 30);
  return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
}).join(' ');
const seatColor = (i) => `var(--cat-p${(i % 4) + 1})`;
const disc = (v, cls = '') => `<span class="cat-disc${RED.has(v) ? ' red' : ''}${cls ? ` ${cls}` : ''}">${v}</span>`;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function ensureCss() {
  const href = new URL('./catania.css', import.meta.url).href;
  if ([...document.styleSheets].some((s) => s.href === href) || document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

let root = null;   // .cat (fica montado)
let view = null;   // conteúdo redesenhado a cada estado
let msgEl = null;  // mensagem da mesa (persistente, para a animação não recomeçar)
let ctx = null;
let msg = null;
const fresh = () => ({
  mode: null, modal: null, keep: null, raise: null, prevPiles: null, prevFire: false, prevMine: false, prevPhase: null,
  zoom: { s: 1, x: 0, y: 0 }, pts: new Map(), dragged: false, moved: 0,
  showAll: false, showPiles: false, showLog: false, logOpen: true, msgQ: [], msgBusy: false,
});
let ui = fresh();

export function mount(el, context) {
  ctx = context;
  ensureCss();
  root = document.createElement('div');
  root.className = 'cat';
  view = document.createElement('div');
  view.className = 'cat-layout';
  msgEl = document.createElement('div');
  msgEl.className = 'cat-msg';
  msgEl.setAttribute('aria-live', 'polite');
  root.append(view, msgEl);
  el.append(root);
  root.addEventListener('click', onClickCapture, true);
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.cat-hex.can')) { e.preventDefault(); onClick(e); }
    if (e.key === 'Escape' && (ui.modal || ui.mode)) { ui.modal = null; ui.mode = null; render(); }
  });
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', onPointerUp);
  root.addEventListener('pointercancel', onPointerUp);
  root.addEventListener('wheel', onWheel, { passive: false });
}

export function unmount() {
  root?.remove();
  root = null; view = null; msgEl = null; msg = null;
  ui = fresh();
}

export function update(next) {
  msg = next;
  const v = msg.view;
  // Sons de coisas que acontecem no tabuleiro (também nas jogadas dos outros).
  const piles = Object.fromEntries(RES.map((r) => [r, v.piles[r].value]));
  if (ui.prevPiles && RES.some((r) => piles[r] !== ui.prevPiles[r])) sfx.discUp();
  ui.prevPiles = piles;
  const firePending = !!(v.me != null && v.players[v.me]?.turn?.firePending);
  if (firePending && !ui.prevFire) { sfx.fire(); announce(ctx.t('ui.msgEruption'), ctx.t('ui.msgEruptionSub')); }
  ui.prevFire = firePending;
  // Mensagem da mesa (ADR-014): a vez, a última ronda e a erupção, uma de cada vez.
  const mine = v.me != null && v.cur === v.me && !msg.result;
  if (mine && !ui.prevMine) announce(ctx.t('ui.yourTurn'));
  ui.prevMine = mine;
  if (v.phase === 'LAST_ROUND' && ui.prevPhase && ui.prevPhase !== 'LAST_ROUND') announce(ctx.t('ui.lastRound') + '!', '', 'warn');
  ui.prevPhase = v.phase;
  // Um modo de recolha que já não tem jogadas legais é cancelado.
  if (ui.mode && !legal('COLLECT').some((m) => !!m.payload.take2 === (ui.mode === 'c2'))) ui.mode = null;
  if (ui.modal === 'found' && !legal('FOUND').length) ui.modal = null;
  render();
}

// ─── Mensagem da mesa ───────────────────────────────────────
function announce(title, sub = '', variant = '') {
  ui.msgQ.push({ title, sub, variant });
  if (!ui.msgBusy) nextMessage();
}

function nextMessage() {
  const m = ui.msgQ.shift();
  if (!m || !msgEl) { ui.msgBusy = false; if (msgEl) msgEl.className = 'cat-msg'; return; }
  ui.msgBusy = true;
  msgEl.innerHTML = `<b>${esc(m.title)}</b>${m.sub ? `<small>${esc(m.sub)}</small>` : ''}`;
  msgEl.className = `cat-msg${m.variant ? ` ${m.variant}` : ''}`;
  void msgEl.offsetWidth; // recomeça a animação
  msgEl.classList.add('on');
  setTimeout(nextMessage, reduced() ? 1800 : MSG_MS);
}

// ─── Jogadas legais ─────────────────────────────────────────
const legal = (type) => (msg?.legal || []).filter((m) => m.type === type);
const send = (mv) => ctx.move(mv);

function hexMove(id) {
  const fire = legal('MOVE_FIRE').find((m) => m.payload.hex === id);
  if (fire) return fire;
  if (ui.mode) return legal('COLLECT').find((m) => m.payload.hex === id && !!m.payload.take2 === (ui.mode === 'c2'));
  return null;
}

// ─── Render ─────────────────────────────────────────────────
function render() {
  if (!view || !msg) return;
  const v = msg.view;
  root.classList.toggle('show-all', ui.showAll);
  root.classList.toggle('show-piles', ui.showPiles);
  root.classList.toggle('show-log', ui.showLog);
  root.classList.toggle('picking', !!ui.mode || !!legal('MOVE_FIRE').length);
  view.innerHTML = `
    ${renderPlayers(v)}
    ${renderChips(v)}
    <div class="cat-board" data-tut="board">
      <div class="cat-view"><div class="cat-zoom">${renderBoard(v)}</div></div>
      ${renderPiles(v)}
      <div class="cat-zoombar">
        <button class="cat-zb" data-zoom="in" aria-label="${esc(ctx.t('ui.zoomIn'))}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
        <button class="cat-zb" data-zoom="out" aria-label="${esc(ctx.t('ui.zoomOut'))}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button>
        <button class="cat-zb" data-zoom="fit" aria-label="${esc(ctx.t('ui.zoomFit'))}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/></svg></button>
      </div>
    </div>
    <div class="cat-bottom">
      ${renderLog()}
      ${v.me != null ? renderMe(v) : '<div></div>'}
      <div></div>
    </div>
    ${msg.result ? '' : `<div class="cat-bar" data-tut="actions">${renderActions(v)}</div>`}
    ${ui.modal === 'found' ? renderFoundModal(v) : ''}
    ${ui.modal === 'pass' ? renderPassModal() : ''}`;
  applyZoom();
  ctx.afterRender?.(root); // ex.: o tutorial volta a destacar as zonas de que fala
}

function renderChips(v) {
  const top = v.tower
    ? `${esc(ctx.t('ui.towerChip'))} ${disc(v.towerTop, 'sm')} <span class="cat-chip-sub">· ${esc(ctx.t('ui.towerLeft', { n: v.tower }))}</span>`
    : esc(ctx.t('ui.towerEmpty'));
  return `<div class="cat-chips">
    <span class="cat-chip">${esc(ctx.t('ui.round', { n: v.round }))}</span>
    ${v.phase === 'LAST_ROUND' ? `<span class="cat-chip hot">${esc(ctx.t('ui.lastRound'))}</span>` : ''}
    <span class="cat-chip" data-tut="tower">${top}</span>
    <button class="cat-chip cat-piles-btn" data-act="piles" aria-expanded="${ui.showPiles}" data-tut="piles">${esc(ctx.t('ui.pilesShort'))} ${ui.showPiles ? '▴' : '▾'}</button>
  </div>`;
}

function renderPlayers(v) {
  // No telemóvel só cabem dois: eu e quem está a jogar (os outros atrás de "+N").
  const first = [...new Set([v.me, v.cur, 0, 1].filter((i) => i != null && i < v.players.length))].slice(0, 2);
  const extra = v.players.length - first.length;
  return `<div class="cat-players" data-tut="players">${v.players.map((p, i) => {
    const cur = i === v.cur && !msg.result;
    const hand = i === v.me
      ? `<span class="cat-pnote">${esc(ctx.t('ui.handCount', { n: p.handTotal }))}</span>`
      : RES.map((r) => `<span class="cat-mini${p.hand[r] ? '' : ' zero'}" title="${esc(`${p.hand[r]} ${ctx.t(`res.${r}`)}`)}">${img(r, 14)}${p.hand[r]}</span>`).join('');
    const vills = p.villages.map((vl) => `<span class="cat-vill" style="border-left-color:var(--cat-res-${vl.res})" title="${esc(`${vl.cards} ${ctx.t(`res.${vl.res}`)} × ${v.piles[vl.res].value}`)}">${img(vl.res, 14)}×${vl.cards}</span>`).join('');
    return `<div class="cat-player${cur ? ' cur' : ''}${first.includes(i) ? '' : ' cat-extra'}">
      <div class="cat-pname"><i class="cat-dot" style="background:${seatColor(i)}"></i><span>${esc(ctx.seatName(i))}</span><b class="cat-score">${p.score}</b></div>
      <div class="cat-pstate">${esc(ctx.t(cur ? 'ui.statePlaying' : 'ui.stateWaiting'))}</div>
      <div class="cat-minis" aria-label="${esc(ctx.t('ui.cards', { n: p.handTotal }))}">${hand}</div>
      <div class="cat-vills">${vills || `<span class="cat-pnote">${esc(ctx.t('ui.noVillages'))}</span>`}</div>
    </div>`;
  }).join('')}${extra > 0 ? `<button class="cat-more" data-act="more" aria-expanded="${ui.showAll}">${ui.showAll ? '‹' : `+${extra} ›`}</button>` : ''}</div>`;
}

function renderBoard(v) {
  const xs = v.hexes.map((h) => h.px.x);
  const ys = v.hexes.map((h) => h.px.y);
  const pad = 14;
  const minX = Math.min(...xs) - W3 / 2 - pad;
  const minY = Math.min(...ys) - R - pad;
  const w = Math.max(...xs) - Math.min(...xs) + W3 + pad * 2;
  const h = Math.max(...ys) - Math.min(...ys) + R * 2 + pad * 2;
  const hexes = v.hexes.map((hex) => {
    const { x: cx, y: cy } = hex.px;
    const isVol = hex.type === 'vulcao';
    const isFire = v.fire === hex.id;
    const move = hexMove(hex.id);
    const name = isVol ? ctx.t('res.vulcao') : ctx.t(`res.${hex.type}`);
    const pile = v.piles[hex.type];
    const workers = hex.workers.map((w, k) => {
      const n = hex.workers.length;
      const rr = n === 1 ? 0 : R * 0.36;
      const a = Math.PI * (2 * k / n) - Math.PI / 2;
      const tx = cx + rr * Math.cos(a);
      const ty = n === 1 ? cy : cy + rr * Math.sin(a);
      const cr = n === 1 ? 26 : 16;
      const is = n === 1 ? 40 : 24;
      return `<circle cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="${cr}" style="fill:${seatColor(w)}" stroke="rgb(255 255 255 / .6)" stroke-width="2"/>
        <image href="${ICONS.trabalhador}" x="${(tx - is / 2).toFixed(1)}" y="${(ty - is / 2).toFixed(1)}" width="${is}" height="${is}"/>`;
    }).join('');
    const label = move
      ? (move.label ? ctx.t(move.label.key, move.label.params) : name)
      : `${name}${pile && !isVol ? ` · ${pile.value}` : ''}`;
    return `<g class="cat-hex${move ? ' can' : ''}${isFire ? ' fire' : ''}" data-hex="${hex.id}"
        ${move ? `role="button" tabindex="0" aria-label="${esc(label)}"` : `aria-label="${esc(label)}"`}>
      <title>${esc(label)}</title>
      <polygon class="cat-hex-shape" points="${hexPts(cx, cy, R - 1.5)}" style="fill:var(--cat-res-${hex.type})" stroke="rgb(0 0 0 / .5)" stroke-width="1.2"/>
      ${move ? `<polygon class="cat-hex-glow" points="${hexPts(cx, cy, R - 1.5)}"/>` : ''}
      <image href="${ICONS[hex.type]}" x="${cx - 16}" y="${cy - 22}" width="32" height="32" style="pointer-events:none"/>
      <text x="${cx}" y="${cy + 24}" text-anchor="middle" font-size="9" font-weight="600" fill="rgb(255 255 255 / .8)" style="font-family:var(--cat-font-display);pointer-events:none">${esc(name)}</text>
      ${!isVol && pile ? `<circle cx="${(cx + R * 0.52).toFixed(1)}" cy="${(cy - R * 0.52).toFixed(1)}" r="13" style="fill:var(--cat-panel-2);stroke:${RED.has(pile.value) ? 'var(--cat-red)' : 'var(--cat-gold-dark)'}" stroke-width="1.8"/>
        <text x="${(cx + R * 0.52).toFixed(1)}" y="${(cy - R * 0.52).toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="700" style="font-family:var(--cat-font-display);fill:${RED.has(pile.value) ? 'var(--cat-red)' : 'var(--cat-gold)'};pointer-events:none">${pile.value}</text>` : ''}
      ${workers}
      ${isFire ? `<image href="${ICONS.fogo}" x="${cx - 26}" y="${cy - 30}" width="52" height="52" style="pointer-events:none"/>` : ''}
    </g>`;
  }).join('');
  return `<svg viewBox="${minX.toFixed(0)} ${minY.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Catania">${hexes}</svg>`;
}


function renderMe(v) {
  const p = v.players[v.me];
  const vills = [0, 1, 2].map((k) => {
    const vl = p.villages[k];
    if (!vl) return '<div class="cat-card cat-vcard empty" aria-hidden="true"></div>';
    const d = v.piles[vl.res].value;
    return `<div class="cat-card cat-vcard" style="border-bottom-color:var(--cat-res-${vl.res})" title="${esc(`${vl.cards} ${ctx.t(`res.${vl.res}`)} × ${d} = ${vl.cards * d}`)}">
      ${img(vl.res, 22)}<b>×${vl.cards}</b><span class="d">${d}</span></div>`;
  }).join('');
  const hand = RES.map((r) => `<div class="cat-card${p.hand[r] ? '' : ' zero'}" title="${esc(ctx.t(`res.${r}`))}">
    ${img(r, 24)}<b>${p.hand[r]}</b></div>`).join('');
  return `<div class="cat-me" data-tut="me">
    <div class="cat-me-grp"><div class="cat-lbl">${esc(ctx.t('ui.villages'))}</div><div class="cat-cards">${vills}</div></div>
    <i class="cat-vsep" aria-hidden="true"></i>
    <div class="cat-me-grp"><div class="cat-lbl">${esc(ctx.t('ui.hand'))} · ${esc(ctx.t('ui.cards', { n: p.handTotal }))}
      <button class="cat-logbtn" data-act="log" aria-expanded="${ui.showLog}">${esc(ctx.t('ui.log'))} ${ui.showLog ? '▾' : '▴'}</button></div>
      <div class="cat-cards">${hand}</div></div>
  </div>`;
}

function renderPiles(v) {
  const rows = RES.map((r) => `<div class="cat-pile"><span class="cat-pile-name">${esc(ctx.t(`res.${r}`))}</span>${img(r, 18)}${disc(v.piles[r].value)}</div>`).join('');
  return `<aside class="cat-piles" data-tut="piles" aria-label="${esc(ctx.t('ui.piles'))}">
    <div class="cat-lbl">${esc(ctx.t('ui.piles'))}</div>${rows}</aside>`;
}

function renderLog() {
  const items = [...(msg.log || [])].reverse().slice(0, ui.logOpen ? 4 : 0);
  return `<aside class="cat-log" data-tut="log">
    <button class="cat-lbl cat-log-head" data-act="logfold" aria-expanded="${ui.logOpen}">${esc(ctx.t('ui.log'))} ${ui.logOpen ? '▾' : '▸'}</button>
    ${items.length ? `<ol>${items.map((l) => `<li>${l.seat != null ? `<b>${esc(ctx.seatName(l.seat))}</b> ` : ''}${esc(ctx.t(l.key, l.params))}</li>`).join('')}</ol>` : ''}
  </aside>`;
}

function btn(label, attrs, cls = '', sub = '') {
  return `<button class="cat-btn ${cls}" ${attrs}><span>${esc(label)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
}

function renderActions(v) {
  const mine = v.me != null && v.cur === v.me;
  if (!mine) return v.me == null ? '' : `<p class="cat-wait">${esc(ctx.t('ui.turnOf', { name: ctx.seatName(v.cur) }))}</p>`;
  const t = v.players[v.me].turn;
  if (t.firePending) {
    const stay = legal('MOVE_FIRE').find((m) => m.payload.stay);
    return `<div class="cat-info"><b>${esc(ctx.t('ui.eruption'))}</b><small>${esc(ctx.t('ui.eruptionBody'))}</small></div>
      ${stay ? btn(ctx.t('ui.fireStay'), 'data-act="stay"', 'pri') : ''}`;
  }
  if (ui.mode) {
    return `<div class="cat-info"><b>${esc(ctx.t(ui.mode === 'c1' ? 'ui.collect1' : 'ui.collect2'))}</b><small>${esc(ctx.t('ui.pickHex'))}</small></div>
      ${btn(ctx.t('ui.cancel'), 'data-act="cancel"')}`;
  }
  const collects = legal('COLLECT');
  const c1 = collects.some((m) => !m.payload.take2);
  const c2 = collects.some((m) => m.payload.take2);
  const found = legal('FOUND').length > 0;
  const types = RES.filter((r) => v.players[v.me].hand[r] > 0).length;
  const total = v.players[v.me].handTotal;
  const foundWhy = t.founded ? ctx.t('ui.foundDone') : total < 5 ? ctx.t('ui.foundNeed5', { n: total }) : types < 2 ? ctx.t('ui.foundNeed2') : '';
  const step = t.founded || t.collects >= 2 ? 'ui.collectDone' : t.collects === 0 ? 'ui.collectStep1' : 'ui.collectStep2';
  const done = t.collects > 0 || t.founded;
  const opening = v.round === 1 && v.me === 0 && t.collects === 1 && !t.founded && v.tower > 0;
  const next = v.tower ? ctx.t(RED.has(v.towerTop) ? 'ui.nextDiscRed' : 'ui.nextDisc', { disc: v.towerTop }) : ctx.t('ui.towerEmpty');
  return `<div class="cat-step">${esc(ctx.t(step))}</div>
    ${!t.founded && t.collects < 2 ? `
      ${btn(ctx.t('ui.collect1'), `data-act="c1" ${c1 ? '' : 'disabled'}`, 'pri')}
      ${btn(ctx.t('ui.collect2'), `data-act="c2" ${c2 ? '' : 'disabled'}`, '', opening ? ctx.t('ui.openingRule') : next)}` : ''}
    ${btn(ctx.t('ui.found'), `data-act="found" ${found ? '' : 'disabled'}`, found ? 'pri' : '', found ? '' : foundWhy)}
    ${btn(ctx.t(done ? 'ui.endTurn' : 'ui.pass'), `data-act="end" ${legal('END_TURN').length ? '' : 'disabled'}`)}`;
}

// ─── Zoom e arrastar no tabuleiro ───────────────────────────
function applyZoom() {
  const z = view?.querySelector('.cat-zoom');
  if (z) z.style.transform = `translate(${ui.zoom.x}px, ${ui.zoom.y}px) scale(${ui.zoom.s})`;
}

function zoomAt(px, py, f) {
  const { s, x, y } = ui.zoom;
  const ns = Math.min(ZOOM.max, Math.max(ZOOM.min, s * f));
  const k = ns / s;
  ui.zoom = { s: ns, x: px - (px - x) * k, y: py - (py - y) * k };
  applyZoom();
}

function viewCenter() {
  const el = view.querySelector('.cat-view');
  return el ? [el.clientWidth / 2, el.clientHeight / 2] : [0, 0];
}

function onPointerDown(e) {
  const el = e.target.closest('.cat-view');
  if (!el || (e.pointerType === 'mouse' && e.button !== 0)) return;
  ui.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ui.pts.size === 1) { ui.moved = 0; ui.dragged = false; }
}

function onPointerMove(e) {
  if (!ui.pts.has(e.pointerId)) return;
  const el = view.querySelector('.cat-view');
  if (!el) return;
  const r = el.getBoundingClientRect();
  const prev = [...ui.pts.values()];
  ui.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const now = [...ui.pts.values()];
  if (now.length === 1) {
    const dx = now[0].x - prev[0].x;
    const dy = now[0].y - prev[0].y;
    ui.moved += Math.abs(dx) + Math.abs(dy);
    if (ui.moved < 6) return; // um toque não é arrastar
    if (!ui.dragged) { ui.dragged = true; el.setPointerCapture?.(e.pointerId); }
    ui.zoom = { ...ui.zoom, x: ui.zoom.x + dx, y: ui.zoom.y + dy };
    applyZoom();
  } else {
    ui.dragged = true;
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const mid = (a, b) => ({ x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top });
    const d0 = d(prev[0], prev[1]);
    const m0 = mid(prev[0], prev[1]);
    const m1 = mid(now[0], now[1]);
    const { s, x, y } = ui.zoom;
    const ns = Math.min(ZOOM.max, Math.max(ZOOM.min, s * (d0 ? d(now[0], now[1]) / d0 : 1)));
    const k = ns / s;
    ui.zoom = { s: ns, x: m1.x - (m0.x - x) * k, y: m1.y - (m0.y - y) * k };
    applyZoom();
  }
}

function onPointerUp(e) { ui.pts.delete(e.pointerId); }

function onWheel(e) {
  const el = e.target.closest('.cat-view');
  if (!el) return;
  e.preventDefault();
  const r = el.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.002));
}

/** Um arrastar no tabuleiro não conta como clique num território. */
function onClickCapture(e) {
  if (ui.dragged && e.target.closest('.cat-view')) { e.stopPropagation(); e.preventDefault(); }
  ui.dragged = false;
}

// ─── Modais ─────────────────────────────────────────────────
function foundOptions() {
  const opts = legal('FOUND').map((m) => m.payload);
  const keeps = [...new Set(opts.map((o) => o.keep))];
  if (!ui.keep && keeps.length === 1) ui.keep = keeps[0];
  const raises = ui.keep ? opts.filter((o) => o.keep === ui.keep).map((o) => o.raise) : [];
  if (ui.keep && !ui.raise && raises.length === 1) ui.raise = raises[0];
  return { keeps, raises };
}

function renderFoundModal(v) {
  const p = v.players[v.me];
  const { keeps, raises } = foundOptions();
  const types = RES.filter((r) => p.hand[r] > 0);
  const step = !ui.keep ? 'ui.vmTie' : !ui.raise ? 'ui.vmRaise' : 'ui.vmReady';
  const warn = p.turn.collects === 0 ? ctx.t('ui.vmNoCollect') : p.turn.collects === 1 ? ctx.t('ui.vmOneCollect') : '';
  let summary = '';
  if (ui.keep && ui.raise) {
    const discs = v.piles[ui.raise].discs;
    const top = discs[discs.length - 1];
    const under = discs[discs.length - 2];
    const res = (r) => ctx.t(`res.${r}`);
    summary = `<div class="cat-summary">
      <div>${img('cidade', 18)} ${esc(ctx.t('ui.vmKeep', { res: res(ui.keep), n: p.hand[ui.keep] }))}</div>
      <div>${esc(ctx.t('ui.vmDiscard', { list: types.filter((r) => r !== ui.keep).map((r) => `${res(r)} ×${p.hand[r]}`).join(', ') }))}</div>
      <div>${esc(discs.length > 1 ? ctx.t('ui.vmRaiseUp', { res: res(ui.raise), top, under }) : ctx.t('ui.vmRaiseSame', { res: res(ui.raise) }))}</div>
    </div>`;
  }
  return `<div class="cat-ovl" data-act="close-bg"><div class="cat-modal" role="dialog" aria-modal="true" aria-labelledby="catVm">
    <h3 id="catVm">${ctx.t('ui.vmTitle')}</h3>
    <p>${ctx.t(step)}${warn ? ` ${warn}` : ''}</p>
    <div class="cat-types">${types.map((r) => {
      const cls = r === ui.keep ? ' keep' : r === ui.raise ? ' raise' : ui.keep && !raises.includes(r) ? ' off' : '';
      const pickable = (!ui.keep && keeps.includes(r)) || (ui.keep && r === ui.keep && keeps.length > 1) || (ui.keep && raises.includes(r));
      return `<button class="cat-type${cls}" data-type="${r}" ${pickable ? '' : 'disabled'}>
        ${img(r, 28)}<span>${esc(ctx.t(`res.${r}`))}</span><small>${ctx.t('ui.cards', { n: p.hand[r] })}</small></button>`;
    }).join('')}</div>
    ${summary}
    <div class="cat-mbtns">
      <button class="cat-btn" data-act="close">${ctx.t('ui.cancel')}</button>
      <button class="cat-btn pri" data-act="found-ok" ${ui.keep && ui.raise ? '' : 'disabled'}>${ctx.t('ui.confirm')}</button>
    </div>
  </div></div>`;
}

function renderPassModal() {
  return `<div class="cat-ovl" data-act="close-bg"><div class="cat-modal" role="dialog" aria-modal="true" aria-labelledby="catPass">
    <h3 id="catPass">${ctx.t('ui.passTitle')}</h3>
    <p>${ctx.t('ui.passBody')}</p>
    <div class="cat-mbtns">
      <button class="cat-btn" data-act="close">${ctx.t('ui.cancel')}</button>
      <button class="cat-btn pri" data-act="pass-ok">${ctx.t('ui.pass')}</button>
    </div>
  </div></div>`;
}

// ─── Cliques ────────────────────────────────────────────────
function onClick(e) {
  const hex = e.target.closest('.cat-hex.can');
  if (hex) {
    const mv = hexMove(Number(hex.dataset.hex));
    if (!mv) return;
    if (mv.type === 'MOVE_FIRE') sfx.fire(); else sfx.worker();
    ui.mode = null;
    send(mv);
    return;
  }
  const type = e.target.closest('[data-type]');
  if (type && !type.disabled) {
    const r = type.dataset.type;
    const { keeps } = foundOptions();
    if (!ui.keep || (r === ui.keep && keeps.length > 1)) { ui.keep = ui.keep === r ? null : r; ui.raise = null; } else ui.raise = r;
    render();
    return;
  }
  const zb = e.target.closest('[data-zoom]');
  if (zb) {
    const [cx, cy] = viewCenter();
    if (zb.dataset.zoom === 'fit') { ui.zoom = { s: 1, x: 0, y: 0 }; applyZoom(); } else zoomAt(cx, cy, zb.dataset.zoom === 'in' ? 1.25 : 0.8);
    return;
  }
  const act = e.target.closest('[data-act]');
  if (!act || act.disabled) return;
  const a = act.dataset.act;
  if (a === 'more') { ui.showAll = !ui.showAll; render(); return; }
  if (a === 'piles') { ui.showPiles = !ui.showPiles; render(); return; }
  if (a === 'log') { ui.showLog = !ui.showLog; ui.logOpen = true; render(); return; }
  if (a === 'logfold') { ui.logOpen = !ui.logOpen; render(); return; }
  if (a === 'close-bg' && e.target !== act) return;
  if (a === 'c1' || a === 'c2') ui.mode = a;
  else if (a === 'cancel') ui.mode = null;
  else if (a === 'stay') { sfx.fire(); send(legal('MOVE_FIRE').find((m) => m.payload.stay)); }
  else if (a === 'found') { ui.keep = null; ui.raise = null; ui.modal = 'found'; }
  else if (a === 'found-ok') {
    const mv = legal('FOUND').find((m) => m.payload.keep === ui.keep && m.payload.raise === ui.raise);
    ui.modal = null;
    if (mv) { sfx.city(); send(mv); }
  } else if (a === 'end') {
    const t = msg.view.players[msg.view.me].turn;
    if (!t.collects && !t.founded) ui.modal = 'pass';
    else { sfx.endTurn(); send(legal('END_TURN')[0]); }
  } else if (a === 'pass-ok') { ui.modal = null; sfx.endTurn(); send(legal('END_TURN')[0]); }
  else if (a === 'close' || a === 'close-bg') ui.modal = null;
  render();
}
