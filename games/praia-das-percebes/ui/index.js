// Praia das Percebes — UI própria (ADR-006, ADR-014). Não repete regras:
// colocar uma peça é clicar numa casa livre do tabuleiro (uma jogada de
// msg.legal), tal como escolher a direção do salva-vidas é um botão da
// barra. Os componentes reutilizáveis (peças, cartas de objetivo, o
// marcador do salva-vidas) seguem a convenção do CONTRATO.md: tokens
// --card-<tipo>/--token-<nome> no skin.json, tipo "image"; sem imagem
// ainda (por publicar), a UI recua para um emoji.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const TILE_EMOJI = { normal: '🧍', prancha: '🏄', rocha: '🪨', areia: '▫️' };
const OBJ_EMOJI = { quadrado3: '🔲', quadrado5: '⬛', linha5: '↔️', linha7: '➡️', coluna4: '↕️', coluna6: '⬆️', pranchas: '🏄', excursao: '🧳' };
const LIFEGUARD_EMOJI = '🛟';

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
const fresh = () => ({ logOpen: true });
let ui = fresh();

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
  view = document.createElement('div');
  view.className = 'pdp-layout';
  root.append(view);
  el.append(root);
  root.addEventListener('click', onClick);
  root.addEventListener('error', onImgError, true);
}

export function unmount() {
  root?.remove();
  root = null; view = null; msg = null;
  ui = fresh();
}

export function update(next) {
  msg = next;
  render();
  fitBoard();
}

const mySeat = () => (msg && Number.isInteger(msg.seat) ? msg.seat : null);

function onClick(e) {
  const place = e.target.closest('[data-place]');
  if (place) {
    const [r, c] = place.dataset.place.split(',').map(Number);
    const mv = (msg.legal || []).find((m) => m.type === 'COLOCAR' && m.payload.r === r && m.payload.c === c);
    if (mv) ctx.move({ type: mv.type, payload: mv.payload });
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
    ${renderPlayers(v, me)}
    ${renderObjectives(v)}
    <div class="pdp-center">${renderBoard(v)}</div>
    <div class="pdp-bottom">
      ${renderLog()}
      ${renderPiece(v, me)}
    </div>
    ${msg.result ? '' : `<div class="pdp-bar">${renderBar(v, me)}</div>`}`;
}

function renderPlayers(v, me) {
  return `<div class="pdp-players">${v.jogadores.map((j, i) => `<div class="pdp-player${i === me ? ' me' : ''}${i === v.vez ? ' active' : ''}">
    <div class="pdp-pname"><i class="pdp-dot" style="background:var(--game-color-${i + 1})"></i><span>${esc(ctx.seatName(i))}</span></div>
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
      ${v.objetivos.map((o) => `<div class="pdp-obj" title="${esc(ctx.t(`obj.${o.id}`))} (+${o.pts})">
        ${art(`card-${o.id}`, o.id, OBJ_EMOJI[o.id] ?? '❔')}
        <b class="pdp-obj-pts">+${o.pts}</b>
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
  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;
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
  return `<div class="pdp-grid" style="--rows:${rows};--cols:${cols}">${tiles}${ghostCells}</div>`;
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

/** As casas do tabuleiro ocupam o espaço livre ao centro, sem passar de um tamanho confortável. */
function fitBoard() {
  const grid = view?.querySelector('.pdp-grid');
  const box = view?.querySelector('.pdp-center');
  if (!grid || !box) return;
  const rows = Number(grid.style.getPropertyValue('--rows')) || 1;
  const cols = Number(grid.style.getPropertyValue('--cols')) || 1;
  const { width: w, height: h } = box.getBoundingClientRect();
  if (!w || !h) return;
  const gap = 4;
  const cell = Math.max(28, Math.min((w - gap * (cols - 1)) / cols, (h - gap * (rows - 1)) / rows, 64));
  grid.style.setProperty('--cell', `${Math.floor(cell)}px`);
  grid.style.setProperty('--gap', `${gap}px`);
}
