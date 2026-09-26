// Gerado pela Forge a partir dos testes aprovados (não editar à mão).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, applyMove, fireTimer, simulate, viewFor, legalMoves } from '@bitnik/engine';
import game from '../index.js';
// Testes aprovados na Forge: são as regras. Um teste por cartão e por partida narrada.
const tweak = (m, fn) => { const c = structuredClone(m); fn(c.state); return c; };

// Funções auxiliares dos testes
let _id = 0;
const carta = (capivaras, o = {}) => ({ id: 't' + (++_id), capivaras, passaro: !!o.passaro, nenufares: o.nenufares || [] });
const encher = (k) => Array.from({ length: k }, () => carta(1));
const comPassaros = (k) => ({ apanhadas: Array.from({ length: k }, () => carta(1, { passaro: true })), passaros: k });
const novo = (n = 3, seed = 1) => createMatch(game, { numPlayers: n, seed, options: {} });
const jogar = (m, lugar, type, payload = {}) => applyMove(game, m, lugar, { type, payload });
const apostar = (m, lugar, letra) => {
  const r = jogar(m, lugar, 'APOSTAR', { carta: letra });
  assert.equal(r.ok, true, 'APOSTAR falhou: ' + JSON.stringify(r.error));
  return r.match;
};
const apostarTodos = (m, letras) => letras.reduce((acc, letra, lugar) => apostar(acc, lugar, letra), m);
const fimRevelacao = (m) => { const r = fireTimer(game, m, 'revelacao'); return r && r.match ? r.match : r; };
const mesaCom = (cartas) => cartas.map((c, i) => ({ letra: String.fromCharCode(65 + i), carta: c }));
const todasAsCartas = (s) => [...s.baralho, ...s.mesa.map((x) => x.carta), ...s.descarte];
const ids = (cartas) => cartas.map((c) => c.id).sort();
const montar = (m, o = {}) => tweak(m, (s) => {
  const n = s.jogadores.length;
  if (o.mesa) s.mesa = mesaCom(o.mesa);
  if (o.baralho) s.baralho = o.baralho;
  if (o.descarte) s.descarte = o.descarte;
  if (o.jogadores) o.jogadores.forEach((j, i) => { if (j) Object.assign(s.jogadores[i], j); });
  if ('token' in o) s.tokenPassaro = o.token;
  if ('reciclagens' in o) s.reciclagens = o.reciclagens;
  s.fase = 'APOSTAS';
  s.apostas = Array(n).fill(null);
  s.revelacao = null;
});

// cartão c1: Composição do baralho
test('Composição do baralho', () => {
  const m = novo(3);
  const cartas = todasAsCartas(m.state);
  assert.equal(cartas.length, 36);
  assert.equal(new Set(cartas.map((c) => c.id)).size, 36);
  const porCapivaras = {};
  for (const c of cartas) porCapivaras[c.capivaras] = (porCapivaras[c.capivaras] || 0) + 1;
  assert.deepEqual(porCapivaras, { 1: 6, 2: 13, 3: 11, 4: 4, 5: 2 });
  for (const c of cartas) {
    assert.equal(typeof c.passaro, 'boolean');
    assert.ok(Array.isArray(c.nenufares));
    for (const cor of c.nenufares) assert.ok(['Y', 'R', 'W', 'B'].includes(cor));
  }
  assert.ok(cartas.some((c) => c.passaro));
  for (const cor of ['Y', 'R', 'W', 'B']) assert.ok(cartas.some((c) => c.nenufares.includes(cor)));
});

// cartão c2: Estado de cada jogador
test('Estado de cada jogador', () => {
  const m = novo(3);
  assert.equal(m.state.jogadores.length, 3);
  for (const j of m.state.jogadores) {
    assert.deepEqual(j.apanhadas, []);
    assert.equal(j.passaros, 0);
  }
  assert.equal(m.state.tokenPassaro, null);
  const inicial = { apanhadas: [carta(2, { nenufares: ['Y'] })], passaros: 0 };
  let m2 = montar(m, { mesa: [carta(3, { passaro: true, nenufares: ['R', 'W'] }), carta(1), carta(1)], baralho: encher(10), jogadores: [inicial] });
  m2 = apostarTodos(m2, ['A', 'B', 'B']);
  const j0 = m2.state.jogadores[0];
  assert.equal(j0.apanhadas.length, 2);
  const cores = new Set(j0.apanhadas.flatMap((c) => c.nenufares));
  assert.deepEqual([...cores].sort(), ['R', 'W', 'Y']);
  assert.equal(j0.passaros, j0.apanhadas.filter((c) => c.passaro).length);
  assert.ok(m2.state.tokenPassaro === null || Number.isInteger(m2.state.tokenPassaro));
});

// cartão c8: Aposta única ganha a carta
test('Aposta única ganha a carta', () => {
  const ave = carta(3, { passaro: true, nenufares: ['Y'] });
  let m = montar(novo(3), { mesa: [ave, carta(2), carta(1)], baralho: encher(10) });
  m = apostarTodos(m, ['A', 'B', 'B']);
  assert.deepEqual(m.state.jogadores[0].apanhadas.map((c) => c.id), [ave.id]);
  assert.equal(m.state.jogadores[0].passaros, 1);
  for (const lugar of [1, 2]) {
    assert.equal(m.state.jogadores[lugar].apanhadas.length, 0);
    assert.equal(m.state.jogadores[lugar].passaros, 0);
  }
  assert.equal(m.state.revelacao.ganhos.A, 0);
  assert.equal(m.state.revelacao.ganhos.B, null);
});

// cartão c9: Empate: ninguém ganha a carta
test('Empate: ninguém ganha a carta', () => {
  const b = carta(4);
  const c = carta(2);
  let m = montar(novo(3), { mesa: [carta(1), b, c], baralho: encher(10) });
  m = apostarTodos(m, ['B', 'B', 'C']);
  for (const j of m.state.jogadores) assert.ok(!j.apanhadas.some((x) => x.id === b.id));
  assert.equal(m.state.jogadores[0].apanhadas.length, 0);
  assert.equal(m.state.jogadores[1].apanhadas.length, 0);
  assert.deepEqual(m.state.jogadores[2].apanhadas.map((x) => x.id), [c.id]);
  assert.equal(m.state.revelacao.ganhos.B, null);
});

// cartão c10: Token do pássaro: primeira atribuição
test('Token do pássaro: primeira atribuição', () => {
  let m = montar(novo(3), { mesa: [carta(2, { passaro: true }), carta(1), carta(1)], baralho: encher(10), token: null });
  m = apostarTodos(m, ['A', 'B', 'B']);
  assert.equal(m.state.tokenPassaro, 0);
});

// cartão c11: Token do pássaro: empate na primeira atribuição
test('Token do pássaro: empate na primeira atribuição', () => {
  let m = montar(novo(3), { mesa: [carta(2, { passaro: true }), carta(3, { passaro: true }), carta(1)], baralho: encher(10), token: null });
  m = apostarTodos(m, ['A', 'B', 'C']);
  assert.equal(m.state.jogadores[0].passaros, 1);
  assert.equal(m.state.jogadores[1].passaros, 1);
  assert.equal(m.state.tokenPassaro, null);
});

// cartão c12: Roubar o token do pássaro
test('Roubar o token do pássaro', () => {
  let m = montar(novo(3), {
    mesa: [carta(1, { passaro: true }), carta(1, { passaro: true }), carta(1)],
    baralho: encher(10), token: 0,
    jogadores: [comPassaros(2), comPassaros(2), comPassaros(1)]
  });
  m = apostarTodos(m, ['C', 'A', 'B']);
  assert.equal(m.state.jogadores[1].passaros, 3);
  assert.equal(m.state.jogadores[2].passaros, 2);
  assert.equal(m.state.tokenPassaro, 1);

  let m2 = montar(novo(3), {
    mesa: [carta(1, { passaro: true }), carta(1), carta(1)],
    baralho: encher(10), token: 0,
    jogadores: [comPassaros(2), comPassaros(1), comPassaros(0)]
  });
  m2 = apostarTodos(m2, ['C', 'A', 'B']);
  assert.equal(m2.state.jogadores[1].passaros, 2);
  assert.equal(m2.state.tokenPassaro, 0);
});

// cartão c13: Token do pássaro: empate no roubo
test('Token do pássaro: empate no roubo', () => {
  let m = montar(novo(3), {
    mesa: [carta(1, { passaro: true }), carta(1, { passaro: true }), carta(1)],
    baralho: encher(10), token: 0,
    jogadores: [comPassaros(1), comPassaros(1), comPassaros(1)]
  });
  m = apostarTodos(m, ['C', 'A', 'B']);
  assert.equal(m.state.jogadores[1].passaros, 2);
  assert.equal(m.state.jogadores[2].passaros, 2);
  assert.equal(m.state.tokenPassaro, 0);
});

// cartão c14: Fim da ronda: mesa vai para o descarte
test('Fim da ronda: mesa vai para o descarte', () => {
  const mesa = [carta(1), carta(2), carta(3)];
  let m = montar(novo(3), { mesa, baralho: encher(10), descarte: [] });
  m = apostarTodos(m, ['A', 'A', 'C']);
  m = fimRevelacao(m);
  assert.deepEqual(ids(m.state.descarte), ids(mesa));
  assert.equal(m.state.mesa.length, 3);
  assert.ok(m.state.mesa.every((x) => !mesa.some((c) => c.id === x.carta.id)));
  assert.equal(m.state.baralho.length, 7);
  assert.deepEqual(m.state.jogadores[2].apanhadas.map((c) => c.id), [mesa[2].id]);
});

// cartão c15: Baralho esgotado
test('Baralho esgotado', () => {
  const baralho = [carta(1), carta(2)];
  const descarte = [carta(3), carta(4), carta(5), carta(1)];
  const mesa = [carta(2), carta(2), carta(2)];
  let m = montar(novo(3), { mesa, baralho, descarte, reciclagens: 0 });
  m = apostarTodos(m, ['A', 'A', 'A']);
  m = fimRevelacao(m);
  assert.equal(m.result, null);
  assert.equal(m.state.fase, 'APOSTAS');
  assert.equal(m.state.reciclagens, 1);
  assert.equal(m.state.descarte.length, 0);
  assert.equal(m.state.mesa.length, 3);
  assert.deepEqual(ids([...m.state.baralho, ...m.state.mesa.map((x) => x.carta)]), ids([...baralho, ...descarte, ...mesa]));

  m = montar(m, { baralho: [carta(1)], reciclagens: 1 });
  m = apostarTodos(m, ['A', 'B', 'C']);
  m = fimRevelacao(m);
  assert.equal(m.state.fase, 'FIM');
  assert.notEqual(m.result, null);
});

// cartão c16: Pontuação final
test('Pontuação final', () => {
  const j0 = { apanhadas: [carta(3, { nenufares: ['Y'] }), carta(2, { nenufares: ['R'] }), carta(1, { nenufares: ['W', 'B'] })], passaros: 0 };
  const j1 = { apanhadas: [carta(5, { nenufares: ['Y', 'R', 'W'] }), carta(4)], passaros: 0 };
  let m = montar(novo(2), { mesa: [carta(5), carta(5)], baralho: [], descarte: [], jogadores: [j0, j1], token: 0, reciclagens: 1 });
  m = apostarTodos(m, ['A', 'A']);
  m = fimRevelacao(m);
  assert.deepEqual(m.result.scores, [21, 9]);
  assert.deepEqual(m.result.winners, [0]);
});

// cartão c17: Vencedor
test('Vencedor', () => {
  const jogadores = [
    { apanhadas: [carta(3)], passaros: 0 },
    { apanhadas: [carta(5)], passaros: 0 },
    { apanhadas: [carta(2), carta(3)], passaros: 0 }
  ];
  let m = montar(novo(3), { mesa: [carta(1), carta(1), carta(1)], baralho: [], descarte: [], jogadores, token: null, reciclagens: 1 });
  m = apostarTodos(m, ['A', 'A', 'A']);
  m = fimRevelacao(m);
  assert.deepEqual(m.result.scores, [3, 5, 5]);
  // 1.0.0 (decisão do David): um empate partilha a vitória (antes ganhava o primeiro lugar empatado).
  assert.deepEqual(m.result.winners, [1, 2]);
});

// cartão c20: Cartas na mesa
test('Cartas na mesa', () => {
  for (const n of [2, 4, 6]) {
    const m = novo(n);
    assert.equal(m.state.mesa.length, n);
    assert.deepEqual(m.state.mesa.map((x) => x.letra), 'ABCDEF'.slice(0, n).split(''));
    assert.equal(m.state.baralho.length, 36 - n);
    for (let lugar = 0; lugar < n; lugar++) {
      assert.deepEqual(game.view(m.state, lugar).mesa, m.state.mesa);
    }
  }
});

// cartão c21: Fase de apostas
test('Fase de apostas', () => {
  let m = novo(3);
  assert.equal(m.state.fase, 'APOSTAS');
  for (const lugar of [0, 1, 2]) {
    const jogadas = game.enumerate(m.state, lugar);
    assert.ok(jogadas.every((j) => j.type === 'APOSTAR'));
    assert.deepEqual(jogadas.map((j) => j.payload.carta).sort(), ['A', 'B', 'C']);
  }
  m = apostar(m, 1, 'A');
  assert.deepEqual(game.enumerate(m.state, 1), []);
  m = apostar(m, 0, 'C');
  assert.equal(m.state.fase, 'APOSTAS');
  m = apostar(m, 2, 'C');
  assert.equal(m.state.fase, 'REVELACAO');
});

// cartão c22: Token do pássaro
test('Token do pássaro', () => {
  assert.equal(novo(3).state.tokenPassaro, null);
  let m = montar(novo(2), { mesa: [carta(1), carta(1)], baralho: [], descarte: [], token: 1, reciclagens: 1 });
  assert.ok(Number.isInteger(m.state.tokenPassaro));
  m = apostarTodos(m, ['A', 'A']);
  m = fimRevelacao(m);
  assert.deepEqual(m.result.scores, [0, 5]);
  assert.deepEqual(m.result.winners, [1]);
});

// cartão c23: Número de jogadores
test('Número de jogadores', () => {
  for (let n = 2; n <= 6; n++) assert.equal(novo(n).state.jogadores.length, n);
  assert.throws(() => novo(1));
  assert.throws(() => novo(7));
});

// cartão c24: Ninguém vê as apostas dos outros
test('Ninguém vê as apostas dos outros', () => {
  let m = montar(novo(3), { mesa: [carta(1), carta(2), carta(3)] });
  m = apostar(m, 0, 'B');
  const v1 = game.view(m.state, 1);
  assert.deepEqual(v1.apostas, [true, null, false]);
  assert.equal(v1.revelacao, null);
  m = apostar(m, 2, 'C');
  assert.deepEqual(game.view(m.state, 1).apostas, [true, null, true]);
  assert.deepEqual(game.view(m.state, 0).apostas, ['B', false, true]);
  assert.deepEqual(game.view(m.state, 2).apostas, [true, false, 'C']);
});

// partida p1: Partida narrada p1
test('Partida narrada p1', () => {
  const B = carta(3);
  const C = carta(2);
  const jogadores = [
    { apanhadas: [carta(4)], passaros: 0 },
    { apanhadas: [carta(2)], passaros: 0 },
    { apanhadas: [carta(5), carta(4), carta(3)], passaros: 0 }
  ];
  let m = montar(novo(3), { mesa: [carta(1), B, C], baralho: [], descarte: [], jogadores, token: null, reciclagens: 1 });
  m = apostar(m, 0, 'B');
  assert.equal(m.state.apostas[0], 'B');
  m = apostar(m, 1, 'B');
  m = apostar(m, 2, 'C');
  assert.equal(m.state.fase, 'REVELACAO');
  assert.deepEqual(m.state.revelacao.apostas, ['B', 'B', 'C']);
  assert.equal(m.state.revelacao.ganhos.B, null);
  for (const j of m.state.jogadores) assert.ok(!j.apanhadas.some((c) => c.id === B.id));
  assert.ok(m.state.jogadores[2].apanhadas.some((c) => c.id === C.id));
  m = fimRevelacao(m);
  assert.equal(m.state.fase, 'FIM');
  assert.deepEqual(m.result.winners, [2]);
  assert.equal(m.result.scores[2], 14);
});

// cartão c4: Apostar em segredo
test('Apostar em segredo', () => {
  const m0 = montar(novo(3), { mesa: [carta(1), carta(2), carta(3)], baralho: encher(10) });
  const m1 = apostar(m0, 0, 'B');
  assert.equal(m1.state.apostas[0], 'B');
  assert.equal(m1.state.fase, 'APOSTAS');
  assert.equal(m1.state.revelacao, null);

  const r = jogar(m1, 0, 'APOSTAR', { carta: 'C' });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'engine.NOT_ACTIVE'); // quem já não pode jogar é travado pelo motor
  assert.equal(m1.state.apostas[0], 'B');
  assert.ok(!game.enumerate(m1.state, 0).some((j) => j.type === 'APOSTAR'));

  const propria = game.view(m1.state, 0);
  assert.equal(propria.apostas[0], 'B');

  for (const lugar of [1, 2]) {
    const v = game.view(m1.state, lugar);
    assert.ok(v.apostas[0], 'o lugar ' + lugar + ' devia saber que J1 já apostou');
    assert.notEqual(v.apostas[0], 'B');
    assert.ok(!JSON.stringify(v.apostas).includes('"B"'));
    assert.equal(v.revelacao, null);
    assert.ok(game.enumerate(m1.state, lugar).some((j) => j.type === 'APOSTAR'));
  }
});

// cartão c7: Revelação simultânea
test('Revelação simultânea', () => {
  const a = carta(1);
  const b = carta(2, { passaro: true });
  const c = carta(3);
  let m = montar(novo(3), { mesa: [a, b, c], baralho: encher(10) });

  m = apostar(m, 0, 'A');
  m = apostar(m, 1, 'B');
  assert.equal(m.state.fase, 'APOSTAS');
  assert.equal(m.state.revelacao, null);
  m.state.jogadores.forEach((j) => assert.equal(j.apanhadas.length, 0));

  m = apostar(m, 2, 'C');
  assert.equal(m.state.fase, 'REVELACAO');
  assert.deepEqual(m.state.revelacao.apostas, ['A', 'B', 'C']);
  assert.equal(m.state.revelacao.duracaoMs, 5000);
  for (const lugar of [0, 1, 2]) {
    const v = game.view(m.state, lugar);
    assert.deepEqual(v.revelacao.apostas, ['A', 'B', 'C']);
  }

  assert.deepEqual(ids(m.state.jogadores[0].apanhadas), [a.id]);
  assert.deepEqual(ids(m.state.jogadores[1].apanhadas), [b.id]);
  assert.deepEqual(ids(m.state.jogadores[2].apanhadas), [c.id]);
  assert.equal(m.state.jogadores[1].passaros, 1);

  for (const lugar of [0, 1, 2]) assert.equal(game.enumerate(m.state, lugar).length, 0);
  const r = jogar(m, 0, 'APOSTAR', { carta: 'A' });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'engine.NOT_ACTIVE'); // quem já não pode jogar é travado pelo motor

  m = fimRevelacao(m);
  assert.equal(m.state.fase, 'APOSTAS');
  assert.equal(m.state.revelacao, null);
  assert.deepEqual(m.state.apostas, [null, null, null]);
  assert.equal(m.state.mesa.length, 3);
  assert.deepEqual(m.state.mesa.map((x) => x.letra), ['A', 'B', 'C']);
});
