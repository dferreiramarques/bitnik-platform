// Testes das regras do Nine Oils, escritos a partir de REGRAS.md (um por regra).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMatch, applyMove, simulate, checkGame, checkPurity } from '@bitnik/engine';
import oils from '../index.js';
import { analisar, conjuntos } from '../rules.js';

const novo = (seed = 'oils') => createMatch(oils, { numPlayers: 2, seed });
const jogar = (m, lugar, type, payload = {}) => applyMove(oils, m, lugar, { type, payload });
const ok = (r) => { assert.ok(r.ok, JSON.stringify(r.error)); return r.match; };
const tweak = (m, fn) => { const c = structuredClone(m); fn(c.state); return c; };
/** Põe o jogo na pausa depois de um lançamento com estes dados, para o jogador 0. */
const comDados = (m, dados, fn = () => {}) => tweak(m, (s) => { s.vez = 0; s.dados = dados; s.pendente = analisar(dados); s.fase = 'PAUSA'; fn(s); });
const set = (b) => b.map((x) => x.join('+')).sort();
/** Continua depois dos dados; se houver escolha, escolhe a opção que tem esta combinação. */
function continuar(m, combo) {
  m = ok(jogar(m, 0, 'CONTINUAR'));
  if (m.state.fase === 'COMBO') m = ok(jogar(m, 0, 'ESCOLHER_COMBO', { opcao: m.state.opcoes.findIndex((o) => o.includes(combo)) }));
  return m;
}

test('pacote válido, i18n PT/EN com paridade e regras puras', () => {
  assert.deepEqual(checkGame(oils), []);
  const dir = new URL('../', import.meta.url);
  const problems = ['index.js', 'rules.js', 'bot.js', 'i18n/pt.js', 'i18n/en.js'].flatMap((f) => checkPurity(readFileSync(new URL(f, dir), 'utf8'), f));
  assert.deepEqual(problems, []);
});

test('Preparação: banca de 6 casas com 2 cubos, 9 cartas de Personagem, 1 carta a cada um', () => {
  const m = novo();
  for (const j of m.state.jogadores) {
    assert.deepEqual(j.banca, [0, 0, 1, 1, 1, 1]);
    assert.equal(j.mao.length, 1);
    assert.equal(j.reserva, 6);
  }
  assert.equal(m.state.baralho.length, 7);
  assert.ok([0, 1].includes(m.state.vez));
  assert.throws(() => createMatch(oils, { numPlayers: 3, seed: 1 }));
});

test('Combinações: cada face só dá uma combinação; o par do Triplo+Duplo é de outra face', () => {
  // quatro 3, três 5, um 1, um 2: Quad(3) + Triplo+Duplo impossível sem os 3 → conflito
  const a = analisar([3, 3, 3, 3, 5, 5, 5, 1, 2]);
  assert.ok(a.opcoes);
  assert.ok(set(a.opcoes).includes('QUAD+TRIPLE_DOUBLE') === false, 'o 3 não pode ser Quad e par ao mesmo tempo');
  assert.ok(set(a.opcoes).includes('TRIPLE_DOUBLE'));
  assert.ok(set(a.opcoes).includes('DOUBLE+QUAD'));
  // três 4 e um par de 1: Triplo+Duplo, ou dois Duplos (sem cascata), à escolha
  assert.deepEqual(set(conjuntos([4, 4, 4, 1, 1, 2, 3, 5, 6])), ['DOUBLE', 'DOUBLE+DOUBLE', 'TRIPLE_DOUBLE']);
  // um só par: sem escolha
  assert.deepEqual(analisar([1, 1, 2, 3, 4, 5, 6, 2, 3]).opcoes, [['DOUBLE', 'DOUBLE', 'DOUBLE'], ['DOUBLE', 'DOUBLE'], ['DOUBLE']]);
});

test('Combinações especiais: 6 iguais, Joker (7), 8 iguais e 9 iguais', () => {
  assert.deepEqual(analisar([2, 2, 2, 2, 2, 2, 1, 3, 4]).combos, ['SIX_OF_KIND']);
  const j = analisar([2, 2, 2, 2, 2, 2, 2, 1, 3]);
  assert.ok(j.joker);
  assert.deepEqual(j.opcoes.map((x) => x[0]), ['DOUBLE', 'TRIPLE_DOUBLE', 'QUAD', 'PENTA', 'SIX_OF_KIND']);
  assert.deepEqual(analisar([6, 6, 6, 6, 6, 6, 6, 6, 1]).combos, ['DOUBLE_QUAD']);
  assert.deepEqual(analisar(Array(9).fill(5)).combos, ['INSTANT_WIN']);
});

test('Triplo + Duplo põe uma garrafa numa casa livre; o Quad abre uma casa com cubo', () => {
  let m = continuar(comDados(novo(), [1, 1, 1, 2, 2, 3, 4, 5, 6]), 'TRIPLE_DOUBLE');
  assert.equal(m.state.jogadores[0].banca.filter((x) => x === 2).length, 1);
  assert.equal(m.state.jogadores[0].reserva, 5);
  m = continuar(comDados(m, [4, 4, 4, 4, 1, 2, 3, 5, 6]), 'QUAD');
  assert.equal(m.state.jogadores[0].banca.filter((x) => x === 0).length, 1);
});

test('Penta: o adversário descarta a mão toda', () => {
  let m = comDados(novo(), [3, 3, 3, 3, 3, 1, 2, 4, 6], (s) => { s.jogadores[1].mao = ['BULLY', 'BOY']; });
  m = continuar(m, 'PENTA');
  assert.deepEqual(m.state.jogadores[1].mao, []);
});

test('Sedutora: com Triplo + Duplo dá 1 garrafa a mais', () => {
  let m = tweak(novo(), (s) => { s.vez = 0; s.jogadores[0].mao = ['TEMPTRESS']; });
  m = ok(jogar(m, 0, 'LANCAR', { cartas: [0] }));
  assert.equal(m.state.sedutoras, 1);
  m = continuar(comDados(m, [1, 1, 1, 2, 2, 3, 4, 5, 6], (s) => { s.sedutoras = 1; }), 'TRIPLE_DOUBLE');
  assert.equal(m.state.jogadores[0].banca.filter((x) => x === 2).length, 2);
});

test('Rapaz rouba 1 garrafa; um Valentão do adversário bloqueia-o (a decisão é do adversário)', () => {
  const base = tweak(novo(), (s) => {
    s.vez = 0;
    s.jogadores[0].mao = ['BOY'];
    s.jogadores[1].banca = [0, 0, 2, 2, 1, 1];
    s.jogadores[1].reserva = 4;
  });
  // Sem Valentões: rouba logo.
  let m = ok(jogar(tweak(base, (s) => { s.jogadores[1].mao = []; }), 0, 'LANCAR', { cartas: [0] }));
  assert.equal(m.state.jogadores[1].banca.filter((x) => x === 2).length, 1);
  // Com um Valentão: o adversário escolhe bloquear.
  m = ok(jogar(tweak(base, (s) => { s.jogadores[1].mao = ['BULLY']; }), 0, 'LANCAR', { cartas: [0] }));
  assert.equal(m.state.fase, 'DEFESA');
  assert.equal(jogar(m, 0, 'DEFENDER', { valentoes: 1 }).error.code, 'engine.NOT_ACTIVE');
  m = ok(jogar(m, 1, 'DEFENDER', { valentoes: 1 }));
  assert.equal(m.state.jogadores[1].banca.filter((x) => x === 2).length, 2, 'bloqueado');
  assert.deepEqual(m.state.jogadores[1].mao, []);
  assert.equal(m.state.fase, 'PAUSA', 'depois da defesa, os dados são lançados');
});

test('2 Valentões no próprio turno: tira às cegas uma carta da mão do adversário', () => {
  let m = tweak(novo(), (s) => { s.vez = 0; s.jogadores[0].mao = ['BULLY', 'BULLY']; s.jogadores[1].mao = ['TEMPTRESS', 'BOY']; });
  m = ok(jogar(m, 0, 'LANCAR', { cartas: [0, 1] }));
  assert.equal(m.state.fase, 'ESCOLHA_CEGA');
  assert.equal(oils.view(m.state, 0).jogadores[1].mao, undefined, 'não vê a mão do adversário');
  m = ok(jogar(m, 0, 'ESCOLHA_CEGA', { carta: 1 }));
  assert.deepEqual(m.state.jogadores[1].mao, ['TEMPTRESS']);
});

test('Limite de mão: com mais de 3 cartas no fim do turno, descarta até 3', () => {
  let m = comDados(novo(), [2, 2, 2, 2, 2, 2, 1, 3, 4], (s) => { s.jogadores[0].mao = ['BOY']; });
  m = ok(jogar(m, 0, 'CONTINUAR'));
  assert.equal(m.state.jogadores[0].mao.length, 4);
  assert.equal(m.state.fase, 'DESCARTE');
  m = ok(jogar(m, 0, 'DESCARTAR', { carta: 0 }));
  assert.equal(m.state.jogadores[0].mao.length, 3);
  assert.equal(m.state.vez, 1);
});

test('Vitória: 6 garrafas na banca, ou nove iguais', () => {
  let m = continuar(comDados(novo(), [1, 1, 1, 2, 2, 3, 4, 5, 6], (s) => { s.jogadores[0].banca = [2, 2, 2, 2, 2, 1]; s.jogadores[0].reserva = 1; }), 'TRIPLE_DOUBLE');
  assert.deepEqual(m.result.winners, [0]);
  m = ok(jogar(comDados(novo(), Array(9).fill(4)), 0, 'CONTINUAR'));
  assert.deepEqual(m.result.winners, [0]);
});

test('Simulação: partidas com bots acabam', () => {
  const r = simulate(oils, { numPlayers: 2, games: 200, seed: 't' });
  assert.equal(r.finished, 200);
  assert.deepEqual(r.failures, []);
});
