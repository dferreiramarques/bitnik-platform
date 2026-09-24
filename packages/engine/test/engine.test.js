import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMatch, applyMove, fireTimer, replay, viewFor, checkGame, translate, simulate, botMove,
} from '../src/index.js';
import race from './fixtures/race.js';

test('a mesma seed dá o mesmo jogo', () => {
  const play = () => {
    let m = createMatch(race, { numPlayers: 2, seed: 'abc' });
    for (let i = 0; i < 6 && !m.result; i++) m = applyMove(race, m, m.state.cur, { type: 'ROLL' }).match;
    return m.state;
  };
  assert.deepEqual(play(), play());
});

test('jogada inválida não altera nada', () => {
  const m = createMatch(race, { numPlayers: 2, seed: 1 });
  const r = applyMove(race, m, 0, { type: 'ROLL', payload: { cheat: true } });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'err.NOPE');
  assert.equal(m.seq, 0);
});

test('exceção nas regras: RULE_ERROR e o match fica intacto', () => {
  const m = createMatch(race, { numPlayers: 2, seed: 1 });
  const before = structuredClone(m);
  const r = applyMove(race, m, 0, { type: 'BOOM' });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'engine.RULE_ERROR');
  assert.equal(r.error.params.message, 'bug de teste');
  assert.deepEqual(m, before, 'a mutação feita antes da exceção não passou para o match');
});

test('jogada sobre um estado antigo: STALE_MOVE', () => {
  let m = createMatch(race, { numPlayers: 2, seed: 1 });
  m = applyMove(race, m, 0, { type: 'ROLL' }, { expectSeq: 0 }).match;
  assert.equal(m.seq, 1);
  const r = applyMove(race, m, 1, { type: 'ROLL' }, { expectSeq: 0 });
  assert.equal(r.error.code, 'engine.STALE_MOVE');
  assert.deepEqual(r.error.params, { seq: 0, current: 1 });
  assert.ok(applyMove(race, m, 1, { type: 'ROLL' }, { expectSeq: 1 }).ok);
});

test('só joga quem está ativo', () => {
  const m = createMatch(race, { numPlayers: 2, seed: 1 });
  assert.equal(applyMove(race, m, 1, { type: 'ROLL' }).error.code, 'engine.NOT_ACTIVE');
  assert.equal(applyMove(race, m, 0, { type: 'FLY' }).error.code, 'engine.UNKNOWN_MOVE');
});

test('timers são declarativos e ficam no registo', () => {
  let m = createMatch(race, { numPlayers: 2, seed: 1 });
  assert.equal(m.timers.length, 1);
  m = fireTimer(race, m, 'turn').match;
  assert.equal(m.state.timeouts, 1);
  assert.equal(m.state.cur, 1);
  assert.equal(m.moves.at(-1).type, '@TIMEOUT');
  assert.equal(m.timers.length, 1, 'o evento reagendou o timer');
});

test('replay reproduz o estado, incluindo timers', () => {
  let m = createMatch(race, { numPlayers: 3, seed: 'replay' });
  m = applyMove(race, m, 0, { type: 'ROLL' }).match;
  m = fireTimer(race, m, 'turn').match;
  m = applyMove(race, m, 2, { type: 'ROLL' }).match;
  const r = replay(race, m);
  assert.deepEqual(r.state, m.state);
  assert.equal(r.rng, m.rng);
});

test('o match sobrevive a JSON (persistência)', () => {
  let m = createMatch(race, { numPlayers: 2, seed: 7 });
  m = applyMove(race, m, 0, { type: 'ROLL' }).match;
  const back = JSON.parse(JSON.stringify(m));
  const a = applyMove(race, m, 1, { type: 'ROLL' }).match;
  const b = applyMove(race, back, 1, { type: 'ROLL' }).match;
  assert.deepEqual(a.state, b.state);
});

test('jogo terminado limpa timers e recusa jogadas', () => {
  let m = createMatch(race, { numPlayers: 2, seed: 3 });
  while (!m.result) m = applyMove(race, m, m.state.cur, { type: 'ROLL' }).match;
  assert.equal(m.timers.length, 0);
  assert.equal(applyMove(race, m, 0, { type: 'ROLL' }).error.code, 'engine.GAME_OVER');
});

test('viewFor dá jogadas legais só a quem está ativo', () => {
  const m = createMatch(race, { numPlayers: 2, seed: 1 });
  assert.equal(viewFor(race, m, 0).legal.length, 1);
  assert.equal(viewFor(race, m, 1).legal.length, 0);
});

test('bots são determinísticos', () => {
  const m = createMatch(race, { numPlayers: 2, seed: 1 });
  assert.deepEqual(botMove(race, m, 0), botMove(race, m, 0));
});

test('checkGame apanha pacotes incompletos e i18n sem paridade', () => {
  assert.ok(checkGame({ id: 'x' }).length > 0);
  const bad = { ...race, i18n: { pt: { a: '1', b: '2' }, en: { a: '1' } } };
  assert.deepEqual(checkGame(bad), ['i18n sem chave en:b']);
});

test('translate: jogo, motor e parâmetros traduzíveis', () => {
  assert.equal(translate(race, 'en', 'log.ROLL', { n: 4 }), 'Rolled 4');
  assert.equal(translate(race, 'en', 'engine.NOT_ACTIVE'), 'It is not your turn.');
  assert.equal(translate(race, 'pt', 'log.ROLL', { n: '@game.name' }), 'Saiu Corrida');
  assert.equal(translate(race, 'fr', 'move.ROLL'), 'Lançar', 'língua em falta usa a por omissão');
});

test('simulate joga partidas completas', () => {
  const r = simulate(race, { numPlayers: 3, games: 50 });
  assert.equal(r.failures.length, 0);
  assert.equal(r.finished, 50);
});
