// Regras do Bulbous (ver REGRAS.md), migradas do servidor antigo (game.js).
// Regras puras: estado JSON, aleatoriedade por ctx.rng, o tempo do
// desempate por ctx.schedule + events.

export const CORES = ['red', 'blue', 'green', 'yellow'];
export const SIMBOLO = { red: 'triangle', yellow: 'triangle', blue: 'circle', green: 'circle' };
export const DESEMPATE_MS = 20_000; // tempo dos empatados para jogar uma carta extra

/** Baralho de Charme: 28 numéricas (3–9 por cor) + 4 Duplos + 2 Jokers = 34. */
export function baralhoCharme() {
  const d = [];
  let id = 0;
  for (const cor of CORES) {
    for (const valor of [3, 4, 5, 6, 7, 8, 9]) d.push({ id: ++id, tipo: 'numero', cor, simbolo: null, valor });
    d.push({ id: ++id, tipo: 'duplo', cor, simbolo: null, valor: null });
  }
  d.push({ id: ++id, tipo: 'joker', cor: null, simbolo: 'circle', valor: null });
  d.push({ id: ++id, tipo: 'joker', cor: null, simbolo: 'triangle', valor: null });
  return d;
}

/** 4 Baelfungious por cor: Juvenil (1 espaço), Adulto (2), Bailio (3), Líder (4). */
function baelfs(cores, dono) {
  return cores.flatMap((cor) => [1, 2, 3, 4].map((espacos) => ({ cor, simbolo: SIMBOLO[cor], espacos, bolbos: [], completa: false, dono })));
}

// ─── Preparação ───────────────────────────────────────────────
export function setup(ctx) {
  const n = ctx.numPlayers;
  const modo = n === 2 ? '2p' : ctx.options?.equipas ? '2v2' : '4p';
  const is2p = modo === '2p';
  const limiteMao = is2p ? 9 : 7;
  const posicoes = is2p ? 2 : 1; // Baelfungious ativas por jogador
  const baralho = ctx.rng.shuffle(baralhoCharme());

  let cores;
  if (is2p) {
    cores = ctx.rng.shuffle(['triangle', 'circle']).map((s) => (s === 'triangle' ? 'red' : 'blue'));
  } else if (modo === '2v2') {
    // Equipas fixas por símbolo, sentadas intercaladas (lugares 0 e 2 contra 1 e 3).
    const circuloPar = ctx.rng.chance(0.5);
    const circulo = ctx.rng.shuffle(['blue', 'green']);
    const triangulo = ctx.rng.shuffle(['red', 'yellow']);
    cores = Array.from({ length: n }, (_, i) => ((i % 2 === 0) === circuloPar ? circulo.shift() : triangulo.shift()));
  } else {
    cores = ctx.rng.shuffle([...CORES]).slice(0, n);
  }

  const jogadores = cores.map((cor, i) => {
    const simbolo = SIMBOLO[cor];
    const minhas = is2p ? (simbolo === 'triangle' ? ['red', 'yellow'] : ['blue', 'green']) : [cor];
    return {
      cor, simbolo,
      equipa: modo === '2v2' ? simbolo : null,
      mao: baralho.splice(0, limiteMao),
      baelfs: baelfs(minhas, i),
      ativas: Array(posicoes).fill(null), // índice em baelfs, ou null
      fimAtivado: false,
    };
  });

  const porEscolher = [];
  for (let j = 0; j < n; j++) for (let p = 0; p < posicoes; p++) porEscolher.push({ jogador: j, posicao: p });

  return {
    modo, n, limiteMao, posicoes, baralho, descarte: [], jogadores,
    fase: 'ESCOLHER',
    governante: ctx.rng.int(n),
    ronda: 1,
    fimDisparado: false,
    porEscolher,                 // quem ainda tem de ativar uma Baelfungious
    sequencia: null,             // ordem das vazas da ronda, declarada de uma vez
    vazaNum: 0,
    vaza: null,
    completaNaRonda: false,
    ultimaVaza: null,
    pontuacao: null,
    equipas: null,
  };
}

// ─── Utilitários ──────────────────────────────────────────────
function comprar(s, n, ctx) {
  const out = [];
  while (out.length < n) {
    if (!s.baralho.length && s.descarte.length) {
      s.baralho = ctx.rng.shuffle(s.descarte);
      s.descarte = [];
      ctx.log('log.BARALHO_REFEITO');
    }
    if (!s.baralho.length) break;
    out.push(s.baralho.shift());
  }
  return out;
}

export function ativas(s) {
  const out = [];
  s.jogadores.forEach((p, jogador) => p.ativas.forEach((b, posicao) => {
    if (b !== null) out.push({ jogador, posicao, baelf: p.baelfs[b] });
  }));
  return out;
}

/** Uma carta joga-se se tiver a cor da Baelfungious (Joker: o símbolo). */
export const podeJogar = (c, b) => (c.tipo === 'joker' ? c.simbolo === b.simbolo : c.cor === b.cor);

/** Valor de uma aposta. O Joker ganha logo (total 1000: mais do que qualquer soma). */
export function valorAposta(cartas, b) {
  if (!cartas?.length) return { total: 0, joker: false };
  if (cartas.some((c) => c.tipo === 'joker')) return { total: 1000, joker: true };
  const soma = cartas.reduce((t, c) => t + (c.tipo === 'numero' ? c.valor : 0), 0);
  const duplo = cartas.some((c) => c.tipo === 'duplo' && c.cor === b.cor);
  return { total: duplo ? soma * 2 : soma, joker: false };
}

export function alvo(s) {
  const p = s.jogadores[s.vaza.alvoJogador];
  return p.baelfs[p.ativas[s.vaza.alvoPosicao]];
}

/** Candidatas para a primeira posição por preencher de um jogador. */
export function candidatas(s, jogador) {
  const p = s.jogadores[jogador];
  const coresAtivas = s.posicoes > 1 ? p.ativas.filter((b) => b !== null).map((b) => p.baelfs[b].cor) : [];
  return p.baelfs.map((b, i) => i).filter((i) => !p.baelfs[i].completa && !p.ativas.includes(i) && !coresAtivas.includes(p.baelfs[i].cor));
}

// No jogo a 2, uma posição pode ficar sem nenhuma opção (as 2 cores têm de ser
// diferentes): sai da lista, senão o jogo ficava à espera para sempre.
function podarImpossiveis(s) {
  if (s.posicoes <= 1) return;
  s.porEscolher = s.porEscolher.filter((r) => candidatas(s, r.jogador).length > 0);
}

const tirarDaMao = (p, ids) => ids.map((id) => p.mao.splice(p.mao.findIndex((c) => c.id === id), 1)[0]);
const temTodas = (p, ids) => Array.isArray(ids) && new Set(ids).size === ids.length && ids.every((id) => p.mao.some((c) => c.id === id));

// ─── Escolher Baelfungious (início e depois de uma ficar completa) ─
function escolher(s, { baelf }, ctx) {
  const j = ctx.seat;
  const k = s.porEscolher.findIndex((r) => r.jogador === j);
  if (k < 0) return ctx.invalid('err.SEM_ESCOLHA');
  const p = s.jogadores[j];
  const b = p.baelfs[baelf];
  if (!b) return ctx.invalid('err.BAELF_INVALIDA');
  if (b.completa) return ctx.invalid('err.BAELF_COMPLETA');
  if (p.ativas.includes(baelf)) return ctx.invalid('err.BAELF_ATIVA');
  if (!candidatas(s, j).includes(baelf)) return ctx.invalid('err.MESMA_COR');

  p.ativas[s.porEscolher[k].posicao] = baelf;
  s.porEscolher.splice(k, 1);
  ctx.log('log.ESCOLHEU', { especime: `@esp.${b.espacos}`, cor: `@cor.${b.cor}` });
  podarImpossiveis(s);

  // Fim do jogo: quem traz a sua última Baelfungious para jogo dispara o fim (acaba a ronda).
  if (!s.porEscolher.some((r) => r.jogador === j) && !p.fimAtivado) {
    const reserva = p.baelfs.filter((x, i) => !x.completa && !p.ativas.includes(i));
    if (!reserva.length) {
      p.fimAtivado = true;
      s.fimDisparado = true;
      ctx.log('log.ULTIMA');
    }
  }
  if (!s.porEscolher.length) comecarRonda(s);
  return undefined;
}

function comecarRonda(s) {
  s.completaNaRonda = false;
  s.vazaNum = 0;
  s.sequencia = null;
  s.vaza = null;
  s.fase = 'SEQUENCIA';
}

// ─── Declarar a sequência da ronda (Governante) ──────────────
function declarar(s, { ordem }, ctx) {
  const at = ativas(s);
  if (!Array.isArray(ordem) || ordem.length !== at.length) return ctx.invalid('err.SEQUENCIA', { n: at.length });
  const vistas = new Set();
  for (const o of ordem) {
    const key = `${o?.jogador}-${o?.posicao}`;
    if (vistas.has(key) || !at.some((a) => a.jogador === o.jogador && a.posicao === o.posicao)) return ctx.invalid('err.SEQUENCIA', { n: at.length });
    vistas.add(key);
  }
  s.sequencia = ordem.map((o) => ({ jogador: o.jogador, posicao: o.posicao }));
  ctx.log('log.SEQUENCIA', { ordem: ordemTexto(s, s.sequencia) });
  comecarVaza(s);
  return undefined;
}

function comecarVaza(s) {
  const { jogador, posicao } = s.sequencia[s.vazaNum];
  s.vaza = {
    alvoJogador: jogador,
    alvoPosicao: posicao,
    ordem: Array.from({ length: s.n }, (_, i) => (s.governante + i) % s.n), // o Governante age primeiro
    atual: 0,
    apostas: Array(s.n).fill(null), // null = ainda não agiu; [] = não apostou
    acoes: Array(s.n).fill(null),   // 'aposta' | 'troca' | 'passa'
    revelada: false,
    empatados: [],
    cartasDesempate: Array(s.n).fill(null),
    desempateFeito: Array(s.n).fill(false),
    aDescartar: -1,
    excesso: 0,
  };
  s.fase = 'ACOES';
}

// ─── Ações da vaza ───────────────────────────────────────────
function apostar(s, { cartas }, ctx) {
  const v = s.vaza;
  if (v.aDescartar !== -1) return ctx.invalid('err.DESCARTA_PRIMEIRO');
  const p = s.jogadores[ctx.seat];
  if (!Array.isArray(cartas) || !cartas.length) return ctx.invalid('err.APOSTA_VAZIA');
  if (!temTodas(p, cartas)) return ctx.invalid('err.CARTA_NAO_ESTA');
  const b = alvo(s);
  if (!cartas.every((id) => podeJogar(p.mao.find((c) => c.id === id), b))) return ctx.invalid('err.CARTA_NAO_JOGA');
  v.apostas[ctx.seat] = tirarDaMao(p, cartas);
  v.acoes[ctx.seat] = 'aposta';
  ctx.log('log.APOSTOU', { n: cartas.length });
  proximo(s, ctx);
  return undefined;
}

function trocar(s, { cartas }, ctx) {
  const v = s.vaza;
  if (v.aDescartar !== -1) return ctx.invalid('err.DESCARTA_PRIMEIRO');
  const p = s.jogadores[ctx.seat];
  if (!Array.isArray(cartas) || cartas.length < 1 || cartas.length > 2) return ctx.invalid('err.TROCA');
  if (!temTodas(p, cartas)) return ctx.invalid('err.CARTA_NAO_ESTA');
  s.descarte.push(...tirarDaMao(p, cartas));
  p.mao.push(...comprar(s, cartas.length, ctx));
  v.apostas[ctx.seat] = [];
  v.acoes[ctx.seat] = 'troca';
  ctx.log('log.TROCOU', { n: cartas.length });
  proximo(s, ctx);
  return undefined;
}

function passar(s, _, ctx) {
  const v = s.vaza;
  if (v.aDescartar !== -1) return ctx.invalid('err.DESCARTA_PRIMEIRO');
  const p = s.jogadores[ctx.seat];
  p.mao.push(...comprar(s, 1, ctx));
  v.apostas[ctx.seat] = [];
  v.acoes[ctx.seat] = 'passa';
  ctx.log('log.PASSOU');
  // Acima do limite da mão, descarta antes de o próximo agir.
  if (p.mao.length > s.limiteMao) {
    v.aDescartar = ctx.seat;
    v.excesso = p.mao.length - s.limiteMao;
    return undefined;
  }
  proximo(s, ctx);
  return undefined;
}

function descartar(s, { cartas }, ctx) {
  const v = s.vaza;
  if (v.aDescartar !== ctx.seat) return ctx.invalid('err.NAO_DESCARTA');
  const p = s.jogadores[ctx.seat];
  if (!Array.isArray(cartas) || cartas.length !== v.excesso) return ctx.invalid('err.DESCARTE', { n: v.excesso });
  if (!temTodas(p, cartas)) return ctx.invalid('err.CARTA_NAO_ESTA');
  s.descarte.push(...tirarDaMao(p, cartas));
  v.aDescartar = -1;
  v.excesso = 0;
  proximo(s, ctx);
  return undefined;
}

function proximo(s, ctx) {
  s.vaza.atual++;
  if (s.vaza.atual >= s.n) revelar(s, ctx);
}

// ─── Revelação e desempate ───────────────────────────────────
function revelar(s, ctx) {
  const v = s.vaza;
  v.revelada = true;
  const b = alvo(s);
  const valores = s.jogadores.map((_, i) => (v.acoes[i] === 'aposta' && v.apostas[i]?.length ? valorAposta(v.apostas[i], b) : null));
  const apostadores = valores.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
  s.ultimaVaza = {
    ronda: s.ronda, vaza: s.vazaNum, alvoJogador: v.alvoJogador, alvoPosicao: v.alvoPosicao,
    apostas: v.apostas, acoes: v.acoes, valores, vencedor: null, empatados: [],
  };
  if (!apostadores.length) {
    ctx.log('log.NINGUEM');
    return fecharVaza(s, ctx);
  }
  const jokers = apostadores.filter((i) => valores[i].joker);
  const max = Math.max(...apostadores.map((i) => valores[i].total));
  const vencedores = jokers.length ? jokers : apostadores.filter((i) => valores[i].total === max);
  if (vencedores.length === 1) {
    bolbo(s, vencedores[0], ctx);
    s.ultimaVaza.vencedor = vencedores[0];
    descartarApostas(s);
    return fecharVaza(s, ctx);
  }
  v.empatados = vencedores;
  v.desempateFeito = s.jogadores.map((_, i) => !vencedores.includes(i));
  s.ultimaVaza.empatados = vencedores;
  s.fase = 'DESEMPATE';
  ctx.log('log.EMPATE', { n: vencedores.length });
  ctx.schedule('desempate', DESEMPATE_MS, 'FIM_DESEMPATE');
  return undefined;
}

function desempatar(s, { carta }, ctx) {
  const v = s.vaza;
  if (!v.empatados.includes(ctx.seat)) return ctx.invalid('err.NAO_EMPATADO');
  if (v.desempateFeito[ctx.seat]) return ctx.invalid('err.JA_DESEMPATOU');
  if (carta != null) {
    const p = s.jogadores[ctx.seat];
    const c = p.mao.find((x) => x.id === carta);
    if (!c) return ctx.invalid('err.CARTA_NAO_ESTA');
    if (c.cor !== alvo(s).cor) return ctx.invalid('err.DESEMPATE_COR');
    v.cartasDesempate[ctx.seat] = tirarDaMao(p, [carta])[0];
  }
  v.desempateFeito[ctx.seat] = true;
  if (v.empatados.every((i) => v.desempateFeito[i])) {
    ctx.cancel('desempate');
    resolverDesempate(s, ctx);
  }
  return undefined;
}

function resolverDesempate(s, ctx) {
  const v = s.vaza;
  const jogaram = v.empatados.filter((i) => v.cartasDesempate[i] !== null);
  for (const i of jogaram) s.descarte.push(v.cartasDesempate[i]);
  let vencedor = null;
  if (jogaram.length) {
    // Só quem jogou uma carta pode ganhar: aposta original + valor da carta (o Duplo vale 0).
    const totais = jogaram.map((i) => ({ i, t: s.ultimaVaza.valores[i].total + (v.cartasDesempate[i].valor || 0) }));
    const max = Math.max(...totais.map((x) => x.t));
    const top = totais.filter((x) => x.t === max);
    if (top.length === 1) vencedor = top[0].i;
  }
  s.ultimaVaza.vencedorDesempate = vencedor;
  s.ultimaVaza.cartasDesempate = [...v.cartasDesempate];
  if (vencedor !== null) bolbo(s, vencedor, ctx);
  else ctx.log('log.SEM_DESEMPATE');
  descartarApostas(s);
  fecharVaza(s, ctx);
}

function bolbo(s, jogador, ctx) {
  const b = alvo(s);
  b.bolbos.push(jogador);
  ctx.log('log.BOLBO', { jogador: jogador + 1, especime: `@esp.${b.espacos}`, cor: `@cor.${b.cor}` });
  if (b.bolbos.length >= b.espacos) {
    b.completa = true;
    s.completaNaRonda = true;
    ctx.log('log.COMPLETA', { especime: `@esp.${b.espacos}`, cor: `@cor.${b.cor}` });
  }
}

function descartarApostas(s) {
  for (const a of s.vaza.apostas) if (a?.length) s.descarte.push(...a);
}

function fecharVaza(s, ctx) {
  s.vazaNum++;
  if (s.vazaNum >= s.sequencia.length) return fimRonda(s, ctx);
  s.vaza = null;
  comecarVaza(s);
  return undefined;
}

// ─── Fim da ronda ────────────────────────────────────────────
function fimRonda(s, ctx) {
  s.vaza = null;
  s.vazaNum = 0;
  s.sequencia = null;
  s.fase = 'SEQUENCIA';

  // 1. Se alguma ficou completa, todos repõem a mão (o Governante primeiro).
  if (s.completaNaRonda) {
    for (let k = 0; k < s.n; k++) {
      const p = s.jogadores[(s.governante + k) % s.n];
      const falta = s.limiteMao - p.mao.length;
      if (falta > 0) p.mao.push(...comprar(s, falta, ctx));
    }
  }
  // 2. Alguém já trouxe a última Baelfungious: acaba nesta ronda.
  if (s.fimDisparado) return terminar(s, ctx);

  // 3. O Governante passa ao jogador à esquerda.
  s.governante = (s.governante + 1) % s.n;
  s.ronda++;
  s.completaNaRonda = false;
  ctx.log('log.RONDA', { ronda: s.ronda });

  // 4. As completas saem; cada dono escolhe a substituta (se ainda tiver alguma).
  const porEscolher = [];
  s.jogadores.forEach((p, j) => {
    const livres = [];
    p.ativas.forEach((b, posicao) => {
      if (b !== null && p.baelfs[b].completa) { p.ativas[posicao] = null; livres.push(posicao); }
    });
    if (!livres.length) return;
    let reserva = p.baelfs.filter((x, i) => !x.completa && !p.ativas.includes(i)).length;
    for (const posicao of livres) if (reserva-- > 0) porEscolher.push({ jogador: j, posicao });
    // Sem nada para trazer, este jogador já não traz mais nenhuma: dispara o fim.
    if (!porEscolher.some((r) => r.jogador === j) && !p.fimAtivado) {
      p.fimAtivado = true;
      s.fimDisparado = true;
    }
  });
  s.porEscolher = porEscolher;
  podarImpossiveis(s);
  if (s.porEscolher.length) s.fase = 'ESCOLHER';
  // Sem nenhuma Baelfungious ativa já não há vazas: o jogo acaba.
  if (s.fase === 'SEQUENCIA' && !ativas(s).length) return terminar(s, ctx);
  return undefined;
}

function terminar(s, ctx) {
  s.pontuacao = pontuar(s);
  s.equipas = s.modo === '2v2' ? resultadoEquipas(s, s.pontuacao) : null;
  s.fase = 'FIM';
  s.vaza = null;
  ctx.log('log.FIM');
}

// ─── Pontuação ───────────────────────────────────────────────
export function pontuar(s) {
  const sc = s.jogadores.map((_, i) => ({ jogador: i, bolbos: 0, maioria: 0, colecao: 0, total: 0, cores: [], especimes: [] }));
  const todas = s.jogadores.flatMap((p) => p.baelfs);
  // 1. Cada bolbo vale 1 ponto (completa ou não).
  for (const b of todas) for (const j of b.bolbos) sc[j].bolbos++;
  // 2. Maioria nas completas: +3 (empate: +1 a cada empatado).
  for (const b of todas) {
    if (!b.completa || !b.bolbos.length) continue;
    const conta = {};
    for (const j of b.bolbos) conta[j] = (conta[j] || 0) + 1;
    const max = Math.max(...Object.values(conta));
    const lideres = Object.keys(conta).filter((k) => conta[k] === max).map(Number);
    for (const l of lideres) {
      sc[l].maioria += lideres.length === 1 ? 3 : 1;
      if (!sc[l].cores.includes(b.cor)) sc[l].cores.push(b.cor);
      if (!sc[l].especimes.includes(b.espacos)) sc[l].especimes.push(b.espacos);
    }
  }
  // 3. Coleção: todas as cores +5; todos os espécimes +10.
  for (const x of sc) {
    if (x.cores.length >= 4) x.colecao += 5;
    if (x.especimes.length >= 4) x.colecao += 10;
    x.total = x.bolbos + x.maioria + x.colecao;
  }
  return sc;
}

function resultadoEquipas(s, sc) {
  const totais = {};
  for (const x of sc) totais[s.jogadores[x.jogador].equipa] = (totais[s.jogadores[x.jogador].equipa] || 0) + x.total;
  const max = Math.max(...Object.values(totais));
  return { totais, vencedoras: Object.keys(totais).filter((t) => totais[t] === max) };
}

// ─── Contrato ────────────────────────────────────────────────
export const moves = {
  ESCOLHER: (s, p, ctx) => (s.fase === 'ESCOLHER' ? escolher(s, p, ctx) : ctx.invalid('err.FASE')),
  DECLARAR: (s, p, ctx) => (s.fase === 'SEQUENCIA' ? declarar(s, p, ctx) : ctx.invalid('err.FASE')),
  APOSTAR: (s, p, ctx) => (s.fase === 'ACOES' ? apostar(s, p, ctx) : ctx.invalid('err.FASE')),
  TROCAR: (s, p, ctx) => (s.fase === 'ACOES' ? trocar(s, p, ctx) : ctx.invalid('err.FASE')),
  PASSAR: (s, p, ctx) => (s.fase === 'ACOES' ? passar(s, p, ctx) : ctx.invalid('err.FASE')),
  DESCARTAR: (s, p, ctx) => (s.fase === 'ACOES' ? descartar(s, p, ctx) : ctx.invalid('err.FASE')),
  DESEMPATAR: (s, p, ctx) => (s.fase === 'DESEMPATE' ? desempatar(s, p, ctx) : ctx.invalid('err.FASE')),
};

export const events = {
  // O tempo do desempate acabou: quem não jogou passa.
  FIM_DESEMPATE(s, _, ctx) {
    if (s.fase !== 'DESEMPATE') return;
    for (const i of s.vaza.empatados) s.vaza.desempateFeito[i] = true;
    resolverDesempate(s, ctx);
  },
};

export function activePlayers(s) {
  switch (s.fase) {
    case 'ESCOLHER': return [...new Set(s.porEscolher.map((r) => r.jogador))];
    case 'SEQUENCIA': return [s.governante];
    case 'ACOES': return [s.vaza.aDescartar !== -1 ? s.vaza.aDescartar : s.vaza.ordem[s.vaza.atual]];
    case 'DESEMPATE': return s.vaza.empatados.filter((i) => !s.vaza.desempateFeito[i]);
    default: return [];
  }
}

const subconjuntos = (arr, min = 1, max = arr.length) => {
  const out = [];
  const rec = (i, cur) => {
    if (cur.length >= min && cur.length <= max) out.push(cur);
    if (cur.length === max) return;
    for (let k = i; k < arr.length; k++) rec(k + 1, [...cur, arr[k]]);
  };
  rec(0, []);
  return out;
};

const permutacoes = (arr) => (arr.length <= 1 ? [arr] : arr.flatMap((x, i) => permutacoes([...arr.slice(0, i), ...arr.slice(i + 1)]).map((r) => [x, ...r])));

export function enumerate(s, lugar) {
  if (!activePlayers(s).includes(lugar)) return [];
  const p = s.jogadores[lugar];
  if (s.fase === 'ESCOLHER') return candidatas(s, lugar).map((baelf) => ({ type: 'ESCOLHER', payload: { baelf } }));
  if (s.fase === 'SEQUENCIA') {
    return permutacoes(ativas(s).map((a) => ({ jogador: a.jogador, posicao: a.posicao }))).map((ordem) => ({ type: 'DECLARAR', payload: { ordem } }));
  }
  if (s.fase === 'ACOES') {
    const ids = p.mao.map((c) => c.id);
    if (s.vaza.aDescartar === lugar) return subconjuntos(ids, s.vaza.excesso, s.vaza.excesso).map((cartas) => ({ type: 'DESCARTAR', payload: { cartas } }));
    const b = alvo(s);
    const jogaveis = p.mao.filter((c) => podeJogar(c, b)).map((c) => c.id);
    return [
      ...subconjuntos(jogaveis).map((cartas) => ({ type: 'APOSTAR', payload: { cartas } })),
      ...subconjuntos(ids, 1, 2).map((cartas) => ({ type: 'TROCAR', payload: { cartas } })),
      { type: 'PASSAR', payload: {} },
    ];
  }
  if (s.fase === 'DESEMPATE') {
    const b = alvo(s);
    return [{ type: 'DESEMPATAR', payload: { carta: null } }, ...p.mao.filter((c) => c.cor === b.cor).map((c) => ({ type: 'DESEMPATAR', payload: { carta: c.id } }))];
  }
  return [];
}

/** O que cada lugar vê: a própria mão; das outras só o número de cartas; as apostas só depois da revelação. */
export function view(s, lugar) {
  const v = s.vaza;
  const eu = Number.isInteger(lugar) ? lugar : -1;
  return {
    modo: s.modo, fase: s.fase, ronda: s.ronda, governante: s.governante, fimDisparado: s.fimDisparado, limiteMao: s.limiteMao,
    jogadores: s.jogadores.map((p, i) => ({
      cor: p.cor, simbolo: p.simbolo, equipa: p.equipa, cartas: p.mao.length, ativas: p.ativas, baelfs: p.baelfs, fimAtivado: p.fimAtivado,
      ...(i === eu ? { mao: p.mao } : {}),
    })),
    minhaMao: eu >= 0 ? s.jogadores[eu].mao : [],
    baralho: s.baralho.length,
    descarte: s.descarte.length,
    topoDescarte: s.descarte.at(-1) ?? null,
    porEscolher: s.porEscolher,
    sequencia: s.sequencia,
    vazaNum: s.vazaNum,
    vaza: v && {
      alvoJogador: v.alvoJogador, alvoPosicao: v.alvoPosicao, ordem: v.ordem, atual: v.atual, acoes: v.acoes, revelada: v.revelada,
      apostas: v.apostas.map((a, i) => (i === eu || v.revelada ? a : a === null ? null : [])),
      empatados: v.empatados, desempateFeito: v.desempateFeito,
      cartasDesempate: v.cartasDesempate.map((c, i) => (i === eu ? c : c === null ? null : {})),
      aDescartar: v.aDescartar, excesso: v.excesso,
    },
    ultimaVaza: s.ultimaVaza,
    pontuacao: s.pontuacao,
    equipas: s.equipas,
  };
}

export function result(s) {
  if (s.fase !== 'FIM') return null;
  const scores = s.pontuacao.map((x) => x.total);
  if (s.equipas) {
    return { scores, winners: s.jogadores.map((p, i) => i).filter((i) => s.equipas.vencedoras.includes(s.jogadores[i].equipa)) };
  }
  const max = Math.max(...scores);
  return { scores, winners: scores.map((x, i) => i).filter((i) => scores[i] === max) };
}

// ─── Rótulos das jogadas (UI genérica) ───────────────────────
const EMOJI = { red: '🔴', blue: '🔵', green: '🟢', yellow: '🟡' };
export const cartaTexto = (c) => (c.tipo === 'joker' ? `Joker ${c.simbolo === 'circle' ? '⭕' : '▲'}` : c.tipo === 'duplo' ? `×2${EMOJI[c.cor]}` : `${c.valor}${EMOJI[c.cor]}`);
function ordemTexto(s, ordem) {
  return ordem.map((o) => { const p = s.jogadores[o.jogador]; const b = p.baelfs[p.ativas[o.posicao]]; return `${EMOJI[b.cor]}${b.espacos}`; }).join(' → ');
}

export function describeMove(move, v) {
  const p = move.payload || {};
  const mao = v?.minhaMao || [];
  const cartas = (ids) => ids.map((id) => mao.find((c) => c.id === id)).filter(Boolean).map(cartaTexto).join(' + ');
  switch (move.type) {
    case 'ESCOLHER': {
      const eu = v.jogadores.find((j) => j.mao);
      const b = eu?.baelfs[p.baelf];
      return b ? { key: 'moveLabel.ESCOLHER', params: { especime: `@esp.${b.espacos}`, cor: `${EMOJI[b.cor]}` } } : null;
    }
    case 'DECLARAR':
      return { key: 'moveLabel.DECLARAR', params: { ordem: p.ordem.map((o) => { const j = v.jogadores[o.jogador]; const b = j.baelfs[j.ativas[o.posicao]]; return `${EMOJI[b.cor]}${b.espacos}`; }).join(' → ') } };
    case 'APOSTAR': return { key: 'moveLabel.APOSTAR', params: { cartas: cartas(p.cartas) } };
    case 'TROCAR': return { key: 'moveLabel.TROCAR', params: { cartas: cartas(p.cartas) } };
    case 'DESCARTAR': return { key: 'moveLabel.DESCARTAR', params: { cartas: cartas(p.cartas) } };
    case 'DESEMPATAR': return p.carta == null ? { key: 'moveLabel.DESEMPATAR_NADA', params: {} } : { key: 'moveLabel.DESEMPATAR', params: { cartas: cartas([p.carta]) } };
    default: return null;
  }
}
