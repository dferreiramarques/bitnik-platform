import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMatch, applyMove, fireTimer, replay, viewFor, checkGame, translate, simulate, botMove, defineGame, checkPurity,
  compatibleVersions, matchIncompatibility, ENGINE_VERSION, describeMove,
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

test('simulate dispara o timer que vence primeiro, não o primeiro da lista', () => {
  const two = defineGame({
    id: 'dois-timers', version: '0.0.1', players: { min: 2, max: 2 },
    i18n: { pt: { 'game.name': 'Dois' }, en: { 'game.name': 'Two' } },
    setup(ctx) {
      ctx.schedule('lento', 5000, 'LENTO');
      ctx.schedule('rapido', 1000, 'RAPIDO');
      return { ordem: [] };
    },
    moves: {},
    events: {
      LENTO: (s) => { s.ordem.push('lento'); },
      RAPIDO: (s, p, ctx) => { s.ordem.push('rapido'); if (s.ordem.length < 3) ctx.schedule('rapido', 1000, 'RAPIDO'); },
    },
    activePlayers: () => [],
    view: (s) => s,
    result: (s) => (s.ordem.includes('lento') ? { scores: [0, 0], winners: [0] } : null),
  });
  let ordem;
  const r = simulate(two, { numPlayers: 2, games: 1, onMatch: (m) => { ordem = m.state.ordem; } });
  assert.deepEqual(r.failures, []);
  // rápido aos 1 s, 2 s e 3 s (reagendado), lento aos 5 s.
  assert.deepEqual(ordem, ['rapido', 'rapido', 'rapido', 'lento']);
});

test('simulate com idleRate exercita os eventos de timeout', () => {
  const quietos = simulate(race, { numPlayers: 2, games: 20, seed: 'idle' });
  assert.equal(quietos.timersFired, 0);
  const idle = simulate(race, { numPlayers: 2, games: 20, seed: 'idle', idleRate: 0.4 });
  assert.deepEqual(idle.failures, []);
  assert.ok(idle.timersFired > 0);
  assert.deepEqual(simulate(race, { numPlayers: 2, games: 20, seed: 'idle', idleRate: 0.4 }), idle, 'determinístico');
});

test('bots veem o view do lugar, não o estado escondido', () => {
  const secreto = defineGame({
    ...race,
    id: 'secreto',
    view: (s, seat) => ({ cur: s.cur, mine: s.pos[seat] }),
    bots: { default: (v) => ({ type: 'ROLL', payload: { viu: Object.keys(v).sort() } }) },
  });
  const m = createMatch(secreto, { numPlayers: 2, seed: 1 });
  assert.deepEqual(botMove(secreto, m, 0).payload.viu, ['cur', 'mine']);
});

test('checkPurity apanha relógio, Math.random, timers e imports de fora, e ignora comentários', () => {
  const src = [
    "import { defineGame } from '@bitnik/engine';",
    "import { x } from './board.js';",
    "import fs from 'node:fs';",
    '// Math.random() num comentário não conta',
    '/* nem setTimeout(() => {}) aqui */',
    'const a = Math.random();',
    'setTimeout(() => {}, 10);',
    'const t = Date.now();',
  ].join('\n');
  assert.deepEqual(checkPurity(src, 'rules.js'), [
    'rules.js:3: importa node:fs',
    'rules.js:6: Math.random (usa ctx.rng)',
    'rules.js:7: timer do sistema (usa ctx.schedule)',
    'rules.js:8: Date.now (as regras não sabem a hora)',
  ]);
});

test('compatibilidade de versões segue semver à letra, incluindo 0.x', () => {
  const casos = [
    ['1.0.0', '1.4.2', true], ['1.9.0', '2.0.0', false], ['3.0.0', '3.0.1', true],
    ['0.1.0', '0.1.5', true], ['0.1.0', '0.2.0', false],
    ['0.0.3', '0.0.3', true], ['0.0.3', '0.0.4', false],
  ];
  for (const [a, b, ok] of casos) assert.equal(compatibleVersions(a, b), ok, `${a} ↔ ${b}`);
});

test('um match de outro major do jogo ou do motor não é retomado', () => {
  const m = createMatch(race, { numPlayers: 2, seed: 1 });
  assert.equal(matchIncompatibility(race, m), null);
  assert.deepEqual(matchIncompatibility({ ...race, version: '0.0.2' }, m), { reason: 'game', from: '0.0.1', to: '0.0.2' });
  assert.deepEqual(matchIncompatibility(race, { ...m, engineVersion: '0.1.0' }),
    { reason: 'engine', from: '0.1.0', to: ENGINE_VERSION });
});

test('replay avisa quando a versão do jogo não é a da partida', () => {
  let m = createMatch(race, { numPlayers: 2, seed: 1 });
  m = applyMove(race, m, 0, { type: 'ROLL' }).match;
  const avisos = [];
  replay(race, m, { onWarn: (w) => avisos.push(w) });
  assert.deepEqual(avisos, []);
  replay({ ...race, version: '0.0.9' }, m, { onWarn: (w) => avisos.push(w) });
  assert.equal(avisos.length, 1);
});

test('describeMove: pacote, depois convenção moveLabel com o payload, depois move.TIPO; nunca lança', () => {
  const base = { ...race, i18n: { pt: { 'moveLabel.PLACE': 'Colocar em ({r},{c})' }, en: { 'moveLabel.PLACE': 'Place at ({r},{c})' } } };
  const place = { type: 'PLACE', payload: { r: 3, c: 4 } };
  assert.deepEqual(describeMove(base, place, {}), { key: 'moveLabel.PLACE', params: { r: 3, c: 4 } });
  assert.deepEqual(describeMove(base, { type: 'ROLL' }, {}), { key: 'move.ROLL', params: {} });
  const own = { ...base, describeMove: (mv) => ({ key: 'x.CUSTOM', params: { n: mv.payload.r } }) };
  assert.deepEqual(describeMove(own, place, {}), { key: 'x.CUSTOM', params: { n: 3 } });
  const buggy = { ...base, describeMove: (mv, view) => ({ key: view.hexes[mv.payload.r].type }) };
  assert.deepEqual(describeMove(buggy, place, {}), { key: 'moveLabel.PLACE', params: { r: 3, c: 4 } }, 'um bug cai no rótulo por convenção');
});

test('viewFor devolve as jogadas legais já rotuladas', () => {
  const m = createMatch(race, { numPlayers: 2, seed: 1 });
  assert.deepEqual(viewFor(race, m, 0).legal, [{ type: 'ROLL', label: { key: 'move.ROLL', params: {} } }]);
});

