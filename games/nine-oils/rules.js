// Regras do Nine Oils (ver REGRAS.md), migradas do servidor antigo
// (repositório nineoils-v2, server.js). Regras puras: estado JSON,
// dados e baralho por ctx.rng.

// 1.1.0: 2 Rapazes, como nas regras escritas (o jogo antigo tinha 3). Em simulação não muda o
// equilíbrio (quem começa ganha 53,1% com 2 e 53,7% com 3); só há metade dos roubos.
export const BARALHO = ['TEMPTRESS', 'TEMPTRESS', 'BOY', 'BOY', 'BULLY', 'BULLY', 'BULLY', 'BULLY'];
export const LIMITE_MAO = 3;
// Banca: 0 = casa com cubo vermelho, 1 = casa livre, 2 = garrafa.
const BANCA = [0, 0, 1, 1, 1, 1];

// ─── Combinações ─────────────────────────────────────────────
const contar = (dados) => dados.reduce((f, d) => ({ ...f, [d]: (f[d] || 0) + 1 }), {});

/**
 * Todos os conjuntos de combinações que um lançamento permite: cada face
 * entra no máximo numa combinação (sem cascata); o par do Triplo+Duplo é de outra face.
 */
export function conjuntos(dados) {
  const freq = contar(dados);
  const faces = Object.keys(freq).map(Number).sort((a, b) => freq[b] - freq[a] || a - b);
  const vistos = new Set();
  const out = [];
  const go = (i0, usadas, atual) => {
    const chave = [...atual].sort().join('|');
    if (!vistos.has(chave)) { vistos.add(chave); out.push([...atual].sort()); }
    for (let i = i0; i < faces.length; i++) {
      const f = faces[i];
      if (usadas.has(f)) continue;
      const c = freq[f];
      const com = (outras, combo) => { outras.forEach((x) => usadas.add(x)); go(i + 1, usadas, [...atual, combo]); outras.forEach((x) => usadas.delete(x)); };
      if (c >= 5) com([f], 'PENTA');
      if (c >= 4) com([f], 'QUAD');
      if (c >= 3) for (const f2 of faces) if (f2 !== f && !usadas.has(f2) && freq[f2] >= 2) com([f, f2], 'TRIPLE_DOUBLE');
      if (c >= 2) com([f], 'DOUBLE');
    }
  };
  go(0, new Set(), []);
  return out.filter((b) => b.length);
}

const VALOR = { PENTA: 100, QUAD: 80, TRIPLE_DOUBLE: 60, SIX_OF_KIND: 50, DOUBLE: 10 };
export const valorConjunto = (b) => b.reduce((s, c) => s + (VALOR[c] || 0), 0);

/** Um conjunto é pior se outro tem tudo o que ele tem e mais alguma coisa (ex.: Duplo < Duplo + Quad). */
export function dominado(b, opcoes) {
  const conta = (x) => x.reduce((m, c) => ({ ...m, [c]: (m[c] || 0) + 1 }), {});
  const a = conta(b);
  return opcoes.some((o) => o.length > b.length && Object.entries(a).every(([c, n]) => (conta(o)[c] || 0) >= n));
}
/** As melhores opções (as que nenhuma outra contém) primeiro; dentro de cada grupo, por valor. */
const ordenar = (opcoes) => [...opcoes].sort((x, y) => dominado(x, opcoes) - dominado(y, opcoes) || valorConjunto(y) - valorConjunto(x));

/** O que um lançamento dá: combinações diretas, ou opções para escolher. */
export function analisar(dados) {
  const max = Math.max(...Object.values(contar(dados)));
  if (max === 9) return { combos: ['INSTANT_WIN'], opcoes: null, joker: false };
  if (max === 8) return { combos: ['DOUBLE_QUAD'], opcoes: null, joker: false };
  if (max === 7) return { combos: null, opcoes: [['DOUBLE'], ['TRIPLE_DOUBLE'], ['QUAD'], ['PENTA'], ['SIX_OF_KIND']], joker: true };
  if (max === 6) return { combos: ['SIX_OF_KIND'], opcoes: null, joker: false };
  const b = ordenar(conjuntos(dados));
  if (b.length <= 1) return { combos: b[0] ?? [], opcoes: null, joker: false };
  return { combos: null, opcoes: b, joker: false };
}

// ─── Preparação ──────────────────────────────────────────────
function comprar(s, ctx) {
  if (!s.baralho.length) {
    if (!s.descarte.length) return null;
    s.baralho = ctx.rng.shuffle(s.descarte);
    s.descarte = [];
  }
  return s.baralho.pop() ?? null;
}

export function setup(ctx) {
  const s = {
    jogadores: [0, 1].map(() => ({ banca: [...BANCA], mao: [], reserva: 6 })),
    baralho: ctx.rng.shuffle([...BARALHO]),
    descarte: [],
    dados: Array(9).fill(0),
    vez: ctx.rng.int(2),
    fase: 'CARTAS',
    sedutoras: 0,        // Sedutoras jogadas neste turno
    rapazes: 0,          // Rapazes à espera da defesa
    pendente: null,      // análise do lançamento, antes de continuar
    opcoes: null,        // conjuntos para escolher (conflito ou Joker)
    joker: false,
    combos: [],          // combinações aplicadas neste lançamento
    vencedor: null,
  };
  for (const j of s.jogadores) { const c = comprar(s, ctx); if (c) j.mao.push(c); }
  return s;
}

// ─── Turno ───────────────────────────────────────────────────
function roubar(s, ctx) {
  const opp = s.jogadores[1 - s.vez];
  const casas = opp.banca.map((x, i) => (x === 2 ? i : -1)).filter((i) => i >= 0);
  if (!casas.length) return;
  opp.banca[casas.at(-1)] = 1;
  opp.reserva++;
  ctx.log('log.ROUBO');
}

function lancar(s, ctx) {
  s.dados = Array.from({ length: 9 }, () => ctx.rng.int(6) + 1);
  s.pendente = analisar(s.dados);
  s.combos = [];
  s.opcoes = null;
  s.fase = 'PAUSA'; // os dois veem os dados antes de se resolver
  ctx.log('log.DADOS', { dados: [...s.dados].sort((a, b) => a - b).join(' ') });
}

function aplicar(s, combos, ctx) {
  const p = s.jogadores[s.vez];
  const opp = s.jogadores[1 - s.vez];
  s.combos = combos;
  if (combos.includes('INSTANT_WIN')) {
    ctx.log('log.NOVE');
    return fim(s, s.vez);
  }
  if (combos.includes('DOUBLE_QUAD')) {
    for (let i = 0; i < 2; i++) { const k = p.banca.indexOf(0); if (k >= 0) p.banca[k] = 1; }
    ctx.log('log.OITO');
  }
  if (combos.includes('SIX_OF_KIND')) {
    for (let i = 0; i < 3; i++) { const c = comprar(s, ctx); if (c) p.mao.push(c); }
    ctx.log('log.SEIS');
  }
  for (let i = combos.filter((x) => x === 'DOUBLE').length; i > 0; i--) {
    const carta = comprar(s, ctx);
    if (carta) p.mao.push(carta);
    ctx.log(carta ? 'log.DUPLO' : 'log.DUPLO_VAZIO');
  }
  // O Quad antes do Triplo+Duplo: a casa aberta já pode receber a garrafa.
  if (combos.includes('QUAD')) {
    const k = p.banca.indexOf(0);
    if (k >= 0) p.banca[k] = 1;
    ctx.log(k >= 0 ? 'log.QUAD' : 'log.QUAD_NADA');
  }
  if (combos.includes('TRIPLE_DOUBLE')) {
    let postas = 0;
    for (let b = 0; b < 1 + s.sedutoras; b++) {
      const k = p.banca.indexOf(1);
      if (k >= 0 && p.reserva > 0) { p.banca[k] = 2; p.reserva--; postas++; }
    }
    ctx.log('log.GARRAFAS', { n: postas });
  }
  s.sedutoras = 0;
  if (combos.includes('PENTA')) {
    s.descarte.push(...opp.mao);
    opp.mao = [];
    ctx.log('log.PENTA');
  }
  if (!combos.length) ctx.log('log.NADA');
  if (p.banca.every((x) => x === 2)) return fim(s, s.vez);
  if (p.mao.length > LIMITE_MAO) { s.fase = 'DESCARTE'; return undefined; }
  return passarVez(s);
}

function passarVez(s) {
  s.vez = 1 - s.vez;
  s.fase = 'CARTAS';
  s.combos = [];
  s.opcoes = null;
  s.joker = false;
  return undefined;
}

function fim(s, vencedor) {
  s.vencedor = vencedor;
  s.fase = 'FIM';
  return undefined;
}

// ─── Jogadas ─────────────────────────────────────────────────
export const moves = {
  /** Joga as cartas escolhidas (índices da mão) e lança os 9 dados. */
  LANCAR(s, { cartas = [] }, ctx) {
    if (s.fase !== 'CARTAS') return ctx.invalid('err.FASE');
    const p = s.jogadores[s.vez];
    const opp = s.jogadores[1 - s.vez];
    if (!Array.isArray(cartas) || new Set(cartas).size !== cartas.length || cartas.some((i) => !Number.isInteger(i) || i < 0 || i >= p.mao.length)) {
      return ctx.invalid('err.CARTAS');
    }
    const jogadas = [...cartas].sort((a, b) => b - a).map((i) => p.mao.splice(i, 1)[0]);
    const n = (t) => jogadas.filter((c) => c === t).length;
    s.sedutoras = n('TEMPTRESS');
    s.descarte.push(...jogadas);
    if (jogadas.length) ctx.log('log.CARTAS', { n: jogadas.length });
    // 2 Valentões sem Rapazes: tira às cegas 1 carta da mão do adversário.
    if (n('BULLY') >= 2 && n('BOY') === 0) {
      if (opp.mao.length) { s.fase = 'ESCOLHA_CEGA'; return undefined; }
      ctx.log('log.MAO_VAZIA');
    } else if (n('BOY') > 0) {
      const garrafas = opp.banca.filter((x) => x === 2).length;
      if (!garrafas) {
        ctx.log('log.BANCA_VAZIA');
      } else if (!opp.mao.includes('BULLY')) {
        for (let i = 0; i < Math.min(n('BOY'), garrafas); i++) roubar(s, ctx);
      } else {
        // O adversário tem Valentões: decide quantos Rapazes bloqueia.
        s.rapazes = n('BOY');
        s.fase = 'DEFESA';
        return undefined;
      }
    }
    lancar(s, ctx);
    return undefined;
  },
  /** O adversário bloqueia com 0 ou mais Valentões (até ao número de Rapazes). */
  DEFENDER(s, { valentoes = 0 }, ctx) {
    if (s.fase !== 'DEFESA') return ctx.invalid('err.FASE');
    const def = s.jogadores[1 - s.vez];
    const max = Math.min(s.rapazes, def.mao.filter((c) => c === 'BULLY').length);
    if (!Number.isInteger(valentoes) || valentoes < 0 || valentoes > max) return ctx.invalid('err.VALENTOES', { max });
    for (let i = 0; i < valentoes; i++) { def.mao.splice(def.mao.indexOf('BULLY'), 1); s.descarte.push('BULLY'); }
    if (valentoes) ctx.log('log.BLOQUEOU', { n: valentoes });
    const roubos = Math.min(s.rapazes - valentoes, def.banca.filter((x) => x === 2).length);
    for (let i = 0; i < roubos; i++) roubar(s, ctx);
    s.rapazes = 0;
    lancar(s, ctx);
    return undefined;
  },
  /** Escolhe às cegas uma carta da mão do adversário (pela posição). */
  ESCOLHA_CEGA(s, { carta }, ctx) {
    if (s.fase !== 'ESCOLHA_CEGA') return ctx.invalid('err.FASE');
    const opp = s.jogadores[1 - s.vez];
    if (!Number.isInteger(carta) || carta < 0 || carta >= opp.mao.length) return ctx.invalid('err.CARTA');
    s.descarte.push(opp.mao.splice(carta, 1)[0]);
    ctx.log('log.CEGA');
    lancar(s, ctx);
    return undefined;
  },
  /** Depois de ver os dados: aplica as combinações ou passa à escolha. */
  CONTINUAR(s, _, ctx) {
    if (s.fase !== 'PAUSA') return ctx.invalid('err.FASE');
    const a = s.pendente;
    s.pendente = null;
    if (a.opcoes) {
      s.opcoes = a.opcoes;
      s.joker = a.joker;
      s.fase = 'COMBO';
      if (a.joker) ctx.log('log.JOKER');
      return undefined;
    }
    return aplicar(s, a.combos, ctx);
  },
  ESCOLHER_COMBO(s, { opcao }, ctx) {
    if (s.fase !== 'COMBO') return ctx.invalid('err.FASE');
    const b = s.opcoes[opcao];
    if (!b) return ctx.invalid('err.OPCAO');
    s.opcoes = null;
    s.joker = false;
    return aplicar(s, b, ctx);
  },
  DESCARTAR(s, { carta }, ctx) {
    if (s.fase !== 'DESCARTE') return ctx.invalid('err.FASE');
    const p = s.jogadores[s.vez];
    if (!Number.isInteger(carta) || carta < 0 || carta >= p.mao.length) return ctx.invalid('err.CARTA');
    s.descarte.push(p.mao.splice(carta, 1)[0]);
    if (p.mao.length <= LIMITE_MAO) return passarVez(s);
    return undefined;
  },
};

export function activePlayers(s) {
  if (s.fase === 'FIM') return [];
  return [s.fase === 'DEFESA' ? 1 - s.vez : s.vez];
}

/** Subconjuntos de índices da mão, um por combinação de tipos (a ordem não interessa). */
function jogadasDeCartas(mao) {
  const out = new Map();
  for (let m = 0; m < 1 << mao.length; m++) {
    const idx = mao.map((_, i) => i).filter((i) => m & (1 << i));
    const chave = idx.map((i) => mao[i]).sort().join('|');
    if (!out.has(chave)) out.set(chave, idx);
  }
  return [...out.values()];
}

export function enumerate(s, lugar) {
  if (!activePlayers(s).includes(lugar)) return [];
  const p = s.jogadores[lugar];
  switch (s.fase) {
    case 'CARTAS': return jogadasDeCartas(p.mao).map((cartas) => ({ type: 'LANCAR', payload: { cartas } }));
    case 'DEFESA': {
      const max = Math.min(s.rapazes, p.mao.filter((c) => c === 'BULLY').length);
      return Array.from({ length: max + 1 }, (_, valentoes) => ({ type: 'DEFENDER', payload: { valentoes } }));
    }
    case 'ESCOLHA_CEGA': return s.jogadores[1 - lugar].mao.map((_, carta) => ({ type: 'ESCOLHA_CEGA', payload: { carta } }));
    case 'PAUSA': return [{ type: 'CONTINUAR', payload: {} }];
    case 'COMBO': return s.opcoes.map((_, opcao) => ({ type: 'ESCOLHER_COMBO', payload: { opcao } }));
    case 'DESCARTE': return [...new Set(p.mao)].map((c) => ({ type: 'DESCARTAR', payload: { carta: p.mao.indexOf(c) } }));
    default: return [];
  }
}

/** Cada um vê a sua mão; da do adversário só o número de cartas; o baralho só pelo número. */
export function view(s, lugar) {
  const { baralho, descarte, pendente, ...resto } = s;
  return {
    ...resto,
    baralho: baralho.length,
    descarte: descarte.length,
    pendente: pendente && { combos: pendente.combos, escolher: !!pendente.opcoes, joker: pendente.joker },
    jogadores: s.jogadores.map((j, i) => ({ banca: j.banca, reserva: j.reserva, cartas: j.mao.length, ...(i === lugar ? { mao: j.mao } : {}) })),
    minhaMao: Number.isInteger(lugar) ? s.jogadores[lugar].mao : [],
  };
}

export function result(s) {
  if (s.fase !== 'FIM') return null;
  return { scores: s.jogadores.map((j) => j.banca.filter((x) => x === 2).length), winners: [s.vencedor] };
}

// ─── Rótulos das jogadas (UI genérica) ───────────────────────
const EMOJI = { TEMPTRESS: '💃', BOY: '🤏', BULLY: '👊' };
export function describeMove(move, v) {
  const p = move.payload || {};
  const mao = v?.minhaMao || [];
  switch (move.type) {
    case 'LANCAR':
      return p.cartas.length
        ? { key: 'moveLabel.LANCAR_CARTAS', params: { cartas: p.cartas.map((i) => EMOJI[mao[i]] ?? '?').join(' ') } }
        : { key: 'moveLabel.LANCAR', params: {} };
    case 'DEFENDER': return { key: 'moveLabel.DEFENDER', params: { n: p.valentoes } };
    case 'ESCOLHA_CEGA': return { key: 'moveLabel.ESCOLHA_CEGA', params: { n: p.carta + 1 } };
    case 'ESCOLHER_COMBO': {
      const b = v.opcoes?.[p.opcao] ?? [];
      // ★ nas melhores opções (as que nenhuma outra contém); no Joker escolhe-se só uma, sem ★.
      const melhor = !v.joker && !dominado(b, v.opcoes ?? []);
      return { key: `moveLabel.COMBO_${Math.min(3, b.length)}`, params: { m: melhor ? '★ ' : '', ...Object.fromEntries(b.map((c, i) => ['abc'[i], `@combo.${c}`])) } };
    }
    case 'DESCARTAR': return { key: 'moveLabel.DESCARTAR', params: { carta: `@carta.${mao[p.carta]}` } };
    default: return null;
  }
}
