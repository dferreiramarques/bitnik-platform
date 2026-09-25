// Catania — UI própria (ADR-006). A plataforma monta este módulo na área da
// mesa: `mount(el, ctx)` uma vez e `update(msg)` a cada estado (ROOM).
// Não repete regras: cada clique corresponde a uma jogada legal que já veio
// do servidor em `msg.legal`. As cores vêm dos tokens --cat-* (skin.json),
// que a plataforma aplica por camadas (defaults, tema, afinações do deploy).
import { ICONS } from './icons.js';
import { sfx } from './sounds.js';

const RES = ['cereais', 'vinho', 'peixe', 'calcario', 'azeite'];
const RED = new Set([9, 7, 5, 3, 1]);
const R = 62;
const W3 = Math.sqrt(3) * R;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const img = (key, size = 24) => `<img src="${ICONS[key]}" width="${size}" height="${size}" alt="">`;
const hexPts = (cx, cy, r) => Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i - 30);
  return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
}).join(' ');
const seatColor = (i) => `var(--cat-p${(i % 4) + 1})`;

function ensureCss() {
  const href = new URL('./catania.css', import.meta.url).href;
  if ([...document.styleSheets].some((s) => s.href === href) || document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

let root = null;
let ctx = null;
let msg = null;
const ui = { mode: null, modal: null, keep: null, raise: null, prevPiles: null, prevFire: false };

export function mount(el, context) {
  ctx = context;
  ensureCss();
  root = document.createElement('div');
  root.className = 'cat';
  el.append(root);
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.cat-hex.can')) { e.preventDefault(); onClick(e); }
    if (e.key === 'Escape' && ui.modal) { ui.modal = null; render(); }
  });
}

export function unmount() {
  root?.remove();
  root = null; msg = null;
  Object.assign(ui, { mode: null, modal: null, keep: null, raise: null, prevPiles: null, prevFire: false });
}

export function update(next) {
  msg = next;
  const v = msg.view;
  // Sons de coisas que acontecem no tabuleiro (também nas jogadas dos outros).
  const piles = Object.fromEntries(RES.map((r) => [r, v.piles[r].value]));
  if (ui.prevPiles && RES.some((r) => piles[r] > ui.prevPiles[r])) sfx.discUp();
  ui.prevPiles = piles;
  const firePending = !!(v.me != null && v.players[v.me]?.turn?.firePending);
  if (firePending && !ui.prevFire) sfx.fire();
  ui.prevFire = firePending;
  // Um modo de recolha que já não tem jogadas legais é cancelado.
  if (ui.mode && !legal('COLLECT').some((m) => !!m.payload.take2 === (ui.mode === 'c2'))) ui.mode = null;
  if (ui.modal === 'found' && !legal('FOUND').length) ui.modal = null;
  render();
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
  if (!root || !msg) return;
  const v = msg.view;
  root.innerHTML = `
    <div class="cat-main">
      ${renderTop(v)}
      ${renderPlayers(v)}
      <div class="cat-board" data-tut="board">${renderBoard(v)}</div>
      ${v.me != null ? renderMe(v) : ''}
    </div>
    <div class="cat-side">
      <section class="cat-sec cat-acts-sec" data-tut="actions"><h4>${ctx.t('ui.actions')}</h4>${renderActions(v)}</section>
      <section class="cat-sec" data-tut="piles"><h4>${ctx.t('ui.piles')}</h4>${renderPiles(v)}</section>
      <section class="cat-sec" data-tut="tower"><h4>${ctx.t('ui.tower')}</h4>${renderTower(v)}</section>
      <section class="cat-sec" data-tut="log"><h4>${ctx.t('ui.log')}</h4>${renderLog()}</section>
    </div>
    ${ui.modal === 'found' ? renderFoundModal(v) : ''}
    ${ui.modal === 'pass' ? renderPassModal() : ''}`;
  ctx.afterRender?.(root); // ex.: o tutorial volta a destacar as zonas de que fala
}

function renderTop(v) {
  const mine = v.me != null && v.cur === v.me && !msg.result;
  const turn = msg.result ? '' : mine ? ctx.t('ui.yourTurn') : ctx.t('ui.turnOf', { name: ctx.seatName(v.cur) });
  return `<div class="cat-top">
    <span class="cat-round">${ctx.t('ui.round', { n: v.round })}</span>
    ${v.phase === 'LAST_ROUND' ? `<span class="cat-last">${ctx.t('ui.lastRound')}</span>` : ''}
    ${turn ? `<span class="cat-turn${mine ? ' mine' : ''}">${esc(turn)}</span>` : ''}
  </div>`;
}

function renderPlayers(v) {
  return `<div class="cat-players" data-tut="players">${v.players.map((p, i) => `
    <div class="cat-player${i === v.cur && !msg.result ? ' cur' : ''}">
      <div class="cat-pname"><i class="cat-dot" style="background:${seatColor(i)}"></i><span>${esc(ctx.seatName(i))}</span>
        <b class="cat-score">${ctx.t('ui.pts', { n: p.score })}</b></div>
      ${i === v.me ? '' : `<div class="cat-minis" aria-label="${esc(ctx.t('ui.cards', { n: p.handTotal }))}">${RES.map((r) => `
        <span class="cat-mini${p.hand[r] ? '' : ' zero'}" title="${esc(`${p.hand[r]} ${ctx.t(`res.${r}`)}`)}">${img(r, 16)}${p.hand[r]}</span>`).join('')}</div>`}
      <div class="cat-vills">${p.villages.length ? p.villages.map((vl) => `
        <span class="cat-vill" style="border-left-color:var(--cat-res-${vl.res})" title="${esc(`${vl.cards} ${ctx.t(`res.${vl.res}`)} × ${v.piles[vl.res].value}`)}">
          ${img(vl.res, 16)}×${vl.cards}</span>`).join('') : ctx.t('ui.noVillages')}</div>
    </div>`).join('')}</div>`;
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
  return `<svg viewBox="${minX.toFixed(0)} ${minY.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}" role="group" aria-label="Catania">${hexes}</svg>`;
}

function renderMe(v) {
  const p = v.players[v.me];
  const vills = [0, 1, 2].map((k) => {
    const vl = p.villages[k];
    if (!vl) return '<div class="cat-card cat-vcard empty" aria-hidden="true"></div>';
    const disc = v.piles[vl.res].value;
    return `<div class="cat-card cat-vcard" title="${esc(`${vl.cards} ${ctx.t(`res.${vl.res}`)} × ${disc} = ${vl.cards * disc}`)}">
      ${img(vl.res, 26)}<b>×${vl.cards}</b><span class="disc">${disc}</span></div>`;
  }).join('');
  const hand = RES.map((r) => `<div class="cat-card${p.hand[r] ? '' : ' zero'}" title="${esc(ctx.t(`res.${r}`))}">
    ${img(r, 30)}<b>${p.hand[r]}</b></div>`).join('');
  return `<div class="cat-me" data-tut="me">
    <div class="cat-sec"><h4>${ctx.t('ui.villages')}</h4><div class="cat-cards">${vills}</div></div>
    <div class="cat-sec"><h4>${ctx.t('ui.hand')} · ${ctx.t('ui.cards', { n: p.handTotal })}</h4><div class="cat-cards">${hand}</div></div>
  </div>`;
}

function renderPiles(v) {
  return RES.map((r) => {
    const val = v.piles[r].value;
    return `<div class="cat-pile">${img(r, 22)}<span>${esc(ctx.t(`res.${r}`))}</span>
      <small title="discos na pilha">${v.piles[r].discs.length}</small>
      <span class="cat-disc${RED.has(val) ? ' red' : ''}">${val}</span></div>`;
  }).join('');
}

function renderTower(v) {
  if (!v.tower) return `<p class="cat-wait">${ctx.t('ui.towerEmpty')}</p>`;
  return `<div class="cat-tower-top">${ctx.t('ui.towerTop', { disc: v.towerTop, n: v.tower })}</div>
    <div class="cat-tower"><span class="cat-disc${RED.has(v.towerTop) ? ' red' : ''}">${v.towerTop}</span></div>`;
}

function renderLog() {
  const items = [...(msg.log || [])].reverse().slice(0, 14);
  return `<ol class="cat-log">${items.map((l) => `<li>${l.seat != null ? `<b>${esc(ctx.seatName(l.seat))}</b> ` : ''}${esc(ctx.t(l.key, l.params))}</li>`).join('')}</ol>`;
}

function renderActions(v) {
  if (msg.result) return '';
  const mine = v.me != null && v.cur === v.me;
  if (!mine) return `<p class="cat-wait">${esc(ctx.t('ui.turnOf', { name: ctx.seatName(v.cur) }))}</p>`;
  const t = v.players[v.me].turn;
  const btn = (label, attrs, cls = '') => `<button class="cat-btn ${cls}" ${attrs}>${esc(label)}</button>`;

  if (t.firePending) {
    const stay = legal('MOVE_FIRE').find((m) => m.payload.stay);
    return `<div class="cat-acts">
      <div class="cat-btn info"><b>${ctx.t('ui.eruption')}</b><br>${ctx.t('ui.eruptionBody')}</div>
      ${stay ? btn(ctx.t('ui.fireStay'), 'data-act="stay"', 'pri') : ''}
    </div>`;
  }
  if (ui.mode) {
    return `<div class="cat-acts">
      <div class="cat-btn info">${ctx.t(ui.mode === 'c1' ? 'ui.collect1' : 'ui.collect2')}<br><small>${ctx.t('ui.pickHex')}</small></div>
      ${btn(ctx.t('ui.cancel'), 'data-act="cancel"')}
    </div>`;
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
  return `<div class="cat-acts">
    <div class="cat-step">${ctx.t(step)}</div>
    ${!t.founded && t.collects < 2 ? `
      ${btn(ctx.t('ui.collect1'), `data-act="c1" ${c1 ? '' : 'disabled'}`, 'pri')}
      ${btn(ctx.t('ui.collect2'), `data-act="c2" ${c2 ? '' : 'disabled'}`)}
      ${opening ? `<div class="cat-step">${ctx.t('ui.openingRule')}</div>` : ''}` : ''}
    <div class="cat-sep"></div>
    ${btn(ctx.t('ui.found'), `data-act="found" ${found ? '' : `disabled title="${esc(foundWhy)}"`}`, found ? 'pri' : '')}
    ${btn(ctx.t(done ? 'ui.endTurn' : 'ui.pass'), `data-act="end" ${legal('END_TURN').length ? '' : 'disabled'}`)}
  </div>`;
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
  const act = e.target.closest('[data-act]');
  if (!act || act.disabled) return;
  const a = act.dataset.act;
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
