// Capivaras — UI própria (ADR-006, ADR-014). A plataforma monta este módulo na
// mesa, que ocupa o ecrã inteiro: `mount(el, ctx)` uma vez e `update(msg)` a
// cada estado (ROOM). Não repete regras: apostar numa carta é uma jogada de
// `msg.legal`. As cores vêm dos tokens --capi-* e --game-* (skin.json).
//
// Disposição (design/figma/TEMPLATE.md, como o Catania): jogadores em vidro no
// topo (no telemóvel, numa faixa com swipe), fichas da ronda, do baralho e do
// pássaro, as cartas da mesa ao centro, o registo flutuante à esquerda, a
// minha coleção e a barra de estado em baixo.

const CORES = ['Y', 'R', 'W', 'B'];
const RATIO = 842 / 600; // altura / largura da arte das cartas

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const asset = (rel) => new URL(rel, import.meta.url).href;
const seatColor = (i) => `var(--capi-p${(i % 6) + 1})`;
/** A imagem de cada carta: uma por combinação de capivaras, nenúfares e pássaro. */
const cardImg = (c) => asset(`./cartas/cap${c.capivaras}${c.nenufares.length ? `_${[...c.nenufares].sort().join('')}` : ''}${c.passaro ? '_bird' : ''}.webp`);
const BIRD = asset('./passaro.webp');

function ensureCss() {
  const href = asset('./capivaras.css');
  if ([...document.styleSheets].some((s) => s.href === href) || document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

let root = null;   // .capi (fica montado)
let view = null;   // conteúdo redesenhado a cada estado
let ctx = null;
let msg = null;
let resizeObs = null;
const fresh = () => ({ prev: null, logOpen: false });
let ui = fresh();

export function mount(el, context) {
  ctx = context;
  ensureCss();
  root = document.createElement('div');
  root.className = 'capi';
  view = document.createElement('div');
  view.className = 'capi-layout';
  root.append(view);
  el.append(root);
  root.addEventListener('click', onClick);
  // O tamanho das cartas segue o espaço livre ao centro (rodar o telemóvel, painéis que mudam).
  if (typeof ResizeObserver !== 'undefined') { resizeObs = new ResizeObserver(() => fitCards()); resizeObs.observe(root); }
}

export function unmount() {
  resizeObs?.disconnect(); resizeObs = null;
  root?.remove();
  root = null; view = null; msg = null;
  ui = fresh();
}

export function update(next) {
  msg = next;
  const v = msg.view;
  const me = mySeat();
  // Mensagens da mesa na revelação: o que aconteceu à minha aposta e ao pássaro.
  const prev = ui.prev;
  if (prev && v.fase === 'REVELACAO' && prev.fase !== 'REVELACAO' && me != null && v.revelacao) {
    const letra = v.revelacao.apostas[me];
    const carta = v.mesa.find((x) => x.letra === letra)?.carta;
    if (letra && v.revelacao.ganhos[letra] === me) announce(ctx.t('ui.youGot', { carta: letra }), ctx.t('ui.youGotSub', { n: carta?.capivaras ?? 0 }));
    else if (letra) announce(ctx.t('ui.youTied', { carta: letra }), '', 'warn');
  }
  if (prev && me != null && v.tokenPassaro !== prev.token) {
    if (v.tokenPassaro === me) announce(ctx.t('ui.birdYours'), '', 'gold');
    else if (prev.token === me) announce(ctx.t('ui.birdLost'), '', 'warn');
  }
  if (prev && (v.reciclagens || 0) > prev.recicl) announce(ctx.t('ui.recycled'), ctx.t('ui.recycledSub'));
  ui.prev = { fase: v.fase, token: v.tokenPassaro, recicl: v.reciclagens || 0 };
  render();
}

// ─── Mensagem da mesa (ADR-014): fila e animação são da plataforma ───
function announce(title, sub = '', variant = '') {
  if (ctx.messages === false) return;
  ctx.announce(title, sub, variant);
}

// ─── Jogadas legais ─────────────────────────────────────────
const mySeat = () => (msg && Number.isInteger(msg.seat) ? msg.seat : null);
const betMove = (letra) => (msg?.legal || []).find((m) => m.type === 'APOSTAR' && m.payload?.carta === letra);

function onClick(e) {
  const card = e.target.closest('[data-bet]');
  if (card) {
    const mv = betMove(card.dataset.bet);
    if (mv) { card.setAttribute('aria-busy', 'true'); ctx.move({ type: mv.type, payload: mv.payload }); }
    return;
  }
  if (e.target.closest('[data-act="logfold"]')) { ui.logOpen = !ui.logOpen; render(); }
}

// ─── Render ─────────────────────────────────────────────────
function render() {
  if (!view || !msg) return;
  const v = msg.view;
  const stripX = view.querySelector('.capi-players')?.scrollLeft ?? 0;
  view.innerHTML = `
    ${renderPlayers(v)}
    ${renderChips(v)}
    <div class="capi-center">${renderTable(v)}</div>
    <div class="capi-bottom">
      ${renderLog()}
      ${mySeat() != null ? renderMe(v) : '<div></div>'}
      <div></div>
    </div>
    ${msg.result ? '' : `<div class="capi-bar">${renderBar(v)}</div>`}`;
  fitCards();
  keepStrip(stripX);
  ctx.afterRender?.(root);
}

const cardsText = (n) => ctx.t(n === 1 ? 'ui.capybara1' : 'ui.capybaras', { n });
const lilyDot = (c, on = true) => `<i class="capi-lily${on ? '' : ' off'}" style="--c:var(--capi-lily-${c.toLowerCase()})" title="${esc(ctx.t(`ui.lily.${c}`))}"></i>`;

function renderPlayers(v) {
  const me = mySeat();
  const reveal = v.fase === 'REVELACAO' && v.revelacao;
  return `<div class="capi-players">${v.jogadores.map((j, i) => {
    const p = v.players?.[i] || {};
    // Nas apostas, a vista diz só se cada um já apostou (a minha traz a letra).
    const thinking = v.fase === 'APOSTAS' && !v.apostas?.[i];
    const state = reveal
      ? (v.revelacao.apostas[i] ? ctx.t('ui.betOn', { carta: v.revelacao.apostas[i] }) : ctx.t('ui.noBet'))
      : v.fase === 'APOSTAS' ? ctx.t(thinking ? 'ui.thinking' : 'ui.betDone') : '';
    const won = reveal && Object.values(v.revelacao.ganhos).includes(i);
    const cores = new Set(j.apanhadas.flatMap((c) => c.nenufares));
    const token = v.tokenPassaro === i;
    return `<div class="capi-player${thinking ? ' thinking' : ''}${won ? ' won' : ''}${i === me ? ' me' : ''}" data-seat="${i}">
      <div class="capi-pname"><i class="capi-dot" style="background:${seatColor(i)}"></i><span>${esc(ctx.seatName(i))}</span><b class="capi-score">${p.score ?? 0}</b></div>
      <div class="capi-pstate">${esc(state)}</div>
      <div class="capi-pinfo">
        <span class="capi-birds${token ? ' token' : ''}" title="${esc(token ? ctx.t('ui.birdToken') : ctx.t('ui.birds', { n: j.passaros }))}"><img src="${BIRD}" alt="" width="16" height="16">${j.passaros}${token ? ' <b>+5</b>' : ''}</span>
        <span class="capi-lilies" aria-label="${esc(ctx.t('ui.lilies'))}">${CORES.map((c) => lilyDot(c, cores.has(c))).join('')}</span>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function renderChips(v) {
  const holder = v.tokenPassaro;
  const pass = (v.reciclagens || 0) > 0 ? ctx.t('ui.pass2') : ctx.t('ui.pass1');
  return `<div class="capi-chips">
    <span class="capi-chip">${esc(ctx.t('ui.round', { n: v.ronda }))}</span>
    <span class="capi-chip${(v.reciclagens || 0) > 0 ? ' hot' : ''}">${esc(pass)} <span class="capi-chip-sub">· ${esc(ctx.t('ui.deckLeft', { n: v.baralhoRestante }))}</span></span>
    <span class="capi-chip${holder != null ? ' gold' : ''}"><img src="${BIRD}" alt="" width="18" height="18">${esc(holder != null ? ctx.t('ui.birdOf', { nome: ctx.seatName(holder) }) : ctx.t('ui.birdNone'))}</span>
  </div>`;
}

function cardDesc(c) {
  return [cardsText(c.capivaras), ...c.nenufares.map((n) => ctx.t(`ui.lily.${n}`)), c.passaro ? ctx.t('ui.bird') : ''].filter(Boolean).join(', ');
}

function renderTable(v) {
  const me = mySeat();
  const reveal = v.fase === 'REVELACAO' && v.revelacao;
  const myBet = me != null ? (reveal ? v.revelacao.apostas[me] : v.apostas?.[me]) : null;
  return `<div class="capi-table" style="--n:${v.mesa.length}">${v.mesa.map((x) => {
    const c = x.carta;
    const mv = betMove(x.letra);
    const mine = typeof myBet === 'string' && myBet === x.letra;
    let badge = '';
    let cls = '';
    if (reveal) {
      const quem = v.revelacao.apostas.map((a, s) => (a === x.letra ? s : null)).filter((s) => s != null);
      const w = v.revelacao.ganhos[x.letra];
      cls = w != null ? ' won' : quem.length ? ' fled' : ' none';
      badge = w != null
        ? `<span class="capi-who win" style="--c:${seatColor(w)}">${esc(ctx.seatName(w))}</span>`
        : quem.length
          ? `<span class="capi-who fled">${esc(ctx.t('ui.ranAway'))}</span><span class="capi-bettors">${quem.map((s) => `<i style="background:${seatColor(s)}" title="${esc(ctx.seatName(s))}"></i>`).join('')}</span>`
          : `<span class="capi-who">${esc(ctx.t('ui.nobody'))}</span>`;
    } else if (mine) {
      badge = `<span class="capi-who mine">${esc(ctx.t('ui.yourBet'))}</span>`;
    }
    const label = ctx.t('ui.cardAria', { carta: x.letra, desc: cardDesc(c) });
    const tag = mv ? 'button' : 'div';
    return `<${tag} class="capi-card${mv ? ' can' : ''}${mine ? ' mine' : ''}${cls}" ${mv ? `data-bet="${esc(x.letra)}" type="button"` : 'role="img"'} aria-label="${esc(label)}">
      <img class="capi-art" src="${cardImg(c)}" alt="" draggable="false">
      <span class="capi-letter">${esc(x.letra)}</span>
      ${badge}
      <span class="capi-cap"><b>${c.capivaras}</b>${c.nenufares.map((n) => lilyDot(n)).join('')}${c.passaro ? `<img src="${BIRD}" alt="" width="16" height="16">` : ''}</span>
    </${tag}>`;
  }).join('')}</div>`;
}

function renderMe(v) {
  const j = v.jogadores[mySeat()];
  const cores = new Set(j.apanhadas.flatMap((c) => c.nenufares));
  const falta = CORES.filter((c) => !cores.has(c)).length;
  const cards = j.apanhadas.map((c) => `<img class="capi-mini" src="${cardImg(c)}" alt="${esc(cardDesc(c))}" title="${esc(cardDesc(c))}">`).join('');
  return `<div class="capi-me">
    <div class="capi-me-grp capi-me-cards">
      <div class="capi-lbl">${esc(ctx.t('ui.myCards'))} · ${j.apanhadas.reduce((t, c) => t + c.capivaras, 0)}</div>
      <div class="capi-minis">${cards || `<span class="capi-note">${esc(ctx.t('ui.myCardsEmpty'))}</span>`}</div>
    </div>
    <i class="capi-vsep" aria-hidden="true"></i>
    <div class="capi-me-grp">
      <div class="capi-lbl">${esc(ctx.t('ui.lilies'))}</div>
      <div class="capi-lilyset">${CORES.map((c) => `<span class="capi-lilyname${cores.has(c) ? '' : ' off'}">${lilyDot(c, cores.has(c))}${esc(ctx.t(`ui.lily.${c}`))}</span>`).join('')}</div>
      <div class="capi-note${falta ? '' : ' ok'}">${esc(falta ? ctx.t('ui.liliesMissing', { n: falta }) : ctx.t('ui.liliesAll'))}</div>
    </div>
    <i class="capi-vsep" aria-hidden="true"></i>
    <div class="capi-me-grp">
      <div class="capi-lbl">${esc(ctx.t('ui.bird'))}</div>
      <span class="capi-birds big${v.tokenPassaro === mySeat() ? ' token' : ''}"><img src="${BIRD}" alt="" width="24" height="24">${j.passaros}${v.tokenPassaro === mySeat() ? ' <b>+5</b>' : ''}</span>
    </div>
  </div>`;
}

function logParams(l) {
  const p = { ...(l.params || {}) };
  if (Number.isInteger(p.jogador)) p.jogador = ctx.seatName(p.jogador - 1);
  if (typeof p.jogadores === 'string') p.jogadores = p.jogadores.split(',').map((s) => ctx.seatName(Number(s) - 1)).join(', ');
  return p;
}

function renderLog() {
  const items = ui.logOpen ? [...(msg.log || [])].filter((l) => l.key !== 'log.APOSTOU').reverse() : [];
  return `<aside class="capi-log">
    <button class="capi-lbl capi-log-head" data-act="logfold" aria-expanded="${ui.logOpen}">${esc(ctx.t('ui.log'))} ${ui.logOpen ? '▾' : '▸'}</button>
    ${items.length ? `<ol>${items.map((l) => `<li>${esc(ctx.t(`ui.${l.key}`, logParams(l)))}</li>`).join('')}</ol>` : ''}
  </aside>`;
}

function renderBar(v) {
  const me = mySeat();
  const total = v.jogadores.length;
  if (v.fase === 'REVELACAO') {
    return `<div class="capi-info"><b>${esc(ctx.t('ui.reveal'))}</b><small>${esc(ctx.t('ui.nextRound'))}</small></div>
      <span class="capi-timer" style="animation-duration:${v.revelacao?.duracaoMs || 5000}ms"></span>`;
  }
  if (v.fase !== 'APOSTAS') return '';
  const done = (v.apostas || []).filter(Boolean).length;
  if (me == null) return `<p class="capi-wait">${esc(ctx.t('ui.watching', { n: done, total }))}</p>`;
  const mine = v.apostas?.[me];
  if (typeof mine === 'string') {
    return `<div class="capi-info"><b>${esc(ctx.t('ui.waiting', { carta: mine }))}</b><small>${esc(ctx.t('ui.waitingSub', { n: done, total }))}</small></div>`;
  }
  return `<div class="capi-info pick"><b>${esc(ctx.t('ui.pick'))}</b><small>${esc(ctx.t('ui.pickSub'))}</small></div>
    <span class="capi-count">${done}/${total}</span>`;
}

/** Cartas o maior possível no espaço livre ao centro, em linhas equilibradas. */
function fitCards() {
  const box = view?.querySelector('.capi-center');
  const table = view?.querySelector('.capi-table');
  if (!box || !table) return;
  const n = table.children.length || 1;
  const { width: w, height: h } = box.getBoundingClientRect();
  if (!w || !h) return;
  const gap = w < 480 ? 8 : 14;
  let best = 0;
  let bestCols = n;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cw = Math.min((w - gap * (cols - 1)) / cols, (h - gap * (rows - 1)) / rows / RATIO, 230);
    if (cw > best + 0.5) { best = cw; bestCols = cols; }
  }
  table.style.setProperty('--cw', `${Math.max(60, Math.floor(best))}px`);
  table.style.setProperty('--cols', bestCols);
  table.style.setProperty('--gap', `${gap}px`);
}

/** Faixa de jogadores (telemóvel): o redesenho não a faz voltar ao início. */
function keepStrip(x) {
  const strip = view.querySelector('.capi-players');
  if (strip) strip.scrollLeft = x;
}
