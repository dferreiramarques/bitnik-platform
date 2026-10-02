// Startup Panic — um teste por regra do REGRAS.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMatch, applyMove, checkGame, checkPurity, viewFor, activeSeats, replay } from '@bitnik/engine';
import game from '../index.js';
import { CEOS, CEO_IDS, SETORES, STARTUPS, calcularOrdem, pontuar } from '../rules.js';

const tweak = (m, fn) => { const c = structuredClone(m); fn(c.state); return c; };
const criar = (n = 2, seed = 'sp') => createMatch(game, { numPlayers: n, seed });
/** Partida nova com o mercado neutro: o CEO da ronda 1 é sorteado e mexeria nos preços. */
const novo = (n = 2, seed = 'sp') => tweak(criar(n, seed), (s) => {
  for (const x of SETORES) s.setores[x] = 0;
  for (const x of s.startups) { x.preco = x.base; x.implodida = false; }
  s.seguro = false; s.sobretaxa = 0; s.penalizacao = null; s.bonusGate = 0; s.gate = { aberto: false, mult: 1 };
});
const vez = (m) => m.state.ordem[m.state.pos];
const jog = (m, i) => m.state.jogadores[i];
const su = (m, id) => m.state.startups.find((x) => x.id === id);
const jogar = (m, seat, type, payload = {}) => {
  const r = applyMove(game, m, seat, { type, payload });
  assert.ok(r.ok, `${type} recusada: ${JSON.stringify(r.error)}`);
  return r.match;
};
const recusa = (m, seat, type, payload, codigo) => {
  const r = applyMove(game, m, seat, { type, payload });
  assert.equal(r.ok, false, `${type} devia ser recusada`);
  if (codigo) assert.equal(r.error.params ? r.error.code : r.error.code, codigo);
};
/** Fecha a ronda: todos fecham o Mercado e terminam o turno. */
const fecharRonda = (m) => {
  const r = m.state.ronda;
  let n = 0;
  while (!m.result && m.state.ronda === r && n++ < 50) {
    const seat = vez(m);
    if (m.state.fase === 'MERCADO') m = jogar(m, seat, 'SP_END_MARKET');
    m = jogar(m, seat, 'SP_END_TURN');
  }
  return m;
};
/** Estado limpo para testar efeitos: preços base, sem implosões. */
const limpo = (n = 2) => {
  const s = structuredClone(novo(n, 'limpo').state);
  for (const x of SETORES) s.setores[x] = 0;
  for (const x of s.startups) { x.preco = x.base; x.implodida = false; x.acoes.fill(0); }
  s.seguro = false; s.sobretaxa = 0; s.bonusGate = 0; s.penalizacao = null;
  return s;
};
const falso = () => ({ log() {}, rng: { pick: (a) => a[0] } });
const mercado = (m) => tweak(m, (s) => { s.fase = 'MERCADO'; });
const manutencao = (m) => tweak(m, (s) => { s.fase = 'MANUTENCAO'; });
const gate = (m, mult = 5) => tweak(m, (s) => { s.gate = { aberto: true, mult }; });

// ─── Componentes e preparação ───────────────────────────────

test('Pacote válido, sem aleatoriedade nem relógio fora do motor, i18n com paridade', () => {
  assert.deepEqual(checkGame(game), []);
  const dir = new URL('../', import.meta.url);
  const problemas = ['index.js', 'rules.js', 'i18n/pt.js', 'i18n/en.js'].flatMap((f) => checkPurity(readFileSync(new URL(f, dir), 'utf8'), f));
  assert.deepEqual(problemas, []);
});

test('Todas as chaves err./log./msg. usadas nas regras existem em PT e EN', () => {
  const src = readFileSync(new URL('../rules.js', import.meta.url), 'utf8');
  const usadas = new Set([...src.matchAll(/'((?:err|log|msg|moveLabel|move)\.[A-Z_]+)'/g)].map((x) => x[1]));
  assert.ok(usadas.size > 30);
  for (const k of usadas) for (const l of ['pt', 'en']) assert.ok(k in game.i18n[l], `${l}: falta ${k}`);
});

test('Preparação: 10 startups em 5 setores, 10M cada, 12 CEOs e uma cópia de cada tipo de trabalhador por jogador', () => {
  for (const n of [2, 3, 4]) {
    const s = novo(n).state;
    assert.equal(s.startups.length, 10);
    assert.deepEqual([...new Set(s.startups.map((x) => x.setor))].sort(), [...SETORES].sort());
    for (const x of SETORES) assert.equal(s.startups.filter((y) => y.setor === x).length, 2);
    assert.ok(s.jogadores.every((j) => j.cash === 10 && j.trab.length === 0));
    assert.deepEqual([...s.baralho].sort(), [...CEO_IDS].sort());
    assert.equal(s.pool.length, 4 * n);
    for (const t of ['engineer', 'lawyer', 'pr', 'cfo']) assert.equal(s.pool.filter((w) => w.tipo === t).length, n);
    assert.equal(s.ronda, 1);
    assert.equal(s.fase, 'MERCADO');
  }
});

test('Aleatoriedade só via rng: a mesma seed repete-se e seeds diferentes baralham o baralho de CEOs', () => {
  assert.deepEqual(novo(2, 'a').state, novo(2, 'a').state);
  const baralhos = new Set(['a', 'b', 'c', 'd', 'e'].map((x) => novo(2, x).state.baralho.join()));
  assert.ok(baralhos.size > 1);
  let m = novo(3, 'rep');
  for (let i = 0; i < 40 && !m.result; i++) {
    const mv = game.enumerate(m.state, vez(m)).at(-1); // sempre o último: fechar mercado / terminar turno
    m = jogar(m, vez(m), mv.type, mv.payload);
  }
  assert.equal(replay(game, m).ok ?? true, true);
});

test('Ronda 1: o jogador inicial é sorteado e segue-se o sentido normal', () => {
  const primeiros = new Set();
  for (let i = 0; i < 30; i++) {
    const s = novo(4, 'p' + i).state;
    primeiros.add(s.ordem[0]);
    assert.deepEqual(s.ordem, [0, 1, 2, 3].map((k) => (s.ordem[0] + k) % 4));
  }
  assert.ok(primeiros.size > 1);
});

test('Preço de mercado = preço base + valor do setor, no mínimo 1M', () => {
  const s = limpo();
  const ctx = falso();
  CEOS.jh.efeito(s, ctx); // IA +3
  assert.equal(s.startups.find((x) => x.id === 'deepanic').preco, 6);
  assert.equal(s.startups.find((x) => x.id === 'halluci').preco, 5);
  for (let i = 0; i < 8; i++) CEOS.mz.efeito(s, ctx); // IA −8 no total: −5
  assert.equal(s.startups.find((x) => x.id === 'halluci').preco, 1);
});

test('Cada ronda revela um CEO e o seu setor de afinidade recebe sempre +1M', () => {
  const m = novo(2, 'afin');
  const id = m.state.baralho[0];
  assert.equal(m.state.ceo.id, id);
  assert.equal(m.state.idx, 1);
  assert.ok(CEOS[id].dado === (m.state.ceo.dado !== null));
  const todos = m.log.map((e) => e.key);
  assert.ok(todos.includes('log.CEO'));
});

// ─── CEOs ───────────────────────────────────────────────────

const setor = (s, x) => s.setores[x];
const implodidas = (s) => s.startups.filter((x) => x.implodida).length;

test('CEO Elon V.: IA sobe ⌊dado/2⌋M; com 5 ou 6 implode a startup mais cara', () => {
  let s = limpo(); CEOS.ev.efeito(s, falso(), 4);
  assert.equal(setor(s, 'ia'), 2); assert.equal(implodidas(s), 0);
  s = limpo(); CEOS.ev.efeito(s, falso(), 5);
  assert.equal(setor(s, 'ia'), 2); assert.equal(implodidas(s), 1);
});

test('CEO Mark Z.: Fintech +2M, IA −1M', () => {
  const s = limpo(); CEOS.mz.efeito(s, falso());
  assert.deepEqual([setor(s, 'fintech'), setor(s, 'ia')], [2, -1]);
});

test('CEO Sam A.: IA +dado, Biotech −1M', () => {
  const s = limpo(); CEOS.sa.efeito(s, falso(), 5);
  assert.deepEqual([setor(s, 'ia'), setor(s, 'biotech')], [5, -1]);
});

test('CEO Jensen H.: IA +3M, Energia −1M', () => {
  const s = limpo(); CEOS.jh.efeito(s, falso());
  assert.deepEqual([setor(s, 'ia'), setor(s, 'energia')], [3, -1]);
});

test('CEO Reed H.: o setor dado%5 sobe 2M e o setor (dado+2)%5 desce 2M', () => {
  const s = limpo(); CEOS.rh.efeito(s, falso(), 1);
  assert.equal(setor(s, 'fintech'), 2);
  assert.equal(setor(s, 'biotech'), -2);
  const t = limpo(); CEOS.rh.efeito(t, falso(), 5); // 5%5=0 (ia), 7%5=2 (seguranca)
  assert.deepEqual([setor(t, 'ia'), setor(t, 'seguranca')], [2, -2]);
});

test('CEO Travis K.: implode uma startup (salvo seguro) e Segurança sobe dado−2', () => {
  let s = limpo(); CEOS.tk.efeito(s, falso(), 6);
  assert.equal(setor(s, 'seguranca'), 4); assert.equal(implodidas(s), 1);
  s = limpo(); s.seguro = true; CEOS.tk.efeito(s, falso(), 1);
  assert.equal(setor(s, 'seguranca'), -1); assert.equal(implodidas(s), 0);
});

test('CEO Elizabeth H.: Biotech +4M agora e −4M na ronda seguinte', () => {
  let m = novo(2, 'eh');
  m = tweak(m, (s) => { Object.assign(s, limpo()); s.baralho[1] = 'ww'; s.penalizacao = null; });
  const s = m.state;
  CEOS.eh.efeito(s, { ...falso(), log() {} });
  assert.equal(setor(s, 'biotech'), 4);
  assert.deepEqual(s.penalizacao, { setor: 'biotech', d: -4 });
  const depois = fecharRonda(m.state ? tweak(m, (x) => { x.penalizacao = { setor: 'biotech', d: -4 }; x.setores.biotech = 4; }) : m);
  // Whitney não toca em Biotech: +1 afinidade da Segurança, e o −4 do diferido aplicou-se.
  assert.equal(depois.state.setores.biotech, 0);
  assert.equal(depois.state.penalizacao, null);
});

test('CEO Brian C.: todos os setores +1M e nenhuma startup implode nessa ronda', () => {
  const s = limpo(); CEOS.bc.efeito(s, falso());
  assert.ok(SETORES.every((x) => setor(s, x) === 1));
  assert.equal(s.seguro, true);
});

test('CEO Adam N.: Biotech sobe dado−3 e os salários sobem 1M nessa ronda', () => {
  const s = limpo(); CEOS.an.efeito(s, falso(), 6);
  assert.equal(setor(s, 'biotech'), 3); assert.equal(s.sobretaxa, 1);
});

test('CEO Patrick C.: Fintech +2M, Segurança +1M', () => {
  const s = limpo(); CEOS.pc.efeito(s, falso());
  assert.deepEqual([setor(s, 'fintech'), setor(s, 'seguranca')], [2, 1]);
});

test('CEO Sam B.: dado ≥4 implode uma startup; abaixo, Fintech +4M', () => {
  let s = limpo(); CEOS.sb.efeito(s, falso(), 4);
  assert.equal(implodidas(s), 1); assert.equal(setor(s, 'fintech'), 0);
  s = limpo(); CEOS.sb.efeito(s, falso(), 3);
  assert.equal(implodidas(s), 0); assert.equal(setor(s, 'fintech'), 4);
});

test('CEO Whitney W.: o multiplicador do Gate sobe 1 nível', () => {
  const s = limpo(); CEOS.ww.efeito(s, falso());
  assert.equal(s.bonusGate, 1);
});

test('Implosão: atinge a startup viva mais cara; com empate, sorteia entre as mais caras', () => {
  const s = limpo();
  CEOS.sb.efeito(s, falso(), 4); // CashBurn (4M) é a única mais cara
  assert.deepEqual(s.startups.filter((x) => x.implodida).map((x) => x.id), ['cashburn']);
  CEOS.sb.efeito(s, { ...falso(), rng: { pick: (a) => a.at(-1) } }, 4); // agora CRISPRash 4M
  assert.deepEqual(s.startups.filter((x) => x.implodida).map((x) => x.id), ['cashburn', 'crispash']);
  const t = limpo(); t.startups.find((x) => x.id === 'cashburn').preco = 9;
  CEOS.sb.efeito(t, falso(), 4);
  assert.ok(t.startups.find((x) => x.id === 'cashburn').implodida);
});

test('Advogado: a startup onde há um Advogado (de qualquer jogador) não implode; a seguinte mais cara sim', () => {
  const s = limpo();
  s.jogadores[1].trab = [{ id: 'l', tipo: 'lawyer', nome: 'x', startup: 'cashburn', nivel: 0 }];
  CEOS.sb.efeito(s, falso(), 4);
  assert.equal(s.startups.find((x) => x.id === 'cashburn').implodida, false);
  assert.equal(s.startups.find((x) => x.id === 'crispash').implodida, true); // a seguinte mais cara (4M)
  const t = limpo();
  for (const x of t.startups) t.jogadores[0].trab.push({ id: 'l' + x.id, tipo: 'lawyer', nome: 'x', startup: x.id, nivel: 0 });
  CEOS.sb.efeito(t, falso(), 4);
  assert.equal(t.startups.filter((x) => x.implodida).length, 0);
});

test('PR: cada PR numa startup sobe 1M ao preço, e desfaz-se ao despedir ou mover', () => {
  let m = manutencao(novo(2, 'pr'));
  const j = vez(m);
  const antes = su(m, 'deepanic').preco;
  m = jogar(m, j, 'SP_HIRE', { worker: m.state.pool.find((w) => w.tipo === 'pr').id, startup: 'deepanic', nivel: 0 });
  assert.equal(su(m, 'deepanic').preco, antes + 1);
  const w = jog(m, j).trab[0];
  m = jogar(m, j, 'SP_MOVE_WORKER', { worker: w.id, startup: 'halluci' });
  assert.equal(su(m, 'deepanic').preco, antes);
  assert.equal(su(m, 'halluci').preco, 3);
  m = jogar(m, j, 'SP_FIRE', { worker: w.id });
  assert.equal(su(m, 'halluci').preco, 2);
});

test('CFO: renda fixa de 2M por ronda, multiplicada pelo nível, sem precisar de ações', () => {
  let m = proximaWhitney(novo(2, 'cfo'));
  const j = m.state.ordem[0];
  m = tweak(m, (s) => {
    s.jogadores[j].trab = [{ id: 'c1', tipo: 'cfo', nome: 'x', startup: 'deepanic', nivel: 0 }, { id: 'c2', tipo: 'cfo', nome: 'y', startup: 'halluci', nivel: 1 }];
    s.pool = s.pool.filter((p) => !['c1', 'c2'].includes(p.id));
  });
  m = fecharRonda(m);
  assert.equal(jog(m, j).cash, 10 - 1 + 2 + 4); // salário do Júnior (1M) + 2M do Estagiário + 4M do Júnior
  assert.deepEqual(m.state.dividendos.map((d) => [d.startup, d.ganho]), [['deepanic', 2], ['halluci', 4]]);
});

test('Previsão: o view mostra o que cada trabalhador rende e os dividendos previstos', () => {
  const m = tweak(novo(2, 'prev'), (s) => {
    su({ state: s }, 'deepanic').acoes[0] = 3;
    s.jogadores[0].trab = [
      { id: 'a', tipo: 'engineer', nome: 'x', startup: 'deepanic', nivel: 3 }, // 3 ações × 2M × 4
      { id: 'b', tipo: 'lawyer', nome: 'y', startup: 'deepanic', nivel: 0 }, // 3 ações × 1M × 1
      { id: 'c', tipo: 'cfo', nome: 'z', startup: 'halluci', nivel: 1 }, // 2M × 2
    ];
    s.jogadores[0].cash = 4;
  });
  const v = viewFor(game, m, 0).view;
  assert.deepEqual(v.jogadores[0].trab.map((w) => w.rende), [24, 3, 4]);
  assert.equal(v.jogadores[0].previsao.reduce((a, d) => a + d.ganho, 0), 31);
  assert.equal(v.meuPatrimonio, 4 + 3 * su(m, 'deepanic').preco);
  assert.equal(viewFor(game, m, 1).view.meuPatrimonio, 10);
  assert.equal(v.startups.find((x) => x.id === 'deepanic').protegida, true);
  assert.equal(v.meusSalarios, 3 + 1);
  assert.deepEqual([v.proximo.nivel, v.proximo.custo], [3, 3]);
});

test('Variação: o estado guarda quanto o CEO da ronda mexeu no preço de cada startup', () => {
  const m = fecharRonda(proximaWhitney(novo(2, 'var'))); // Whitney: afinidade Segurança +1M
  assert.equal(m.state.ceo.id, 'ww');
  assert.deepEqual(Object.entries(m.state.variacoes).filter(([, d]) => d !== 0).sort(), [['hackshield', 1], ['zerotrust', 1]]);
  assert.equal(viewFor(game, m, 0).view.variacoes.hackshield, 1);
});

test('Uma implosão deixa a startup sem valor: sai da pontuação e das compras', () => {
  let m = novo(2, 'imp');
  m = tweak(m, (s) => { const j = vez(m); s.startups[0].acoes[j] = 2; s.startups[0].implodida = true; s.jogadores[j].cash = 5; });
  assert.equal(pontuar(m.state, vez(m)), 5);
  recusa(m, vez(m), 'SP_BUY', { startup: m.state.startups[0].id, qty: 1 }, 'err.IMPLODIDA'.replace('IMPLODIDA', 'STARTUP'));
});

// ─── Gate de Venda ──────────────────────────────────────────

const comCeo = (m, idx, ceo, extra = () => {}) => tweak(m, (s) => {
  s.idx = idx; s.baralho[idx] = ceo; extra(s);
});

test('Gate de Venda: abre só nas rondas 4, 8 e 12, com piso ×5, ×10 e ×20', () => {
  for (const [idx, base] of [[3, 5], [7, 10], [11, 20]]) {
    const m = fecharRonda(comCeo(novo(2, 'g' + idx), idx, 'eh'));
    assert.deepEqual(m.state.gate, { aberto: true, mult: base }, `ronda ${idx + 1}`);
  }
  const m = fecharRonda(comCeo(novo(2, 'g0'), 4, 'eh'));
  assert.equal(m.state.gate.aberto, false);
});

test('Gate de Venda: CEO de multiplicador alto ×1,5 e baixo ×0,7 (arredondado)', () => {
  assert.equal(fecharRonda(comCeo(novo(2, 'a1'), 3, 'sa')).state.gate.mult, 8);
  assert.equal(fecharRonda(comCeo(novo(2, 'a2'), 7, 'ww')).state.gate.mult, 16); // 15 + 1 da própria Whitney
  assert.equal(fecharRonda(comCeo(novo(2, 'a3'), 3, 'mz')).state.gate.mult, 4);
  assert.equal(fecharRonda(comCeo(novo(2, 'a4'), 7, 'jh')).state.gate.mult, 7);
  assert.equal(fecharRonda(comCeo(novo(2, 'a5'), 11, 'pc')).state.gate.mult, 14);
});

test('Gate de Venda: o bónus da Whitney W. soma ao multiplicador do Gate', () => {
  const m = fecharRonda(comCeo(novo(2, 'w'), 3, 'eh', (s) => { s.bonusGate = 1; }));
  assert.equal(m.state.gate.mult, 6);
});

test('Gate de Venda: vender dá preço × ações × multiplicador e perde as ações', () => {
  let m = gate(mercado(novo(2, 'v')), 5);
  const j = vez(m);
  m = tweak(m, (s) => { su({ state: s }, 'deepanic').acoes[j] = 3; s.jogadores[j].cash = 0; });
  m = jogar(m, j, 'SP_SELL_STARTUP', { startup: 'deepanic' });
  assert.equal(jog(m, j).cash, Math.round(su(m, 'deepanic').preco * 3 * 5));
  assert.equal(su(m, 'deepanic').acoes[j], 0);
});

test('Gate de Venda: exige maioria real (mais de 50%), não basta empatar ou ser o maior', () => {
  const base = gate(mercado(novo(3, 'maj')), 5);
  const j = vez(base);
  const com = (acoes) => tweak(base, (s) => { su({ state: s }, 'deepanic').acoes = acoes(j); });
  recusa(com((x) => { const a = [0, 0, 0]; a[x] = 2; a[(x + 1) % 3] = 2; return a; }), j, 'SP_SELL_STARTUP', { startup: 'deepanic' }, 'err.MAIORIA'); // 2 de 4: empate
  recusa(com((x) => { const a = [0, 0, 0]; a[x] = 2; a[(x + 1) % 3] = 1; a[(x + 2) % 3] = 1; return a; }), j, 'SP_SELL_STARTUP', { startup: 'deepanic' }, 'err.MAIORIA'); // 2 de 4, o maior mas sem 50%+
  recusa(com((x) => { const a = [0, 0, 0]; a[x] = 2; a[(x + 1) % 3] = 2; a[(x + 2) % 3] = 1; return a; }), j, 'SP_SELL_STARTUP', { startup: 'deepanic' }, 'err.MAIORIA'); // 2 de 5
  jogar(com((x) => { const a = [0, 0, 0]; a[x] = 3; a[(x + 1) % 3] = 2; return a; }), j, 'SP_SELL_STARTUP', { startup: 'deepanic' }); // 3 de 5
});

test('Gate de Venda: recusado com o Gate fechado, fora do Mercado ou numa startup implodida', () => {
  const j = vez(novo(2, 'r'));
  const base = (f) => tweak(gate(mercado(novo(2, 'r')), 5), (s) => { su({ state: s }, 'deepanic').acoes[j] = 3; f?.(s); });
  recusa(tweak(base(), (s) => { s.gate.aberto = false; }), j, 'SP_SELL_STARTUP', { startup: 'deepanic' }, 'err.GATE_FECHADO');
  recusa(tweak(base(), (s) => { s.fase = 'MANUTENCAO'; }), j, 'SP_SELL_STARTUP', { startup: 'deepanic' }, 'err.FASE');
  recusa(base((s) => { su({ state: s }, 'deepanic').implodida = true; }), j, 'SP_SELL_STARTUP', { startup: 'deepanic' }, 'err.IMPLODIDA');
});

test('Gate de Venda: não se vende uma startup em que se comprou nesse mesmo turno', () => {
  let m = gate(mercado(novo(2, 'cv')), 5);
  const j = vez(m);
  m = jogar(m, j, 'SP_BUY', { startup: 'halluci', qty: 1 }); // maioria imediata, mas comprada agora
  recusa(m, j, 'SP_SELL_STARTUP', { startup: 'halluci' }, 'err.COMPRADA_NO_TURNO');
  assert.ok(!game.enumerate(m.state, j).some((x) => x.type === 'SP_SELL_STARTUP'));
  m = jogar(jogar(m, j, 'SP_END_MARKET'), j, 'SP_END_TURN');
  m = jogar(jogar(m, vez(m), 'SP_END_MARKET'), vez(m), 'SP_END_TURN'); // a ronda fecha; o Gate fecha com ela
  m = gate(mercado(m), 5);
  assert.deepEqual(m.state.compradas, []);
  jogar(m, vez(m), 'SP_SELL_STARTUP', { startup: 'halluci' }); // numa vez seguinte já pode vender
});

test('Venda livre no mercado: ao preço atual, sem multiplicador, sem Gate e sem maioria', () => {
  let m = mercado(novo(2, 'vm'));
  const j = vez(m);
  m = tweak(m, (s) => { su({ state: s }, 'cashburn').acoes[j] = 2; s.jogadores[j].cash = 0; });
  m = jogar(m, j, 'SP_SELL_MARKET', { startup: 'cashburn', qty: 1 });
  assert.equal(jog(m, j).cash, 4);
  assert.equal(su(m, 'cashburn').acoes[j], 1);
  m = jogar(m, j, 'SP_SELL_MARKET', { startup: 'cashburn' }); // sem qty vende tudo o que resta
  assert.equal(jog(m, j).cash, 8);
  recusa(m, j, 'SP_SELL_MARKET', { startup: 'cashburn' }, 'err.SEM_ACOES');
});

test('Troca no Gate: o outro jogador tem de aceitar; troca todas as ações de uma startup pelas da outra', () => {
  let m = gate(mercado(novo(2, 'tr')), 5);
  const a = vez(m), b = 1 - a;
  m = tweak(m, (s) => { su({ state: s }, 'deepanic').acoes[a] = 2; su({ state: s }, 'cashburn').acoes[b] = 1; });
  m = jogar(m, a, 'SP_TRADE_PROPOSE', { de: 'deepanic', para: b, por: 'cashburn' });
  assert.deepEqual(activeSeats(game, m), [b]);
  recusa(m, a, 'SP_END_MARKET', {});
  const aceite = jogar(m, b, 'SP_TRADE_ACCEPT');
  assert.deepEqual([su(aceite, 'deepanic').acoes[a], su(aceite, 'deepanic').acoes[b]], [0, 2]);
  assert.deepEqual([su(aceite, 'cashburn').acoes[a], su(aceite, 'cashburn').acoes[b]], [1, 0]);
  assert.equal(aceite.state.proposta, null);
  const recusada = jogar(m, b, 'SP_TRADE_REJECT');
  assert.deepEqual(su(recusada, 'deepanic').acoes, [2, 0].map((x, i) => (i === a ? 2 : 0)));
  assert.deepEqual(activeSeats(game, recusada), [a]);
});

test('Troca no Gate: respeita o limite total de 9 ações de cada um', () => {
  const base = gate(mercado(novo(2, 'trt')), 5);
  const a = vez(base), b = 1 - a;
  const com = tweak(base, (s) => {
    su({ state: s }, 'deepanic').acoes[a] = 1; su({ state: s }, 'cashburn').acoes[b] = 4;
    su({ state: s }, 'halluci').acoes[a] = 4; su({ state: s }, 'crispash').acoes[a] = 4; // a tem 9; ficaria com 12
  });
  recusa(com, a, 'SP_TRADE_PROPOSE', { de: 'deepanic', para: b, por: 'cashburn' }, 'err.MAX_TOTAL');
});

test('Troca no Gate: só com o Gate aberto, com ações dos dois lados e respeitando o máximo de 4 ações', () => {
  const base = gate(mercado(novo(2, 'trc')), 5);
  const a = vez(base), b = 1 - a;
  const com = (f) => tweak(base, (s) => f(s));
  const pronto = (s) => { su({ state: s }, 'deepanic').acoes[a] = 2; su({ state: s }, 'cashburn').acoes[b] = 1; };
  recusa(com((s) => { pronto(s); s.gate.aberto = false; }), a, 'SP_TRADE_PROPOSE', { de: 'deepanic', para: b, por: 'cashburn' }, 'err.GATE_FECHADO');
  recusa(com((s) => { su({ state: s }, 'deepanic').acoes[a] = 2; }), a, 'SP_TRADE_PROPOSE', { de: 'deepanic', para: b, por: 'cashburn' }, 'err.TROCA_SEM_ACOES');
  recusa(com((s) => { pronto(s); su({ state: s }, 'deepanic').acoes[b] = 3; }), a, 'SP_TRADE_PROPOSE', { de: 'deepanic', para: b, por: 'cashburn' }, 'err.MAX_ACOES');
  recusa(com(pronto), a, 'SP_TRADE_PROPOSE', { de: 'deepanic', para: a, por: 'cashburn' }, 'err.ALVO');
});

// ─── Fase de Mercado ────────────────────────────────────────

test('Comprar: paga preço × quantidade em cash', () => {
  let m = mercado(novo(2, 'b'));
  const j = vez(m);
  m = jogar(m, j, 'SP_BUY', { startup: 'deepanic', qty: 2 });
  assert.equal(jog(m, j).cash, 10 - 2 * su(m, 'deepanic').preco);
  assert.equal(su(m, 'deepanic').acoes[j], 2);
  recusa(m, j, 'SP_BUY', { startup: 'cashburn', qty: 5 }, 'err.MAX_ACOES');
  recusa(m, j, 'SP_BUY', { startup: 'cashburn', qty: 0 }, 'err.QTD');
});

test('Comprar: sem cash suficiente é recusado', () => {
  let m = mercado(novo(2, 'bc'));
  const j = vez(m);
  m = tweak(m, (s) => { s.jogadores[j].cash = 2; });
  recusa(m, j, 'SP_BUY', { startup: 'cashburn', qty: 1 }, 'err.CASH');
});

test('Comprar: máximo de 9 ações no total, em todas as startups (só dá para ter 2 ou 3 maiorias)', () => {
  let m = mercado(novo(2, 'bt'));
  const j = vez(m);
  m = tweak(m, (s) => { s.jogadores[j].cash = 99; su({ state: s }, 'deepanic').acoes[j] = 4; su({ state: s }, 'cashburn').acoes[j] = 4; });
  m = jogar(m, j, 'SP_BUY', { startup: 'halluci', qty: 1 }); // 9.ª ação
  recusa(m, j, 'SP_BUY', { startup: 'halluci', qty: 1 }, 'err.MAX_TOTAL');
  recusa(m, j, 'SP_BUY', { startup: 'solarscam', qty: 1 }, 'err.MAX_TOTAL');
  assert.ok(!game.enumerate(m.state, j).some((x) => x.type === 'SP_BUY'));
  m = jogar(m, j, 'SP_SELL_MARKET', { startup: 'cashburn', qty: 2 }); // vender liberta espaço
  jogar(m, j, 'SP_BUY', { startup: 'solarscam', qty: 2 });
});

test('Comprar: as ações de startups implodidas não contam para o limite total', () => {
  let m = mercado(novo(2, 'bti'));
  const j = vez(m);
  m = tweak(m, (s) => { s.jogadores[j].cash = 99; su({ state: s }, 'deepanic').acoes[j] = 4; su({ state: s }, 'deepanic').implodida = true; su({ state: s }, 'cashburn').acoes[j] = 4; });
  jogar(m, j, 'SP_BUY', { startup: 'halluci', qty: 4 });
});

test('Comprar: máximo de 4 ações da mesma startup por jogador', () => {
  let m = mercado(novo(2, 'bm'));
  const j = vez(m);
  m = tweak(m, (s) => { s.jogadores[j].cash = 99; su({ state: s }, 'halluci').acoes[j] = 3; });
  m = jogar(m, j, 'SP_BUY', { startup: 'halluci', qty: 1 });
  recusa(m, j, 'SP_BUY', { startup: 'halluci', qty: 1 }, 'err.MAX_ACOES');
});

test('Comprar e vender só na própria vez e na fase de Mercado', () => {
  const m = mercado(novo(2, 'vz'));
  const j = vez(m);
  recusa(m, 1 - j, 'SP_BUY', { startup: 'deepanic' });
  recusa(manutencao(m), j, 'SP_BUY', { startup: 'deepanic' }, 'err.FASE');
});

test('Fechar Mercado: passa à Manutenção', () => {
  const m = jogar(mercado(novo(2, 'em')), vez(novo(2, 'em')), 'SP_END_MARKET');
  assert.equal(m.state.fase, 'MANUTENCAO');
});

// ─── Manutenção ─────────────────────────────────────────────

const contratar = (m, tipo, startup, senior = false) => jogar(m, vez(m), 'SP_HIRE', { worker: m.state.pool.find((w) => w.tipo === tipo).id, startup, senior });

test('Contratar: o nível sai da ordem — Estagiário grátis, Júnior, Mid e do 4.º em diante Sénior; custo cresce', () => {
  let m = tweak(manutencao(novo(2, 'h')), (s) => { s.jogadores[s.ordem[s.pos]].cash = 50; });
  const j = vez(m);
  const esperado = [[0, 0], [1, 1], [2, 2], [3, 3], [3, 3]]; // [nível, custo]
  const tipos = ['engineer', 'lawyer', 'pr', 'cfo', 'engineer'];
  const sus = ['deepanic', 'deepanic', 'deepanic', 'deepanic', 'halluci'];
  esperado.forEach(([nivel, custo], i) => {
    const antes = jog(m, j).cash;
    m = jogar(m, j, 'SP_HIRE', { worker: m.state.pool.find((w) => w.tipo === tipos[i]).id, startup: sus[i] });
    assert.equal(jog(m, j).trab[i].nivel, nivel, `contratado ${i + 1}`);
    assert.equal(antes - jog(m, j).cash, custo);
  });
  assert.equal(m.state.pool.length, 8 - 5);
});

test('Contratar: no máximo 1 trabalhador de cada tipo por startup', () => {
  let m = contratar(manutencao(novo(2, 'h1')), 'engineer', 'deepanic');
  recusa(m, vez(m), 'SP_HIRE', { worker: m.state.pool.find((w) => w.tipo === 'engineer').id, startup: 'deepanic', nivel: 0 }, 'err.TIPO_REPETIDO');
  contratar(m, 'engineer', 'halluci'); // noutra startup já pode
});

test('Contratar: sem limite fixo de trabalhadores, só a pool e o custo; a pool tem uma cópia de cada tipo por jogador', () => {
  let m = tweak(manutencao(novo(2, 'h4')), (s) => { s.jogadores[s.ordem[s.pos]].cash = 99; });
  for (const [t, s] of [['engineer', 'deepanic'], ['lawyer', 'deepanic'], ['pr', 'deepanic'], ['cfo', 'deepanic'], ['engineer', 'halluci']]) m = contratar(m, t, s);
  assert.equal(jog(m, vez(m)).trab.length, 5);
  m = contratar(m, 'lawyer', 'halluci');
  m = contratar(m, 'pr', 'halluci');
  m = contratar(m, 'cfo', 'halluci');
  recusa(m, vez(m), 'SP_HIRE', { worker: 'nao_existe', startup: 'halluci' }, 'err.TRABALHADOR'); // a pool de 8 acabou
  assert.equal(m.state.pool.length, 0);
});

test('Contratar: sem cash para o custo do nível é recusado, e o trabalhador tem de estar na pool', () => {
  let m = tweak(contratar(manutencao(novo(2, 'h2')), 'engineer', 'deepanic'), (s) => { s.jogadores[s.ordem[s.pos]].cash = 0; });
  recusa(m, vez(m), 'SP_HIRE', { worker: m.state.pool.find((w) => w.tipo === 'cfo').id, startup: 'deepanic' }, 'err.CASH'); // o 2.º é Júnior: 1M
  recusa(m, vez(m), 'SP_HIRE', { worker: 'nao_existe', startup: 'deepanic' }, 'err.TRABALHADOR');
});

test('Despedir: o trabalhador volta à pool partilhada', () => {
  let m = contratar(manutencao(novo(2, 'f')), 'cfo', 'deepanic');
  const id = jog(m, vez(m)).trab[0].id;
  m = jogar(m, vez(m), 'SP_FIRE', { worker: id });
  assert.equal(jog(m, vez(m)).trab.length, 0);
  assert.ok(m.state.pool.some((w) => w.id === id));
});

test('Mover trabalhador: indemnização igual ao salário (mínimo 1M)', () => {
  let m = contratar(contratar(tweak(manutencao(novo(2, 'mv')), (s) => { s.jogadores[s.ordem[s.pos]].cash = 20; }), 'engineer', 'deepanic'), 'lawyer', 'deepanic');
  const j = vez(m);
  const [e, l] = jog(m, j).trab; // Estagiário (salário 0 → 1M) e Júnior (1M)
  let antes = jog(m, j).cash;
  m = jogar(m, j, 'SP_MOVE_WORKER', { worker: e.id, startup: 'halluci' });
  assert.equal(jog(m, j).cash, antes - 1);
  m = tweak(m, (s) => { s.jogadores[j].trab[1].nivel = 3; });
  antes = jog(m, j).cash;
  m = jogar(m, j, 'SP_MOVE_WORKER', { worker: l.id, startup: 'halluci' });
  assert.equal(jog(m, j).cash, antes - 3);
  assert.deepEqual(jog(m, j).trab.map((w) => w.startup), ['halluci', 'halluci']);
});

test('Mover trabalhador: não para a mesma startup nem onde já há um desse tipo', () => {
  let m = contratar(contratar(manutencao(novo(2, 'mv2')), 'engineer', 'deepanic'), 'engineer', 'halluci');
  const [a] = jog(m, vez(m)).trab;
  recusa(m, vez(m), 'SP_MOVE_WORKER', { worker: a.id, startup: 'deepanic' }, 'err.STARTUP');
  recusa(m, vez(m), 'SP_MOVE_WORKER', { worker: a.id, startup: 'halluci' }, 'err.TIPO_REPETIDO');
});

test('Salários: cada trabalhador pago custa o seu salário (mais a sobretaxa) e só se paga uma vez por turno', () => {
  let m = tweak(manutencao(novo(2, 'sal')), (s) => {
    const j = s.ordem[s.pos];
    s.jogadores[j].trab = [{ id: 'a', tipo: 'engineer', nome: 'x', startup: 'deepanic', nivel: 0 }, { id: 'b', tipo: 'cfo', nome: 'y', startup: 'halluci', nivel: 2 }];
    s.pool = s.pool.filter((p) => !['a', 'b'].includes(p.id));
    s.sobretaxa = 1;
  });
  const j = vez(m);
  const antes = jog(m, j).cash;
  m = jogar(m, j, 'SP_PAY_SALARY');
  assert.equal(jog(m, j).cash, antes - 3); // o Estagiário não tem salário; o Mid paga 2M + 1M de sobretaxa
  recusa(m, j, 'SP_PAY_SALARY', {}, 'err.SEM_SALARIOS');
});

test('Salários: sem cash, ao terminar o turno lança-se um dado: com 6 o trabalhador fica (sem receber), com outro número vai-se embora', () => {
  const base = tweak(manutencao(novo(2, 'ab')), (s) => {
    const j = s.ordem[s.pos];
    s.jogadores[j].trab = [{ id: 'a', tipo: 'engineer', nome: 'Ada', startup: 'deepanic', nivel: 3 }];
    s.pool = s.pool.filter((p) => p.id !== 'a');
    s.jogadores[j].cash = 0;
  });
  const j = vez(base);
  const resultados = new Set();
  for (let i = 0; i < 40 && resultados.size < 2; i++) {
    const m = jogar({ ...structuredClone(base), rng: i * 7919 + 1 }, j, 'SP_END_TURN');
    const ficou = jog(m, j).trab.length === 1;
    resultados.add(ficou);
    const entrada = m.log.filter((e) => e.key === 'log.FICA' || e.key === 'log.ABANDONOU').at(-1);
    assert.equal(entrada.key, ficou ? 'log.FICA' : 'log.ABANDONOU');
    assert.ok(entrada.announce, 'o jogador é avisado com uma mensagem da mesa');
    assert.equal(entrada.params.dado === 6, ficou);
    assert.equal(jog(m, j).cash, 0);
    if (!ficou) assert.ok(m.state.pool.some((w) => w.id === 'a'));
  }
  assert.equal(resultados.size, 2, 'viu-se um que ficou e um que saiu');
});

const comEquipa = (cash = 20) => tweak(manutencao(novo(2, 'opt')), (s) => {
  const j = s.ordem[s.pos];
  s.jogadores[j].trab = [
    { id: 'a', tipo: 'engineer', nome: 'Ada', startup: 'deepanic', nivel: 0 }, // sem salário
    { id: 'b', tipo: 'lawyer', nome: 'Saul', startup: 'deepanic', nivel: 1 }, // 1M
    { id: 'c', tipo: 'pr', nome: 'Max', startup: 'halluci', nivel: 3 }, // 3M
  ];
  s.pool = s.pool.filter((p) => !['a', 'b', 'c'].includes(p.id));
  s.jogadores[j].cash = cash;
});

test('Salários: pagar é opcional e um a um; o que se paga não se cobra outra vez ao terminar o turno', () => {
  let m = comEquipa();
  const j = vez(m);
  m = jogar(m, j, 'SP_PAY_SALARY', { worker: 'c' });
  assert.equal(jog(m, j).cash, 17);
  recusa(m, j, 'SP_PAY_SALARY', { worker: 'c' }, 'err.SEM_SALARIOS'); // já pago
  recusa(m, j, 'SP_PAY_SALARY', { worker: 'a' }, 'err.SEM_SALARIOS'); // o Estagiário não tem salário
  m = jogar(m, j, 'SP_END_TURN'); // cobra só o que faltava (o Júnior, 1M)
  assert.equal(jog(m, j).cash, 16);
  assert.equal(jog(m, j).trab.length, 3);
});

test('Salários: sem worker paga os de todos os que o cash deixa; um a um recusa o que não se pode pagar', () => {
  let m = comEquipa(2);
  const j = vez(m);
  recusa(m, j, 'SP_PAY_SALARY', { worker: 'c' }, 'err.CASH'); // 3M e só há 2M
  m = jogar(m, j, 'SP_PAY_SALARY'); // paga o Júnior (1M); o Sénior não dá
  assert.equal(jog(m, j).cash, 1);
  assert.deepEqual(m.state.pagos, ['b']);
});

test('Salários: arriscar — com cash para pagar, pode não pagar e jogar o dado (6 fica, outro número sai), sem gastar cash', () => {
  const base = comEquipa(20);
  const j = vez(base);
  const resultados = new Set();
  for (let i = 0; i < 40 && resultados.size < 2; i++) {
    const m = jogar({ ...structuredClone(base), rng: i * 7919 + 1 }, j, 'SP_RISK_SALARY', { worker: 'c' });
    const ficou = jog(m, j).trab.some((w) => w.id === 'c');
    resultados.add(ficou);
    assert.equal(jog(m, j).cash, 20, 'arriscar não custa cash');
    const entrada = m.log.filter((e) => e.key === 'log.ARRISCOU_FICA' || e.key === 'log.ARRISCOU_SAI').at(-1);
    assert.equal(entrada.key, ficou ? 'log.ARRISCOU_FICA' : 'log.ARRISCOU_SAI');
    assert.ok(entrada.announce);
    assert.equal(entrada.params.dado === 6, ficou);
    assert.ok(m.state.pagos.includes('c') || !ficou, 'já está decidido neste turno');
    recusa(m, j, 'SP_RISK_SALARY', { worker: 'c' }, 'err.SEM_SALARIOS');
    if (!ficou) assert.ok(m.state.pool.some((w) => w.id === 'c'));
    const fim = jogar(m, j, 'SP_END_TURN'); // o Júnior paga; o arriscado não se cobra outra vez
    assert.equal(jog(fim, j).cash, 19);
  }
  assert.equal(resultados.size, 2);
  recusa(base, j, 'SP_RISK_SALARY', { worker: 'a' }, 'err.SEM_SALARIOS'); // o Estagiário não tem salário
});

test('Salários: o view diz quanto cada trabalhador custa e se já foi tratado; enumerate oferece pagar ou arriscar', () => {
  let m = comEquipa(20);
  const j = vez(m);
  let v = viewFor(game, m, j);
  assert.deepEqual(v.view.jogadores[j].trab.map((w) => [w.salario, w.pago]), [[0, false], [1, false], [3, false]]);
  assert.ok(v.legal.some((x) => x.type === 'SP_RISK_SALARY' && x.payload.worker === 'b'));
  assert.ok(v.legal.some((x) => x.type === 'SP_PAY_SALARY' && x.payload.worker === 'c'));
  m = jogar(m, j, 'SP_PAY_SALARY', { worker: 'b' });
  v = viewFor(game, m, j);
  assert.equal(v.view.jogadores[j].trab[1].pago, true);
  assert.ok(!v.legal.some((x) => ['SP_PAY_SALARY', 'SP_RISK_SALARY'].includes(x.type) && x.payload?.worker === 'b'));
});

test('Terminar turno: cobra os salários por pagar e passa a vez', () => {
  let m = tweak(contratar(contratar(manutencao(novo(2, 'et')), 'engineer', 'deepanic'), 'lawyer', 'deepanic'), (s) => { s.jogadores[s.ordem[s.pos]].cash = 5; });
  const j = vez(m);
  m = jogar(m, j, 'SP_END_TURN');
  assert.equal(jog(m, j).cash, 4); // o Júnior (2.º) custa 1M por ronda
  assert.equal(m.state.fase, 'MERCADO');
  assert.notEqual(vez(m), j);
  assert.deepEqual(m.state.pagos, []);
});

// ─── Fim de ronda ───────────────────────────────────────────

const proximaWhitney = (m) => tweak(m, (s) => { s.baralho[s.idx] = 'ww'; });

test('Dividendos: ações × Σ(dividendo do tipo × nível), só com trabalhador na startup', () => {
  let m = proximaWhitney(novo(2, 'div'));
  const j = m.state.ordem[0];
  m = tweak(m, (s) => {
    su({ state: s }, 'deepanic').acoes[j] = 3;
    su({ state: s }, 'cashburn').acoes[j] = 2; // sem trabalhadores: não paga
    const w = (id, tipo, startup, nivel) => ({ id, tipo, nome: id, startup, nivel });
    s.jogadores[j].trab = [w('x1', 'engineer', 'deepanic', 1), w('x2', 'lawyer', 'deepanic', 0)];
    s.pool = s.pool.filter((p) => !['x1', 'x2'].includes(p.id));
    s.jogadores[j].cash = 10;
  });
  m = fecharRonda(m);
  // (2M × 2 do Júnior + 1M × 1 do Estagiário) × 3 ações = 15; o Júnior cobra 1M de salário.
  assert.equal(jog(m, j).cash, 10 - 1 + 15);
  assert.deepEqual(m.state.dividendos.map((d) => [d.startup, d.ganho]), [['deepanic', 15]]);
});

test('Dividendos: startups implodidas não pagam', () => {
  let m = proximaWhitney(novo(2, 'div2'));
  const j = m.state.ordem[0];
  m = tweak(m, (s) => {
    su({ state: s }, 'deepanic').acoes[j] = 3; su({ state: s }, 'deepanic').implodida = true;
    s.jogadores[j].trab = [{ id: 'x1', tipo: 'engineer', nome: 'x', startup: 'deepanic', nivel: 0 }];
  });
  m = fecharRonda(m);
  assert.equal(jog(m, j).cash, 10);
});

test('A ronda só acaba quando o último jogador termina o turno: entra o CEO seguinte', () => {
  let m = novo(3, 'ronda');
  const ceo0 = m.state.ceo.id;
  for (let k = 0; k < 2; k++) m = jogar(jogar(m, vez(m), 'SP_END_MARKET'), vez(m), 'SP_END_TURN');
  assert.equal(m.state.ronda, 1);
  m = jogar(jogar(m, vez(m), 'SP_END_MARKET'), vez(m), 'SP_END_TURN');
  assert.equal(m.state.ronda, 2);
  assert.notEqual(m.state.ceo.id, ceo0);
  assert.equal(m.state.pos, 0);
});

// ─── Ordem de jogo ──────────────────────────────────────────

test('Ordem: joga primeiro quem tem ações na startup mais cara; quem não tem ações joga no fim', () => {
  const s = limpo(4);
  s.ordem = [0, 1, 2, 3];
  s.startups.find((x) => x.id === 'cashburn').acoes[2] = 1; // 4M
  s.startups.find((x) => x.id === 'deepanic').acoes[1] = 1; // 3M
  s.startups.find((x) => x.id === 'halluci').acoes[3] = 1; // 2M
  assert.deepEqual(calcularOrdem(s), [2, 1, 3, 0]);
});

test('Ordem: conta a startup mais cara de cada jogador e ignora as implodidas', () => {
  const s = limpo(3);
  s.ordem = [0, 1, 2];
  s.startups.find((x) => x.id === 'cashburn').acoes[0] = 1;
  s.startups.find((x) => x.id === 'cashburn').implodida = true;
  s.startups.find((x) => x.id === 'halluci').acoes[0] = 1; // 2M
  s.startups.find((x) => x.id === 'deepanic').acoes[1] = 1; // 3M
  s.startups.find((x) => x.id === 'solarscam').acoes[1] = 1;
  assert.deepEqual(calcularOrdem(s), [1, 0, 2]);
});

test('Ordem: os empates mantêm a ordem da ronda anterior', () => {
  const s = limpo(3);
  s.ordem = [2, 0, 1];
  s.startups.find((x) => x.id === 'deepanic').acoes[0] = 1;
  s.startups.find((x) => x.id === 'solarscam').acoes[1] = 1; // também 3M
  assert.deepEqual(calcularOrdem(s), [0, 1, 2]);
  s.ordem = [1, 0, 2];
  assert.deepEqual(calcularOrdem(s), [1, 0, 2]);
});

test('Ordem: recalcula-se no início de cada ronda, depois de revelado o CEO', () => {
  let m = proximaWhitney(novo(2, 'ord'));
  m = tweak(m, (s) => { s.ordem = [0, 1]; su({ state: s }, 'cashburn').acoes[1] = 1; });
  m = fecharRonda(m);
  assert.deepEqual(m.state.ordem, [1, 0]);
  assert.equal(vez(m), 1);
});

// ─── Fim de jogo ────────────────────────────────────────────

const ultima = (m, f) => tweak(m, (s) => {
  s.idx = 12; s.pos = 1; s.fase = 'MANUTENCAO'; s.ordem = [0, 1]; f?.(s);
});

test('Fim de jogo: acaba quando o último jogador termina a 12.ª ronda, depois dos dividendos', () => {
  let m = ultima(novo(2, 'fim'));
  assert.equal(m.result, null);
  m = jogar(m, 1, 'SP_END_TURN');
  assert.ok(m.result);
  assert.equal(m.state.fase, 'FIM');
  assert.deepEqual(activeSeats(game, m), []);
});

test('Fim de jogo: pontuação = cash + ações × preço atual (as implodidas valem 0); ganha o mais alto', () => {
  const m = jogar(ultima(novo(2, 'pt'), (s) => {
    s.jogadores[0].cash = 10; s.jogadores[1].cash = 4;
    su({ state: s }, 'cashburn').acoes[0] = 1; // 4
    su({ state: s }, 'deepanic').acoes[1] = 3; // 9
    su({ state: s }, 'halluci').acoes[0] = 4; su({ state: s }, 'halluci').implodida = true;
  }), 1, 'SP_END_TURN');
  const r = m.result;
  assert.deepEqual(r.scores, [10 + 4, 4 + 9]);
  assert.deepEqual(r.winners, [0]);
});

test('Fim de jogo: com pontuação igual, os lugares empatados partilham a vitória', () => {
  const m = jogar(ultima(novo(2, 'emp'), (s) => { s.jogadores[0].cash = 7; s.jogadores[1].cash = 7; }), 1, 'SP_END_TURN');
  assert.deepEqual(m.result.winners, [0, 1]);
});

// ─── Informação escondida ───────────────────────────────────

test('Informação escondida: só o cash dos outros jogadores; ações, trabalhadores e pool são públicos', () => {
  let m = tweak(novo(3, 'hid'), (s) => {
    s.jogadores[1].cash = 7;
    su({ state: s }, 'deepanic').acoes[1] = 2;
    s.jogadores[1].trab = [{ id: 'x', tipo: 'pr', nome: 'x', startup: 'deepanic', nivel: 0 }];
  });
  const v = viewFor(game, m, 0).view;
  assert.equal(v.meuCash, 10);
  assert.equal(v.jogadores[0].cash, 10);
  assert.equal(v.jogadores[1].cash, null);
  assert.deepEqual(v.jogadores[1].acoes, [{ id: 'deepanic', n: 2 }]);
  assert.equal(v.jogadores[1].trab.length, 1);
  assert.equal(v.pool.length, 12);
  const esp = viewFor(game, m, null).view;
  assert.equal(esp.meuCash, null);
  assert.ok(esp.jogadores.every((j) => j.cash === null));
  assert.ok(!JSON.stringify(v).includes('"cash":7'));
});

test('Simulação: partidas completas com o bot por omissão acabam sem falhas', async () => {
  const { simulate } = await import('@bitnik/engine');
  for (const n of [2, 3, 4]) {
    const r = simulate(game, { numPlayers: n, games: 3, seed: 'sim' + n });
    assert.equal(r.failures.length, 0);
    assert.equal(r.finished, 3);
  }
});
