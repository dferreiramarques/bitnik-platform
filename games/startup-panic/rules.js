// Startup Panic — regras puras (investimento em startups, CEOs caóticos e Gates de Venda).
// Só depende de @bitnik/engine (via index.js) e de ficheiros próprios.

export const SETORES = ['ia', 'fintech', 'seguranca', 'biotech', 'energia'];
export const MAX_ACOES = 4; // por jogador e por startup
export const MAX_ACOES_TOTAL = 9; // por jogador, somando todas as startups vivas: só dá para ter 2 ou 3 maiorias
export const RONDAS = 12; // uma por CEO
export const CASH_INICIAL = 10;
/**
 * Nível de um trabalhador: o 1.º que contratas é Estagiário, o 2.º Júnior, o 3.º Mid e do 4.º em diante Sénior
 * (fica fixo no momento da contratação). Mais nível rende mais (mult) mas custa mais a contratar e a manter.
 */
export const NIVEIS = [
  { id: 'estagiario', mult: 1, custo: 0, salario: 0 },
  { id: 'junior', mult: 2, custo: 1, salario: 1 },
  { id: 'mid', mult: 3, custo: 2, salario: 2 },
  { id: 'senior', mult: 4, custo: 3, salario: 3 },
];
export const nivelPara = (contratados) => Math.min(contratados, NIVEIS.length - 1);

export const STARTUPS = [
  { id: 'deepanic', setor: 'ia', base: 3 },
  { id: 'halluci', setor: 'ia', base: 2 },
  { id: 'cashburn', setor: 'fintech', base: 4 },
  { id: 'tokenstonk', setor: 'fintech', base: 3 },
  { id: 'hackshield', setor: 'seguranca', base: 3 },
  { id: 'zerotrust', setor: 'seguranca', base: 2 },
  { id: 'crispash', setor: 'biotech', base: 4 },
  { id: 'pharmarush', setor: 'biotech', base: 3 },
  { id: 'fusionfail', setor: 'energia', base: 2 },
  { id: 'solarscam', setor: 'energia', base: 3 },
];

export const TIPOS = ['engineer', 'lawyer', 'pr', 'cfo'];
/**
 * Dividendo base por ação e por ronda, multiplicado pelo nível do trabalhador. O CFO não paga por ação: tem renda fixa.
 * Efeitos próprios: o Advogado protege a startup de implodir; o PR sobe o preço da startup;
 * o CFO rende FIXO_CFO por ronda mesmo sem ações.
 */
export const DIVIDENDO = { engineer: 2, lawyer: 1, pr: 1 };
export const FIXO_CFO = 2; // por ronda, multiplicado pelo nível
export const BONUS_PR = 1;
export const NOMES = {
  engineer: ['Ada', 'Linus', 'Grace', 'Tim', 'Bjarne', 'Guido', 'Dennis', 'Ken'],
  lawyer: ['Harvey', 'Kim', 'Elle', 'Saul', 'Alan', 'Ruth', 'Thurgood', 'Amal'],
  pr: ['Max', 'Donna', 'Olivia', 'Louis', 'Judy', 'Seth', 'Ari', 'Samantha'],
  cfo: ['Gordon', 'Warren', 'Ray', 'Carol', 'Jack', 'Sheryl', 'Jamie', 'Mary'],
};

/** Piso do multiplicador do Gate por ronda; o arquétipo do CEO multiplica-o. */
export const GATE_BASE = { 4: 5, 8: 10, 12: 20 };
export const CEO_ALTO = ['sa', 'ev', 'ww', 'sb'];
export const CEO_BAIXO = ['mz', 'jh', 'pc', 'bc'];
export const MULT_ALTO = 1.5;
export const MULT_BAIXO = 0.7;

const fmt = (n) => (n >= 0 ? '+' : '') + n + 'M';

// ─── Efeitos de mercado ─────────────────────────────────────

/** Há um Advogado (de qualquer jogador) nesta startup: não implode. */
export const protegida = (s, id) => s.jogadores.some((j) => j.trab.some((w) => w.startup === id && w.tipo === 'lawyer'));
/** Bónus de preço dos PR (de qualquer jogador) nesta startup. */
export const bonusPr = (s, id) => BONUS_PR * s.jogadores.reduce((a, j) => a + j.trab.filter((w) => w.startup === id && w.tipo === 'pr').length, 0);

/** Preço = base + valor do setor + PR, no mínimo 1M. */
export function recalcular(s) {
  for (const su of s.startups) if (!su.implodida) su.preco = Math.max(1, su.base + s.setores[su.setor] + bonusPr(s, su.id));
}

function mexer(s, ctx, setor, delta) {
  if (!delta) return;
  s.setores[setor] += delta;
  recalcular(s);
  ctx.log('log.SETOR', { setor: `@setor.${setor}`, d: fmt(delta) });
}

/** Implode a startup viva mais cara que não tenha Advogado (empate: sorteio). */
function implodir(s, ctx) {
  if (s.seguro) return;
  const vivas = s.startups.filter((x) => !x.implodida);
  const livres = vivas.filter((x) => !protegida(s, x.id));
  if (!livres.length) {
    if (vivas.length) ctx.log('log.PROTEGIDAS');
    return;
  }
  const max = Math.max(...livres.map((x) => x.preco));
  const topo = livres.filter((x) => x.preco === max);
  const alvo = topo.length > 1 ? ctx.rng.pick(topo) : topo[0];
  for (const x of vivas) if (protegida(s, x.id) && x.preco >= alvo.preco) ctx.log('log.PROTEGIDA', { startup: `@startup.${x.id}` });
  alvo.implodida = true;
  ctx.log('log.IMPLODE', { startup: `@startup.${alvo.id}` }, { announce: 'warn' });
}

/** CEOs: setor de afinidade (+1M sempre), se lança o dado e o efeito. */
export const CEOS = {
  ev: { setor: 'energia', dado: true, efeito: (s, ctx, d) => { mexer(s, ctx, 'ia', Math.floor(d / 2)); if (d >= 5) implodir(s, ctx); } },
  mz: { setor: 'fintech', dado: false, efeito: (s, ctx) => { mexer(s, ctx, 'fintech', 2); mexer(s, ctx, 'ia', -1); } },
  sa: { setor: 'ia', dado: true, efeito: (s, ctx, d) => { mexer(s, ctx, 'ia', d); mexer(s, ctx, 'biotech', -1); } },
  jh: { setor: 'ia', dado: false, efeito: (s, ctx) => { mexer(s, ctx, 'ia', 3); mexer(s, ctx, 'energia', -1); } },
  rh: { setor: 'fintech', dado: true, efeito: (s, ctx, d) => { mexer(s, ctx, SETORES[d % 5], 2); mexer(s, ctx, SETORES[(d + 2) % 5], -2); } },
  tk: { setor: 'seguranca', dado: true, efeito: (s, ctx, d) => { implodir(s, ctx); mexer(s, ctx, 'seguranca', d - 2); } },
  eh: { setor: 'biotech', dado: false, efeito: (s, ctx) => { mexer(s, ctx, 'biotech', 4); s.penalizacao = { setor: 'biotech', d: -4 }; ctx.log('log.PENALIZACAO'); } },
  bc: { setor: 'energia', dado: false, efeito: (s, ctx) => { s.seguro = true; for (const x of SETORES) mexer(s, ctx, x, 1); ctx.log('log.SEGURO'); } },
  an: { setor: 'biotech', dado: true, efeito: (s, ctx, d) => { mexer(s, ctx, 'biotech', d - 3); s.sobretaxa = 1; ctx.log('log.SOBRETAXA'); } },
  pc: { setor: 'fintech', dado: false, efeito: (s, ctx) => { mexer(s, ctx, 'fintech', 2); mexer(s, ctx, 'seguranca', 1); } },
  sb: { setor: 'fintech', dado: true, efeito: (s, ctx, d) => { if (d >= 4) implodir(s, ctx); else mexer(s, ctx, 'fintech', 4); } },
  ww: { setor: 'seguranca', dado: false, efeito: (s, ctx) => { s.bonusGate += 1; ctx.log('log.WHITNEY'); } },
};
export const CEO_IDS = Object.keys(CEOS);

// ─── Auxiliares ─────────────────────────────────────────────

const atual = (s) => s.ordem[s.pos];
const total = (su) => su.acoes.reduce((a, b) => a + b, 0);
/** Ações de um jogador em startups vivas (as implodidas não contam para o limite). */
export const totalAcoes = (s, seat) => s.startups.reduce((a, su) => a + (su.implodida ? 0 : su.acoes[seat]), 0);
const salarioDe = (s, w) => (NIVEIS[w.nivel].salario > 0 ? NIVEIS[w.nivel].salario + s.sobretaxa : 0);
const startup = (s, id) => s.startups.find((x) => x.id === id);
const tem = (j, su, tipo) => j.trab.some((w) => w.startup === su && w.tipo === tipo);

export const acoesDe = (s, seat) => s.startups.map((su) => ({ id: su.id, n: su.acoes[seat] })).filter((x) => x.n > 0);

export function pontuar(s, seat) {
  let t = s.jogadores[seat].cash;
  for (const su of s.startups) if (!su.implodida) t += su.acoes[seat] * su.preco;
  return t;
}

/** Joga primeiro quem tem ações na startup mais cara; sem ações joga no fim; empates mantêm a ordem anterior. */
export function calcularOrdem(s) {
  const melhor = (seat) => Math.max(0, ...s.startups.filter((su) => !su.implodida && su.acoes[seat] > 0).map((su) => su.preco));
  return s.ordem.slice().sort((a, b) => melhor(b) - melhor(a) || s.ordem.indexOf(a) - s.ordem.indexOf(b));
}

// ─── Preparação ─────────────────────────────────────────────

export function setup(ctx) {
  const n = ctx.numPlayers;
  const pool = [];
  for (const tipo of TIPOS) {
    const nomes = ctx.rng.shuffle([...NOMES[tipo]]);
    for (let i = 0; i < n; i++) pool.push({ id: `${tipo}_${i}`, tipo, nome: nomes[i] }); // uma cópia de cada tipo por jogador: ninguém fica sem
  }
  const baralho = ctx.rng.shuffle([...CEO_IDS]);
  const primeiro = ctx.rng.int(n);
  const s = {
    n,
    jogadores: Array.from({ length: n }, () => ({ cash: CASH_INICIAL, trab: [] })),
    startups: STARTUPS.map((x) => ({ ...x, preco: x.base, acoes: Array(n).fill(0), implodida: false })),
    setores: Object.fromEntries(SETORES.map((x) => [x, 0])),
    baralho,
    idx: 0,
    ceo: null,
    pool,
    ronda: 1,
    ordem: Array.from({ length: n }, (_, i) => (primeiro + i) % n),
    pos: 0,
    fase: 'MERCADO', // MERCADO | MANUTENCAO | FIM
    gate: { aberto: false, mult: 1 },
    bonusGate: 0,
    seguro: false,
    sobretaxa: 0,
    penalizacao: null,
    pagos: [], // trabalhadores cujo salário já foi tratado neste turno
    compradas: [], // startups em que o jogador da vez comprou neste turno
    proposta: null, // troca à espera de resposta
    dividendos: [],
    variacoes: {}, // variação de preço de cada startup causada pelo CEO da ronda
    acabou: false,
  };
  ctx.log('log.RONDA', { n: 1 });
  comecarRonda(s, ctx);
  return s;
}

function comecarRonda(s, ctx) {
  const antes = Object.fromEntries(s.startups.map((x) => [x.id, x.preco]));
  s.seguro = false;
  s.sobretaxa = 0;
  if (s.penalizacao) {
    mexer(s, ctx, s.penalizacao.setor, s.penalizacao.d);
    s.penalizacao = null;
  }
  const id = s.baralho[s.idx];
  s.idx += 1;
  const ceo = CEOS[id];
  const dado = ceo.dado ? 1 + ctx.rng.int(6) : null;
  s.ceo = { id, dado };
  mexer(s, ctx, ceo.setor, 1);
  ctx.log('log.CEO', { ceo: `@ceo.${id}`, setor: `@setor.${ceo.setor}`, dado: dado ?? '' });
  if (dado) ctx.log('log.DADO', { n: dado });
  ceo.efeito(s, ctx, dado);
  s.variacoes = Object.fromEntries(s.startups.map((x) => [x.id, x.implodida ? 0 : x.preco - antes[x.id]]));

  const base = GATE_BASE[s.idx];
  if (base) {
    const arq = CEO_ALTO.includes(id) ? MULT_ALTO : CEO_BAIXO.includes(id) ? MULT_BAIXO : 1;
    s.gate = { aberto: true, mult: Math.max(1, Math.round(base * arq)) + s.bonusGate };
    ctx.log('log.GATE', { mult: s.gate.mult, ceo: `@ceo.${id}` }, { announce: { key: 'msg.GATE', params: { mult: s.gate.mult } } });
  } else {
    s.gate = { aberto: false, mult: 1 };
  }
}

/** Quanto rende um trabalhador por ronda ao seu dono: por ação (Engenheiro, Advogado, PR) ou fixo (CFO). */
export function rendimento(s, seat, w) {
  const su = startup(s, w.startup);
  if (!su || su.implodida) return 0;
  const m = NIVEIS[w.nivel].mult;
  return w.tipo === 'cfo' ? FIXO_CFO * m : su.acoes[seat] * DIVIDENDO[w.tipo] * m;
}

/** Dividendos de um jogador por startup viva onde tem trabalhadores (os mesmos que se pagam no fim da ronda). */
export function dividendosDe(s, seat) {
  const out = [];
  for (const su of s.startups) {
    if (su.implodida) continue;
    const meus = s.jogadores[seat].trab.filter((w) => w.startup === su.id);
    const ganho = meus.reduce((a, w) => a + rendimento(s, seat, w), 0);
    if (ganho > 0) out.push({ seat, startup: su.id, acoes: su.acoes[seat], ganho });
  }
  return out;
}

function fimDeRonda(s, ctx) {
  s.dividendos = [];
  s.jogadores.forEach((j, seat) => {
    const lista = dividendosDe(s, seat);
    const soma = lista.reduce((a, d) => a + d.ganho, 0);
    j.cash += soma;
    s.dividendos.push(...lista);
    if (soma > 0) ctx.log('log.DIVIDENDOS', { lugar: seat + 1, n: soma });
  });
  s.ronda += 1;
}

/** Dado do salário: com 6 o trabalhador fica (sem receber), com outro número vai-se embora e volta à pool. */
function dadoDoSalario(s, ctx, j, w, sal, arriscou) {
  const dado = 1 + ctx.rng.int(6);
  if (dado === 6) {
    ctx.log(arriscou ? 'log.ARRISCOU_FICA' : 'log.FICA', { nome: w.nome, sal, dado }, { announce: { variant: 'warn', key: 'msg.FICA', params: { nome: w.nome, dado } } });
  } else {
    j.trab.splice(j.trab.indexOf(w), 1);
    s.pool.push({ id: w.id, tipo: w.tipo, nome: w.nome });
    ctx.log(arriscou ? 'log.ARRISCOU_SAI' : 'log.ABANDONOU', { nome: w.nome, sal, dado }, { announce: { variant: 'warn', key: 'msg.ABANDONOU', params: { nome: w.nome, dado } } });
  }
  s.pagos.push(w.id);
}

/** Salários ainda por decidir neste turno. */
const porPagar = (s, seat) => s.jogadores[seat].trab.filter((w) => salarioDe(s, w) > 0 && !s.pagos.includes(w.id));

/**
 * Ao terminar o turno cobra o que o jogador não decidiu: paga se houver cash; se não houver, lança o dado.
 * (Pagar é opcional: ele pode antes pagar um a um com SP_PAY_SALARY ou arriscar com SP_RISK_SALARY.)
 */
function liquidar(s, ctx, seat) {
  const j = s.jogadores[seat];
  let pago = 0;
  for (const w of porPagar(s, seat)) {
    const sal = salarioDe(s, w);
    if (j.cash >= sal) {
      j.cash -= sal;
      pago += sal;
      s.pagos.push(w.id);
    } else {
      dadoDoSalario(s, ctx, j, w, sal, false);
    }
  }
  recalcular(s);
  if (pago > 0) ctx.log('log.SALARIOS', { n: pago });
  return pago;
}

// ─── Jogadas ────────────────────────────────────────────────

export const activePlayers = (s) => (s.acabou ? [] : s.proposta ? [s.proposta.para] : [atual(s)]);

const naVez = (s, ctx, fase) => {
  if (s.proposta) return ctx.invalid('err.PROPOSTA_PENDENTE');
  if (ctx.seat !== atual(s)) return ctx.invalid('err.NAO_E_A_TUA_VEZ');
  if (s.fase !== fase) return ctx.invalid('err.FASE');
  return null;
};

export const moves = {
  SP_BUY(s, { startup: id, qty = 1 }, ctx) {
    const e = naVez(s, ctx, 'MERCADO');
    if (e) return e;
    const su = startup(s, id);
    if (!su || su.implodida) return ctx.invalid('err.STARTUP');
    if (!Number.isInteger(qty) || qty < 1) return ctx.invalid('err.QTD');
    const j = s.jogadores[ctx.seat];
    if (su.acoes[ctx.seat] + qty > MAX_ACOES) return ctx.invalid('err.MAX_ACOES', { max: MAX_ACOES, tens: su.acoes[ctx.seat] });
    if (totalAcoes(s, ctx.seat) + qty > MAX_ACOES_TOTAL) return ctx.invalid('err.MAX_TOTAL', { max: MAX_ACOES_TOTAL });
    const custo = su.preco * qty;
    if (j.cash < custo) return ctx.invalid('err.CASH', { preciso: custo, tens: j.cash });
    j.cash -= custo;
    su.acoes[ctx.seat] += qty;
    if (!s.compradas.includes(su.id)) s.compradas.push(su.id);
    ctx.log('log.BUY', { qty, startup: `@startup.${su.id}`, custo });
  },

  /** Venda livre no mercado: ao preço atual, sem multiplicador, a qualquer momento da fase de Mercado. */
  SP_SELL_MARKET(s, { startup: id, qty }, ctx) {
    const e = naVez(s, ctx, 'MERCADO');
    if (e) return e;
    const su = startup(s, id);
    if (!su) return ctx.invalid('err.STARTUP');
    if (su.implodida) return ctx.invalid('err.IMPLODIDA');
    const tenho = su.acoes[ctx.seat];
    if (!tenho) return ctx.invalid('err.SEM_ACOES');
    const q = qty === undefined ? tenho : qty;
    if (!Number.isInteger(q) || q < 1 || q > tenho) return ctx.invalid('err.QTD');
    const ganho = su.preco * q;
    s.jogadores[ctx.seat].cash += ganho;
    su.acoes[ctx.seat] -= q;
    ctx.log('log.SELL_MARKET', { qty: q, startup: `@startup.${su.id}`, ganho });
  },

  /** Venda da startup no Gate: exige maioria real (mais de 50% das ações emitidas). */
  SP_SELL_STARTUP(s, { startup: id }, ctx) {
    const e = naVez(s, ctx, 'MERCADO');
    if (e) return e;
    if (!s.gate.aberto) return ctx.invalid('err.GATE_FECHADO');
    const su = startup(s, id);
    if (!su) return ctx.invalid('err.STARTUP');
    if (su.implodida) return ctx.invalid('err.IMPLODIDA');
    const tenho = su.acoes[ctx.seat];
    if (!tenho) return ctx.invalid('err.SEM_ACOES');
    if (tenho * 2 <= total(su)) return ctx.invalid('err.MAIORIA');
    if (s.compradas.includes(su.id)) return ctx.invalid('err.COMPRADA_NO_TURNO');
    const ganho = Math.round(su.preco * tenho * s.gate.mult);
    s.jogadores[ctx.seat].cash += ganho;
    su.acoes[ctx.seat] = 0;
    ctx.log('log.SELL_STARTUP', { startup: `@startup.${su.id}`, mult: s.gate.mult, ganho });
  },

  /** Proposta de troca no Gate: todas as ações de uma startup por todas as de outra, se o outro jogador aceitar. */
  SP_TRADE_PROPOSE(s, { de, para, por }, ctx) {
    const e = naVez(s, ctx, 'MERCADO');
    if (e) return e;
    if (!s.gate.aberto) return ctx.invalid('err.GATE_FECHADO');
    if (!Number.isInteger(para) || para === ctx.seat || !s.jogadores[para]) return ctx.invalid('err.ALVO');
    const a = startup(s, de);
    const b = startup(s, por);
    if (!a || !b || a === b || a.implodida || b.implodida) return ctx.invalid('err.STARTUP');
    const mine = a.acoes[ctx.seat];
    const deles = b.acoes[para];
    if (!mine || !deles) return ctx.invalid('err.TROCA_SEM_ACOES');
    if (b.acoes[ctx.seat] + deles > MAX_ACOES || a.acoes[para] + mine > MAX_ACOES) return ctx.invalid('err.MAX_ACOES', { max: MAX_ACOES });
    if (totalAcoes(s, ctx.seat) - mine + deles > MAX_ACOES_TOTAL || totalAcoes(s, para) - deles + mine > MAX_ACOES_TOTAL) return ctx.invalid('err.MAX_TOTAL', { max: MAX_ACOES_TOTAL });
    s.proposta = { de: ctx.seat, para, dar: a.id, receber: b.id };
    ctx.log('log.TRADE_PROPOSE', { dar: `@startup.${a.id}`, receber: `@startup.${b.id}`, para: para + 1 });
  },

  SP_TRADE_ACCEPT(s, _p, ctx) {
    const p = s.proposta;
    if (!p || ctx.seat !== p.para) return ctx.invalid('err.SEM_PROPOSTA');
    const a = startup(s, p.dar);
    const b = startup(s, p.receber);
    const mine = a.acoes[p.de];
    const deles = b.acoes[p.para];
    a.acoes[p.de] = 0;
    a.acoes[p.para] += mine;
    b.acoes[p.para] = 0;
    b.acoes[p.de] += deles;
    s.proposta = null;
    ctx.log('log.TRADE_ACCEPT', { de: p.de + 1 });
  },

  SP_TRADE_REJECT(s, _p, ctx) {
    const p = s.proposta;
    if (!p || ctx.seat !== p.para) return ctx.invalid('err.SEM_PROPOSTA');
    s.proposta = null;
    ctx.log('log.TRADE_REJECT', { de: p.de + 1 });
  },

  SP_END_MARKET(s, _p, ctx) {
    const e = naVez(s, ctx, 'MERCADO');
    if (e) return e;
    s.fase = 'MANUTENCAO';
  },

  SP_HIRE(s, { worker, startup: id }, ctx) {
    const e = naVez(s, ctx, 'MANUTENCAO');
    if (e) return e;
    const w = s.pool.find((x) => x.id === worker);
    if (!w) return ctx.invalid('err.TRABALHADOR');
    const su = startup(s, id);
    if (!su || su.implodida) return ctx.invalid('err.STARTUP');
    const j = s.jogadores[ctx.seat];
    if (tem(j, su.id, w.tipo)) return ctx.invalid('err.TIPO_REPETIDO');
    const nivel = nivelPara(j.trab.length);
    const custo = NIVEIS[nivel].custo;
    if (j.cash < custo) return ctx.invalid('err.CASH', { preciso: custo, tens: j.cash });
    j.cash -= custo;
    s.pool.splice(s.pool.indexOf(w), 1);
    j.trab.push({ id: w.id, tipo: w.tipo, nome: w.nome, startup: su.id, nivel });
    recalcular(s);
    ctx.log('log.HIRE', { nome: w.nome, tipo: `@tipo.${w.tipo}`, nivel: `@nivel.${NIVEIS[nivel].id}`, startup: `@startup.${su.id}` });
  },

  SP_FIRE(s, { worker }, ctx) {
    const e = naVez(s, ctx, 'MANUTENCAO');
    if (e) return e;
    const j = s.jogadores[ctx.seat];
    const i = j.trab.findIndex((x) => x.id === worker);
    if (i < 0) return ctx.invalid('err.TRABALHADOR');
    const [w] = j.trab.splice(i, 1);
    s.pool.push({ id: w.id, tipo: w.tipo, nome: w.nome });
    recalcular(s);
    ctx.log('log.FIRE', { nome: w.nome });
  },

  /** Muda um trabalhador de startup, com indemnização (1M Estagiário, 2M Sénior). */
  SP_MOVE_WORKER(s, { worker, startup: id }, ctx) {
    const e = naVez(s, ctx, 'MANUTENCAO');
    if (e) return e;
    const j = s.jogadores[ctx.seat];
    const w = j.trab.find((x) => x.id === worker);
    if (!w) return ctx.invalid('err.TRABALHADOR');
    const su = startup(s, id);
    if (!su || su.implodida || su.id === w.startup) return ctx.invalid('err.STARTUP');
    if (tem(j, su.id, w.tipo)) return ctx.invalid('err.TIPO_REPETIDO');
    const custo = Math.max(1, NIVEIS[w.nivel].salario);
    if (j.cash < custo) return ctx.invalid('err.CASH', { preciso: custo, tens: j.cash });
    j.cash -= custo;
    w.startup = su.id;
    recalcular(s);
    ctx.log('log.MOVE', { nome: w.nome, startup: `@startup.${su.id}`, custo });
  },

  /** Paga o salário de um trabalhador (`worker`) ou, sem `worker`, de todos os que o cash deixar pagar. */
  SP_PAY_SALARY(s, { worker } = {}, ctx) {
    const e = naVez(s, ctx, 'MANUTENCAO');
    if (e) return e;
    const j = s.jogadores[ctx.seat];
    const pendentes = porPagar(s, ctx.seat).filter((w) => worker === undefined || w.id === worker);
    if (!pendentes.length) return ctx.invalid('err.SEM_SALARIOS');
    let pago = 0;
    for (const w of pendentes) {
      const sal = salarioDe(s, w);
      if (j.cash < sal) continue;
      j.cash -= sal;
      pago += sal;
      s.pagos.push(w.id);
    }
    if (!pago) return ctx.invalid('err.CASH', { preciso: salarioDe(s, pendentes[0]), tens: j.cash });
    ctx.log('log.SALARIOS', { n: pago });
  },

  /** Não paga o salário de um trabalhador e arrisca: dado, com 6 ele fica (sem receber), com outro número sai. */
  SP_RISK_SALARY(s, { worker }, ctx) {
    const e = naVez(s, ctx, 'MANUTENCAO');
    if (e) return e;
    const j = s.jogadores[ctx.seat];
    const w = porPagar(s, ctx.seat).find((x) => x.id === worker);
    if (!w) return ctx.invalid('err.SEM_SALARIOS');
    dadoDoSalario(s, ctx, j, w, salarioDe(s, w), true);
    recalcular(s);
  },

  /** Passa a vez. Os salários por pagar são cobrados aqui. No fim da última vez da ronda pagam-se os dividendos e entra o CEO seguinte. */
  SP_END_TURN(s, _p, ctx) {
    const e = naVez(s, ctx, 'MANUTENCAO');
    if (e) return e;
    liquidar(s, ctx, ctx.seat);
    s.pagos = [];
    s.compradas = [];
    s.pos += 1;
    if (s.pos >= s.n) {
      fimDeRonda(s, ctx);
      if (s.idx >= RONDAS) {
        s.fase = 'FIM';
        s.acabou = true;
        ctx.log('log.FIM');
        return;
      }
      ctx.log('log.RONDA', { n: s.ronda });
      comecarRonda(s, ctx);
      s.ordem = calcularOrdem(s);
      s.pos = 0;
    }
    s.fase = 'MERCADO';
  },
};

// ─── Leitura ────────────────────────────────────────────────

export function enumerate(s, seat) {
  if (s.acabou) return [];
  if (s.proposta) {
    return s.proposta.para === seat ? [{ type: 'SP_TRADE_ACCEPT', payload: {} }, { type: 'SP_TRADE_REJECT', payload: {} }] : [];
  }
  if (atual(s) !== seat) return [];
  const j = s.jogadores[seat];
  const out = [];
  const vivas = s.startups.filter((x) => !x.implodida);
  if (s.fase === 'MERCADO') {
    for (const su of vivas) {
      const mine = su.acoes[seat];
      for (let q = 1; q <= Math.min(MAX_ACOES - mine, MAX_ACOES_TOTAL - totalAcoes(s, seat)) && su.preco * q <= j.cash; q++) out.push({ type: 'SP_BUY', payload: { startup: su.id, qty: q } });
      for (let q = 1; q <= mine; q++) out.push({ type: 'SP_SELL_MARKET', payload: { startup: su.id, qty: q } });
      if (s.gate.aberto && mine && mine * 2 > total(su) && !s.compradas.includes(su.id)) out.push({ type: 'SP_SELL_STARTUP', payload: { startup: su.id } });
    }
    if (s.gate.aberto) {
      for (const a of vivas.filter((x) => x.acoes[seat] > 0)) {
        for (const b of vivas) {
          if (a === b) continue;
          for (let para = 0; para < s.n; para++) {
            if (para === seat || !b.acoes[para]) continue;
            if (b.acoes[seat] + b.acoes[para] > MAX_ACOES || a.acoes[para] + a.acoes[seat] > MAX_ACOES) continue;
            if (totalAcoes(s, seat) - a.acoes[seat] + b.acoes[para] > MAX_ACOES_TOTAL || totalAcoes(s, para) - b.acoes[para] + a.acoes[seat] > MAX_ACOES_TOTAL) continue;
            out.push({ type: 'SP_TRADE_PROPOSE', payload: { de: a.id, para, por: b.id } });
          }
        }
      }
    }
    out.push({ type: 'SP_END_MARKET', payload: {} });
  } else {
    // Um candidato por tipo: os 3 da pool são equivalentes (só o nome muda).
    const livres = TIPOS.map((t) => s.pool.find((w) => w.tipo === t)).filter(Boolean);
    if (j.cash >= NIVEIS[nivelPara(j.trab.length)].custo) {
      for (const w of livres) {
        for (const su of vivas) {
          if (tem(j, su.id, w.tipo)) continue;
          out.push({ type: 'SP_HIRE', payload: { worker: w.id, startup: su.id } });
        }
      }
    }
    for (const w of j.trab) {
      out.push({ type: 'SP_FIRE', payload: { worker: w.id } });
      const custo = Math.max(1, NIVEIS[w.nivel].salario);
      if (j.cash < custo) continue;
      for (const su of vivas) if (su.id !== w.startup && !tem(j, su.id, w.tipo)) out.push({ type: 'SP_MOVE_WORKER', payload: { worker: w.id, startup: su.id } });
    }
    const pendentes = porPagar(s, seat);
    if (pendentes.some((w) => j.cash >= salarioDe(s, w))) out.push({ type: 'SP_PAY_SALARY', payload: {} });
    for (const w of pendentes) {
      if (j.cash >= salarioDe(s, w)) out.push({ type: 'SP_PAY_SALARY', payload: { worker: w.id } });
      out.push({ type: 'SP_RISK_SALARY', payload: { worker: w.id } });
    }
    out.push({ type: 'SP_END_TURN', payload: {} });
  }
  return out;
}

/** Só o cash dos outros jogadores é escondido; ações, trabalhadores e pool são públicos. */
export function view(s, seat) {
  const meu = seat != null && seat >= 0 && s.jogadores[seat];
  return {
    n: s.n,
    ronda: s.ronda,
    rondas: RONDAS,
    ordem: s.ordem,
    pos: s.pos,
    vez: s.acabou ? null : atual(s),
    fase: s.fase,
    ceo: s.ceo,
    gate: s.gate,
    seguro: s.seguro,
    sobretaxa: s.sobretaxa,
    bonusGate: s.bonusGate,
    penalizacao: s.penalizacao,
    setores: s.setores,
    startups: s.startups.map((su) => ({ ...su, protegida: protegida(s, su.id), bonusPr: bonusPr(s, su.id) })),
    variacoes: s.variacoes,
    pool: s.pool,
    pagos: s.pagos,
    compradas: s.compradas,
    proposta: s.proposta,
    dividendos: s.dividendos,
    maxAcoes: MAX_ACOES,
    maxAcoesTotal: MAX_ACOES_TOTAL,
    niveis: NIVEIS,
    gateBase: GATE_BASE,
    jogadores: s.jogadores.map((j, i) => ({
      cash: i === seat ? j.cash : null,
      trab: j.trab.map((w) => ({ ...w, rende: rendimento(s, i, w), salario: salarioDe(s, w), pago: s.pagos.includes(w.id) })),
      acoes: acoesDe(s, i),
      totalAcoes: totalAcoes(s, i),
      previsao: dividendosDe(s, i),
    })),
    meuCash: meu ? meu.cash : null,
    meuPatrimonio: meu ? pontuar(s, seat) : null,
    proximo: meu ? { nivel: nivelPara(meu.trab.length), ...NIVEIS[nivelPara(meu.trab.length)] } : null,
    meusSalarios: meu ? meu.trab.reduce((a, w) => a + salarioDe(s, w), 0) : null,
    acabou: s.acabou,
    players: s.jogadores.map((j, i) => ({
      score: s.acabou ? pontuar(s, i) : undefined,
      summary: `👷${j.trab.length} 📈${s.startups.reduce((a, su) => a + su.acoes[i], 0)}`,
    })),
  };
}

export function result(s) {
  if (!s.acabou) return null;
  const scores = s.jogadores.map((_, i) => pontuar(s, i));
  const max = Math.max(...scores);
  return { scores, winners: scores.flatMap((x, i) => (x === max ? [i] : [])) };
}

export function describeMove(move) {
  const p = move.payload || {};
  if (move.type === 'SP_BUY') return { key: 'moveLabel.SP_BUY', params: { qty: p.qty ?? 1, startup: `@startup.${p.startup}` } };
  if (move.type === 'SP_SELL_MARKET') return { key: 'moveLabel.SP_SELL_MARKET', params: { qty: p.qty ?? '', startup: `@startup.${p.startup}` } };
  if (move.type === 'SP_SELL_STARTUP') return { key: 'moveLabel.SP_SELL_STARTUP', params: { startup: `@startup.${p.startup}` } };
  if (move.type === 'SP_TRADE_PROPOSE') return { key: 'moveLabel.SP_TRADE_PROPOSE', params: { dar: `@startup.${p.de}`, receber: `@startup.${p.por}`, para: p.para + 1 } };
  if (move.type === 'SP_HIRE') return { key: 'moveLabel.SP_HIRE', params: { tipo: `@tipo.${String(p.worker).split('_')[0]}`, startup: `@startup.${p.startup}` } };
  if (move.type === 'SP_PAY_SALARY' && p.worker) return { key: 'moveLabel.SP_PAY_ONE', params: {} };
  if (move.type === 'SP_RISK_SALARY') return { key: 'moveLabel.SP_RISK_SALARY', params: {} };
  if (move.type === 'SP_MOVE_WORKER') return { key: 'moveLabel.SP_MOVE_WORKER', params: { startup: `@startup.${p.startup}` } };
  return { key: `move.${move.type}`, params: {} };
}
