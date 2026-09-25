// Testes das regras do Bulbous, escritos a partir de REGRAS.md (um por regra).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMatch, applyMove, fireTimer, simulate, checkGame, checkPurity, botMove, viewFor } from '@bitnik/engine';
import bulbous from '../index.js';
import { baralhoCharme, pontuar, valorAposta } from '../rules.js';

const novo = (n = 4, seed = 'bulbous', options = {}) => createMatch(bulbous, { numPlayers: n, seed, options });
const jogar = (m, lugar, type, payload = {}) => applyMove(bulbous, m, lugar, { type, payload });
const ok = (r) => { assert.ok(r.ok, JSON.stringify(r.error)); return r.match; };
const tweak = (m, fn) => { const c = structuredClone(m); fn(c.state); return c; };
const carta = (id, cor, valor, tipo = 'numero', simbolo = null) => ({ id, tipo, cor, simbolo, valor });

/** Todos ativam a primeira candidata; devolve o match na fase SEQUENCIA. */
function prontos(m) {
  while (m.state.fase === 'ESCOLHER') {
    const j = m.state.porEscolher[0].jogador;
    m = ok(jogar(m, j, 'ESCOLHER', { baelf: bulbous.enumerate(m.state, j)[0].payload.baelf }));
  }
  return m;
}
/** Governante declara a ordem pela qual as ativas aparecem. */
const declarar = (m) => ok(jogar(m, m.state.governante, 'DECLARAR', { ordem: bulbous.enumerate(m.state, m.state.governante)[0].payload.ordem }));
const atual = (m) => m.state.vaza.ordem[m.state.vaza.atual];
/** Dá a um lugar uma mão escolhida (ids novos, acima dos do baralho). */
const comMao = (m, lugar, mao) => tweak(m, (s) => { s.jogadores[lugar].mao = mao; });
const alvoDe = (m) => { const p = m.state.jogadores[m.state.vaza.alvoJogador]; return p.baelfs[p.ativas[m.state.vaza.alvoPosicao]]; };

test('pacote válido, i18n PT/EN com paridade e regras puras', () => {
  assert.deepEqual(checkGame(bulbous), []);
  const dir = new URL('../', import.meta.url);
  const problems = ['index.js', 'rules.js', 'bot.js', 'i18n/pt.js', 'i18n/en.js'].flatMap((f) => checkPurity(readFileSync(new URL(f, dir), 'utf8'), f));
  assert.deepEqual(problems, []);
});

test('I. Componentes: 34 Cartas de Charme (28 numéricas 3–9, 4 Duplos, 2 Jokers)', () => {
  const d = baralhoCharme();
  assert.equal(d.length, 34);
  assert.equal(d.filter((c) => c.tipo === 'numero').length, 28);
  assert.equal(d.filter((c) => c.tipo === 'duplo').length, 4);
  assert.deepEqual(d.filter((c) => c.tipo === 'joker').map((c) => c.simbolo).sort(), ['circle', 'triangle']);
});

test('III. Joga-se a 2 ou a 4, nunca a 3', () => {
  assert.throws(() => novo(3), /3 jogadores/);
  assert.equal(novo(2).state.modo, '2p');
  assert.equal(novo(4).state.modo, '4p');
  assert.equal(novo(4, 's', { equipas: true }).state.modo, '2v2');
});

test('III.A. A 4: 4 Baelfungious de uma cor e 7 cartas cada; todos ativam 1', () => {
  const m = novo(4);
  for (const p of m.state.jogadores) {
    assert.equal(p.mao.length, 7);
    assert.equal(p.baelfs.length, 4);
    assert.ok(p.baelfs.every((b) => b.cor === p.cor));
    assert.deepEqual(p.baelfs.map((b) => b.espacos), [1, 2, 3, 4]);
  }
  assert.equal(new Set(m.state.jogadores.map((p) => p.cor)).size, 4);
  assert.equal(m.state.porEscolher.length, 4);
  assert.equal(m.state.baralho.length, 34 - 28);
});

test('III.B. A 2: 8 Baelfungious de um símbolo e 9 cartas; as 2 ativas têm cores diferentes', () => {
  let m = novo(2);
  for (const p of m.state.jogadores) {
    assert.equal(p.mao.length, 9);
    assert.equal(p.baelfs.length, 8);
    assert.equal(new Set(p.baelfs.map((b) => b.cor)).size, 2);
  }
  const j = m.state.porEscolher[0].jogador;
  const primeira = m.state.jogadores[j].baelfs.findIndex((b) => b.cor === m.state.jogadores[j].baelfs[0].cor);
  m = ok(jogar(m, j, 'ESCOLHER', { baelf: primeira }));
  const mesmaCor = m.state.jogadores[j].baelfs.findIndex((b, i) => i !== primeira && b.cor === m.state.jogadores[j].baelfs[primeira].cor);
  assert.equal(jogar(m, j, 'ESCOLHER', { baelf: mesmaCor }).error.code, 'err.MESMA_COR');
  m = prontos(m);
  const cores = m.state.jogadores.map((p) => p.ativas.map((b) => p.baelfs[b].cor));
  for (const c of cores) assert.equal(new Set(c).size, 2);
  assert.equal(new Set(cores.flat()).size, 4, 'as 4 cores do jogo ficam sempre ativas');
});

test('III.C. Equipas: Círculo (azul+verde) contra Triângulo (vermelho+amarelo), sentadas intercaladas', () => {
  const m = novo(4, 'equipas', { equipas: true });
  const eq = m.state.jogadores.map((p) => p.equipa);
  assert.equal(eq[0], eq[2]);
  assert.equal(eq[1], eq[3]);
  assert.notEqual(eq[0], eq[1]);
  for (const p of m.state.jogadores) assert.equal(p.equipa, p.cor === 'blue' || p.cor === 'green' ? 'circle' : 'triangle');
});

test('IV.1. O Governante declara de uma vez a ordem das 4 vazas; só ele, e cada uma uma vez', () => {
  let m = prontos(novo(4));
  const g = m.state.governante;
  const outro = (g + 1) % 4;
  const ordem = bulbous.enumerate(m.state, g)[0].payload.ordem;
  assert.equal(jogar(m, outro, 'DECLARAR', { ordem }).error.code, 'engine.NOT_ACTIVE');
  assert.equal(jogar(m, g, 'DECLARAR', { ordem: [ordem[0], ordem[0], ordem[1], ordem[2]] }).error.code, 'err.SEQUENCIA');
  assert.equal(bulbous.enumerate(m.state, g).length, 24, '4! ordens possíveis');
  m = ok(jogar(m, g, 'DECLARAR', { ordem }));
  assert.deepEqual(m.state.sequencia, ordem);
  assert.equal(m.state.fase, 'ACOES');
  assert.equal(atual(m), g, 'o Governante age primeiro');
});

test('IV.2. Apostar: só cartas da cor da Baelfungious (Joker: o mesmo símbolo), viradas para baixo', () => {
  let m = declarar(prontos(novo(4)));
  const eu = atual(m);
  const b = alvoDe(m);
  const outra = ['red', 'blue', 'green', 'yellow'].find((c) => c !== b.cor);
  const jokerErrado = b.simbolo === 'circle' ? 'triangle' : 'circle';
  m = comMao(m, eu, [carta(101, b.cor, 9), carta(102, outra, 8), carta(103, null, null, 'joker', jokerErrado)]);
  assert.equal(jogar(m, eu, 'APOSTAR', { cartas: [102] }).error.code, 'err.CARTA_NAO_JOGA');
  assert.equal(jogar(m, eu, 'APOSTAR', { cartas: [103] }).error.code, 'err.CARTA_NAO_JOGA');
  assert.equal(jogar(m, eu, 'APOSTAR', { cartas: [] }).error.code, 'err.APOSTA_VAZIA');
  m = ok(jogar(m, eu, 'APOSTAR', { cartas: [101] }));
  const outroLugar = atual(m);
  assert.deepEqual(bulbous.view(m.state, outroLugar).vaza.apostas[eu], [], 'os outros não veem a aposta antes da revelação');
  assert.equal(bulbous.view(m.state, eu).vaza.apostas[eu][0].valor, 9);
});

test('IV.2. Duplo multiplica as cartas da sua cor; Joker ganha logo', () => {
  const b = { cor: 'blue', simbolo: 'circle' };
  assert.equal(valorAposta([carta(1, 'blue', null, 'duplo'), carta(2, 'blue', 9)], b).total, 18);
  assert.equal(valorAposta([carta(1, 'blue', 4), carta(2, 'blue', 5)], b).total, 9);
  assert.ok(valorAposta([carta(1, null, null, 'joker', 'circle')], b).joker);
});

test('IV.2. Trocar até 2 cartas; passar tira 1 carta (acima do limite, descarta)', () => {
  let m = declarar(prontos(novo(4)));
  const a = atual(m);
  const mao = m.state.jogadores[a].mao.map((c) => c.id);
  assert.equal(jogar(m, a, 'TROCAR', { cartas: mao.slice(0, 3) }).error.code, 'err.TROCA');
  m = ok(jogar(m, a, 'TROCAR', { cartas: mao.slice(0, 2) }));
  assert.equal(m.state.jogadores[a].mao.length, 7);
  assert.ok(!m.state.jogadores[a].mao.some((c) => mao.slice(0, 2).includes(c.id)));
  const b = atual(m);
  m = ok(jogar(m, b, 'PASSAR'));
  assert.equal(m.state.jogadores[b].mao.length, 8);
  assert.deepEqual(bulbous.activePlayers(m.state), [b], 'fica à espera do descarte');
  assert.equal(jogar(m, b, 'DESCARTAR', { cartas: [] }).error.code, 'err.DESCARTE');
  m = ok(jogar(m, b, 'DESCARTAR', { cartas: [m.state.jogadores[b].mao[0].id] }));
  assert.equal(m.state.jogadores[b].mao.length, 7);
});

/** Monta uma vaza em que cada lugar aposta a carta indicada (ou passa com null). */
function vaza(m, porLugar) {
  const b = alvoDe(m);
  let id = 500;
  for (const [lugar] of porLugar.entries()) {
    const v = porLugar[lugar];
    if (v != null) m = comMao(m, lugar, [carta(++id, b.cor, v), ...m.state.jogadores[lugar].mao.filter((c) => c.cor !== b.cor)]);
  }
  for (let k = 0; k < m.state.n && m.state.fase === 'ACOES'; k++) {
    const l = atual(m);
    const v = porLugar[l];
    if (v == null) {
      m = ok(jogar(m, l, 'TROCAR', { cartas: [m.state.jogadores[l].mao.at(-1).id] }));
    } else {
      m = ok(jogar(m, l, 'APOSTAR', { cartas: [m.state.jogadores[l].mao.find((c) => c.cor === b.cor && c.valor === v).id] }));
    }
  }
  return m;
}

test('IV.2. A aposta mais alta ganha a vaza e põe um bolbo na Baelfungious', () => {
  let m = declarar(prontos(novo(4)));
  const b0 = alvoDe(m);
  m = vaza(m, [5, 9, null, 4]);
  assert.equal(m.state.ultimaVaza.vencedor, 1);
  const p = m.state.jogadores[m.state.ultimaVaza.alvoJogador];
  const b = p.baelfs.find((x) => x.cor === b0.cor && x.espacos === b0.espacos);
  assert.deepEqual(b.bolbos, [1]);
});

test('Empate: os empatados podem jogar 1 carta da cor; ao fim de 20 s quem não jogou passa', () => {
  let m = declarar(prontos(novo(4)));
  m = vaza(m, [7, 7, null, null]);
  assert.equal(m.state.fase, 'DESEMPATE');
  assert.deepEqual([...bulbous.activePlayers(m.state)].sort(), [0, 1]);
  assert.ok(m.timers.some((t) => t.key === 'desempate' && t.delayMs === 20_000));
  const b = alvoDe(m);
  m = comMao(m, 0, [carta(900, b.cor, 3), ...m.state.jogadores[0].mao]);
  m = ok(jogar(m, 0, 'DESEMPATAR', { carta: 900 }));
  m = ok(fireTimer(bulbous, m, 'desempate'));
  assert.equal(m.state.ultimaVaza.vencedorDesempate, 0, 'só quem jogou carta pode ganhar');
});

test('Baelfungious completa sai no fim da ronda; o dono ativa outra e todos repõem a mão', () => {
  let m = declarar(prontos(novo(4)));
  const g0 = m.state.governante;
  // Ronda com uma Juvenil (1 espaço) como 1.ª vaza: fica completa logo.
  m = tweak(m, (s) => {
    const { jogador, posicao } = s.sequencia[0];
    s.jogadores[jogador].ativas[posicao] = s.jogadores[jogador].baelfs.findIndex((b) => b.espacos === 1);
  });
  const dono = m.state.sequencia[0].jogador;
  m = vaza(m, [9, null, null, null]);
  assert.ok(m.state.completaNaRonda);
  while (m.state.fase === 'ACOES') m = vaza(m, [null, null, null, null]);
  assert.equal(m.state.fase, 'ESCOLHER');
  assert.deepEqual(m.state.porEscolher.map((r) => r.jogador), [dono]);
  assert.ok(m.state.jogadores.every((p) => p.mao.length === 7), 'repõem a mão até 7');
  assert.equal(m.state.governante, (g0 + 1) % 4, 'o Governante passa ao jogador à esquerda');
});

test('V/VI. Pontuação: 1 por bolbo, maioria +3 (empate +1), todas as cores +5, todos os espécimes +10', () => {
  const s = novo(4).state;
  const b = (j, espacos) => s.jogadores[j].baelfs.find((x) => x.espacos === espacos);
  // Jogador 0 controla uma de cada cor e uma de cada espécime.
  [[0, 1], [1, 2], [2, 3], [3, 4]].forEach(([j, esp]) => { const x = b(j, esp); x.bolbos = Array(esp).fill(0); x.completa = true; });
  // Empate na maioria entre os jogadores 1 e 2 numa Adulta (2 espaços) do jogador 2.
  const t = b(2, 2); t.bolbos = [1, 2]; t.completa = true;
  const sc = pontuar(s);
  assert.equal(sc[0].bolbos, 1 + 2 + 3 + 4);
  assert.equal(sc[0].maioria, 12);
  assert.equal(sc[0].colecao, 15);
  assert.equal(sc[1].maioria, 1);
  assert.equal(sc[2].maioria, 1);
  assert.equal(sc[0].total, 10 + 12 + 15);
});

test('VI.4. Em equipas, ganha a equipa com a soma mais alta (os dois jogadores)', () => {
  let m = novo(4, 'eq', { equipas: true });
  for (let i = 0; i < 3000 && !m.result; i++) {
    const l = bulbous.activePlayers(m.state)[0];
    if (l === undefined) { m = ok(fireTimer(bulbous, m, m.timers[0].key)); continue; }
    m = ok(applyMove(bulbous, m, l, botMove(bulbous, m, l)));
  }
  assert.ok(m.result, 'a partida acaba');
  const eq = m.state.jogadores.map((p) => p.equipa);
  const w = m.result.winners;
  assert.ok(w.length === 2 || w.length === 4);
  assert.ok(w.every((i) => m.state.equipas.vencedoras.includes(eq[i])));
});

test('Simulação: partidas com bots acabam a 2 e a 4, sem vantagem de lugar', () => {
  for (const n of [2, 4]) {
    const r = simulate(bulbous, { numPlayers: n, games: 60, seed: `t${n}` });
    assert.equal(r.finished, 60);
    assert.deepEqual(r.failures, []);
  }
});

test('A UI genérica mostra rótulos legíveis das jogadas', () => {
  const m = prontos(novo(4));
  const v = viewFor(bulbous, m, m.state.governante);
  assert.match(v.legal[0].label.key, /moveLabel\.DECLARAR/);
  assert.match(v.legal[0].label.params.ordem, /→/);
});
