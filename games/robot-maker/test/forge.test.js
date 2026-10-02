// Gerado pela Forge a partir dos testes aprovados (não editar à mão).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, applyMove, fireTimer, simulate, viewFor, legalMoves } from '@bitnik/engine';
import game from '../index.js';
// Testes aprovados na Forge: são as regras. Um teste por cartão e por partida narrada.
const tweak = (m, fn) => { const c = structuredClone(m); fn(c.state); return c; };

// Funções auxiliares dos testes
const novo = (n = 2, seed = 'rm') => createMatch(game, { numPlayers: n, seed });
const R = (o = {}) => ({ head: 0, chest: 0, arm: 0, port: 0, legs: 0, ...o });
const com = (m, lugar, p) => tweak(m, (s) => Object.assign(s.jogadores[lugar], p));
const vez = (m) => m.state.ordem[m.state.vez];
const jog = (m, lugar) => m.state.jogadores[lugar];
const jogar = (m, lugar, type, payload = {}) => {
  const r = applyMove(game, m, lugar, { type, payload });
  assert.ok(r.ok, type + ' recusada: ' + JSON.stringify(r.error));
  return r.match;
};
const recusa = (m, lugar, type, payload, codigo) => {
  const r = applyMove(game, m, lugar, { type, payload });
  assert.equal(r.ok, false, type + ' devia ser recusada');
  assert.equal(r.error.code, codigo);
};
// Põe o lugar na fase do mercado (já sem workers livres), para testar compras.
const mercado = (m, lugar = 0) => tweak(m, (s) => { s.vez = s.ordem.indexOf(lugar); s.fase = 'mercado'; s.jogadores[lugar].livres = 0; });
const fixo = (m) => tweak(m, (s) => {
  s.mercado.fila = { 1: ['head', 'chest', 'arm', 'port'], 2: ['head', 'chest', 'arm', 'port'], 3: ['head', 'chest', 'arm', 'port'] };
  s.mercado.baralho = { 1: ['legs'], 2: ['legs'], 3: ['legs'] };
});
const todas = (m) => tweak(m, (s) => {
  for (const l of [1, 2, 3]) { s.mercado.fila[l] = ['head', 'chest', 'arm', 'port', 'legs']; s.mercado.baralho[l] = []; }
});
const fecharRonda = (m) => {
  const r = m.state.rodada; let n = 0;
  while (!m.result && m.state.rodada === r && n++ < 100) m = jogar(m, vez(m), 'PASSAR');
  return m;
};
const acabar = (m) => { let n = 0; while (!m.result && n++ < 400) m = jogar(m, vez(m), 'PASSAR'); return m; };
// Fim de jogo na ronda extra (o lugar 1 fez o gatilho e não joga): só o lugar 0 passa.
const final = (m, ajustes) => acabar(tweak(m, (s) => { s.fim = { gatilho: 1, rondaExtra: true }; ajustes(s); }));
// Fim de jogo pelo limite de rondas: ambos jogam (passam).
const porLimite = (m, ajustes) => acabar(tweak(m, (s) => { s.rodada = 30; ajustes(s); }));
const PECAS = {
  head: [[2, 0, 3], [1, 1, 8], [1, 1, 15]], chest: [[2, 0, 4], [0, 1, 8], [1, 1, 12]], arm: [[2, 0, 3], [0, 1, 8], [1, 1, 12]],
  port: [[2, 0, 4], [0, 1, 8], [1, 1, 12]], legs: [[2, 0, 3], [1, 1, 8], [1, 1, 12]],
};
const CPUS = [[2, 0, 5], [1, 1, 9], [1, 1, 14]];
const FAMILIAS = ['bio', 'combat', 'agility', 'shield'];

// cartão c-setup: Preparação
test('Preparação', () => {
  for (const n of [2, 3, 4]) {
    const m = novo(n);
    const s = m.state;
    assert.equal(s.jogadores.length, n);
    for (const j of s.jogadores) {
      assert.deepEqual([j.l1, j.l2, j.workers, j.livres, j.deploy], [0, 0, 1, 1, 0]);
      assert.deepEqual(j.robot, R());
      assert.equal(j.cpu.nivel, 0);
      assert.equal(j.circuito, null);
    }
    assert.deepEqual(s.ordem, [...Array(n).keys()]);
    assert.equal(s.rodada, 1);
    assert.deepEqual(s.esgotados, []);
    for (const l of [1, 2, 3]) assert.equal(s.mercado.fila[l].length, 4);
    assert.deepEqual(game.activePlayers(s), [0]);
    assert.equal(s.fase, 'trabalho');
    assert.equal(m.result, null);
  }
});

// cartão c-ordem: Ordem de turno roda uma posição por ronda
test('Ordem de turno roda uma posição por ronda', () => {
  let m = fixo(novo(3));
  m = jogar(m, 0, 'FORJA', { peca: 'arm' });
  m = jogar(m, 1, 'DEPLOY');
  m = jogar(jogar(m, 2, 'COMPILADOR'), 2, 'PASSAR');
  assert.equal(m.state.rodada, 2);
  assert.deepEqual(m.state.ordem, [1, 2, 0]);
  assert.deepEqual(game.activePlayers(m.state), [1]);
  m = fecharRonda(m);
  assert.deepEqual(m.state.ordem, [2, 0, 1]);
});

// cartão c-turno: O turno tem duas fases: workers e depois mercado
test('O turno tem duas fases: workers e depois mercado', () => {
  let m = com(novo(), 0, { workers: 2, livres: 2 });
  recusa(m, 1, 'COMPILADOR', {}, 'engine.NOT_ACTIVE');
  m = jogar(m, 0, 'COMPILADOR');
  assert.deepEqual(game.activePlayers(m.state), [0]);
  assert.equal(jog(m, 0).livres, 1);
  assert.equal(m.state.fase, 'trabalho');
  m = jogar(m, 0, 'COMPILADOR');
  assert.equal(jog(m, 0).l1, 6);
  // Sem workers livres passa-se ao mercado, ainda no mesmo turno.
  assert.equal(m.state.fase, 'mercado');
  assert.deepEqual(game.activePlayers(m.state), [0]);
  recusa(m, 0, 'COMPILADOR', {}, 'err.FASE');
  m = jogar(m, 0, 'PASSAR');
  assert.deepEqual(game.activePlayers(m.state), [1]);
  // Comprar antes dos workers é recusado; com 1 worker: worker → mercado → compra, no mesmo turno.
  const t = fixo(com(novo(), 0, { l1: 2 }));
  recusa(t, 0, 'COMPRAR', { peca: 'head1' }, 'err.FASE');
  let u = jogar(t, 0, 'COMPILADOR');
  assert.equal(jog(u, 0).livres, 0);
  u = jogar(u, 0, 'COMPRAR', { peca: 'head1' });
  assert.equal(jog(u, 0).robot.head, 1);
  assert.equal(jog(u, 0).l1, 3);
  assert.deepEqual(game.activePlayers(u.state), [1]);
  // Ir ao mercado sem gastar todos os workers.
  let w = fixo(com(novo(), 0, { workers: 2, livres: 2, l1: 2 }));
  w = jogar(w, 0, 'IR_AO_MERCADO');
  assert.equal(w.state.fase, 'mercado');
  assert.equal(jog(w, 0).livres, 0);
  w = jogar(w, 0, 'COMPRAR', { peca: 'chest1' });
  assert.deepEqual(game.activePlayers(w.state), [1]);
});

// cartão c-passar: Passar gasta os workers que restam
test('Passar gasta os workers que restam', () => {
  let m = com(novo(), 0, { workers: 2, livres: 2 });
  m = jogar(m, 0, 'PASSAR');
  assert.equal(jog(m, 0).livres, 0);
  assert.deepEqual(game.activePlayers(m.state), [1]);
  assert.equal(m.state.rodada, 1);
  m = jogar(m, 1, 'PASSAR');
  assert.equal(m.state.rodada, 2);
});

// cartão c-workers-voltam: No fim da ronda os workers regressam
test('No fim da ronda os workers regressam', () => {
  let m = fixo(com(novo(), 0, { workers: 2, livres: 2 }));
  m = jogar(m, 0, 'FORJA', { peca: 'head' });
  m = jogar(m, 0, 'DEPLOY');
  assert.deepEqual([m.state.tabuleiro.forja, m.state.tabuleiro.deploy], [0, 0]);
  m = jogar(m, 1, 'PASSAR');
  assert.equal(m.state.rodada, 2);
  assert.deepEqual([m.state.tabuleiro.forja, m.state.tabuleiro.deploy], [null, null]);
  assert.equal(jog(m, 0).livres, 2);
  assert.equal(jog(m, 1).livres, 1);
  assert.deepEqual(m.state.ordem, [1, 0]);
});

// cartão c-workers-max: Máximo de 3 workers e 1 circuito por jogador
test('Máximo de 3 workers e 1 circuito por jogador', () => {
  // Já tem um circuito: Mobilidade (tronco+braço+pernas) completa-se mas não dá worker.
  let a = todas(com(novo(), 0, { workers: 2, livres: 1, circuito: 'central', l1: 2, robot: R({ chest: 1, arm: 1 }) }));
  a = tweak(a, (s) => { s.esgotados = ['central']; });
  a = jogar(mercado(a), 0, 'COMPRAR', { peca: 'legs1' });
  assert.equal(jog(a, 0).workers, 2);
  assert.equal(jog(a, 0).circuito, 'central');
  assert.ok(!a.state.esgotados.includes('mobilidade'));
  // Já tem 3 workers (sem circuito): Armas (braço+interface+tronco) completa-se e continua disponível.
  let b = todas(com(novo(), 0, { workers: 3, livres: 1, l1: 2, robot: R({ arm: 1, port: 1 }) }));
  b = jogar(mercado(b), 0, 'COMPRAR', { peca: 'chest1' });
  assert.equal(jog(b, 0).workers, 3);
  assert.equal(jog(b, 0).circuito, null);
  assert.deepEqual(b.state.esgotados, []);
});

// cartão c-compilador: Compilador dá 3 L1 por worker
test('Compilador dá 3 L1 por worker', () => {
  let m = com(novo(), 0, { workers: 2, livres: 2 });
  m = jogar(m, 0, 'COMPILADOR');
  m = jogar(m, 0, 'COMPILADOR');
  assert.equal(jog(m, 0).l1, 6);
  m = jogar(m, 0, 'PASSAR');
  m = jogar(m, 1, 'COMPILADOR');
  assert.equal(jog(m, 1).l1, 3);
});

// cartão c-optimizador: Optimizador converte 2 L1 em 1 L2
test('Optimizador converte 2 L1 em 1 L2', () => {
  let m = com(novo(), 0, { l1: 5 });
  m = jogar(m, 0, 'OPTIMIZADOR');
  assert.deepEqual([jog(m, 0).l1, jog(m, 0).l2], [3, 1]);
});

// cartão c-optimizador-vazio: Optimizador sem 2 L1 gasta o worker sem efeito
test('Optimizador sem 2 L1 gasta o worker sem efeito', () => {
  let m = com(novo(), 0, { l1: 1 });
  m = jogar(m, 0, 'OPTIMIZADOR');
  assert.deepEqual([jog(m, 0).l1, jog(m, 0).l2], [1, 0]);
  assert.equal(jog(m, 0).livres, 0);
  assert.deepEqual(game.activePlayers(m.state), [1]);
});

// cartão c-forja: Forja dá uma peça L1 à escolha
test('Forja dá uma peça L1 à escolha', () => {
  let m = fixo(novo());
  recusa(m, 0, 'FORJA', { peca: 'bio' }, 'err.PECA_INVALIDA');
  recusa(m, 0, 'FORJA', { peca: 'legs' }, 'err.NAO_VISIVEL');
  const a = jogar(m, 0, 'FORJA', { peca: 'arm' });
  assert.equal(jog(a, 0).robot.arm, 1);
  assert.equal(a.state.mercado.stock.arm1, 7);
  assert.deepEqual([jog(a, 0).l1, jog(a, 0).l2], [0, 0]);
  assert.equal(a.state.tabuleiro.forja, 0);
  const b = fixo(com(novo(), 0, { robot: R({ arm: 1 }) }));
  recusa(b, 0, 'FORJA', { peca: 'arm' }, 'err.PECA_INVALIDA');
  // Sem nenhum slot de robot vazio (a CPU não conta): o worker gasta-se sem efeito.
  const c = jogar(fixo(com(novo(), 0, { robot: R({ head: 1, chest: 1, arm: 1, port: 1, legs: 1 }) })), 0, 'FORJA', {});
  assert.equal(jog(c, 0).livres, 0);
  assert.equal(c.state.mercado.stock.head1, 8);
});

// cartão c-forja-exclusiva: Forja e Deploy são exclusivos
test('Forja e Deploy são exclusivos', () => {
  let m = fixo(com(novo(), 0, { workers: 2, livres: 2 }));
  m = jogar(m, 0, 'FORJA', { peca: 'head' });
  recusa(m, 0, 'FORJA', { peca: 'chest' }, 'err.SLOT_OCUPADO');
  m = jogar(m, 0, 'DEPLOY');
  recusa(m, 1, 'FORJA', { peca: 'chest' }, 'err.SLOT_OCUPADO');
  recusa(m, 1, 'DEPLOY', {}, 'err.SLOT_OCUPADO');
  const d = jogar(com(novo(), 0, { workers: 2, livres: 2 }), 0, 'DEPLOY');
  recusa(d, 0, 'DEPLOY', {}, 'err.SLOT_OCUPADO');
});

// cartão c-deploy: Deploy dá 6 pontos acumulados
test('Deploy dá 6 pontos acumulados', () => {
  let m = novo();
  m = jogar(m, 0, 'DEPLOY');
  assert.equal(jog(m, 0).deploy, 6);
  assert.equal(m.state.tabuleiro.deploy, 0);
  m = jogar(m, 1, 'PASSAR');
  assert.equal(m.state.rodada, 2);
  assert.equal(m.state.tabuleiro.deploy, null);
  m = jogar(m, vez(m), 'DEPLOY');
  assert.equal(jog(m, 0).deploy + jog(m, 1).deploy, 12);
});

// cartão c-comprar: Comprar uma peça paga o custo e reduz o stock
test('Comprar uma peça paga o custo e reduz o stock', () => {
  let m = fixo(com(novo(), 0, { l1: 2, workers: 2, livres: 2 }));
  m = jogar(mercado(m), 0, 'COMPRAR', { peca: 'head1' });
  assert.equal(jog(m, 0).robot.head, 1);
  assert.deepEqual([jog(m, 0).l1, jog(m, 0).l2, jog(m, 0).deploy], [0, 0, 0]);
  assert.equal(m.state.mercado.stock.head1, 7);
  assert.equal(m.result, null);
  // CPU: vai para o slot da CPU.
  let c = fixo(com(novo(), 0, { l1: 2 }));
  c = jogar(mercado(c), 0, 'COMPRAR', { peca: 'bio1' });
  assert.deepEqual(jog(c, 0).cpu, { familia: 'bio', nivel: 1 });
  assert.equal(c.state.mercado.stock.bio1, 7);
  // Substituir: a peça antiga não volta ao stock.
  let u = fixo(com(novo(), 0, { l1: 1, l2: 1, robot: R({ head: 1 }) }));
  u = jogar(mercado(u), 0, 'COMPRAR', { peca: 'head2' });
  assert.equal(jog(u, 0).robot.head, 2);
  assert.equal(u.state.mercado.stock.head1, 8);
  assert.equal(u.state.mercado.stock.head2, 1);
});

// cartão c-comprar-recursos: Sem recursos ou sem stock não se compra
test('Sem recursos ou sem stock não se compra', () => {
  const m = fixo(com(novo(), 0, { l1: 1 }));
  recusa(mercado(m), 0, 'COMPRAR', { peca: 'head1' }, 'err.RECURSOS');
  const s = tweak(com(fixo(novo()), 0, { l1: 2 }), (st) => { st.mercado.stock.head1 = 0; });
  recusa(mercado(s), 0, 'COMPRAR', { peca: 'head1' }, 'err.SEM_STOCK');
  assert.equal(jog(s, 0).l1, 2);
});

// cartão c-progressao: Progressão obrigatória L1 → L2 → L3
test('Progressão obrigatória L1 → L2 → L3', () => {
  let m = fixo(com(novo(), 0, { l1: 20, l2: 20, workers: 3, livres: 3 }));
  recusa(mercado(m), 0, 'COMPRAR', { peca: 'head2' }, 'err.NIVEL');
  recusa(mercado(m), 0, 'COMPRAR', { peca: 'head3' }, 'err.NIVEL');
  m = jogar(mercado(m), 0, 'COMPRAR', { peca: 'head1' });
  recusa(mercado(m), 0, 'COMPRAR', { peca: 'head1' }, 'err.NIVEL');
  recusa(mercado(m), 0, 'COMPRAR', { peca: 'head3' }, 'err.NIVEL');
  m = jogar(mercado(m), 0, 'COMPRAR', { peca: 'head2' });
  m = jogar(mercado(m), 0, 'COMPRAR', { peca: 'head3' });
  assert.equal(jog(m, 0).robot.head, 3);
  // CPU: Omni sem CPU L2 é recusado; trocar de família ao subir de nível é permitido.
  let c = fixo(com(novo(), 0, { l1: 20, l2: 20, workers: 3, livres: 3 }));
  recusa(mercado(c), 0, 'COMPRAR', { peca: 'omni3' }, 'err.NIVEL');
  c = jogar(mercado(c), 0, 'COMPRAR', { peca: 'bio1' });
  recusa(mercado(c), 0, 'COMPRAR', { peca: 'bio3' }, 'err.NIVEL');
  c = jogar(mercado(c), 0, 'COMPRAR', { peca: 'combat2' });
  assert.deepEqual(jog(c, 0).cpu, { familia: 'combat', nivel: 2 });
  c = jogar(mercado(c), 0, 'COMPRAR', { peca: 'omni3' });
  assert.deepEqual(jog(c, 0).cpu, { familia: 'omni', nivel: 3 });
});

// cartão c-mercado: Mercado: baralhos por nível, fila de 4 e rotação
test('Mercado: baralhos por nível, fila de 4 e rotação', () => {
  const m = novo();
  const st = m.state.mercado.stock;
  for (const s of ['head', 'chest', 'arm', 'port', 'legs', 'bio', 'combat', 'agility', 'shield']) {
    assert.deepEqual([st[s + '1'], st[s + '2'], st[s + '3']], [8, 2, 1]);
  }
  assert.equal(st.omni3, 1);
  const filas = new Set();
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
    const mk = novo(2, seed).state.mercado;
    for (const l of [1, 2, 3]) {
      assert.equal(new Set(mk.fila[l]).size, 4);
      assert.deepEqual([...mk.fila[l], ...mk.baralho[l]].sort(), ['arm', 'chest', 'head', 'legs', 'port']);
    }
    filas.add(JSON.stringify(mk.fila));
  }
  assert.ok(filas.size > 1, 'a fila depende da seed');
  assert.deepEqual(novo(2, 'x').state.mercado, novo(2, 'x').state.mercado);
  // Escondida não se compra.
  recusa(mercado(fixo(com(novo(), 0, { l1: 2 }))), 0, 'COMPRAR', { peca: 'legs1' }, 'err.NAO_VISIVEL');
  // Esgotar: sai da fila e entra a do topo do baralho.
  let e = fixo(com(novo(), 0, { l1: 1, l2: 1, robot: R({ head: 2 }) }));
  e = jogar(mercado(e), 0, 'COMPRAR', { peca: 'head3' });
  assert.equal(e.state.mercado.stock.head3, 0);
  assert.deepEqual(e.state.mercado.fila[3], ['chest', 'arm', 'port', 'legs']);
  assert.deepEqual(e.state.mercado.baralho[3], []);
  // Rotação: ninguém adquire peças dos níveis 2 e 3; o nível 1 teve uma aquisição (Forja).
  let r = fixo(novo());
  r = jogar(r, 0, 'FORJA', { peca: 'head' });
  r = jogar(r, 1, 'PASSAR');
  assert.deepEqual(r.state.mercado.fila[1], ['head', 'chest', 'arm', 'port']);
  assert.deepEqual(r.state.mercado.fila[2], ['chest', 'arm', 'port', 'legs']);
  assert.deepEqual(r.state.mercado.baralho[2], ['head']);
  assert.deepEqual(r.state.mercado.fila[3], ['chest', 'arm', 'port', 'legs']);
  assert.equal(r.state.mercado.stock.head2, 2);
  // Se o nível 1 teve uma aquisição mas não da peça mais à esquerda, também roda.
  let q = fixo(novo());
  q = jogar(q, 0, 'FORJA', { peca: 'chest' });
  q = jogar(q, 1, 'PASSAR');
  assert.deepEqual(q.state.mercado.fila[1], ['chest', 'arm', 'port', 'legs']);
  assert.deepEqual(q.state.mercado.baralho[1], ['head']);
});

// cartão c-pecas: Custos e pontos das peças
test('Custos e pontos das peças', () => {
  for (const [slot, niveis] of Object.entries(PECAS)) {
    niveis.forEach(([c1, c2, pts], i) => {
      const nivel = i + 1;
      const base = todas(com(novo(), 0, { l1: c1, l2: c2, robot: R({ [slot]: nivel - 1 }) }));
      const m = jogar(mercado(base), 0, 'COMPRAR', { peca: slot + nivel });
      assert.deepEqual([jog(m, 0).l1, jog(m, 0).l2, jog(m, 0).robot[slot]], [0, 0, nivel], slot + nivel);
      const curta = com(base, 0, c1 > 0 ? { l1: c1 - 1 } : { l2: c2 - 1 });
      recusa(mercado(curta), 0, 'COMPRAR', { peca: slot + nivel }, 'err.RECURSOS');
      const f = final(novo(), (s) => { s.jogadores[0].robot = R({ [slot]: nivel }); });
      assert.equal(f.result.scores[0], pts + (nivel === 3 ? 5 : 0), slot + nivel);
    });
  }
});

// cartão c-cpus: CPUs e custos
test('CPUs e custos', () => {
  for (const fam of FAMILIAS) {
    CPUS.forEach(([c1, c2, pts], i) => {
      const nivel = i + 1;
      const base = todas(com(novo(), 0, { l1: c1, l2: c2, cpu: { familia: nivel > 1 ? 'bio' : null, nivel: nivel - 1 } }));
      const m = jogar(mercado(base), 0, 'COMPRAR', { peca: fam + nivel });
      assert.deepEqual([jog(m, 0).l1, jog(m, 0).l2], [0, 0]);
      assert.deepEqual(jog(m, 0).cpu, { familia: fam, nivel });
      const f = final(novo(), (s) => { s.jogadores[0].cpu = { familia: fam, nivel }; });
      assert.equal(f.result.scores[0], pts + (nivel === 3 ? 5 : 0), fam + nivel);
    });
  }
  const o = jogar(mercado(todas(com(novo(), 0, { l1: 2, l2: 1, cpu: { familia: 'bio', nivel: 2 } }))), 0, 'COMPRAR', { peca: 'omni3' });
  assert.deepEqual([jog(o, 0).l1, jog(o, 0).l2], [0, 0]);
  recusa(mercado(todas(com(novo(), 0, { l1: 9, l2: 9 }))), 0, 'COMPRAR', { peca: 'omni1' }, 'err.PECA_INVALIDA');
  const f = final(novo(), (s) => { s.jogadores[0].cpu = { familia: 'omni', nivel: 3 }; });
  assert.equal(f.result.scores[0], 18 + 5);
});

// cartão c-cpu-fatores: A CPU amplifica as zonas indicadas
test('A CPU amplifica as zonas indicadas', () => {
  const BASE = { head: 3, chest: 4, arm: 3, port: 4, legs: 3 };
  const ZONAS = {
    bio: [['head'], ['head'], ['head', 'legs']],
    combat: [['arm', 'port'], ['arm', 'port'], ['arm', 'port', 'chest']],
    agility: [['legs'], ['legs'], ['legs', 'head']],
    shield: [['chest'], ['chest'], ['chest', 'arm', 'port']],
  };
  const FATOR = [2, 2.5, 3];
  const esperado = (zonas, f, cpuPts, nivel) => Object.entries(BASE).reduce((a, [s, p]) => a + Math.floor(zonas.includes(s) ? p * f : p), 0) + cpuPts + 8 + (nivel === 3 ? 5 : 0);
  for (const fam of FAMILIAS) {
    for (let i = 0; i < 3; i++) {
      const f = final(novo(), (s) => {
        s.jogadores[0].robot = R({ head: 1, chest: 1, arm: 1, port: 1, legs: 1 });
        s.jogadores[0].cpu = { familia: fam, nivel: i + 1 };
      });
      assert.equal(f.result.scores[0], esperado(ZONAS[fam][i], FATOR[i], CPUS[i][2], i + 1), fam + (i + 1));
    }
  }
  const o = final(novo(), (s) => {
    s.jogadores[0].robot = R({ head: 1, chest: 1, arm: 1, port: 1, legs: 1 });
    s.jogadores[0].cpu = { familia: 'omni', nivel: 3 };
  });
  assert.equal(o.result.scores[0], esperado(['head', 'chest', 'arm', 'port', 'legs'], 1.5, 18, 3));
  // Exemplo explícito do arredondamento: Bio L2 sobre Cabeça L1 (3 × 2.5 = 7.5 → 7).
  const r = final(novo(), (s) => { s.jogadores[0].robot = R({ head: 1 }); s.jogadores[0].cpu = { familia: 'bio', nivel: 2 }; });
  assert.equal(r.result.scores[0], 7 + 9);
});

// cartão c-circuito: Circuito dá um worker permanente
test('Circuito dá um worker permanente', () => {
  // Armas (braço+interface+tronco): o lugar 0 recolhe; o lugar 1 já não o pode recolher.
  let m = fixo(com(com(novo(), 0, { l1: 2, robot: R({ arm: 1, port: 1 }) }), 1, { l1: 2, robot: R({ arm: 1, port: 1 }) }));
  m = jogar(mercado(m), 0, 'COMPRAR', { peca: 'chest1' });
  // Por compra (fase do mercado) o turno acaba e o worker novo só joga na ronda seguinte.
  assert.deepEqual([jog(m, 0).workers, jog(m, 0).livres, jog(m, 0).circuito], [2, 0, 'armas']);
  assert.deepEqual(m.state.esgotados, ['armas']);
  assert.deepEqual(game.activePlayers(m.state), [1]);
  m = jogar(mercado(m, 1), 1, 'COMPRAR', { peca: 'chest1' });
  assert.deepEqual([jog(m, 1).workers, jog(m, 1).circuito], [1, null]);
  // Vários completos de uma vez: fica com o primeiro da lista (Central).
  let v = fixo(com(novo(), 0, { l1: 2, robot: R({ head: 1, legs: 1, arm: 1 }) }));
  v = jogar(mercado(v), 0, 'COMPRAR', { peca: 'chest1' });
  assert.equal(jog(v, 0).circuito, 'central');
  assert.deepEqual(v.state.esgotados, ['central']);
  // Pela Forja também conta.
  let f = tweak(fixo(com(novo(), 0, { robot: R({ head: 1, chest: 1 }) })), (s) => { s.mercado.fila[1] = ['legs', 'chest', 'arm', 'port']; });
  f = jogar(f, 0, 'FORJA', { peca: 'legs' });
  assert.equal(jog(f, 0).circuito, 'central');
  // Pela Forja (fase dos workers) o worker novo joga já neste turno.
  assert.equal(jog(f, 0).livres, 1);
  assert.deepEqual(game.activePlayers(f.state), [0]);
});

// cartão c-circuito-lista: Os 5 circuitos
test('Os 5 circuitos', () => {
  const LISTA = {
    central: ['head', 'chest', 'legs'], combate: ['head', 'chest', 'arm'], mobilidade: ['chest', 'arm', 'legs'],
    armas: ['arm', 'port', 'chest'], processo: ['head', 'arm', 'port'],
  };
  for (const [id, slots] of Object.entries(LISTA)) {
    const [a, b, c] = slots;
    let m = todas(com(novo(), 0, { l1: 2, robot: R({ [a]: 1 }) }));
    const meio = jogar(mercado(com(m, 0, { l1: 2, livres: 2, workers: 1 })), 0, 'COMPRAR', { peca: b + '1' });
    assert.equal(jog(meio, 0).circuito, null, id + ' com 2 slots');
    m = com(m, 0, { robot: R({ [a]: 1, [b]: 1 }) });
    m = jogar(mercado(m), 0, 'COMPRAR', { peca: c + '1' });
    assert.equal(jog(m, 0).circuito, id);
  }
});

// cartão c-trigger-fim: Gatilho do fim de jogo: risco e recompensa
test('Gatilho do fim de jogo: risco e recompensa', () => {
  // Pela Forja: o turno continua (outro worker e o mercado).
  let f = todas(com(novo(), 0, { workers: 2, livres: 2, l2: 1, circuito: 'armas', robot: R({ head: 3, chest: 2, arm: 2, port: 1 }), cpu: { familia: 'bio', nivel: 1 } }));
  f = jogar(f, 0, 'FORJA', { peca: 'legs' });
  assert.equal(f.state.fim.gatilho, 0);
  f = jogar(f, 0, 'COMPILADOR');
  assert.equal(jog(f, 0).l1, 3);
  assert.deepEqual(game.activePlayers(f.state), [0]);
  // Por compra: o turno acaba.
  let m = todas(com(novo(), 0, { l1: 2, circuito: 'armas', robot: R({ head: 3, chest: 2, arm: 2, port: 1 }), cpu: { familia: 'bio', nivel: 1 } }));
  m = jogar(mercado(m), 0, 'COMPRAR', { peca: 'legs1' });
  assert.equal(m.state.fim.gatilho, 0);
  assert.deepEqual(game.activePlayers(m.state), [1]);
  m = jogar(m, 1, 'PASSAR');
  assert.equal(m.result, null);
  assert.equal(m.state.fim.rondaExtra, true);
  assert.equal(m.state.rodada, 2);
  assert.deepEqual(game.activePlayers(m.state), [1]);
  m = jogar(m, 1, 'PASSAR');
  assert.notEqual(m.result, null);
  // A CPU L3 também dá o gatilho.
  let c = todas(com(novo(), 0, { l1: 1, l2: 1, robot: R({ head: 2, chest: 2, arm: 1, port: 1, legs: 1 }), cpu: { familia: 'bio', nivel: 2 } }));
  c = jogar(mercado(c), 0, 'COMPRAR', { peca: 'bio3' });
  assert.equal(c.state.fim.gatilho, 0);
});

// cartão c-sem-gatilho: Sem a composição mínima o jogo não acaba
test('Sem a composição mínima o jogo não acaba', () => {
  let m = todas(com(novo(), 0, { l1: 2, circuito: 'armas', robot: R({ head: 2, chest: 2, arm: 1, port: 1 }), cpu: { familia: 'combat', nivel: 2 } }));
  m = jogar(mercado(m), 0, 'COMPRAR', { peca: 'legs1' });
  assert.equal(m.state.fim.gatilho, null);
  m = jogar(m, 1, 'PASSAR');
  assert.equal(m.result, null);
  assert.equal(m.state.rodada, 2);
  assert.equal(m.state.fim.rondaExtra, false);
  assert.deepEqual(game.activePlayers(m.state), [1]);
  // Com uma L3 mas só uma peça de nível 2 ou mais, também não acaba.
  let c = todas(com(novo(), 0, { l1: 2, circuito: 'armas', robot: R({ head: 3, chest: 1, arm: 1, port: 1 }), cpu: { familia: 'bio', nivel: 1 } }));
  c = jogar(mercado(c), 0, 'COMPRAR', { peca: 'legs1' });
  assert.equal(c.state.fim.gatilho, null);
});

// cartão c-limite-rondas: Limite de rondas de segurança (proposta: 30)
test('Limite de rondas de segurança (proposta: 30)', () => {
  let a = tweak(novo(), (s) => { s.rodada = 29; });
  a = fecharRonda(a);
  assert.equal(a.result, null);
  assert.equal(a.state.rodada, 30);
  const b = fecharRonda(a);
  assert.notEqual(b.result, null);
  assert.equal(b.result.scores.length, 2);
});

// cartão c-pontuacao: Pontuação final
test('Pontuação final', () => {
  const f = final(novo(), (s) => {
    s.jogadores[0].robot = R({ head: 2, chest: 1, arm: 3, port: 2, legs: 1 });
    s.jogadores[0].cpu = { familia: 'combat', nivel: 2 };
    s.jogadores[0].deploy = 12;
  });
  const esperado = 8 + 4 + Math.floor(12 * 2.5) + Math.floor(8 * 2.5) + 3 + 9 + 12 + 13;
  assert.equal(esperado, 99);
  assert.equal(f.result.scores[0], 99);
});

// cartão c-bonus: Bónus de conclusão
test('Bónus de conclusão', () => {
  const pont = (ajustes) => final(novo(), ajustes).result.scores[0];
  assert.equal(pont((s) => { s.jogadores[0].robot = R(); }), 0);
  assert.equal(pont((s) => { s.jogadores[0].robot = R({ head: 3 }); }), 15 + 5);
  const todasL1 = (s, arm) => {
    s.jogadores[0].robot = R({ head: 1, chest: 1, arm, port: 1, legs: 1 });
    s.jogadores[0].cpu = { familia: 'agility', nivel: 1 };
  };
  assert.equal(pont((s) => todasL1(s, 1)), 3 + 4 + 3 + 4 + 6 + 5 + 8);
  assert.equal(pont((s) => todasL1(s, 3)), 3 + 4 + 12 + 4 + 6 + 5 + 8 + 5);
});

// cartão c-vencedor: Vencedor e empates
test('Vencedor e empates', () => {
  const a = porLimite(novo(), (s) => { s.jogadores[0].deploy = 12; s.jogadores[1].deploy = 6; });
  assert.deepEqual(a.result.winners, [0]);
  // 20 pontos para cada: o lugar 0 com cabeça L3 (15+5), o lugar 1 com cabeça L2 (8) + Deploy 12. Ganha quem tem mais L3.
  const b = porLimite(novo(), (s) => {
    s.jogadores[0].robot = R({ head: 3 });
    s.jogadores[1].robot = R({ head: 2 }); s.jogadores[1].deploy = 12;
  });
  assert.deepEqual(b.result.scores, [20, 20]);
  assert.deepEqual(b.result.winners, [0]);
  // Empate total: partilham.
  const c = porLimite(novo(), (s) => { s.jogadores[0].deploy = 6; s.jogadores[1].deploy = 6; });
  assert.deepEqual(c.result.winners, [0, 1]);
});
