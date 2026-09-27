// Testes acrescentados depois da publicação (os da Forge estão em forge.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, fireTimer, checkGame } from '@bitnik/engine';
import game from '../index.js';
import { vencedores } from '../rules.js';

test('pacote válido e i18n PT/EN com paridade', () => {
  assert.deepEqual(checkGame(game), []);
});

test('Empate na pontuação máxima: partilham a vitória (não ganha o lugar mais baixo)', () => {
  assert.deepEqual(vencedores([7, 9, 9]), [1, 2]);
  assert.deepEqual(vencedores([5, 3, 1]), [0]);
  // Fim de jogo com empate: o baralho acaba no fim da revelação.
  let m = createMatch(game, { numPlayers: 2, seed: 'empate' });
  m = structuredClone(m);
  const s = m.state;
  s.fase = 'REVELACAO';
  s.baralho = [];
  s.reciclagens = 1;
  s.jogadores[0].apanhadas = [{ id: 901, capivaras: 3, passaro: false, nenufares: [] }];
  s.jogadores[1].apanhadas = [{ id: 902, capivaras: 3, passaro: false, nenufares: [] }];
  s.tokenPassaro = null;
  m.timers = [{ key: 'revelacao', delayMs: 5000, event: 'FIM_REVELACAO', payload: {}, seq: m.seq }];
  const r = fireTimer(game, m, 'revelacao');
  assert.ok(r.ok, JSON.stringify(r.error));
  assert.deepEqual(r.match.result.winners, [0, 1]);
  assert.equal(r.match.log.at(-1).key, 'log.FIM_EMPATE');
});

test('Baralho: as 36 cartas do jogo, com pássaros e nenúfares como na arte', async () => {
  const { criarBaralho } = await import('../rules.js');
  const cartas = criarBaralho();
  assert.equal(cartas.length, 36);
  const tipo = (c) => `${c.capivaras}${[...c.nenufares].sort().join('')}${c.passaro ? '+' : ''}`;
  const conta = {};
  for (const c of cartas) conta[tipo(c)] = (conta[tipo(c)] || 0) + 1;
  assert.deepEqual(conta, {
    1: 2, '1R': 2, '1BW': 1, '1W+': 1,
    2: 6, '2Y': 2, '2B': 1, '2Y+': 1, '2R+': 1, '2+': 2,
    3: 6, '3Y': 1, '3B': 2, '3+': 2,
    4: 2, '4+': 2,
    5: 1, '5+': 1,
  });
  assert.equal(cartas.filter((c) => c.passaro).length, 10);
  const nen = (cor) => cartas.filter((c) => c.nenufares.includes(cor)).length;
  assert.deepEqual([nen('Y'), nen('R'), nen('B'), nen('W')], [4, 3, 4, 2]);
});

test('UI: cada carta do baralho tem a sua imagem', async () => {
  const { existsSync } = await import('node:fs');
  const { criarBaralho } = await import('../rules.js');
  for (const c of criarBaralho()) {
    const nome = `cap${c.capivaras}${c.nenufares.length ? '_' + [...c.nenufares].sort().join('') : ''}${c.passaro ? '_bird' : ''}`;
    assert.ok(existsSync(new URL(`../ui/cartas/${nome}.webp`, import.meta.url)), nome);
  }
});
