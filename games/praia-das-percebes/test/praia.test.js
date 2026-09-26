// Testes das regras da Praia das Percebes, escritos a partir de REGRAS.md (um por regra).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMatch, applyMove, simulate, checkGame, checkPurity, createRng, translate, viewFor } from '@bitnik/engine';
import praia from '../index.js';
import { baralho, banhistasVigiados, objetivoFeito, podeColocar } from '../rules.js';

const novo = (n = 2, seed = 'praia') => createMatch(praia, { numPlayers: n, seed });
const jogar = (m, lugar, type, payload = {}) => applyMove(praia, m, lugar, { type, payload });
const ok = (r) => { assert.ok(r.ok, JSON.stringify(r.error)); return r.match; };
const tweak = (m, fn) => { const c = structuredClone(m); fn(c.state); return c; };
const peca = (banhistas, tipo = 'normal') => ({ id: 900, banhistas, tipo });
/** Tabuleiro a partir de linhas de texto: 1-3 banhistas, S prancha, R rocha, A areia, . vazio. */
function praiaDe(linhas) {
  const t = {};
  linhas.forEach((l, r) => [...l].forEach((ch, c) => {
    if (ch === '.') return;
    t[`${r},${c}`] = ch === 'S' ? peca(1, 'prancha') : ch === 'R' ? peca(0, 'rocha') : ch === 'A' ? peca(0, 'areia') : peca(Number(ch));
  }));
  return t;
}

test('pacote válido, i18n PT/EN com paridade e regras puras', () => {
  assert.deepEqual(checkGame(praia), []);
  const dir = new URL('../', import.meta.url);
  const problems = ['index.js', 'rules.js', 'bot.js', 'i18n/pt.js', 'i18n/en.js'].flatMap((f) => checkPurity(readFileSync(new URL(f, dir), 'utf8'), f));
  assert.deepEqual(problems, []);
});

test('Componentes: 44 peças (42 a 3 jogadores) e fichas 6/5/4', () => {
  const b = baralho(createRng(1), 2);
  assert.equal(b.length, 44);
  const conta = (f) => b.filter(f).length;
  assert.equal(conta((p) => p.tipo === 'normal' && p.banhistas === 1), 8);
  assert.equal(conta((p) => p.tipo === 'normal' && p.banhistas === 2), 12);
  assert.equal(conta((p) => p.tipo === 'normal' && p.banhistas === 3), 6);
  assert.equal(conta((p) => p.tipo === 'prancha'), 4);
  assert.equal(conta((p) => p.tipo === 'rocha'), 2);
  assert.equal(conta((p) => p.tipo === 'areia'), 12);
  assert.equal(baralho(createRng(1), 3).length, 42);
  for (const [n, f] of [[2, 6], [3, 5], [4, 4]]) assert.ok(novo(n).state.jogadores.every((j) => j.fichas === f));
});

test('Preparação: peça inicial na mesa, 4 objetivos revelados, o 1.º jogador já tirou a peça (só ele a vê)', () => {
  const m = novo(3);
  assert.deepEqual(m.state.tabuleiro['0,0'], { id: 0, banhistas: 1, tipo: 'normal' });
  assert.equal(m.state.objetivos.length, 4);
  assert.equal(m.state.porRevelar.length, 4);
  assert.ok(praia.view(m.state, 0).peca.tipo);
  assert.deepEqual(praia.view(m.state, 1).peca, { escondida: true });
  assert.equal(typeof praia.view(m.state, 1).baralho, 'number', 'a ordem do baralho não se vê');
});

test('Colocar: ortogonalmente adjacente, nunca na diagonal; a praia não passa de 7×7', () => {
  const m = novo();
  assert.equal(jogar(m, 0, 'COLOCAR', { r: 1, c: 1 }).error.code, 'err.POSICAO');
  assert.equal(jogar(m, 1, 'COLOCAR', { r: 0, c: 1 }).error.code, 'engine.NOT_ACTIVE');
  ok(jogar(m, 0, 'COLOCAR', { r: 0, c: 1 }));
  const linha = praiaDe(['1111111']);
  assert.equal(podeColocar(linha, 0, 7), false, 'linha de 7 cheia');
  assert.equal(podeColocar(praiaDe(['1', '1', '1', '1', '1', '1', '1']), 7, 0), false, 'coluna de 7 cheia');
  assert.equal(podeColocar(linha, 1, 3), true);
});

test('Salva-vidas: opcional, gasta 1 ficha, 1 por linha e por coluna, nunca em rochas', () => {
  let m = tweak(novo(), (s) => { s.peca = peca(2); });
  m = ok(jogar(m, 0, 'COLOCAR', { r: 0, c: 1 }));
  assert.equal(m.state.fase, 'SALVA_VIDAS');
  m = ok(jogar(m, 0, 'SALVA_VIDAS', { dir: 'h' }));
  assert.equal(m.state.jogadores[0].fichas, 5);
  // Na mesma linha já há salva-vidas: o jogador 1 só pode vigiar a coluna.
  m = tweak(m, (s) => { s.peca = peca(3); });
  m = ok(jogar(m, 1, 'COLOCAR', { r: 0, c: 2 }));
  assert.equal(jogar(m, 1, 'SALVA_VIDAS', { dir: 'h' }).error.code, 'err.LINHA_VIGIADA');
  assert.deepEqual(praia.enumerate(m.state, 1).map((x) => x.type), ['SALVA_VIDAS', 'SALTAR']);
  m = ok(jogar(m, 1, 'SALTAR'));
  assert.equal(m.state.jogadores[1].fichas, 6);
  // Rocha: não há fase de salva-vidas.
  m = tweak(m, (s) => { s.peca = peca(0, 'rocha'); });
  m = ok(jogar(m, 0, 'COLOCAR', { r: 1, c: 0 }));
  assert.equal(m.state.fase, 'COLOCAR');
  assert.equal(m.state.vez, 1);
});

test('Sem fichas, o jogador continua a colocar peças mas não põe salva-vidas', () => {
  let m = tweak(novo(), (s) => { s.jogadores[0].fichas = 0; s.peca = peca(2); });
  m = ok(jogar(m, 0, 'COLOCAR', { r: 0, c: 1 }));
  assert.equal(m.state.fase, 'COLOCAR');
  assert.equal(m.state.vez, 1);
});

test('Pontuação do salva-vidas: troço da linha, as rochas cortam, as pranchas multiplicam', () => {
  const t = praiaDe(['23R3S2']);
  assert.equal(banhistasVigiados(t, 0, 0, 'h'), 5, 'antes da rocha: 2 + 3');
  assert.equal(banhistasVigiados(t, 0, 3, 'h'), (3 + 1 + 2) * 2, 'depois da rocha, com 1 prancha: ×2');
  assert.equal(banhistasVigiados(praiaDe(['S1S']), 0, 1, 'h'), (1 + 1 + 1) * 4, 'duas pranchas: ×4');
  assert.equal(banhistasVigiados(praiaDe(['1A2']), 0, 0, 'h'), 3, 'a areia vale 0');
});

test('Objetivos: linha/coluna de 5 e 7, quadrados 3×3 e 5×5, 2 pranchas, excursão', () => {
  assert.ok(objetivoFeito('linha5', praiaDe(['11111']), 0, 4));
  assert.ok(!objetivoFeito('linha5', praiaDe(['1111.1']), 0, 5));
  assert.ok(objetivoFeito('coluna5', praiaDe(['1', '1', '1', '1', '1']), 4, 0));
  assert.ok(objetivoFeito('quadrado3', praiaDe(['111', '111', '111']), 2, 2));
  assert.ok(objetivoFeito('pranchas', praiaDe(['SS']), 0, 1));
  assert.ok(objetivoFeito('excursao', praiaDe(['33', '33']), 1, 1));
  assert.ok(!objetivoFeito('excursao', praiaDe(['33', '32']), 1, 1));
});

test('Um objetivo feito é de quem pôs a peça e revela-se outro', () => {
  let m = tweak(novo(), (s) => {
    s.tabuleiro = praiaDe(['1111']);
    s.objetivos = [{ id: 'linha5', pts: 4 }, ...s.objetivos.filter((o) => o.id !== 'linha5').slice(0, 3)];
    s.porRevelar = s.porRevelar.filter((o) => o.id !== 'linha5');
    s.peca = peca(1, 'areia');
  });
  const porRevelar = m.state.porRevelar.length;
  m = ok(jogar(m, 0, 'COLOCAR', { r: 0, c: 4 }));
  assert.deepEqual(m.state.conquistados.map((o) => [o.id, o.jogador]), [['linha5', 0]]);
  assert.equal(m.state.jogadores[0].objPts, 4);
  assert.equal(m.state.objetivos.length, 4);
  assert.equal(m.state.porRevelar.length, porRevelar - 1);
});

test('Fim: quando o baralho tem menos peças do que jogadores; fichas por usar valem +2', () => {
  let m = tweak(novo(3), (s) => { s.baralho = s.baralho.slice(0, 2); s.peca = peca(0, 'areia'); });
  m = ok(jogar(m, 0, 'COLOCAR', { r: 0, c: 1 }));
  m = ok(jogar(m, 0, 'SALTAR'));
  assert.equal(m.state.fase, 'FIM');
  assert.ok(m.result);
  assert.deepEqual(m.result.scores, [10, 10, 10], '5 fichas × 2 cada');
  assert.deepEqual(m.result.winners, [0, 1, 2], 'empate partilha a vitória');
});

test('As posições leem-se a partir da peça inicial: C1 por cima, B1 por baixo, D1 à direita, E1 à esquerda', () => {
  const lbl = (r, c) => { const l = praia.describeMove({ type: 'COLOCAR', payload: { r, c } }); return translate(praia, 'pt', l.key, l.params); };
  assert.equal(lbl(-1, 0), 'Colocar em C1');
  assert.equal(lbl(1, 0), 'Colocar em B1');
  assert.equal(lbl(0, 1), 'Colocar em D1');
  assert.equal(lbl(0, -3), 'Colocar em E3');
  assert.equal(lbl(-1, 2), 'Colocar em C1 D2');
  assert.ok(viewFor(praia, novo(), 0).legal.every((m) => m.label.key.startsWith('moveLabel.COLOCAR_')));
});

test('Simulação: partidas com bots acabam a 2, 3 e 4', () => {
  for (const n of [2, 3, 4]) {
    const r = simulate(praia, { numPlayers: n, games: 40, seed: `t${n}` });
    assert.equal(r.finished, 40);
    assert.deepEqual(r.failures, []);
  }
});
