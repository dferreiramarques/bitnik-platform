// Testes das regras do Catania, escritos a partir de REGRAS.md.
// Cada test corresponde a uma regra (futuro: gerados dos cartões do Forge).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createMatch, applyMove, simulate, checkGame, checkPurity, botMove, viewFor } from '@bitnik/engine';
import catania from '../index.js';

const newMatch = (n = 2, seed = 'catania') => createMatch(catania, { numPlayers: n, seed });
const move = (m, seat, type, payload = {}) => applyMove(catania, m, seat, { type, payload });
const ok = (r) => { assert.ok(r.ok, r.error?.code); return r.match; };
const hexOf = (m, type) => m.state.hexes.find((h) => h.type === type && m.state.fire !== h.id);
/** Mexe diretamente no estado para montar um cenário (só em testes). */
const tweak = (m, fn) => { const c = structuredClone(m); fn(c.state); return c; };

test('pacote válido e i18n com paridade PT/EN', () => {
  assert.deepEqual(checkGame(catania), []);
});

test('Componentes: 8/9/10 territórios para 2/3/4 jogadores, pelo menos 1 de cada recurso', () => {
  for (const [n, count] of [[2, 8], [3, 9], [4, 10]]) {
    const m = newMatch(n, `c${n}`);
    const res = m.state.hexes.filter((h) => h.type !== 'vulcao');
    assert.equal(res.length, count);
    assert.equal(new Set(res.map((h) => h.type)).size, 5);
  }
});

test('Preparação: os 5 discos de cima (12, 11, 11, 10, 10) vão para as pilhas; fogo no vulcão', () => {
  const m = newMatch();
  const tops = Object.values(m.state.piles).map((p) => p.discs[0]).sort((a, b) => b - a);
  assert.deepEqual(tops, [12, 11, 11, 10, 10]);
  assert.equal(m.state.tower.length, 13);
  assert.equal(m.state.hexes[m.state.fire].type, 'vulcao');
});

test('Recolher: não no fogo, não ocupado, não 2x no mesmo território, máximo 2', () => {
  let m = newMatch(2);
  const [a, b, c] = m.state.hexes.filter((h) => h.type !== 'vulcao');
  m = ok(move(m, 0, 'COLLECT', { hex: a.id }));
  assert.equal(move(m, 0, 'COLLECT', { hex: a.id }).error.code, 'err.SAME_HEX');
  m = ok(move(m, 0, 'COLLECT', { hex: b.id }));
  assert.equal(move(m, 0, 'COLLECT', { hex: c.id }).error.code, 'err.TWO_COLLECTS');
  m = ok(move(m, 0, 'END_TURN'));
  assert.equal(move(m, 1, 'COLLECT', { hex: a.id }).error.code, 'err.OCCUPIED');
  assert.equal(move(m, 1, 'COLLECT', { hex: 0 }).error.code, 'err.BAD_HEX');
  const burning = tweak(m, (s) => { s.fire = c.id; });
  assert.equal(move(burning, 1, 'COLLECT', { hex: c.id }).error.code, 'err.FIRE_BLOCKS');
});

test('Os trabalhadores voltam no início do turno do dono', () => {
  let m = newMatch(2);
  const h = m.state.hexes[1];
  m = ok(move(m, 0, 'COLLECT', { hex: h.id }));
  m = ok(move(m, 0, 'END_TURN'));
  m = ok(move(m, 1, 'END_TURN'));
  assert.ok(!m.state.hexes[h.id].workers.includes(0));
  m = ok(move(m, 0, 'COLLECT', { hex: h.id }));
});

test('Recolher 2 cartas nunca sobe o valor da pilha', () => {
  let m = tweak(newMatch(), (s) => { s.tower = [2, 4, 12]; });
  const h = hexOf(m, 'vinho');
  const before = m.state.piles.vinho.discs.at(-1);
  m = ok(move(m, 0, 'COLLECT', { hex: h.id, take2: true }));
  assert.equal(m.state.piles.vinho.discs.at(-1), before, 'o 12 vai para baixo');
  assert.equal(m.state.players[0].hand.vinho, 2);
});

test('Torre vazia: não se pode recolher 2', () => {
  const m = tweak(newMatch(), (s) => { s.tower = []; });
  assert.equal(move(m, 0, 'COLLECT', { hex: hexOf(m, 'peixe').id, take2: true }).error.code, 'err.TOWER_EMPTY');
});

test('Disco vermelho: erupção; o fogo tem de se mover antes de continuar', () => {
  let m = tweak(newMatch(), (s) => { s.tower.push(9); });
  const h = hexOf(m, 'azeite');
  m = ok(move(m, 0, 'COLLECT', { hex: h.id, take2: true }));
  assert.ok(m.state.players[0].turn.firePending);
  assert.equal(move(m, 0, 'END_TURN').error.code, 'err.FIRE_FIRST');
  // Regressão do catania-v2: "ficar" era aceite mesmo havendo vizinhos vazios.
  assert.equal(move(m, 0, 'MOVE_FIRE', { stay: true }).error.code, 'err.FIRE_MUST_MOVE');
  const target = m.state.hexes[m.state.fire].adj.find((id) => m.state.hexes[id].workers.length === 0);
  m = ok(move(m, 0, 'MOVE_FIRE', { hex: target }));
  assert.equal(m.state.fire, target);
});

test('O fogo só vai para vizinhos vazios; se não houver, fica', () => {
  let m = tweak(newMatch(), (s) => {
    s.players[0].turn.firePending = true;
    for (const id of s.hexes[s.fire].adj) s.hexes[id].workers = [1];
  });
  const adj = m.state.hexes[m.state.fire].adj[0];
  assert.equal(move(m, 0, 'MOVE_FIRE', { hex: adj }).error.code, 'err.FIRE_NOT_EMPTY');
  m = ok(move(m, 0, 'MOVE_FIRE', { stay: true }));
  assert.equal(m.state.hexes[m.state.fire].type, 'vulcao');
});

const withHand = (hand) => tweak(newMatch(), (s) => { Object.assign(s.players[0].hand, hand); });

test('Fundar: 5+ cartas e 2+ tipos; a aldeia fica com a maioria', () => {
  assert.equal(move(withHand({ vinho: 4 }), 0, 'FOUND', { keep: 'vinho', raise: 'peixe' }).error.code, 'err.NEED_5');
  assert.equal(move(withHand({ vinho: 5 }), 0, 'FOUND', { keep: 'vinho', raise: 'peixe' }).error.code, 'err.NEED_2_TYPES');
  const m = withHand({ vinho: 3, peixe: 2 });
  assert.equal(move(m, 0, 'FOUND', { keep: 'peixe', raise: 'vinho' }).error.code, 'err.KEEP_MAJORITY');
  assert.equal(move(m, 0, 'FOUND', { keep: 'vinho', raise: 'azeite' }).error.code, 'err.RAISE_MINORITY');
});

test('Fundar (exemplo das regras): empate 3 Calcário / 3 Azeite + 1 Cereais', () => {
  let m = tweak(withHand({ calcario: 3, azeite: 3, cereais: 1 }), (s) => { s.piles.cereais.discs = [10, 8]; });
  m = ok(move(m, 0, 'FOUND', { keep: 'azeite', raise: 'cereais' }));
  const p = m.state.players[0];
  assert.deepEqual(p.villages, [{ res: 'azeite', cards: 3 }]);
  assert.equal(Object.values(p.hand).reduce((a, b) => a + b), 0, 'usa a mão toda');
  assert.equal(m.state.piles.cereais.discs.at(-1), 10, 'o 8 voltou à torre');
  assert.deepEqual(m.state.tower, [...m.state.tower].sort((a, b) => a - b), 'a torre fica ordenada');
  assert.equal(move(m, 0, 'COLLECT', { hex: hexOf(m, 'vinho').id }).error.code, 'err.FOUNDED_LAST');
});

test('Valorizar uma pilha só com o disco-base não muda nada', () => {
  let m = withHand({ vinho: 4, peixe: 1 });
  const before = [...m.state.piles.peixe.discs];
  m = ok(move(m, 0, 'FOUND', { keep: 'vinho', raise: 'peixe' }));
  assert.deepEqual(m.state.piles.peixe.discs, before);
});

/** Monta um jogo em que o lugar `seat` está prestes a fundar a 3.ª aldeia. */
const aboutToTrigger = (n, seat) => tweak(newMatch(n), (s) => {
  s.cur = seat;
  s.players[seat].villages = [{ res: 'vinho', cards: 2 }, { res: 'peixe', cards: 2 }];
  Object.assign(s.players[seat].hand, { vinho: 4, peixe: 1 });
});

test('3.ª aldeia: termina a ronda em curso (ronda completa, 3.0.0)', () => {
  let m = aboutToTrigger(4, 1);
  m = ok(move(m, 1, 'FOUND', { keep: 'vinho', raise: 'peixe' }));
  assert.equal(m.state.phase, 'LAST_ROUND');
  m = ok(move(m, 1, 'END_TURN'));
  m = ok(move(m, 2, 'END_TURN'));
  assert.equal(m.result, null, 'o Lugar 4 ainda joga');
  m = ok(move(m, 3, 'END_TURN'));
  assert.ok(m.result, 'acaba no último lugar; o Lugar 1 não volta a jogar');
});

test('3.ª aldeia no 1.º lugar: todos os outros jogam uma vez', () => {
  let m = aboutToTrigger(3, 0);
  m = ok(move(m, 0, 'FOUND', { keep: 'vinho', raise: 'peixe' }));
  m = ok(move(m, 0, 'END_TURN'));
  m = ok(move(m, 1, 'END_TURN'));
  assert.equal(m.result, null);
  m = ok(move(m, 2, 'END_TURN'));
  assert.ok(m.result);
});

test('3.ª aldeia no último lugar: o jogo acaba no fim desse turno', () => {
  let m = aboutToTrigger(3, 2);
  m = ok(move(m, 2, 'FOUND', { keep: 'vinho', raise: 'peixe' }));
  m = ok(move(m, 2, 'END_TURN'));
  assert.ok(m.result);
});

test('Todos os jogadores fazem o mesmo número de turnos', () => {
  for (const n of [2, 3, 4]) {
    simulate(catania, {
      numPlayers: n, games: 50, seed: `turnos${n}`,
      onMatch(m) {
        const turns = Array(n).fill(0);
        for (const mv of m.moves) if (mv.type === 'END_TURN') turns[mv.seat]++;
        assert.equal(new Set(turns).size, 1, `n=${n}: ${turns}`);
      },
    });
  }
});

test('Pontuação (exemplo das regras): 48 + 18 + 32 = 98', () => {
  const m = tweak(newMatch(), (s) => {
    s.piles.vinho.discs = [12]; s.piles.peixe.discs = [10, 6]; s.piles.azeite.discs = [8];
    s.players[0].villages = [{ res: 'vinho', cards: 4 }, { res: 'peixe', cards: 3 }, { res: 'azeite', cards: 4 }];
    s.phase = 'OVER';
  });
  assert.equal(catania.result(m.state).scores[0], 98);
});

test('Desempate: mais cartas na mão; se persistir, partilham a vitória', () => {
  const base = (handB) => tweak(newMatch(), (s) => {
    s.piles.vinho.discs = [10];
    s.players[0].villages = [{ res: 'vinho', cards: 3 }];
    s.players[1].villages = [{ res: 'vinho', cards: 3 }];
    s.players[0].hand.peixe = 2;
    s.players[1].hand.peixe = handB;
    s.phase = 'OVER';
  });
  assert.deepEqual(catania.result(base(1).state).winners, [0]);
  assert.deepEqual(catania.result(base(2).state).winners, [0, 1]);
});

test('Simulação: 300 partidas com bots, 2 a 4 jogadores, sem erros', () => {
  for (const n of [2, 3, 4]) {
    const r = simulate(catania, { numPlayers: n, games: 100, seed: `sim${n}` });
    assert.deepEqual(r.failures, [], `n=${n}`);
    assert.equal(r.finished, 100);
  }
});

test('Todas as jogadas enumeradas são aceites pelas regras', () => {
  simulate(catania, {
    numPlayers: 3, games: 20, seed: 'enum',
    onMatch() {},
  });
  let m = newMatch(3, 'enum2');
  for (let i = 0; i < 60 && !m.result; i++) {
    const seat = m.state.cur;
    const legal = catania.enumerate(m.state, seat);
    for (const mv of legal) assert.ok(applyMove(catania, m, seat, mv).ok, JSON.stringify(mv));
    m = applyMove(catania, m, seat, legal[i % legal.length]).match;
  }
});

test('Todas as chaves err./log. usadas nas regras existem em PT e EN', () => {
  const src = readFileSync(new URL('../rules.js', import.meta.url), 'utf8');
  const keys = new Set(src.match(/'(err|log)\.[A-Z0-9_]+'/g).map((k) => k.slice(1, -1)));
  for (const lang of ['pt', 'en']) for (const k of keys) assert.ok(k in catania.i18n[lang], `${lang}:${k}`);
});

test('O pacote é puro: só importa @bitnik/engine e ficheiros próprios, sem relógio nem Math.random', () => {
  const dir = new URL('../', import.meta.url);
  const files = ['index.js', 'rules.js', 'board.js', 'bot.js', ...readdirSync(new URL('i18n/', dir)).map((f) => `i18n/${f}`)];
  const problems = files.flatMap((f) => checkPurity(readFileSync(new URL(f, dir), 'utf8'), f));
  assert.deepEqual(problems, []);
});

test('O bot joga sobre o view do seu lugar, não sobre o estado completo', () => {
  const m = newMatch(2, 'bot-view');
  let seen;
  const spy = { ...catania, bots: { default: (v, seat, ctx) => { seen = { v, ctx }; return catania.bots.default(v, seat, ctx); } } };
  const mv = botMove(spy, m, 0);
  assert.deepEqual(seen.v, catania.view(m.state, 0));
  assert.ok(seen.ctx.legal.some((x) => x.type === mv.type), 'recebe as jogadas legais');
  assert.ok(applyMove(catania, m, 0, mv).ok);
});

test('Rótulos: cada jogada legal tem uma frase com recurso e território', () => {
  const m = newMatch(2, 'rotulos');
  const { legal } = viewFor(catania, m, 0);
  const collect = legal.find((x) => x.type === 'COLLECT' && x.payload.take2);
  assert.equal(collect.label.key, 'moveLabel.COLLECT');
  assert.equal(collect.label.params.n, 2);
  assert.match(collect.label.params.res, /^@res\./);
  assert.ok(legal.every((x) => x.label.key in catania.i18n.pt));
});


test('A UI (ui/) só importa ficheiros próprios ou o SDK de cliente, nunca o servidor', () => {
  const dir = new URL('../ui/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const [, spec] of src.matchAll(/from\s+'([^']+)'/g)) {
      assert.ok(spec.startsWith('./') || spec === '@bitnik/client' || spec === '@bitnik/engine', `ui/${f} importa ${spec}`);
    }
  }
});

test('skin.json: todos os tokens --cat-* usados no CSS e na UI têm valor por omissão', () => {
  const skin = JSON.parse(readFileSync(new URL('../ui/skin.json', import.meta.url), 'utf8'));
  const used = new Set();
  for (const f of ['catania.css', 'index.js']) {
    for (const [tok] of readFileSync(new URL(`../ui/${f}`, import.meta.url), 'utf8').matchAll(/--cat-[a-z0-9-]+/g)) used.add(tok);
  }
  used.delete('--cat-gap'); // variável interna de layout, não é skin
  used.delete('--cat-p'); // prefixo de seatColor (--cat-p1..4)
  used.delete('--cat-res-'); // prefixo de --cat-res-<recurso>
  for (const tok of used) assert.ok(tok in skin.tokens, `falta ${tok} no skin.json`);
  assert.ok(skin.tokens['--table-bg']?.value, 'toda a skin define --table-bg, o aspeto da mesa');
});
