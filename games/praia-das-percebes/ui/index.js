// Praia das Percebes — UI própria (ADR-006, ADR-014). Não repete regras:
// colocar uma peça é clicar numa casa livre do tabuleiro (uma jogada de
// msg.legal), tal como escolher a direção do salva-vidas é um botão da
// barra. Os componentes reutilizáveis (peças, cartas de objetivo, o
// marcador do salva-vidas) seguem a convenção do CONTRATO.md: tokens
// --card-<tipo>/--token-<nome> no skin.json, tipo "image"; sem imagem
// ainda (por publicar), a UI recua para um emoji.
//
// Tabuleiro com zoom e arrastar (dois dedos, roda, botões) tal como o
// Catania: `.pdp-view` ocupa o ecrã inteiro por baixo da UI, `.pdp-center`
// é só a zona livre medida para encaixar a grelha com zoom 1.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const TILE_EMOJI = { normal: '🧍', prancha: '🏄', rocha: '🪨', areia: '▫️' };
const OBJ_EMOJI = { quadrado3: '🔲', quadrado5: '⬛', linha5: '↔️', linha7: '➡️', coluna4: '↕️', coluna6: '⬆️', pranchas: '🏄', excursao: '🧳' };
const LIFEGUARD_EMOJI = '🛟';
// Ícone do vento (svgrepo.com), um só <path>: recolorido por CSS (fill: currentColor via var(--game-on-table)).
const WIND_PATH = 'M156.7 256H16c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h142.2c15.9 0 30.8 10.9 33.4 26.6 3.3 20-12.1 37.4-31.6 37.4-14.1 0-26.1-9.2-30.4-21.9-2.1-6.3-8.6-10.1-15.2-10.1H81.6c-9.8 0-17.7 8.8-15.9 18.4 8.6 44.1 47.6 77.6 94.2 77.6 57.1 0 102.7-50.1 95.2-108.6C249 291 205.4 256 156.7 256zM16 224h336c59.7 0 106.8-54.8 93.8-116.7-7.6-36.2-36.9-65.5-73.1-73.1-55.4-11.6-105.1 24.9-114.9 75.5-1.9 9.6 6.1 18.3 15.8 18.3h32.8c6.7 0 13.1-3.8 15.2-10.1C325.9 105.2 337.9 96 352 96c19.4 0 34.9 17.4 31.6 37.4-2.6 15.7-17.4 26.6-33.4 26.6H16c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16zm384 32H243.7c19.3 16.6 33.2 38.8 39.8 64H400c26.5 0 48 21.5 48 48s-21.5 48-48 48c-17.9 0-33.3-9.9-41.6-24.4-2.9-5-8.7-7.6-14.5-7.6h-33.8c-10.9 0-19 10.8-15.3 21.1 17.8 50.6 70.5 84.8 129.4 72.3 41.2-8.7 75.1-41.6 84.7-82.7C526 321.5 470.5 256 400 256z';
const ZOOM = { min: 0.6, max: 3 };
const EDGE = 40; // px do tabuleiro que ficam sempre no ecrã
const GAP = 4;

function ensureCss() {
  const href = new URL('./praia-das-percebes.css', import.meta.url).href;
  if ([...document.styleSheets].some((s) => s.href === href) || document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

/** Lê um token --<nome> do skin.json já aplicado (url("...") → o caminho). */
function tokenUrl(name) {
  if (!root) return '';
  const raw = getComputedStyle(root).getPropertyValue(`--${name}`).trim();
  const m = raw.match(/^url\((['"]?)([\s\S]*)\1\)$/);
  return m ? m[2] : '';
}
/** <img> se o token tiver imagem; senão o emoji de recuo. */
function art(tokenName, fallbackKey, emoji) {
  const url = tokenUrl(tokenName);
  return url
    ? `<img src="${esc(url)}" data-fallback="${esc(fallbackKey)}" alt="">`
    : `<span class="pdp-emoji-fallback">${emoji}</span>`;
}

let root = null;
let view = null;
let ctx = null;
let msg = null;
const fresh = () => ({ logOpen: true, zoom: { s: 1, x: 0, y: 0 }, pts: new Map(), dragged: false, moved: 0 });
let ui = fresh();
let boardDims = { rows: 1, cols: 1 };
let resizeObs = null;

/** Uma <img data-fallback="chave"> que falhe a carregar vira o emoji da peça/carta/marcador. */
function onImgError(e) {
  const img = e.target;
  if (img.tagName !== 'IMG' || !img.dataset.fallback) return;
  const key = img.dataset.fallback;
  const emoji = TILE_EMOJI[key] ?? OBJ_EMOJI[key] ?? (key === 'salvavidas' ? LIFEGUARD_EMOJI : '');
  img.replaceWith(Object.assign(document.createElement('span'), { className: 'pdp-emoji-fallback', textContent: emoji }));
}

export function mount(el, context) {
  ctx = context;
  ensureCss();
  root = document.createElement('div');
  root.className = 'pdp';
  root.append(renderWind());
  view = document.createElement('div');
  view.className = 'pdp-layout';
  root.append(view);
  el.append(root);
  root.addEventListener('click', onClickCapture, true);
  root.addEventListener('click', onClick);
  root.addEventListener('error', onImgError, true);
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', onPointerUp);
  root.addEventListener('pointercancel', onPointerUp);
  root.addEventListener('wheel', onWheel, { passive: false });
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
  render();
}

const mySeat = () => (msg && Number.isInteger(msg.seat) ? msg.seat : null);

/** Um arrastar no tabuleiro não conta como clique numa casa. */
function onClickCapture(e) {
  if (ui.dragged && e.target.closest('.pdp-view')) { e.stopPropagation(); e.preventDefault(); }
  ui.dragged = false;
}

function onClick(e) {
  const place = e.target.closest('[data-place]');
  if (place) {
    const [r, c] = place.dataset.place.split(',').map(Number);
    const mv = (msg.legal || []).find((m) => m.type === 'COLOCAR' && m.payload.r === r && m.payload.c === c);
    if (mv) ctx.move({ type: mv.type, payload: mv.payload });
    return;
  }
  const zb = e.target.closest('[data-zoom]');
  if (zb) {
    const [cx, cy] = viewCenter();
    if (zb.dataset.zoom === 'fit') { ui.zoom = { s: 1, x: 0, y: 0 }; applyZoom(false, true); } else zoomAt(cx, cy, zb.dataset.zoom === 'in' ? 1.25 : 0.8);
    return;
  }
  const bar = e.target.closest('[data-idx]');
  if (bar) { const mv = msg.legal?.[Number(bar.dataset.idx)]; if (mv) ctx.move({ type: mv.type, payload: mv.payload }); return; }
  if (e.target.closest('[data-act="logfold"]')) { ui.logOpen = !ui.logOpen; render(); }
}

function render() {
  if (!view || !msg) return;
  const v = msg.view;
  const me = mySeat();
  view.innerHTML = `
    <div class="pdp-view"><div class="pdp-zoom">${renderBoard(v)}</div></div>
    ${renderPlayers(v, me)}
    ${renderObjectives(v)}
    <div class="pdp-center" data-tut="board">
      <div class="pdp-zoombar">
        <button class="pdp-zb" data-zoom="in" type="button" aria-label="${esc(ctx.t('ui.zoomIn'))}">+</button>
        <button class="pdp-zb" data-zoom="out" type="button" aria-label="${esc(ctx.t('ui.zoomOut'))}">−</button>
        <button class="pdp-zb" data-zoom="fit" type="button" aria-label="${esc(ctx.t('ui.zoomFit'))}">⤢</button>
      </div>
    </div>
    <div class="pdp-bottom">
      ${renderLog()}
      ${renderPiece(v, me)}
    </div>
    ${msg.result ? '' : `<div class="pdp-bar">${renderBar(v, me)}</div>`}`;
  applyZoom();
}

function renderPlayers(v, me) {
  return `<div class="pdp-players">${v.jogadores.map((j, i) => `<div class="pdp-player${i === me ? ' me' : ''}${i === v.vez ? ' active' : ''}">
    <div class="pdp-pname"><i class="pdp-dot" style="background:var(--game-color-${i + 1})"></i><span>${esc(ctx.seatName(i))}</span><b class="pdp-score">${j.pts}</b></div>
    <div class="pdp-pmeta">
      <span>${art('token-salvavidas', 'salvavidas', LIFEGUARD_EMOJI)}×${j.fichas}</span>
      <span>${esc(ctx.t('ui.objPts', { n: j.objPts }))}</span>
    </div>
  </div>`).join('')}</div>`;
}

function renderObjectives(v) {
  const extra = v.porRevelar > 0 ? `<span class="pdp-note">${esc(ctx.t('ui.toReveal', { n: v.porRevelar }))}</span>` : '';
  return `<div class="pdp-objectives">
    <div class="pdp-lbl">${esc(ctx.t('ui.objectives'))}</div>
    <div class="pdp-obj-row">
      ${v.objetivos.map((o) => `<div class="pdp-obj">
        <div class="pdp-obj-art">${art(`card-${o.id}`, o.id, OBJ_EMOJI[o.id] ?? '❔')}</div>
        <div class="pdp-obj-text"><b>${esc(ctx.t(`obj.${o.id}`))}</b><span>+${o.pts}</span></div>
      </div>`).join('')}
      ${extra}
    </div>
  </div>`;
}

function tileCell(p) {
  return `${art(`card-${p.tipo}`, p.tipo, TILE_EMOJI[p.tipo] ?? '❔')}${p.banhistas > 0 ? `<b class="pdp-n">${p.banhistas}</b>` : ''}`;
}

function renderBoard(v) {
  const cells = Object.entries(v.tabuleiro).map(([k, p]) => { const [r, c] = k.split(',').map(Number); return { r, c, p }; });
  const legalPlace = (msg.legal || []).filter((m) => m.type === 'COLOCAR');
  const ghosts = legalPlace.map((m) => ({ r: m.payload.r, c: m.payload.c }));
  const all = [...cells.map((x) => ({ r: x.r, c: x.c })), ...ghosts];
  const minR = Math.min(...all.map((x) => x.r));
  const maxR = Math.max(...all.map((x) => x.r));
  const minC = Math.min(...all.map((x) => x.c));
  const maxC = Math.max(...all.map((x) => x.c));
  boardDims = { rows: maxR - minR + 1, cols: maxC - minC + 1 };
  const g = (r, c) => `grid-row:${r - minR + 1};grid-column:${c - minC + 1}`;
  const tiles = cells.map(({ r, c, p }) => {
    const lg = v.salvaVidas.find((s) => s.r === r && s.c === c);
    const last = v.ultima && v.ultima.r === r && v.ultima.c === c ? ' last' : '';
    return `<div class="pdp-cell tile ${p.tipo}${last}" style="${g(r, c)}" title="${esc(ctx.t(`peca.${p.tipo}`))}${p.banhistas ? ` (${p.banhistas})` : ''}">
      ${tileCell(p)}
      ${lg ? `<i class="pdp-lg" style="--pc:var(--game-color-${lg.jogador + 1})" title="${esc(ctx.t(lg.dir === 'h' ? 'moveLabel.SALVA_VIDAS_H' : 'moveLabel.SALVA_VIDAS_V'))}">${art('token-salvavidas', 'salvavidas', LIFEGUARD_EMOJI)}<b>${lg.dir === 'h' ? '↔' : '↕'}</b></i>` : ''}
    </div>`;
  }).join('');
  const ghostCells = ghosts.map(({ r, c }) => `<button class="pdp-cell ghost" type="button" data-place="${r},${c}" style="${g(r, c)}" aria-label="${esc(ctx.t('ui.placeHere'))}"></button>`).join('');
  return `<div class="pdp-grid" style="--rows:${boardDims.rows};--cols:${boardDims.cols}">${tiles}${ghostCells}</div>`;
}

function renderPiece(v, me) {
  if (me == null || v.fase !== 'COLOCAR' || !v.peca || v.peca.escondida) return '<div></div>';
  return `<div class="pdp-piece">
    <div class="pdp-lbl">${esc(ctx.t('ui.myPiece'))}</div>
    <div class="pdp-cell tile ${v.peca.tipo} big">${tileCell(v.peca)}</div>
  </div>`;
}

function renderLog() {
  const items = [...(msg.log || [])].reverse().slice(0, ui.logOpen ? 5 : 0);
  return `<aside class="pdp-log">
    <button class="pdp-lbl pdp-log-head" data-act="logfold" aria-expanded="${ui.logOpen}">${esc(ctx.t('ui.log'))} ${ui.logOpen ? '▾' : '▸'}</button>
    ${items.length ? `<ol>${items.map((l) => `<li>${l.seat != null ? `<b>${esc(ctx.seatName(l.seat))}</b> ` : ''}${esc(ctx.t(l.key, l.params))}</li>`).join('')}</ol>` : ''}
  </aside>`;
}

function renderBar(v, me) {
  const legal = msg.legal || [];
  if (v.fase === 'COLOCAR') {
    if (me === v.vez) return `<p class="pdp-hint">${esc(ctx.t('ui.placeHint'))}</p>`;
    return `<p class="pdp-wait">${esc(ctx.t(me == null ? 'ui.spectating' : 'ui.turnOf', { nome: ctx.seatName(v.vez) }))}</p>`;
  }
  if (!legal.length) return `<p class="pdp-wait">${esc(ctx.t(me == null ? 'ui.spectating' : 'ui.turnOf', { nome: ctx.seatName(v.vez) }))}</p>`;
  return legal.map((mv, i) => `<button class="pdp-move" type="button" data-idx="${i}">${esc(ctx.t(mv.label.key, mv.label.params))}</button>`).join('');
}

/** Vento na praia: faixas de areia a passar, decorativas, atrás de tudo — criado
 * uma vez (não é regenerado a cada estado, por isso a animação nunca reinicia). */
function renderWind() {
  const wind = document.createElement('div');
  wind.className = 'pdp-wind';
  wind.setAttribute('aria-hidden', 'true');
  const defs = `<svg width="0" height="0" style="position:absolute"><defs><symbol id="pdp-wind-icon" viewBox="0 0 512 512"><path d="${WIND_PATH}"/></symbol></defs></svg>`;
  const gusts = Array.from({ length: 6 }, (_, i) => {
    const top = 8 + ((i * 37) % 90);
    const size = 30 + (i % 3) * 12;
    const dur = 7 + (i % 4) * 2.3;
    const delay = -(i * 2.7);
    return `<svg class="pdp-gust" viewBox="0 0 512 512" style="top:${top}%;width:${size}px;height:${size}px;animation-duration:${dur}s;animation-delay:${delay}s"><use href="#pdp-wind-icon"/></svg>`;
  }).join('');
  wind.innerHTML = defs + gusts;
  return wind;
}

// ─── Zoom e arrastar no tabuleiro (tal como o Catania) ───────
// `.pdp-view` ocupa o ecrã inteiro, por baixo da UI. Com zoom 1 o tabuleiro
// encaixa na zona livre (.pdp-center, a célula da grelha entre os
// objetivos e o registo); ao aproximar ou arrastar, passa por baixo dos
// painéis. A zona é medida uma vez e fica fixa enquanto o ecrã não mudar.
let frame = null; // { L, T, w, h, ow, oh }: zona livre relativa a .pdp-view

function measureFrame(o) {
  const cell = view?.querySelector('.pdp-center');
  if (!cell) return null;
  const r = cell.getBoundingClientRect();
  return { L: r.left - o.left, T: r.top - o.top, w: r.width, h: r.height, ow: o.width, oh: o.height };
}

function boardRect(refit = false) {
  const vw = view?.querySelector('.pdp-view');
  if (!vw) return null;
  const o = vw.getBoundingClientRect();
  if (refit || !frame || !frame.w || frame.ow !== o.width || frame.oh !== o.height) frame = measureFrame(o);
  if (!frame) return null;
  return { left: o.left + frame.L, top: o.top + frame.T, width: frame.w, height: frame.h };
}

// A grelha (gridW×gridH) fica centrada na zona livre (r), que raramente tem a
// mesma proporção (a grelha mantém as casas quadradas). `anchor` é por isso o
// ponto onde a grelha começa de facto no ecrã — diferente de r.left/r.top —
// e é a referência certa para "zoom aqui" (roda, pinça, botões); usar r.left
// como se fosse a origem fazia o zoom derivar para o lado sempre que a
// grelha não enchia a zona livre toda numa das direções.
let anchor = { left: 0, top: 0, w: 0, h: 0 };

/** `limit`: depois de um gesto, não deixar o tabuleiro sair do ecrã. */
function applyZoom(limit = false, refit = false) {
  const vw = view?.querySelector('.pdp-view');
  const z = view?.querySelector('.pdp-zoom');
  const r = boardRect(refit);
  if (!vw || !z || !r) return;
  const o = vw.getBoundingClientRect();
  const { rows, cols } = boardDims;
  const cell = Math.max(28, Math.min((r.width - GAP * (cols - 1)) / cols, (r.height - GAP * (rows - 1)) / rows, 64));
  const gridW = cell * cols + GAP * (cols - 1);
  const gridH = cell * rows + GAP * (rows - 1);
  const L = (r.left - o.left) + (r.width - gridW) / 2;
  const T = (r.top - o.top) + (r.height - gridH) / 2;
  Object.assign(z.style, { left: `${L}px`, top: `${T}px`, width: `${gridW}px`, height: `${gridH}px` });
  z.style.setProperty('--cell', `${Math.floor(cell)}px`);
  anchor = { left: o.left + L, top: o.top + T, w: gridW, h: gridH };
  if (limit && o.width && gridW) {
    const { s } = ui.zoom;
    const clamp = (v, lo, hi) => Math.min(Math.max(v, Math.min(lo, hi)), Math.max(lo, hi));
    ui.zoom = {
      s,
      x: clamp(ui.zoom.x, EDGE - L - gridW * s, o.width - EDGE - L),
      y: clamp(ui.zoom.y, EDGE - T - gridH * s, o.height - EDGE - T),
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
  return [anchor.w / 2, anchor.h / 2];
}

function onPointerDown(e) {
  const el = e.target.closest('.pdp-view');
  if (!el || (e.pointerType === 'mouse' && e.button !== 0)) return;
  ui.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ui.pts.size === 1) { ui.moved = 0; ui.dragged = false; }
}

function onPointerMove(e) {
  if (!ui.pts.has(e.pointerId)) return;
  const el = view.querySelector('.pdp-view');
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
    const mid = (a, b) => ({ x: (a.x + b.x) / 2 - anchor.left, y: (a.y + b.y) / 2 - anchor.top });
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
  const el = e.target.closest('.pdp-view');
  if (!el) return;
  e.preventDefault();
  zoomAt(e.clientX - anchor.left, e.clientY - anchor.top, Math.exp(-e.deltaY * 0.002));
}
