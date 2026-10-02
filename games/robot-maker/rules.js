// Robot Maker — regras puras (worker placement + construção de robot).
// Só depende de @bitnik/engine (via index.js) e de ficheiros próprios.

export const SLOTS = ['head', 'chest', 'arm', 'port', 'legs'];
export const FAMILIAS = ['bio', 'combat', 'agility', 'shield'];
export const MAX_RONDAS = 30;
export const MAX_WORKERS = 3;
export const DEPLOY_PONTOS = 6;

/** [L1, L2, pontos] por slot e nível. */
export const CUSTO = {
  head: [[2, 0, 3], [1, 1, 8], [1, 1, 15]],
  chest: [[2, 0, 4], [0, 1, 8], [1, 1, 12]],
  arm: [[2, 0, 3], [0, 1, 8], [1, 1, 12]],
  port: [[2, 0, 4], [0, 1, 8], [1, 1, 12]],
  legs: [[2, 0, 3], [1, 1, 8], [1, 1, 12]],
};
export const CPU_CUSTO = [[2, 0, 5], [1, 1, 9], [1, 1, 14]];
export const OMNI_CUSTO = [2, 1, 18];
export const FATOR = [2, 2.5, 3];
export const ZONAS = {
  bio: [['head'], ['head'], ['head', 'legs']],
  combat: [['arm', 'port'], ['arm', 'port'], ['arm', 'port', 'chest']],
  agility: [['legs'], ['legs'], ['legs', 'head']],
  shield: [['chest'], ['chest'], ['chest', 'arm', 'port']],
};
export const CIRCUITOS = [
  ['central', ['head', 'chest', 'legs']],
  ['combate', ['head', 'chest', 'arm']],
  ['mobilidade', ['chest', 'arm', 'legs']],
  ['armas', ['arm', 'port', 'chest']],
  ['processo', ['head', 'arm', 'port']],
];
const STOCK_NIVEL = [8, 2, 1];

/** 'head2' → { tipo: 'robot', slot: 'head', nivel: 2 }; 'bio1' → { tipo: 'cpu', familia: 'bio', nivel: 1 }; senão null. */
export function parsePeca(id) {
  const m = /^([a-z]+)([123])$/.exec(String(id ?? ''));
  if (!m) return null;
  const nivel = Number(m[2]);
  if (SLOTS.includes(m[1])) return { id, tipo: 'robot', slot: m[1], nivel };
  if (FAMILIAS.includes(m[1])) return { id, tipo: 'cpu', familia: m[1], nivel };
  if (m[1] === 'omni' && nivel === 3) return { id, tipo: 'cpu', familia: 'omni', nivel };
  return null;
}

/** [L1, L2, pontos] de uma peça. */
export function custoDe(p) {
  if (p.tipo === 'robot') return CUSTO[p.slot][p.nivel - 1];
  return p.familia === 'omni' ? OMNI_CUSTO : CPU_CUSTO[p.nivel - 1];
}

export const todasPecas = () => [
  ...SLOTS.flatMap((s) => [1, 2, 3].map((n) => s + n)),
  ...FAMILIAS.flatMap((f) => [1, 2, 3].map((n) => f + n)),
  'omni3',
];

// ─── Preparação ─────────────────────────────────────────────

export function setup(ctx) {
  const n = ctx.numPlayers;
  const stock = {};
  for (const id of todasPecas()) stock[id] = STOCK_NIVEL[parsePeca(id).nivel - 1] ?? 1;
  stock.omni3 = 1;
  const fila = {};
  const baralho = {};
  for (const nivel of [1, 2, 3]) {
    const ordem = ctx.rng.shuffle([...SLOTS]);
    fila[nivel] = ordem.slice(0, 4);
    baralho[nivel] = ordem.slice(4);
  }
  return {
    rodada: 1,
    ordem: Array.from({ length: n }, (_, i) => i),
    vez: 0,
    jogadores: Array.from({ length: n }, () => ({
      l1: 0, l2: 0, workers: 1, livres: 1, deploy: 0,
      robot: { head: 0, chest: 0, arm: 0, port: 0, legs: 0 },
      cpu: { familia: null, nivel: 0 },
      circuito: null,
    })),
    tabuleiro: { forja: null, deploy: null },
    mercado: { stock, fila, baralho },
    adquiridos: { 1: false, 2: false, 3: false },
    esgotados: [],
    fim: { gatilho: null, rondaExtra: false },
    acabou: false,
  };
}

export const activePlayers = (s) => (s.acabou ? [] : [s.ordem[s.vez]]);

// ─── Auxiliares ─────────────────────────────────────────────

const completo = (j) => SLOTS.every((x) => j.robot[x] > 0) && j.cpu.nivel > 0;
/** Fim de jogo: 6 slots preenchidas com pelo menos 1 peça L3 e 3 peças de nível 2 ou mais (1×L3, 2×L2, 3×L1). */
const robotFinal = (j) => completo(j) && temL3(j) && [...SLOTS.map((x) => j.robot[x]), j.cpu.nivel].filter((n) => n >= 2).length >= 3;
const temL3 = (j) => SLOTS.some((x) => j.robot[x] === 3) || j.cpu.nivel === 3;
const numL3 = (j) => SLOTS.filter((x) => j.robot[x] === 3).length + (j.cpu.nivel === 3 ? 1 : 0);

/** Slots do robot onde a Forja pode pôr uma L1: vazios, visíveis e com stock. */
export const slotsForja = (s, j) => SLOTS.filter((x) => j.robot[x] === 0 && s.mercado.fila[1].includes(x) && s.mercado.stock[x + '1'] > 0);

/** Pontos de um robot: peças (com o fator da CPU nas zonas), CPU, Deploy e bónus. */
export function pontuar(j) {
  let zonas = [];
  let fator = 1;
  if (j.cpu.nivel > 0) {
    if (j.cpu.familia === 'omni') { zonas = SLOTS; fator = 1.5; } else { zonas = ZONAS[j.cpu.familia][j.cpu.nivel - 1]; fator = FATOR[j.cpu.nivel - 1]; }
  }
  const pecas = SLOTS.filter((x) => j.robot[x] > 0).map((x) => {
    const base = CUSTO[x][j.robot[x] - 1][2];
    const amp = zonas.includes(x);
    return { slot: x, nivel: j.robot[x], base, amp, valor: amp ? Math.floor(base * fator) : base };
  });
  const cpu = j.cpu.nivel > 0 ? (j.cpu.familia === 'omni' ? OMNI_CUSTO[2] : CPU_CUSTO[j.cpu.nivel - 1][2]) : 0;
  const bonusCompleto = completo(j) ? 8 : 0;
  const bonusL3 = temL3(j) ? 5 : 0;
  const total = pecas.reduce((a, p) => a + p.valor, 0) + cpu + j.deploy + bonusCompleto + bonusL3;
  return { pecas, fator, cpu, deploy: j.deploy, bonusCompleto, bonusL3, total };
}

export function result(s) {
  if (!s.acabou) return null;
  const scores = s.jogadores.map((j) => pontuar(j).total);
  const max = Math.max(...scores);
  let winners = scores.map((p, i) => (p === max ? i : -1)).filter((i) => i >= 0);
  if (winners.length > 1) {
    const l3 = Math.max(...winners.map((i) => numL3(s.jogadores[i])));
    winners = winners.filter((i) => numL3(s.jogadores[i]) === l3);
  }
  return { scores, winners };
}

function instalar(s, seat, ctx, p) {
  const j = s.jogadores[seat];
  if (p.tipo === 'robot') { j.robot[p.slot] = p.nivel; s.adquiridos[p.nivel] = true; } else j.cpu = { familia: p.familia, nivel: p.nivel };
  s.mercado.stock[p.id]--;
  // Peça esgotada: sai da fila e entra a do topo do baralho (à direita).
  if (p.tipo === 'robot' && s.mercado.stock[p.id] <= 0) {
    const f = s.mercado.fila[p.nivel];
    const i = f.indexOf(p.slot);
    if (i >= 0) f.splice(i, 1);
    if (s.mercado.baralho[p.nivel].length) f.push(s.mercado.baralho[p.nivel].shift());
  }
  // Circuito: o primeiro da lista que ficou completo e ainda não foi recolhido.
  if (j.circuito === null && j.workers < MAX_WORKERS) {
    const c = CIRCUITOS.find(([id, slots]) => !s.esgotados.includes(id) && slots.every((x) => j.robot[x] > 0));
    if (c) {
      s.esgotados.push(c[0]);
      j.circuito = c[0];
      j.workers += 1;
      j.livres += 1;
      ctx.log(`log.CIRCUITO.${c[0]}`, {}, { announce: true });
    }
  }
  if (s.fim.gatilho === null && robotFinal(j)) {
    s.fim.gatilho = seat;
    ctx.log('log.GATILHO', {}, { announce: 'warn' });
  }
}

/** Passa a vez ao seguinte (quem fez o gatilho não joga na ronda extra); se já jogaram todos, fecha a ronda. */
function avancar(s, ctx) {
  s.vez += 1;
  while (s.vez < s.ordem.length && s.fim.rondaExtra && s.ordem[s.vez] === s.fim.gatilho) s.vez += 1;
  if (s.vez >= s.ordem.length) fecharRonda(s, ctx);
}

function fecharRonda(s, ctx) {
  if (s.fim.rondaExtra || (s.fim.gatilho === null && s.rodada >= MAX_RONDAS)) {
    s.acabou = true;
    ctx.log('log.FIM');
    return;
  }
  if (s.fim.gatilho !== null) {
    s.fim.rondaExtra = true;
    ctx.log('log.RONDA_EXTRA', {}, { announce: 'warn' });
  }
  // Rotação do mercado: sem aquisições num nível, a peça mais à esquerda vai para o fundo do baralho.
  for (const nivel of [1, 2, 3]) {
    const f = s.mercado.fila[nivel];
    const b = s.mercado.baralho[nivel];
    if (!s.adquiridos[nivel] && f.length && b.length) {
      b.push(f.shift());
      f.push(b.shift());
      ctx.log('log.ROTACAO', { nivel });
    }
    s.adquiridos[nivel] = false;
  }
  for (const j of s.jogadores) j.livres = j.workers;
  s.tabuleiro = { forja: null, deploy: null };
  s.ordem = [...s.ordem.slice(1), s.ordem[0]];
  s.rodada += 1;
  s.vez = 0;
  while (s.vez < s.ordem.length && s.fim.rondaExtra && s.ordem[s.vez] === s.fim.gatilho) s.vez += 1;
  ctx.log('log.RONDA', { n: s.rodada });
}

/** Gasta um worker; quando o jogador fica sem livres, o turno passa. */
function gastar(s, seat, ctx) {
  s.jogadores[seat].livres -= 1;
  return seat;
}
function concluir(s, seat, ctx) {
  if (s.jogadores[seat].livres <= 0) avancar(s, ctx);
}

const semWorkers = (s, seat, ctx) => (s.jogadores[seat].livres <= 0 ? ctx.invalid('err.SEM_WORKERS') : null);

// ─── Jogadas ────────────────────────────────────────────────

export const moves = {
  COMPILADOR(s, _p, ctx) {
    const bad = semWorkers(s, ctx.seat, ctx); if (bad) return bad;
    gastar(s, ctx.seat);
    s.jogadores[ctx.seat].l1 += 3;
    ctx.log('log.COMPILADOR');
    concluir(s, ctx.seat, ctx);
  },

  OPTIMIZADOR(s, _p, ctx) {
    const bad = semWorkers(s, ctx.seat, ctx); if (bad) return bad;
    gastar(s, ctx.seat);
    const j = s.jogadores[ctx.seat];
    if (j.l1 >= 2) { j.l1 -= 2; j.l2 += 1; ctx.log('log.OPTIMIZADOR'); } else ctx.log('log.OPTIMIZADOR_VAZIO');
    concluir(s, ctx.seat, ctx);
  },

  FORJA(s, p, ctx) {
    const bad = semWorkers(s, ctx.seat, ctx); if (bad) return bad;
    if (s.tabuleiro.forja !== null) return ctx.invalid('err.SLOT_OCUPADO');
    const j = s.jogadores[ctx.seat];
    const ok = slotsForja(s, j);
    if (ok.length) {
      const slot = p?.peca;
      if (!SLOTS.includes(slot) || j.robot[slot] !== 0) return ctx.invalid('err.PECA_INVALIDA');
      if (!s.mercado.fila[1].includes(slot)) return ctx.invalid('err.NAO_VISIVEL');
      if (s.mercado.stock[slot + '1'] <= 0) return ctx.invalid('err.SEM_STOCK');
    }
    gastar(s, ctx.seat);
    s.tabuleiro.forja = ctx.seat;
    if (ok.length) {
      ctx.log(`log.FORJA.${p.peca}1`);
      instalar(s, ctx.seat, ctx, parsePeca(p.peca + '1'));
    } else ctx.log('log.FORJA_VAZIA');
    concluir(s, ctx.seat, ctx);
  },

  DEPLOY(s, _p, ctx) {
    const bad = semWorkers(s, ctx.seat, ctx); if (bad) return bad;
    if (s.tabuleiro.deploy !== null) return ctx.invalid('err.SLOT_OCUPADO');
    gastar(s, ctx.seat);
    s.tabuleiro.deploy = ctx.seat;
    s.jogadores[ctx.seat].deploy += DEPLOY_PONTOS;
    ctx.log('log.DEPLOY', { n: DEPLOY_PONTOS });
    concluir(s, ctx.seat, ctx);
  },

  COMPRAR(s, p, ctx) {
    const bad = semWorkers(s, ctx.seat, ctx); if (bad) return bad;
    const peca = parsePeca(p?.peca);
    if (!peca) return ctx.invalid('err.PECA_INVALIDA');
    const j = s.jogadores[ctx.seat];
    if (peca.tipo === 'robot' && !s.mercado.fila[peca.nivel].includes(peca.slot)) return ctx.invalid('err.NAO_VISIVEL');
    if (s.mercado.stock[peca.id] <= 0) return ctx.invalid('err.SEM_STOCK');
    const atual = peca.tipo === 'robot' ? j.robot[peca.slot] : j.cpu.nivel;
    if (peca.nivel !== atual + 1) return ctx.invalid('err.NIVEL');
    const [c1, c2] = custoDe(peca);
    if (j.l1 < c1 || j.l2 < c2) return ctx.invalid('err.RECURSOS');
    gastar(s, ctx.seat);
    j.l1 -= c1;
    j.l2 -= c2;
    ctx.log(`log.COMPRAR.${peca.id}`);
    instalar(s, ctx.seat, ctx, peca);
    concluir(s, ctx.seat, ctx);
  },

  PASSAR(s, _p, ctx) {
    s.jogadores[ctx.seat].livres = 0;
    ctx.log('log.PASSAR');
    avancar(s, ctx);
  },
};

// ─── Jogadas legais, vista e descrição ──────────────────────

export function compraveis(s, seat) {
  const j = s.jogadores[seat];
  const out = [];
  for (const id of todasPecas()) {
    const p = parsePeca(id);
    if (s.mercado.stock[id] <= 0) continue;
    if (p.tipo === 'robot' && !s.mercado.fila[p.nivel].includes(p.slot)) continue;
    if (p.nivel !== (p.tipo === 'robot' ? j.robot[p.slot] : j.cpu.nivel) + 1) continue;
    out.push(id);
  }
  return out;
}

export function enumerate(s, seat) {
  if (s.acabou || s.ordem[s.vez] !== seat || s.jogadores[seat].livres <= 0) return [];
  const j = s.jogadores[seat];
  const out = [{ type: 'COMPILADOR', payload: {} }, { type: 'OPTIMIZADOR', payload: {} }];
  if (s.tabuleiro.forja === null) for (const x of slotsForja(s, j)) out.push({ type: 'FORJA', payload: { peca: x } });
  if (s.tabuleiro.deploy === null) out.push({ type: 'DEPLOY', payload: {} });
  for (const id of compraveis(s, seat)) {
    const [c1, c2] = custoDe(parsePeca(id));
    if (j.l1 >= c1 && j.l2 >= c2) out.push({ type: 'COMPRAR', payload: { peca: id } });
  }
  out.push({ type: 'PASSAR', payload: {} });
  return out;
}

export function view(s, seat) {
  return {
    rodada: s.rodada,
    ordem: s.ordem,
    vez: s.vez,
    jogadores: s.jogadores.map((j) => ({ ...j, pontos: pontuar(j) })),
    tabuleiro: s.tabuleiro,
    mercado: {
      stock: s.mercado.stock,
      fila: s.mercado.fila,
      baralho: { 1: s.mercado.baralho[1].length, 2: s.mercado.baralho[2].length, 3: s.mercado.baralho[3].length },
    },
    adquiridos: s.adquiridos,
    esgotados: s.esgotados,
    fim: s.fim,
    acabou: s.acabou,
    maxRondas: MAX_RONDAS,
    custos: Object.fromEntries(todasPecas().map((id) => [id, custoDe(parsePeca(id))])),
    circuitos: CIRCUITOS,
    compraveis: seat != null && seat >= 0 && s.jogadores[seat] ? compraveis(s, seat) : [],
  };
}

export function describeMove(move) {
  if (move.type === 'COMPRAR') return { key: `moveLabel.COMPRAR.${move.payload.peca}`, params: {} };
  if (move.type === 'FORJA') return { key: `moveLabel.FORJA.${move.payload.peca}`, params: {} };
  return { key: `move.${move.type}`, params: {} };
}
