// Startup Panic — UI própria (ADR-006, ADR-014), no template vanilla: só usa os
// tokens --game-* e --sp-setor-* do skin.json. Não repete regras: cada clique
// corresponde a uma jogada de `msg.legal`; preços, maiorias e ordem vêm do `view`.
//
// Disposição: jogadores em vidro no topo, pela ordem da ronda; CEO e setores;
// as 10 startups com as ações de cada um; a minha equipa; barra de jogadas.
import css from './style.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const SETOR_ICON = { ia: '🤖', fintech: '💳', seguranca: '🛡️', biotech: '🧬', energia: '⚡' };
const TIPO_ICON = { engineer: '🧑‍💻', lawyer: '⚖️', pr: '📣', cfo: '💼' };
const SETORES = ['ia', 'fintech', 'seguranca', 'biotech', 'energia'];
const tipoDe = (workerId) => String(workerId).split('_')[0];

function ensureCss() {
  if (document.getElementById('sp-css')) return;
  const el = document.createElement('style');
  el.id = 'sp-css';
  el.textContent = css;
  document.head.append(el);
}

let root = null;
let layout = null;
let ctx = null;
let msg = null;
const fresh = () => ({ logOpen: false, lastLogSeq: 0, hire: null, move: null, trade: null, chart: null });
let ui = fresh();

export function mount(el, context) {
  ctx = context;
  ensureCss();
  root = document.createElement('div');
  root.className = 'sp';
  layout = document.createElement('div');
  layout.className = 'sp-layout';
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
  // Janelas que deixaram de fazer sentido (mudou a vez, a fase ou a ronda).
  if (!legal('SP_HIRE').length) ui.hire = null;
  if (ui.move && !legal('SP_MOVE_WORKER').length) ui.move = null;
  if (!legal('SP_TRADE_PROPOSE').length) ui.trade = null;
  render();
}

const mySeat = () => (msg && Number.isInteger(msg.seat) ? msg.seat : null);
const legal = (type) => (msg?.legal || []).filter((m) => m.type === type);
const find = (type, payload) => legal(type).find((m) => Object.entries(payload).every(([k, v]) => m.payload?.[k] === v));
const send = (mv) => { if (mv) ctx.move({ type: mv.type, payload: mv.payload }); };
const nameOf = (i) => ctx.seatName(i);
const stName = (id) => ctx.t(`startup.${id}`);

function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const { act, id } = b.dataset;
  if (act === 'buy') send(find('SP_BUY', { startup: id, qty: 1 }));
  else if (act === 'sell') send(find('SP_SELL_MARKET', { startup: id, qty: 1 }));
  else if (act === 'sellgate') send(find('SP_SELL_STARTUP', { startup: id }));
  else if (act === 'endmarket') send(legal('SP_END_MARKET')[0]);
  else if (act === 'pay') send(legal('SP_PAY_SALARY').find((m) => m.payload.worker === undefined));
  else if (act === 'pay1') send(find('SP_PAY_SALARY', { worker: id }));
  else if (act === 'risk') send(find('SP_RISK_SALARY', { worker: id }));
  else if (act === 'endturn') send(legal('SP_END_TURN')[0]);
  else if (act === 'fire') send(find('SP_FIRE', { worker: id }));
  else if (act === 'accept') send(legal('SP_TRADE_ACCEPT')[0]);
  else if (act === 'decline') send(legal('SP_TRADE_REJECT')[0]);
  else if (act === 'hire') { ui.hire = { tipo: null, startup: null }; render(); }
  else if (act === 'move') { ui.move = { worker: id }; render(); }
  else if (act === 'trade') { ui.trade = { de: null, para: null, por: null }; render(); }
  else if (act === 'chart') { ui.chart = id; render(); }
  else if (act === 'close') { ui.hire = null; ui.move = null; ui.trade = null; ui.chart = null; render(); }
  else if (act === 'hire-tipo') { ui.hire.tipo = id; ui.hire.startup = null; render(); }
  else if (act === 'hire-su') { ui.hire.startup = id; render(); }
  else if (act === 'hire-ok') {
    const h = ui.hire;
    const mv = legal('SP_HIRE').find((m) => tipoDe(m.payload.worker) === h.tipo && m.payload.startup === h.startup);
    ui.hire = null;
    send(mv);
  } else if (act === 'move-su') {
    const mv = find('SP_MOVE_WORKER', { worker: ui.move.worker, startup: id });
    ui.move = null;
    send(mv);
  } else if (act === 'trade-de') { ui.trade.de = id; ui.trade.para = null; ui.trade.por = null; render(); }
  else if (act === 'trade-por') { const [para, por] = id.split(':'); ui.trade.para = Number(para); ui.trade.por = por; render(); }
  else if (act === 'trade-ok') {
    const t = ui.trade;
    const mv = find('SP_TRADE_PROPOSE', { de: t.de, para: t.para, por: t.por });
    ui.trade = null;
    send(mv);
  } else if (act === 'logfold') { ui.logOpen = !ui.logOpen; render(); }
}

function render() {
  if (!layout || !msg) return;
  const v = msg.view;
  layout.innerHTML = `
    ${renderPlayers(v)}
    ${renderTimeline(v)}
    <div class="sp-top">${renderCeo(v)}${renderSectors(v)}</div>
    ${renderStartups(v)}
    ${renderTeam(v)}
    ${msg.result ? '' : renderBar(v)}
    ${renderLog()}
    ${renderModal(v)}`;
}

const activeSeat = (v) => (v.acabou ? null : v.vez);

function renderPlayers(v) {
  const me = mySeat();
  const act = activeSeat(v);
  return `<div class="sp-players" aria-label="${esc(ctx.t('ui.order'))}">${v.ordem.map((i, k) => {
    const j = v.jogadores[i];
    const state = i === act ? (i === me ? ctx.t('ui.yourTurn') : ctx.t('ui.turnOf', { nome: nameOf(i) })) : '';
    const cash = j.cash == null ? `<span title="${esc(ctx.t('ui.hidden'))}">🔒</span>` : `<b>${j.cash}M</b>`;
    return `<div class="sp-glass sp-player${i === me ? ' me' : ''}${i === act ? ' active' : ''}">
      <div class="sp-pname"><span class="sp-pos">${k + 1}</span><i class="sp-dot" style="background:var(--game-color-${(i % 4) + 1})"></i><span class="n">${esc(nameOf(i))}</span></div>
      <div class="sp-pstate">${esc(state) || '&nbsp;'}</div>
      <div class="sp-res"><span title="${esc(ctx.t('ui.cash'))}">💰 ${cash}</span><span title="${esc(ctx.t('ui.totalShares'))}">📈 <b>${j.totalAcoes}</b>/${v.maxAcoesTotal}</span><span title="${esc(ctx.t('ui.workersCount'))}">👷 <b>${j.trab.length}</b></span></div>
    </div>`;
  }).join('')}</div>`;
}

function renderTimeline(v) {
  const cells = Array.from({ length: v.rondas }, (_, k) => {
    const n = k + 1;
    const base = v.gateBase[n];
    const cls = ['sp-tl', n < v.ronda || (v.acabou && n === v.ronda - 1) ? 'done' : '', n === v.ronda && !v.acabou ? 'now' : '', base ? 'gate' : ''].filter(Boolean).join(' ');
    const open = base && n === v.ronda && v.gate.aberto ? v.gate.mult : null;
    return `<li class="${cls}"${base ? ` title="${esc(ctx.t('ui.gateRound', { mult: base }))}"` : ''}><b>${n}</b>${base ? `<span>🔔 ×${open ?? base}</span>` : ''}</li>`;
  }).join('');
  return `<ol class="sp-timeline" aria-label="${esc(ctx.t('ui.timeline'))}">${cells}</ol>`;
}

function renderCeo(v) {
  const c = v.ceo;
  const chips = [
    `<span class="sp-pill turn">${esc(ctx.t('ui.roundOf', { n: v.ronda, max: v.rondas }))}</span>`,
    v.gate.aberto ? `<span class="sp-pill gate">🔔 ${esc(ctx.t('ui.gate', { mult: v.gate.mult }))}</span>` : '',
    v.seguro ? `<span class="sp-pill">🛟 ${esc(ctx.t('ui.safe'))}</span>` : '',
    v.sobretaxa ? `<span class="sp-pill warn">💸 ${esc(ctx.t('ui.surcharge'))}</span>` : '',
    v.penalizacao ? `<span class="sp-pill warn">📉 ${esc(ctx.t('ui.penalty', { setor: ctx.t(`setor.${v.penalizacao.setor}`), d: `${v.penalizacao.d}M` }))}</span>` : '',
  ].join('');
  if (!c) return `<div class="sp-glass sp-ceo"><div class="sp-chips">${chips}</div></div>`;
  return `<div class="sp-glass sp-ceo">
    <div class="nm">${esc(ctx.t(`ceo.${c.id}`))}${c.dado ? `<span class="sp-die" title="${esc(ctx.t('ui.dice'))}">${c.dado}</span>` : ''}</div>
    <div class="role">${esc(ctx.t(`ceo.${c.id}.papel`))}</div>
    <div class="fx">${esc(ctx.t(`ceo.${c.id}.efeito`))}</div>
    <div class="sp-chips">${chips}</div>
  </div>`;
}

function renderSectors(v) {
  return `<div class="sp-sectors" aria-label="${esc(ctx.t('ui.sectors'))}">${SETORES.map((s) => {
    const x = v.setores[s];
    return `<div class="sp-glass sp-sector" style="--sc:var(--sp-setor-${s})"><b>${SETOR_ICON[s]} ${esc(ctx.t(`setor.${s}`))}</b>
      <span class="v ${x > 0 ? 'up' : x < 0 ? 'down' : ''}">${x > 0 ? '+' : ''}${x}M</span></div>`;
  }).join('')}</div>`;
}

function renderStartups(v) {
  const me = mySeat();
  const cards = v.startups.map((su) => {
    const holders = v.jogadores.map((j, i) => ({ i, n: j.acoes.find((a) => a.id === su.id)?.n || 0 })).filter((h) => h.n);
    const total = holders.reduce((a, h) => a + h.n, 0);
    const major = holders.find((h) => h.n * 2 > total);
    const mine = me != null ? holders.find((h) => h.i === me)?.n || 0 : 0;
    const team = me != null ? v.jogadores[me].trab.filter((w) => w.startup === su.id) : [];
    const buy = find('SP_BUY', { startup: su.id, qty: 1 });
    const sell = find('SP_SELL_MARKET', { startup: su.id, qty: 1 });
    const gate = find('SP_SELL_STARTUP', { startup: su.id });
    const delta = v.variacoes?.[su.id] || 0;
    const rende = team.reduce((a, w) => a + (w.rende || 0), 0);
    const semEquipa = mine > 0 && !team.length && !su.implodida;
    const acts = su.implodida ? '' : `<div class="sp-acts">
      ${v.fase === 'MERCADO' && me != null && legal('SP_END_MARKET').length ? `
        <button class="sp-act buy" type="button" data-act="buy" data-id="${su.id}" ${buy ? '' : 'disabled'} title="${esc(buy ? '' : ctx.t('ui.cantAct'))}">${esc(ctx.t('ui.buy'))} · ${su.preco}M</button>
        <button class="sp-act" type="button" data-act="sell" data-id="${su.id}" ${sell ? '' : 'disabled'}>${esc(ctx.t('ui.sell'))}</button>
        ${v.gate.aberto && gate ? `<button class="sp-act gate" type="button" data-act="sellgate" data-id="${su.id}">${esc(ctx.t('ui.sellGate', { mult: v.gate.mult }))}</button>` : ''}` : ''}
    </div>`;
    return `<div class="sp-su${mine ? ' mine' : ''}${su.implodida ? ' dead' : ''}" style="--sc:var(--sp-setor-${su.setor})">
      <div class="sp-suhead"><button class="nm sp-nm" type="button" data-act="chart" data-id="${su.id}" title="${esc(ctx.t('ui.chartOpen'))}" aria-label="${esc(`${stName(su.id)}: ${ctx.t('ui.chartOpen')}`)}">${SETOR_ICON[su.setor]} ${esc(stName(su.id))} <span aria-hidden="true">📈</span></button><span class="price">${su.implodida ? '💀' : `${su.preco}M`}${delta ? `<small class="${delta > 0 ? 'up' : 'down'}" title="${esc(ctx.t('ui.priceChange'))}">${delta > 0 ? '▲' : '▼'}${Math.abs(delta)}</small>` : ''}</span></div>
      <small>${su.implodida ? esc(ctx.t('ui.imploded')) : `${esc(ctx.t('ui.base'))} ${su.base}M + ${esc(ctx.t(`setor.${su.setor}`))} ${v.setores[su.setor] >= 0 ? '+' : ''}${v.setores[su.setor]}M${su.bonusPr ? ` + ${esc(ctx.t('ui.prBonus', { n: su.bonusPr }))}` : ''}`}${su.protegida && !su.implodida ? ` <span title="${esc(ctx.t('ui.protected'))}">🛡️</span>` : ''}</small>
      <div class="sp-holders">${holders.map((h) => `<span><i class="sp-dot" style="background:var(--game-color-${(h.i % 4) + 1})"></i><b>${h.n}</b>${h.i === me ? ` <small>${esc(ctx.t('ui.you'))}</small>` : ''}</span>`).join('') || '<small>—</small>'}</div>
      <small>${major ? esc(ctx.t('ui.majority', { nome: nameOf(major.i) })) : esc(ctx.t('ui.noMajority'))}</small>
      ${semEquipa ? `<small class="sp-warn">⚠ ${esc(ctx.t('ui.noTeamWarn'))}</small>` : ''}
      <div class="sp-wk">${rende ? `<b class="sp-yield">${esc(ctx.t('ui.perRound', { n: rende }))}</b>` : ''}${team.map((w) => `<span title="${esc(w.nome)}">${TIPO_ICON[w.tipo]}${w.nivel >= 3 ? '⭐' : ''}</span>`).join('')}</div>
      ${acts}
    </div>`;
  }).join('');
  return `<section class="sp-section"><div class="sp-lbl">${esc(ctx.t('ui.startups'))}</div><div class="sp-startups">${cards}</div></section>`;
}

function renderTeam(v) {
  const me = mySeat();
  if (me == null) return '<div></div>';
  const j = v.jogadores[me];
  const pool = ['engineer', 'lawyer', 'pr', 'cfo'].map((t) => `<span>${TIPO_ICON[t]} ${v.pool.filter((w) => w.tipo === t).length}</span>`).join(' ');
  const previsto = j.previsao.reduce((a, d) => a + d.ganho, 0);
  const canMaint = v.fase === 'MANUTENCAO' && legal('SP_END_TURN').length > 0;
  const workers = j.trab.map((w) => `<div class="sp-worker">
    <span class="nm">${TIPO_ICON[w.tipo]} ${esc(w.nome)} <small>${esc(ctx.t(`nivel.${v.niveis[w.nivel].id}`))} ×${v.niveis[w.nivel].mult}</small></span>
    <small>${esc(ctx.t(`tipo.${w.tipo}`))} · ${esc(stName(w.startup))} · <b>${esc(ctx.t('ui.yields', { n: w.rende }))}</b></small>
    <small>${esc(ctx.t(`tipo.${w.tipo}.desc`))}</small>
    ${canMaint && w.salario > 0 ? (w.pago ? `<small>✔ ${esc(ctx.t('ui.paid'))}</small>` : `<div class="sp-acts" title="${esc(ctx.t('ui.riskHint'))}">
      <button class="sp-act" type="button" data-act="pay1" data-id="${w.id}" ${find('SP_PAY_SALARY', { worker: w.id }) ? '' : 'disabled'}>${esc(ctx.t('ui.payOne', { n: w.salario }))}</button>
      <button class="sp-act" type="button" data-act="risk" data-id="${w.id}">${esc(ctx.t('ui.risk'))}</button>
    </div>`) : ''}
    ${canMaint ? `<div class="sp-acts">
      <button class="sp-act" type="button" data-act="move" data-id="${w.id}" ${legal('SP_MOVE_WORKER').some((m) => m.payload.worker === w.id) ? '' : 'disabled'}>${esc(ctx.t('ui.move'))}</button>
      <button class="sp-act" type="button" data-act="fire" data-id="${w.id}">${esc(ctx.t('ui.fire'))}</button>
    </div>` : ''}
  </div>`).join('');
  return `<section class="sp-team">
    <div class="sp-teamhead"><span class="sp-lbl">${esc(ctx.t('ui.team'))}</span><span>💰 <b>${v.meuCash}M</b></span><span title="${esc(ctx.t('ui.networth'))}">📊 <b>${v.meuPatrimonio}M</b></span><span title="${esc(ctx.t('ui.expectedHint'))}">💵 ${esc(ctx.t('ui.expected'))}: <b>${esc(ctx.t('ui.perRound', { n: previsto }))}</b></span><span title="${esc(ctx.t('ui.salaries'))}">💸 ${esc(ctx.t('ui.salaries'))}: <b>${v.meusSalarios}M</b></span><span class="sp-lbl">${esc(ctx.t('ui.pool'))}</span><span>${pool}</span>
      ${canMaint && legal('SP_HIRE').length ? `<button class="sp-act" type="button" data-act="hire">${esc(ctx.t('ui.hire'))}</button>` : ''}</div>
    ${j.trab.length ? `<div class="sp-workers">${workers}</div>` : `<div class="sp-empty">${esc(ctx.t('ui.noTeam'))}</div>`}
  </section>`;
}

function renderBar(v) {
  const me = mySeat();
  const act = activeSeat(v);
  if (me == null) return `<div class="sp-bar"><span class="sp-hint">${esc(ctx.t('ui.spectating'))}</span></div>`;
  if (v.proposta && v.proposta.de === me) return `<div class="sp-bar"><span class="sp-hint">${esc(ctx.t('ui.waitingReply'))}</span></div>`;
  if (!(msg.legal || []).length) return `<div class="sp-bar"><span class="sp-hint">${esc(ctx.t('ui.waiting', { nome: nameOf(act ?? 0) }))}</span></div>`;
  if (v.fase === 'MERCADO') {
    return `<div class="sp-bar">
      <span class="sp-hint">${esc(ctx.t('ui.phaseMarket'))}</span>
      ${legal('SP_TRADE_PROPOSE').length ? `<button class="sp-btn" type="button" data-act="trade">${esc(ctx.t('ui.trade'))}</button>` : ''}
      <button class="sp-btn primary" type="button" data-act="endmarket">${esc(ctx.t('ui.endMarket'))}</button>
    </div>`;
  }
  return `<div class="sp-bar">
    <span class="sp-hint">${esc(ctx.t('ui.phaseMaint'))}</span>
    ${legal('SP_PAY_SALARY').some((m) => m.payload.worker === undefined) ? `<button class="sp-btn" type="button" data-act="pay">${esc(ctx.t('ui.paySalary'))}</button>` : ''}
    <button class="sp-btn primary" type="button" data-act="endturn">${esc(ctx.t('ui.endTurn'))}</button>
  </div>`;
}

const opt = (act, id, label, on, disabled = false) => `<button class="sp-opt${on ? ' on' : ''}" type="button" data-act="${act}" data-id="${esc(id)}" ${disabled ? 'disabled' : ''}>${label}</button>`;
const uniq = (a) => [...new Set(a)];

function renderModal(v) {
  const me = mySeat();
  if (ui.chart && !(v.proposta && v.proposta.para === me)) return renderChart(v);
  if (v.proposta && v.proposta.para === me) {
    const p = v.proposta;
    return `<div class="sp-modal"><div class="sp-modal-box" role="dialog" aria-label="${esc(ctx.t('ui.trade'))}">
      <h3>${esc(ctx.t('ui.trade'))}</h3>
      <p>${esc(ctx.t('ui.tradeOffer', { de: nameOf(p.de), dar: stName(p.dar), receber: stName(p.receber) }))}</p>
      <div class="sp-modal-acts"><button class="sp-btn" type="button" data-act="decline">${esc(ctx.t('ui.decline'))}</button><button class="sp-btn primary" type="button" data-act="accept">${esc(ctx.t('ui.accept'))}</button></div>
    </div></div>`;
  }
  if (ui.hire) {
    const h = ui.hire;
    const all = legal('SP_HIRE');
    const tipos = uniq(all.map((m) => tipoDe(m.payload.worker)));
    const sus = uniq(all.filter((m) => tipoDe(m.payload.worker) === h.tipo).map((m) => m.payload.startup));
    const ok = h.tipo && h.startup;
    const pr = v.proximo;
    return `<div class="sp-modal"><div class="sp-modal-box" role="dialog" aria-label="${esc(ctx.t('ui.hire'))}">
      <h3>${esc(ctx.t('ui.hire'))}</h3>
      <div class="sp-lbl">${esc(ctx.t('ui.pickType'))}</div>
      <div class="sp-opts">${tipos.map((t) => opt('hire-tipo', t, `${TIPO_ICON[t]} ${esc(ctx.t(`tipo.${t}`))}`, h.tipo === t)).join('')}</div>
      <p class="sp-desc"><b>${esc(ctx.t('ui.nextLevel', { nivel: ctx.t(`nivel.${pr.id}`), custo: pr.custo, salario: pr.salario, mult: pr.mult }))}</b></p>
      ${h.tipo ? `<p class="sp-desc">${esc(ctx.t(`tipo.${h.tipo}.desc`))}</p><div class="sp-lbl">${esc(ctx.t('ui.pickStartup'))}</div><div class="sp-opts">${sus.map((s) => opt('hire-su', s, esc(stName(s)), h.startup === s)).join('')}</div>` : ''}
      <div class="sp-modal-acts"><button class="sp-btn" type="button" data-act="close">${esc(ctx.t('ui.cancel'))}</button><button class="sp-btn primary" type="button" data-act="hire-ok" ${ok ? '' : 'disabled'}>${esc(ctx.t('ui.confirm'))}</button></div>
    </div></div>`;
  }
  if (ui.move) {
    const w = v.jogadores[me].trab.find((x) => x.id === ui.move.worker);
    const sus = uniq(legal('SP_MOVE_WORKER').filter((m) => m.payload.worker === ui.move.worker).map((m) => m.payload.startup));
    return `<div class="sp-modal"><div class="sp-modal-box" role="dialog" aria-label="${esc(ctx.t('ui.move'))}">
      <h3>${esc(ctx.t('ui.moveTo', { nome: w?.nome ?? '' }))}</h3>
      <div class="sp-opts">${sus.map((s) => opt('move-su', s, esc(stName(s)), false)).join('')}</div>
      <div class="sp-modal-acts"><button class="sp-btn" type="button" data-act="close">${esc(ctx.t('ui.cancel'))}</button></div>
    </div></div>`;
  }
  if (ui.trade) {
    const t = ui.trade;
    const all = legal('SP_TRADE_PROPOSE');
    const des = uniq(all.map((m) => m.payload.de));
    const alvos = all.filter((m) => m.payload.de === t.de);
    const ok = t.de && t.para != null && t.por;
    return `<div class="sp-modal"><div class="sp-modal-box" role="dialog" aria-label="${esc(ctx.t('ui.trade'))}">
      <h3>${esc(ctx.t('ui.trade'))}</h3>
      <div class="sp-lbl">${esc(ctx.t('ui.tradeGive'))}</div>
      <div class="sp-opts">${des.map((s) => opt('trade-de', s, esc(stName(s)), t.de === s)).join('')}</div>
      ${t.de ? `<div class="sp-lbl">${esc(ctx.t('ui.tradeGet'))}</div><div class="sp-opts">${alvos.map((m) => opt('trade-por', `${m.payload.para}:${m.payload.por}`, `${esc(nameOf(m.payload.para))} · ${esc(stName(m.payload.por))}`, t.para === m.payload.para && t.por === m.payload.por)).join('')}</div>` : ''}
      <div class="sp-modal-acts"><button class="sp-btn" type="button" data-act="close">${esc(ctx.t('ui.cancel'))}</button><button class="sp-btn primary" type="button" data-act="trade-ok" ${ok ? '' : 'disabled'}>${esc(ctx.t('ui.confirm'))}</button></div>
    </div></div>`;
  }
  return '';
}

/** Gráfico de velas (como num gráfico de câmbio): uma vela por ronda, verde a subir e vermelha a descer. */
function renderChart(v) {
  const su = v.startups.find((x) => x.id === ui.chart);
  if (!su) return '';
  const velas = v.historico?.[su.id] || [];
  const W = 640, H = 320, L = 14, R = 52, T = 16, B = 30;
  const px = (W - L - R) / v.rondas;
  const valores = velas.flatMap((c) => [c.h, c.l, c.o, c.c]);
  const max = Math.max(4, ...valores), min = Math.min(0, ...valores);
  const passo = Math.max(1, Math.ceil((max - min) / 5));
  const topo = Math.ceil(max / passo) * passo, base = Math.floor(min / passo) * passo;
  const y = (val) => T + (H - T - B) * (1 - (val - base) / (topo - base || 1));
  const grelha = [];
  for (let g = base; g <= topo; g += passo) grelha.push(`<line x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}" class="sp-grid"/><text x="${W - R + 6}" y="${y(g) + 4}" class="sp-axis">${g}M</text>`);
  const eixoX = Array.from({ length: v.rondas }, (_, k) => {
    const n = k + 1, x0 = L + k * px;
    const gate = v.gateBase[n];
    return `${gate ? `<rect x="${x0}" y="${T}" width="${px}" height="${H - T - B}" class="sp-gatebg"/>` : ''}<text x="${x0 + px / 2}" y="${H - 10}" class="sp-axis sp-axisx${n === v.ronda ? ' now' : ''}" text-anchor="middle">${gate ? '🔔' : ''}${n}</text>`;
  }).join('');
  const corpo = velas.map((c) => {
    const k = c.r - 1, cx = L + k * px + px / 2, w = Math.max(6, px * 0.55);
    const sobe = c.c >= c.o;
    const topoC = y(Math.max(c.o, c.c)), altura = Math.max(2, Math.abs(y(c.o) - y(c.c)));
    const tip = ctx.t('ui.chartCandle', { r: c.r, o: c.o, h: c.h, l: c.l, c: c.c });
    return `<g class="sp-candle ${c.c === c.o ? 'flat' : sobe ? 'up' : 'down'}"><title>${esc(tip)}</title>
      <line x1="${cx}" x2="${cx}" y1="${y(c.h)}" y2="${y(c.l)}"/><rect x="${cx - w / 2}" y="${topoC}" width="${w}" height="${altura}"/>${c.x ? `<text x="${cx}" y="${y(0) - 6}" text-anchor="middle" class="sp-axis">💀</text>` : ''}</g>`;
  }).join('');
  const morta = velas.find((c) => c.x);
  const desc = velas.map((c) => ctx.t('ui.chartCandle', { r: c.r, o: c.o, h: c.h, l: c.l, c: c.c })).join('. ');
  return `<div class="sp-modal"><div class="sp-modal-box sp-chartbox" role="dialog" aria-label="${esc(ctx.t('ui.chartTitle', { startup: stName(su.id) }))}">
    <h3>${SETOR_ICON[su.setor]} ${esc(ctx.t('ui.chartTitle', { startup: stName(su.id) }))} · ${su.implodida ? '💀' : `${esc(ctx.t('ui.chartNow'))} ${su.preco}M`}</h3>
    ${velas.length ? `<svg class="sp-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}"><rect x="0" y="0" width="${W}" height="${H}" class="sp-chartbg"/>${eixoX}${grelha.join('')}${corpo}</svg>` : `<p class="sp-desc">${esc(ctx.t('ui.chartEmpty'))}</p>`}
    ${morta ? `<p class="sp-desc"><b>${esc(ctx.t('ui.chartDead', { r: morta.r }))}</b></p>` : ''}
    <p class="sp-desc">${esc(ctx.t('ui.chartHint'))}</p>
    <div class="sp-modal-acts"><button class="sp-btn primary" type="button" data-act="close">${esc(ctx.t('ui.close'))}</button></div>
  </div></div>`;
}

function renderLog() {
  const items = ui.logOpen ? [...(msg.log || [])].reverse().slice(0, 12) : [];
  return `<aside class="sp-log">
    <button class="sp-lbl sp-log-head" data-act="logfold" aria-expanded="${ui.logOpen}">${esc(ctx.t('ui.log'))} ${ui.logOpen ? '▾' : '▸'}</button>
    ${items.length ? `<ol>${items.map((l) => `<li>${l.seat != null ? `<b>${esc(nameOf(l.seat))}</b> ` : ''}${esc(ctx.t(l.key, l.params))}</li>`).join('')}</ol>` : ''}
  </aside>`;
}
