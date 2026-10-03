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

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const img = (key, size = 24) => `<img src="${ICONS[key]}" width="${size}" height="${size}" alt="">`;
const hexPts = (cx, cy, r) => Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i - 30);
  return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
}).join(' ');
/**
 * Atraso negativo que põe uma animação em loop na fase de um relógio contínuo:
 * o tabuleiro é redesenhado a cada estado (e ao abrir painéis), mas as ondas,
 * o fogo e o pulsar continuam onde estavam em vez de recomeçar.
 */
const loopDelay = (dur, offset = 0) => `-${(((performance.now() / 1000) + offset) % dur).toFixed(2)}s`;
const seatColor = (i) => `var(--cat-p${(i % 4) + 1})`;
const disc = (v, cls = '') => `<span class="cat-disc${RED.has(v) ? ' red' : ''}${cls ? ` ${cls}` : ''}">${v}</span>`;

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
let ctx = null;
let msg = null;
let resizeObs = null;
const fresh = () => ({
  mode: null, modal: null, keep: null, raise: null, prevPiles: null, prevFire: false, prevMine: false, prevPhase: null,
  zoom: { s: 1, x: 0, y: 0 }, pts: new Map(), dragged: false, moved: 0,
  stripCur: null, showPiles: false, logOpen: false,
});
let ui = fresh();

export function mount(el, context) {
  ctx = context;
  ensureCss();
  root = document.createElement('div');
  root.className = 'cat';
  view = document.createElement('div');
  view.className = 'cat-layout';
  root.append(view);
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
  // A zona livre muda com o ecrã (rodar o telemóvel, abrir painéis): volta a encaixar.
  if (typeof ResizeObserver !== 'undefined') { resizeObs = new ResizeObserver(() => applyZoom()); resizeObs.observe(root); }
}

export function unmount() {
  resizeObs?.disconnect(); resizeObs = null;
  frame = null;
  root?.remove();
  root = null; view = null; msg = null;
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

// ─── Mensagem da mesa (ADR-014): fila e animação são da plataforma ───
function announce(title, sub = '', variant = '') {
  if (ctx.messages === false) return; // o tutorial explica tudo na caixa do guia
  ctx.announce(title, sub, variant);
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
  root.classList.toggle('show-piles', ui.showPiles);
  root.classList.toggle('picking', !!ui.mode || !!legal('MOVE_FIRE').length);
  const stripX = view.querySelector('.cat-players')?.scrollLeft ?? 0;
  view.innerHTML = `
    <div class="cat-view"><div class="cat-zoom">${renderBoard(v)}</div></div>
    ${renderPlayers(v)}
    ${renderChips(v)}
    <div class="cat-board" data-tut="board">
      ${renderPiles(v)}
      <div class="cat-zoombar">
        <button class="cat-zb" data-zoom="in" aria-label="${esc(ctx.t('ui.zoomIn'))}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
        <button class="cat-zb" data-zoom="out" aria-label="${esc(ctx.t('ui.zoomOut'))}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button>
        <button class="cat-zb" data-zoom="fit" aria-label="${esc(ctx.t('ui.zoomFit'))}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/></svg></button>
      </div>
    </div>
    <div class="cat-bottom">
      ${v.me != null ? renderMe(v) : '<div></div>'}
      <div></div>
    </div>
    ${msg.result ? '' : `<div class="cat-bar" data-tut="actions">${renderActions(v)}</div>`}
    ${renderLog()}
    ${ui.modal === 'found' ? renderFoundModal(v) : ''}
    ${ui.modal === 'pass' ? renderPassModal() : ''}`;
  applyZoom();
  keepStrip(stripX, v.cur);
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
  // No telemóvel os cartões ficam numa faixa com scroll horizontal (swipe para os restantes).
  return `<div class="cat-players" data-tut="players">${v.players.map((p, i) => {
    const cur = i === v.cur && !msg.result;
    const hand = i === v.me
      ? `<span class="cat-pnote">${esc(ctx.t('ui.handCount', { n: p.handTotal }))}</span>`
      : RES.map((r) => `<span class="cat-mini${p.hand[r] ? '' : ' zero'}" title="${esc(`${p.hand[r]} ${ctx.t(`res.${r}`)}`)}">${img(r, 14)}${p.hand[r]}</span>`).join('');
    const vills = p.villages.map((vl) => `<span class="cat-vill" style="border-left-color:var(--cat-res-${vl.res})" title="${esc(`${vl.cards} ${ctx.t(`res.${vl.res}`)} × ${v.piles[vl.res].value}`)}">${img(vl.res, 14)}×${vl.cards}</span>`).join('');
    return `<div class="cat-player${cur ? ' cur' : ''}" data-seat="${i}">
      <div class="cat-pname"><i class="cat-dot" style="background:${seatColor(i)}"></i><span>${esc(ctx.seatName(i))}</span><b class="cat-score">${p.score}</b></div>
      <div class="cat-pstate">${esc(ctx.t(cur ? 'ui.statePlaying' : 'ui.stateWaiting'))}</div>
      <div class="cat-minis" aria-label="${esc(ctx.t('ui.cards', { n: p.handTotal }))}">${hand}</div>
      <div class="cat-vills">${vills || `<span class="cat-pnote">${esc(ctx.t('ui.noVillages'))}</span>`}</div>
    </div>`;
  }).join('')}</div>`;
}

/** Textura dos hexágonos (token --tile-texture, "Aparência" na consola): uma
 * imagem sobreposta por multiplicação, para não perder as cores. Lê o token
 * do estilo calculado (a plataforma aplica-o em folhas de estilo próprias) e
 * extrai o url(); sem imagem ou com intensidade 0, não há textura. Devolve o
 * href para o <pattern> (ver renderBoard) ou null. */
function tileTexture() {
  if (!root) return null;
  const cs = getComputedStyle(root);
  const strength = parseFloat(cs.getPropertyValue('--tile-texture-strength'));
  if (!(strength > 0)) return null;
  const m = /url\(\s*(['"]?)(.*?)\1\s*\)/i.exec(cs.getPropertyValue('--tile-texture'));
  return m ? m[2] : null;
}

function renderBoard(v) {
  const xs = v.hexes.map((h) => h.px.x);
  const ys = v.hexes.map((h) => h.px.y);
  const pad = 14;
  const minX = Math.min(...xs) - W3 / 2 - pad;
  const minY = Math.min(...ys) - R - pad;
  const w = Math.max(...xs) - Math.min(...xs) + W3 + pad * 2;
  const h = Math.max(...ys) - Math.min(...ys) + R * 2 + pad * 2;
  const tex = tileTexture();
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
    return `<g class="cat-hex${move ? ' can' : ''}${move?.type === 'MOVE_FIRE' ? ' firepick' : ''}${isFire ? ' fire' : ''}" data-hex="${hex.id}"
        ${move ? `role="button" tabindex="0" aria-label="${esc(label)}"` : `aria-label="${esc(label)}"`}>
      <title>${esc(label)}</title>
      <polygon class="cat-hex-shape" points="${hexPts(cx, cy, R - 1.5)}" style="fill:var(--cat-res-${hex.type})" stroke="rgb(0 0 0 / .5)" stroke-width="1.2"/>
      ${tex ? `<polygon class="cat-hex-tex" points="${hexPts(cx, cy, R - 1.5)}"/>` : ''}
      ${move ? `<polygon class="cat-hex-glow" points="${hexPts(cx, cy, R - 1.5)}"/>` : ''}
      <image href="${ICONS[hex.type]}" x="${cx - 16}" y="${cy - 22}" width="32" height="32" style="pointer-events:none"/>
      <text x="${cx}" y="${cy + 24}" text-anchor="middle" font-size="9" font-weight="600" fill="rgb(255 255 255 / .8)" style="font-family:var(--cat-font-display);pointer-events:none">${esc(name)}</text>
      ${!isVol && pile ? `<circle cx="${(cx + R * 0.52).toFixed(1)}" cy="${(cy - R * 0.52).toFixed(1)}" r="13" style="fill:var(--cat-panel-2);stroke:${RED.has(pile.value) ? 'var(--cat-red)' : 'var(--cat-gold-dark)'}" stroke-width="1.8"/>
        <text x="${(cx + R * 0.52).toFixed(1)}" y="${(cy - R * 0.52).toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="700" style="font-family:var(--cat-font-display);fill:${RED.has(pile.value) ? 'var(--cat-red)' : 'var(--cat-gold)'};pointer-events:none">${pile.value}</text>` : ''}
      ${workers}
      ${isFire ? `<g class="cat-fire-wrap" style="pointer-events:none"><ellipse class="cat-fire-glow" cx="${cx}" cy="${cy + 12}" rx="30" ry="18" style="animation-delay:${loopDelay(2.4)}"/>
        <image class="cat-fire" href="${ICONS.fogo}" x="${cx - 26}" y="${cy - 30}" width="52" height="52" style="animation-delay:${loopDelay(1.8)}"/></g>` : ''}
    </g>`;
  }).join('');
  // Para onde o fogo pode ir: contorno a pulsar por cima de todos os hexágonos (o brilho não fica tapado pelos vizinhos).
  const picks = v.hexes.filter((hex) => hexMove(hex.id)?.type === 'MOVE_FIRE')
    .map((hex) => `<polygon points="${hexPts(hex.px.x, hex.px.y, R - 1.5)}"/>`).join('');
  return `<svg viewBox="${minX.toFixed(0)} ${minY.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Catania">${tex ? `<defs><pattern id="cat-tex" patternUnits="userSpaceOnUse" width="520" height="355"><image href="${esc(tex)}" width="520" height="355" preserveAspectRatio="none"/></pattern></defs>` : ''}${renderFoam(v)}${hexes}${picks ? `<g class="cat-firepicks" aria-hidden="true" style="--pick-delay:${loopDelay(1.3)}">${picks}</g>` : ''}</svg>`;
}


const WAVE_PATHS = [
  'm 119.52692,120.03656 c -1.11461,-0.39774 -1.49432,-0.65484 -2.88329,-1.95231 -0.96756,-0.90382 -0.96756,-0.90382 -2.22271,-0.0403 -3.25067,2.23652 -7.15961,2.36142 -10.65497,0.34043 -1.27239,-0.73568 -1.37465,-1.1067 -0.13452,-0.48804 3.37049,1.68142 8.18319,0.81169 10.78812,-1.94957 1.04583,-1.1086 1.57301,-1.04046 2.95545,0.38196 2.7855,2.86607 5.66537,2.87377 9.05863,0.0242 1.43223,-1.20275 1.82387,-1.20488 2.96577,-0.0161 2.31388,2.40886 5.40246,2.69281 7.23728,0.66536 0.68227,-0.7539 1.0145,-0.70592 2.39182,0.34542 1.49616,1.14204 2.79204,1.58223 4.69217,1.59385 0.82677,0.005 1.36255,0.0987 1.19063,0.20799 -0.84693,0.5386 -4.32581,0.21359 -5.82884,-0.54455 -1.47081,-0.74189 -1.49569,-0.7449 -1.95551,-0.23643 -1.94175,2.14718 -5.36694,2.14262 -8.24165,-0.011 -0.58976,-0.44182 -1.00643,-0.58962 -1.21719,-0.43178 -3.15085,2.35969 -5.63715,3.00432 -8.14119,2.11078 z',
  'm 131.02309,123.97385 c -0.84237,-0.30059 -1.12933,-0.49489 -2.17904,-1.47545 -0.73123,-0.68306 -0.73123,-0.68306 -1.6798,-0.0305 -2.45669,1.69024 -5.41084,1.78464 -8.05244,0.25728 -0.96162,-0.55598 -1.0389,-0.83638 -0.1016,-0.36882 2.54723,1.27071 6.18441,0.61342 8.15307,-1.47339 0.79038,-0.83782 1.1888,-0.78632 2.23357,0.28867 2.10513,2.16601 4.28158,2.17183 6.84602,0.0184 1.0824,-0.90897 1.37839,-0.91058 2.24136,-0.0128 1.74871,1.82048 4.0829,2.03507 5.46955,0.50285 0.51562,-0.56977 0.76671,-0.5335 1.80761,0.26103 1.13072,0.8631 2.11006,1.19578 3.54608,1.20456 0.62483,0.004 1.02975,0.0746 0.89982,0.15719 -0.64006,0.40704 -3.26922,0.16141 -4.40512,-0.41154 -1.11156,-0.56069 -1.13036,-0.56296 -1.47786,-0.17869 -1.46749,1.62272 -4.05605,1.61928 -6.22861,-0.009 -0.4457,-0.33391 -0.76059,-0.44561 -0.91988,-0.32632 -2.38124,1.78333 -4.26025,2.27051 -6.15266,1.59522 z',
];

/**
 * Espuma do mar na costa da ilha: nos lados dos hexágonos que dão para o mar
 * (os que nenhum vizinho partilha), alguns troços têm uma pequena onda branca
 * que vem do mar até à costa, lenta e desfasada. Fica por baixo dos hexágonos; só é decoração.
 */
function renderFoam(v) {
  const vert = (hex, r, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return [hex.px.x + r * Math.cos(a), hex.px.y + r * Math.sin(a)];
  };
  const seen = new Map();
  const edges = [];
  for (const hex of v.hexes) {
    for (let i = 0; i < 6; i++) {
      const [ax, ay] = vert(hex, R, i);
      const [bx, by] = vert(hex, R, (i + 1) % 6);
      const key = `${Math.round((ax + bx) / 2)},${Math.round((ay + by) / 2)}`;
      seen.set(key, (seen.get(key) || 0) + 1);
      edges.push({ key, hex, i });
    }
  }
  const coast = edges.filter((e) => seen.get(e.key) === 1);
  // A onda (desenho do David, Inkscape): duas cristas, a maior por cima.
  const wave = `<defs><symbol id="cat-wave" viewBox="0 0 47.477158 9.0824566"><g transform="translate(-102.7544,-115.18111)">${WAVE_PATHS.map((d) => `<path d="${d}"/>`).join('')}</g></symbol></defs>`;
  return `${wave}<g class="cat-foam" aria-hidden="true">${coast.map((e, k) => {
    if (k % 3 === 2) return ''; // só algumas partes da costa
    const [ax, ay] = vert(e.hex, R, e.i);
    const [bx, by] = vert(e.hex, R, (e.i + 1) % 6);
    const [mx, my] = [(ax + bx) / 2, (ay + by) / 2];
    // para fora da ilha (do centro do hexágono para o meio do lado)
    const len = Math.hypot(mx - e.hex.px.x, my - e.hex.px.y);
    const ox = (mx - e.hex.px.x) / len;
    const oy = (my - e.hex.px.y) / len;
    // ao longo do lado, com o "de baixo" da onda (y local positivo) virado para o mar
    let ang = Math.atan2(by - ay, bx - ax);
    if (-ox * Math.sin(ang) + oy * Math.cos(ang) < 0) ang += Math.PI;
    const dur = 4.6 + (k % 4) * 0.7;
    return `<g class="cat-wave" style="--fx:${(ox * 7).toFixed(1)}px;--fy:${(oy * 7).toFixed(1)}px;animation-duration:${dur.toFixed(1)}s;animation-delay:${loopDelay(dur, k * 1.3)}">
      <use href="#cat-wave" x="-23" y="-4.4" width="46" height="8.8" transform="translate(${(mx + ox * 9).toFixed(1)} ${(my + oy * 9).toFixed(1)}) rotate(${(ang * 180 / Math.PI).toFixed(1)})"/></g>`;
  }).join('')}</g>`;
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
    <div class="cat-me-grp"><div class="cat-lbl">${esc(ctx.t('ui.hand'))} · ${esc(ctx.t('ui.cards', { n: p.handTotal }))}</div>
      <div class="cat-cards">${hand}</div></div>
  </div>`;
}

function renderPiles(v) {
  const rows = RES.map((r) => `<div class="cat-pile"><span class="cat-pile-name">${esc(ctx.t(`res.${r}`))}</span>${img(r, 18)}${disc(v.piles[r].value)}</div>`).join('');
  return `<aside class="cat-piles" data-tut="piles" aria-label="${esc(ctx.t('ui.piles'))}">
    <div class="cat-lbl">${esc(ctx.t('ui.piles'))}</div>${rows}</aside>`;
}

function renderLog() {
  const items = ui.logOpen ? [...(msg.log || [])].reverse() : [];
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
  const total = v.players[v.me].handTotal;
  // Só "Fundar aldeia" ganha texto informativo (quantas cartas faltam, a
  // contar até 0) — os outros botões dizem só a ação; a info da torre já
  // está nas fichas de cima (.cat-chips), não precisa de repetir aqui.
  const missing = Math.max(0, 5 - total);
  const foundSub = !found && !t.founded && missing > 0 ? ctx.t(missing === 1 ? 'ui.foundMissing1' : 'ui.foundMissing', { n: missing }) : '';
  const step = t.founded || t.collects >= 2 ? 'ui.collectDone' : t.collects === 0 ? 'ui.collectStep1' : 'ui.collectStep2';
  const done = t.collects > 0 || t.founded;
  return `<div class="cat-step">${esc(ctx.t(step))}</div>
    ${!t.founded && t.collects < 2 ? `
      ${btn(ctx.t('ui.collect1'), `data-act="c1" ${c1 ? '' : 'disabled'}`, 'pri')}
      ${btn(ctx.t('ui.collect2'), `data-act="c2" ${c2 ? '' : 'disabled'}`)}` : ''}
    ${btn(ctx.t('ui.found'), `data-act="found" ${found ? '' : 'disabled'}`, found ? 'pri' : '', foundSub)}
    ${btn(ctx.t(done ? 'ui.endTurn' : 'ui.pass'), `data-act="end" ${legal('END_TURN').length ? '' : 'disabled'}`)}`;
}

/** Faixa de jogadores (telemóvel): o redesenho não a faz voltar ao início; quando a vez muda, mostra quem joga. */
function keepStrip(x, cur) {
  const strip = view.querySelector('.cat-players');
  if (!strip) return;
  strip.scrollLeft = x;
  if (ui.stripCur === cur) return;
  ui.stripCur = cur;
  const card = strip.querySelector(`[data-seat="${cur}"]`);
  if (!card || strip.scrollWidth <= strip.clientWidth) return;
  const s = strip.getBoundingClientRect();
  const c = card.getBoundingClientRect();
  if (c.left < s.left || c.right > s.right) strip.scrollTo({ left: strip.scrollLeft + c.left - s.left, behavior: 'smooth' });
}

// ─── Zoom e arrastar no tabuleiro ───────────────────────────
// O tabuleiro (.cat-view) ocupa o ecrã inteiro, por baixo da UI (ADR-014).
// Com zoom 1 a ilha encaixa na zona livre (.cat-board, a célula da grelha
// entre os jogadores e a barra); ao aproximar ou arrastar, passa por baixo
// dos painéis. As coordenadas do zoom são relativas a essa zona.
// A zona é medida uma vez e fica fixa enquanto o ecrã não mudar de tamanho:
// os painéis que crescem e encolhem (ações, a minha área, o registo) mudam a
// célula, mas o tabuleiro não se mexe com eles. Volta a medir ao rodar o
// ecrã, ao mudar o tamanho da janela ou no botão de encaixar.
const EDGE = 60; // px da ilha que ficam sempre no ecrã
let frame = null; // { L, T, w, h, ow, oh }: zona livre relativa a .cat-view

function measureFrame(o) {
  const cell = view?.querySelector('.cat-board');
  if (!cell) return null;
  const r = cell.getBoundingClientRect();
  return { L: r.left - o.left, T: r.top - o.top, w: r.width, h: r.height, ow: o.width, oh: o.height };
}

/** A zona livre (fixa) em coordenadas do ecrã. */
function boardRect(refit = false) {
  const vw = view?.querySelector('.cat-view');
  if (!vw) return null;
  const o = vw.getBoundingClientRect();
  if (refit || !frame || !frame.w || frame.ow !== o.width || frame.oh !== o.height) frame = measureFrame(o);
  if (!frame) return null;
  return { left: o.left + frame.L, top: o.top + frame.T, width: frame.w, height: frame.h };
}

/** `limit`: depois de um gesto, não deixar a ilha sair do ecrã. */
function applyZoom(limit = false, refit = false) {
  const vw = view?.querySelector('.cat-view');
  const z = view?.querySelector('.cat-zoom');
  const r = boardRect(refit);
  if (!vw || !z || !r) return;
  const o = vw.getBoundingClientRect();
  const L = r.left - o.left;
  const T = r.top - o.top;
  Object.assign(z.style, { left: `${L}px`, top: `${T}px`, width: `${r.width}px`, height: `${r.height}px` });
  if (limit && o.width && r.width) {
    const { s } = ui.zoom;
    const clamp = (v, lo, hi) => Math.min(Math.max(v, Math.min(lo, hi)), Math.max(lo, hi));
    ui.zoom = {
      s,
      x: clamp(ui.zoom.x, EDGE - L - r.width * s, o.width - EDGE - L),
      y: clamp(ui.zoom.y, EDGE - T - r.height * s, o.height - EDGE - T),
    };
  }
  const { s, x, y } = ui.zoom;
  z.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
}

function zoomAt(px, py, f) {
  const { s, x, y } = ui.zoom;
  const ns = Math.min(ZOOM.max, Math.max(ZOOM.min, s * f));
  const k = ns / s;
  ui.zoom = { s: ns, x: px - (px - x) * k, y: py - (py - y) * k };
  applyZoom(true);
}

function viewCenter() {
  const r = boardRect();
  return r ? [r.width / 2, r.height / 2] : [0, 0];
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
  const r = boardRect();
  if (!el || !r) return;
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
    applyZoom(true);
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
    applyZoom(true);
  }
}

function onPointerUp(e) { ui.pts.delete(e.pointerId); }

function onWheel(e) {
  const el = e.target.closest('.cat-view');
  if (!el) return;
  e.preventDefault();
  const r = boardRect();
  if (!r) return;
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
    if (zb.dataset.zoom === 'fit') { ui.zoom = { s: 1, x: 0, y: 0 }; applyZoom(false, true); } else zoomAt(cx, cy, zb.dataset.zoom === 'in' ? 1.25 : 0.8);
    return;
  }
  const act = e.target.closest('[data-act]');
  if (!act || act.disabled) return;
  const a = act.dataset.act;
  if (a === 'piles') { ui.showPiles = !ui.showPiles; render(); return; }
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
