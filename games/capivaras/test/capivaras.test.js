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
