// Bulbous — UI própria (ADR-006, ADR-014). Não repete regras: apostar,
// trocar, passar e desempatar constroem a jogada diretamente (payload com
// as cartas escolhidas), em vez de percorrer msg.legal — para APOSTAR isso
// listaria um botão por cada subconjunto possível da mão (exponencial).
// ESCOLHER e DESEMPATAR têm poucas opções e usam msg.legal normalmente.
//
// Visual 1:1 com o jogo antigo (repositório bulbous): fundo quase-preto,
// roxo brilhante em destaque, 4 cores de bolbo. As 50 imagens em ./cards
// (16 Baelfungious + 34 cartas de charme) são as mesmas do jogo antigo
// (public/cards/*.webp), trazidas tal como estavam — o jogo antigo já as
// tinha como arte principal, com o cartão a puro CSS (símbolo + valor) só
// como recuo se a imagem falhar (client.html, mkCharm/mkBaelf: a mesma
// ideia é replicada aqui). Os bolbos colocados numa Baelfungious desenham-se
// por cima da própria arte, nas posições medidas no jogo antigo (SLOT_POS),
// coloridos pela cor de quem os colocou — os anéis vazios já estão na arte.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const CORES = ['red', 'blue', 'green', 'yellow'];
const SIMBOLO = { red: 'triangle', yellow: 'triangle', blue: 'circle', green: 'circle' };
const SIMBOLO_ICON = { triangle: '▲', circle: '●' };
const BAELF_EMOJI = { 1: '🌱', 2: '🍄', 3: '🧌', 4: '👑' };
/** Posição (%) de cada bolbo sobre a arte da Baelfungious, por nº de espaços
 * (medida no jogo antigo, client.html: SLOT_POS). */
const SLOT_POS = {
  1: [{ x: 49.6, y: 80.5 }],
  2: [{ x: 36.9, y: 80.4 }, { x: 62.3, y: 80.5 }],
  3: [{ x: 25.0, y: 80.6 }, { x: 49.6, y: 80.6 }, { x: 73.9, y: 80.6 }],
  4: [{ x: 49.7, y: 74.0 }, { x: 70.0, y: 80.7 }, { x: 29.0, y: 80.8 }, { x: 49.5, y: 87.1 }],
};

const asset = (rel) => new URL(rel, import.meta.url).href;
const baelfImg = (cor, espacos) => asset(`./cards/baelf_${cor}_${espacos}.webp`);
const charmImg = (c) => (c.tipo === 'joker' ? asset(`./cards/card_joker_${c.simbolo}.webp`) : c.tipo === 'duplo' ? asset(`./cards/card_${c.cor}_x2.webp`) : asset(`./cards/card_${c.cor}_${c.valor}.webp`));

function ensureCss() {
  const href = new URL('./bulbous.css', import.meta.url).href;
  if ([...document.styleSheets].some((s) => s.href === href) || document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

/** A imagem falhar (ficheiro em falta) remove-a: o cartão a CSS por baixo,
 * já sempre presente, fica visível sozinho. */
function onImgError(e) {
  e.target.closest('img.bulbous-art')?.remove();
}

let root = null;
let view = null;
let ctx = null;
let msg = null;
let resizeObs = null;
const fresh = () => ({ logOpen: false, doneSeat: null, selected: new Set(), declareOrder: [], declareRonda: null, prevKey: null, lastLogSeq: 0 });
let ui = fresh();

export function mount(el, context) {
  ctx = context;
  ensureCss();
  root = document.createElement('div');
  root.className = 'bulbous';
  view = document.createElement('div');
  view.className = 'bulbous-layout';
  root.append(view);
  el.append(root);
  root.addEventListener('click', onClick);
  root.addEventListener('error', onImgError, true);
  // A mão nunca quebra linha: sobrepõe as cartas conforme o espaço muda (rodar o telemóvel).
  if (typeof ResizeObserver !== 'undefined') { resizeObs = new ResizeObserver(() => fitHand()); resizeObs.observe(root); }
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
  // Muda de fase (ou de vaza): a seleção de cartas deixa de fazer sentido,
  // limpa para a próxima ação.
  const key = `${v.fase}-${v.vazaNum}-${v.ronda}`;
  if (ui.prevKey !== key) { ui.selected = new Set(); ui.prevKey = key; }
  // A sequência em construção só é limpa quando muda de ronda (nova sequência
  // por declarar) — nunca por causa de uma atualização qualquer entretanto
  // (ex.: outro jogador a ficar "away"), senão perdia-se o que já estava
  // escolhido antes de chegar a Confirmar.
  if (ui.declareRonda !== v.ronda) { ui.declareOrder = []; ui.declareRonda = v.ronda; }
  // Entradas do registo marcadas com { announce } (ex.: sequência declarada,
  // última ronda) viram mensagem da mesa — a UI genérica faz isto sozinha,
  // mas a UI própria tem de a chamar (ADR-014).
  for (const l of msg.log || []) {
    if (l.announce == null || (l.seq ?? 0) <= ui.lastLogSeq) continue;
    ctx.announce(ctx.t(l.announce.key, l.announce.params), '', l.announce.variant);
  }
  ui.lastLogSeq = Math.max(ui.lastLogSeq, ...(msg.log || []).map((l) => l.seq ?? 0));
  render();
}

const mySeat = () => (msg && Number.isInteger(msg.seat) ? msg.seat : null);

/** Espaços de Baelfungious ativa de todos os jogadores (mesa em jogo). */
function ativasList(v) {
  const out = [];
  v.jogadores.forEach((p, jogador) => p.ativas.forEach((b, posicao) => { if (b !== null) out.push({ jogador, posicao, baelf: p.baelfs[b] }); }));
  return out;
}

/** Quem pode agir agora (replica activePlayers(s) das regras, só para realce). */
function activeSeats(v) {
  if (v.fase === 'ESCOLHER') return new Set(v.porEscolher.map((r) => r.jogador));
  if (v.fase === 'SEQUENCIA') return new Set([v.governante]);
  if (v.fase === 'ACOES' && v.vaza) return new Set([v.vaza.aDescartar !== -1 ? v.vaza.aDescartar : v.vaza.ordem[v.vaza.atual]]);
  if (v.fase === 'DESEMPATE' && v.vaza) return new Set(v.vaza.empatados.filter((i) => !v.vaza.desempateFeito[i]));
  return new Set();
}

function symbolFor(cor) { return SIMBOLO[cor]; }

function cardVisual(c) {
  if (c.tipo === 'joker') return { top: SIMBOLO_ICON[c.simbolo], mid: '★', bot: 'Joker', colorVar: '--bulb-accent', joker: true };
  if (c.tipo === 'duplo') return { top: SIMBOLO_ICON[symbolFor(c.cor)], mid: '×2', bot: esc(ctx.t(`cor.${c.cor}`)), colorVar: `--bulb-${c.cor}` };
  return { top: SIMBOLO_ICON[symbolFor(c.cor)], mid: String(c.valor), bot: esc(ctx.t(`cor.${c.cor}`)), colorVar: `--bulb-${c.cor}` };
}

function onClick(e) {
  if (e.target.classList.contains('bulbous-done-backdrop') || e.target.closest('.bulbous-done-x')) { ui.doneSeat = null; render(); return; }
  const done = e.target.closest('[data-done]');
  if (done) { ui.doneSeat = Number(done.dataset.done); render(); return; }
  const choose = e.target.closest('[data-choose]');
  if (choose) {
    const baelf = Number(choose.dataset.choose);
    const mv = (msg.legal || []).find((m) => m.type === 'ESCOLHER' && m.payload.baelf === baelf);
    if (mv) ctx.move(mv);
    return;
  }
  const order = e.target.closest('[data-order]');
  if (order) {
    const [jogador, posicao] = order.dataset.order.split(',').map(Number);
    if (!ui.declareOrder.some((o) => o.jogador === jogador && o.posicao === posicao)) {
      ui.declareOrder = [...ui.declareOrder, { jogador, posicao }];
      render();
    }
    return;
  }
  const tie = e.target.closest('[data-tie]');
  if (tie) {
    const carta = tie.dataset.tie === 'none' ? null : Number(tie.dataset.tie);
    ctx.move({ type: 'DESEMPATAR', payload: { carta } });
    return;
  }
  const card = e.target.closest('[data-card]');
  if (card) {
    const id = Number(card.dataset.card);
    const next = new Set(ui.selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    ui.selected = next;
    render();
    return;
  }
  const act = e.target.closest('[data-act]');
  if (act) {
    const a = act.dataset.act;
    if (a === 'logfold') { ui.logOpen = !ui.logOpen; render(); return; }
    if (a === 'reset-order') { ui.declareOrder = []; render(); return; }
    if (a === 'confirm-order') { ctx.move({ type: 'DECLARAR', payload: { ordem: ui.declareOrder } }); return; }
    if (a === 'bet') { ctx.move({ type: 'APOSTAR', payload: { cartas: [...ui.selected] } }); return; }
    if (a === 'swap') { ctx.move({ type: 'TROCAR', payload: { cartas: [...ui.selected] } }); return; }
    if (a === 'pass') { ctx.move({ type: 'PASSAR', payload: {} }); return; }
    if (a === 'discard') { ctx.move({ type: 'DESCARTAR', payload: { cartas: [...ui.selected] } }); return; }
  }
}

function render() {
  if (!view || !msg) return;
  const v = msg.view;
  view.innerHTML = `
    <div class="bulbous-topline" data-tut="players">
      ${renderPlayers(v)}
      ${renderChips(v)}
    </div>
    <div class="bulbous-center" data-tut="center">${renderCenter(v)}</div>
    <div class="bulbous-bottom" data-tut="mine">
      ${renderMyBaelfs(v)}
    </div>
    ${renderHand(v)}
    ${msg.result ? '' : `<div class="bulbous-bar" data-tut="bar">${renderBar(v)}</div>`}
    ${renderLog()}
    ${renderDone(v)}`;
  fitHand();
  ctx.afterRender?.(); // o tutorial volta a pôr o destaque
}

/** As cartas da mão nunca quebram linha: sobrepõem-se (margem negativa) só o
 * necessário para caberem todas, em vez de encolher ou passar a duas linhas. */
function fitHand() {
  const box = view?.querySelector('.bulbous-hand');
  if (!box) return;
  const cards = [...box.children];
  if (cards.length < 2) return;
  const w = box.clientWidth;
  const cw = cards[0].getBoundingClientRect().width;
  if (!w || !cw) return;
  const gap = 7;
  const n = cards.length;
  // Largura total = cw*n + margem*(n-1) — a fórmula tem de contar a largura
  // de todas as cartas, não só da primeira, senão nunca sobrepõe a tempo.
  const step = cw * n + gap * (n - 1) <= w ? gap : (w - cw * n) / (n - 1);
  const minStep = -cw + 16; // pelo menos 16px de cada cartão visíveis
  const margin = `${Math.max(step, minStep)}px`;
  cards.forEach((c, i) => { c.style.marginLeft = i === 0 ? '0' : margin; });
}

function renderPlayers(v) {
  const me = mySeat();
  const active = activeSeats(v);
  return `<div class="bulbous-players">${v.jogadores.map((j, i) => {
    let estado = '';
    if (v.fase === 'ACOES' && v.vaza) {
      const acao = v.vaza.acoes[i];
      estado = acao === 'aposta' ? esc(ctx.t('ui.bet')) : acao === 'troca' ? esc(ctx.t('ui.swapped')) : acao === 'passa' ? esc(ctx.t('ui.passed')) : active.has(i) ? esc(ctx.t('ui.thinking')) : '';
    } else if (v.fase === 'DESEMPATE' && v.vaza) {
      estado = v.vaza.desempateFeito[i] ? '' : esc(ctx.t('ui.tieBreaking'));
    } else if (active.has(i)) {
      estado = esc(ctx.t('ui.thinking'));
    }
    return `<div class="bulbous-player${i === me ? ' me' : ''}${active.has(i) ? ' active' : ''}${v.governante === i ? ' governor' : ''}">
      ${v.governante === i ? '<i class="bulbous-gov" title="' + esc(ctx.t('ui.governor')) + '">👑</i>' : ''}
      <div class="bulbous-pname"><i class="bulbous-dot" style="background:var(--bulb-${j.cor});color:var(--bulb-${j.cor})"></i><span>${esc(ctx.seatName(i))}</span></div>
      <div class="bulbous-pcards">${esc(ctx.t('ui.hand'))}: ${j.mao ? j.mao.length : j.cartas}</div>
      <div class="bulbous-pstate">${estado}</div>
      ${renderMinis(j)}
      ${donePill(j, i)}
    </div>`;
  }).join('')}</div>`;
}

function renderMinis(j) {
  return `<div class="bulbous-minis">${j.baelfs.map((b, idx) => {
    if (!j.ativas.includes(idx) && !b.completa) return '';
    return `<span class="bulbous-mini${b.completa ? ' complete' : ''}" style="--pc:var(--bulb-${b.cor})" title="${esc(ctx.t(`esp.${b.espacos}`))} ${esc(ctx.t(`cor.${b.cor}`))}">
      <span class="bulbous-mini-dots">${Array.from({ length: b.espacos }, (_, k) => `<i class="bulbous-mini-dot${k < b.bolbos.length ? ' filled' : ''}"></i>`).join('')}</span>
    </span>`;
  }).join('')}</div>`;
}

/** Pill "Completas (N)" — só aparece quando já há Baelfungious completas; abre
 * o modal com elas (e os bolbos que cada uma leva). */
function donePill(j, seat) {
  const n = j.baelfs.filter((b) => b.completa).length;
  if (!n) return '';
  return `<button class="bulbous-donepill" type="button" data-done="${seat}" aria-label="${esc(ctx.t('ui.completed'))}" title="${esc(ctx.t('ui.completed'))}"><span class="bulbous-donepill-txt">${esc(ctx.t('ui.completed'))}</span><span class="bulbous-donepill-ico" aria-hidden="true">☑</span> (${n})</button>`;
}

/** Modal com as Baelfungious completas de um jogador, com scroll. */
function renderDone(v) {
  const seat = ui.doneSeat;
  const j = seat != null ? v.jogadores[seat] : null;
  if (!j) return '';
  const cards = j.baelfs.filter((b) => b.completa).map((b) => `<div class="bulbous-baelf-slot">${baelfCard(b, v)}</div>`).join('');
  return `<div class="bulbous-done-backdrop">
    <div class="bulbous-done-modal" role="dialog" aria-label="${esc(ctx.t('ui.completed'))}">
      <div class="bulbous-done-head"><span>${esc(ctx.t('ui.completed'))} — ${esc(ctx.seatName(seat))}</span><button class="bulbous-done-x" type="button" aria-label="${esc(ctx.t('ui.close'))}">✕</button></div>
      <div class="bulbous-done-list">${cards || `<span class="bulbous-lbl">${esc(ctx.t('ui.noneCompleted'))}</span>`}</div>
    </div>
  </div>`;
}

function renderChips(v) {
  return `<div class="bulbous-chips">
    <span>${esc(ctx.t('ui.round', { n: v.ronda }))}</span>
    <span>${esc(ctx.t('ui.deckLeft', { n: v.baralho }))}</span>
  </div>`;
}

function baelfCard(b, v, { clickable = false, choose = null, order = null, target = false, contested = false, selected = false, badge = null } = {}) {
  const cls = ['bulbous-baelf'];
  if (clickable) cls.push('clickable');
  if (target) cls.push('target');
  if (contested) cls.push('contested');
  if (selected) cls.push('selected');
  if (b.completa) cls.push('complete');
  const attrs = choose !== null ? `data-choose="${choose}"` : order !== null ? `data-order="${order}"` : '';
  // Um bolbo por dono, na posição medida na arte (SLOT_POS); anéis vazios
  // não precisam de nada — já aparecem vazios na própria imagem.
  const dots = b.bolbos.map((seat, k) => {
    const pos = SLOT_POS[b.espacos]?.[k];
    if (!pos) return '';
    const cor = v.jogadores[seat]?.cor;
    return `<i class="bulbous-baelf-dot" style="left:${pos.x}%;top:${pos.y}%;background:var(--bulb-${cor})" title="${esc(ctx.seatName(seat))}"></i>`;
  }).join('');
  return `<div class="${cls.join(' ')}" style="--bc:var(--bulb-${b.cor})" ${attrs} role="${attrs ? 'button' : 'img'}" tabindex="${attrs ? '0' : '-1'}" aria-label="${esc(ctx.t(`esp.${b.espacos}`))} ${esc(ctx.t(`cor.${b.cor}`))}">
    <img class="bulbous-art bulbous-baelf-img" src="${baelfImg(b.cor, b.espacos)}" alt="">
    <span class="bulbous-baelf-art bulbous-emoji-fallback">${BAELF_EMOJI[b.espacos]}</span>
    ${dots}
    ${badge ? `<span class="bulbous-baelf-badge">${badge}</span>` : ''}
  </div>`;
}

function renderCenter(v) {
  const me = mySeat();
  const at = ativasList(v);
  const seqIndex = (jogador, posicao) => {
    const list = v.sequencia || ui.declareOrder;
    const i = list.findIndex((o) => o.jogador === jogador && o.posicao === posicao);
    return i >= 0 ? i + 1 : null;
  };
  const mesa = at.map(({ jogador, posicao, baelf }) => {
    const isTarget = v.fase === 'ACOES' && v.vaza && v.vaza.alvoJogador === jogador && v.vaza.alvoPosicao === posicao;
    const isContested = v.fase === 'DESEMPATE' && v.vaza && v.vaza.alvoJogador === jogador && v.vaza.alvoPosicao === posicao;
    const orderable = v.fase === 'SEQUENCIA' && v.governante === me;
    const badge = seqIndex(jogador, posicao);
    return `<div class="bulbous-baelf-slot">
      <span class="bulbous-owner">${esc(ctx.seatName(jogador))}</span>
      ${baelfCard(baelf, v, { clickable: orderable, order: orderable ? `${jogador},${posicao}` : null, target: isTarget, contested: isContested, badge })}
    </div>`;
  }).join('');

  const escolher = v.fase === 'ESCOLHER' ? renderEscolher(v) : '';
  return mesa + escolher;
}

function renderEscolher(v) {
  const me = mySeat();
  if (me == null) return '';
  const opcoes = (msg.legal || []).filter((m) => m.type === 'ESCOLHER');
  if (!opcoes.length) return '';
  const p = v.jogadores[me];
  return `<div class="bulbous-escolher">
    <span class="bulbous-lbl">${esc(ctx.t('ui.chooseBaelf'))}</span>
    <div class="bulbous-choices">
      ${opcoes.map((m) => baelfCard(p.baelfs[m.payload.baelf], v, { clickable: true, choose: m.payload.baelf })).join('')}
    </div>
  </div>`;
}

function renderMyBaelfs(v) {
  const me = mySeat();
  if (me == null) return '<div></div>';
  return `<div class="bulbous-mybaelfs">${renderMinis(v.jogadores[me])}${donePill(v.jogadores[me], me)}</div>`;
}

function renderLog() {
  const items = ui.logOpen ? [...(msg.log || [])].reverse() : [];
  return `<aside class="bulbous-log">
    <button class="bulbous-lbl bulbous-log-head" data-act="logfold" aria-expanded="${ui.logOpen}">${esc(ctx.t('ui.log'))} ${ui.logOpen ? '▾' : '▸'}</button>
    ${items.length ? `<ol>${items.map((l) => `<li>${l.seat != null ? `<b>${esc(ctx.seatName(l.seat))}</b> ` : ''}${esc(ctx.t(l.key, l.params))}</li>`).join('')}</ol>` : ''}
  </aside>`;
}

function renderHand(v) {
  const me = mySeat();
  if (me == null) return '<div class="bulbous-hand"></div>';
  const mao = v.minhaMao || [];
  const aDescartar = v.fase === 'ACOES' && v.vaza && v.vaza.aDescartar === me;
  const podeSelecionar = v.fase === 'ACOES' && v.vaza && v.vaza.aDescartar === -1 && v.vaza.ordem[v.vaza.atual] === me;
  const jogaveis = new Set((msg.legal || []).filter((m) => m.type === 'APOSTAR').flatMap((m) => m.payload.cartas));
  const clickable = podeSelecionar || aDescartar;
  return `<div class="bulbous-hand" data-tut="hand">${mao.map((c) => {
    const vis = cardVisual(c);
    const sel = ui.selected.has(c.id);
    const dim = podeSelecionar && !aDescartar && !jogaveis.has(c.id) && !sel;
    return `<div class="bulbous-card${vis.joker ? ' joker' : ''}${sel ? ' selected' : ''}${clickable ? ' clickable' : ''}${dim ? ' dim' : ''}" style="--cc:var(${vis.colorVar})" ${clickable ? `data-card="${c.id}" role="button" tabindex="0"` : ''}>
      <span class="bulbous-card-top">${vis.top}</span>
      <span class="bulbous-card-mid">${vis.mid}</span>
      <span class="bulbous-card-bot">${vis.bot}</span>
      <img class="bulbous-art bulbous-card-img" src="${charmImg(c)}" alt="">
    </div>`;
  }).join('')}</div>`;
}

function renderBar(v) {
  const me = mySeat();
  if (me == null) return `<p class="bulbous-wait">${esc(ctx.t('ui.spectating'))}</p>`;

  if (v.fase === 'ESCOLHER') {
    const meuTurno = (msg.legal || []).some((m) => m.type === 'ESCOLHER');
    return meuTurno ? '' : `<p class="bulbous-wait">${esc(ctx.t('ui.waitingYou'))}</p>`;
  }
  if (v.fase === 'SEQUENCIA') {
    if (v.governante !== me) return `<p class="bulbous-wait">${esc(ctx.t('ui.waitSequence'))}</p>`;
    const at = ativasList(v);
    const done = ui.declareOrder.length === at.length && at.length > 0;
    return `<button class="bulbous-move" data-act="reset-order" type="button">${esc(ctx.t('ui.resetSequence'))}</button>
      <button class="bulbous-move confirm" data-act="confirm-order" type="button" ${done ? '' : 'disabled'}>${esc(ctx.t('ui.confirmSequence'))}</button>`;
  }
  if (v.fase === 'ACOES' && v.vaza) {
    if (v.vaza.aDescartar === me) {
      const ok = ui.selected.size === v.vaza.excesso;
      return `<button class="bulbous-move confirm" data-act="discard" type="button" ${ok ? '' : 'disabled'}>${esc(ctx.t('ui.discardAction'))} (${ui.selected.size}/${v.vaza.excesso})</button>`;
    }
    if (v.vaza.ordem[v.vaza.atual] !== me) return `<p class="bulbous-wait">${esc(ctx.t('ui.turnOf', { nome: ctx.seatName(v.vaza.ordem[v.vaza.atual]) }))}</p>`;
    const jogaveis = new Set((msg.legal || []).filter((m) => m.type === 'APOSTAR').flatMap((m) => m.payload.cartas));
    const podeApostar = ui.selected.size > 0 && [...ui.selected].every((id) => jogaveis.has(id));
    const podeTrocar = ui.selected.size >= 1 && ui.selected.size <= 2;
    return `<button class="bulbous-move bet" data-act="bet" type="button" ${podeApostar ? '' : 'disabled'}>${esc(ctx.t('ui.betAction'))}</button>
      <button class="bulbous-move swap" data-act="swap" type="button" ${podeTrocar ? '' : 'disabled'}>${esc(ctx.t('ui.swapAction'))}</button>
      <button class="bulbous-move pass" data-act="pass" type="button">${esc(ctx.t('ui.passAction'))}</button>`;
  }
  if (v.fase === 'DESEMPATE' && v.vaza) {
    if (!v.vaza.empatados.includes(me) || v.vaza.desempateFeito[me]) return `<p class="bulbous-wait">${esc(ctx.t('ui.tieBreaking'))}</p>`;
    const b = ativasList(v).find((a) => a.jogador === v.vaza.alvoJogador && a.posicao === v.vaza.alvoPosicao)?.baelf;
    const mao = v.minhaMao || [];
    const jogaveis = mao.filter((c) => b && c.cor === b.cor);
    return `${jogaveis.map((c) => { const vis = cardVisual(c); return `<button class="bulbous-move" data-tie="${c.id}" type="button" style="background:var(${vis.colorVar});color:#fff">${vis.mid}</button>`; }).join('')}
      <button class="bulbous-move cancel" data-tie="none" type="button">${esc(ctx.t('ui.tieBreakNone'))}</button>`;
  }
  return '';
}
