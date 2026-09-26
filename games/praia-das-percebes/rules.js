// Regras da Praia das Percebes (ver REGRAS.md), migradas do servidor antigo
// (repositório praiadaspercebes, server.js). Regras puras: estado JSON,
// aleatoriedade por ctx.rng.

export const MAX_LINHA = 7;               // a praia nunca passa de 7×7
export const FICHAS = { 2: 6, 3: 5, 4: 4 }; // salva-vidas por jogador

/** 44 peças (42 a 3 jogadores): 8×1, 12×2 e 6×3 banhistas, 4 pranchas, 2 rochas, 12 de areia. */
export function baralho(rng, n) {
  const pecas = [];
  let id = 1;
  const junta = (k, banhistas, tipo) => { for (let i = 0; i < k; i++) pecas.push({ id: id++, banhistas, tipo }); };
  junta(8, 1, 'normal');
  junta(12, 2, 'normal');
  junta(6, 3, 'normal');
  junta(4, 1, 'prancha');
  junta(2, 0, 'rocha');
  junta(12, 0, 'areia');
  rng.shuffle(pecas);
  return pecas.slice(0, n === 3 ? 42 : 44);
}

export const OBJETIVOS = [
  { id: 'quadrado3', pts: 2 }, { id: 'linha5', pts: 4 }, { id: 'linha7', pts: 6 }, { id: 'quadrado5', pts: 2 },
  { id: 'coluna4', pts: 4 }, { id: 'coluna6', pts: 6 }, { id: 'pranchas', pts: 4 }, { id: 'excursao', pts: 6 },
];

// ─── Tabuleiro ("r,c" → peça) ───────────────────────────────
const get = (t, r, c) => t[`${r},${c}`] || null;
const celulas = (t) => Object.keys(t).map((k) => { const [r, c] = k.split(',').map(Number); return { r, c }; });

export function podeColocar(t, r, c) {
  if (get(t, r, c)) return false;
  const oc = celulas(t);
  if (!oc.length) return true;
  if (!oc.some((p) => (p.r === r && Math.abs(p.c - c) === 1) || (p.c === c && Math.abs(p.r - r) === 1))) return false;
  if (oc.filter((p) => p.r === r).length >= MAX_LINHA || oc.filter((p) => p.c === c).length >= MAX_LINHA) return false;
  const rs = oc.map((p) => p.r);
  const cs = oc.map((p) => p.c);
  if (Math.max(...rs, r) - Math.min(...rs, r) >= MAX_LINHA) return false;
  if (Math.max(...cs, c) - Math.min(...cs, c) >= MAX_LINHA) return false;
  return true;
}

export function posicoes(t) {
  const cand = new Set();
  for (const p of celulas(t)) for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) cand.add(`${p.r + dr},${p.c + dc}`);
  return [...cand].map((k) => { const [r, c] = k.split(',').map(Number); return { r, c }; }).filter(({ r, c }) => podeColocar(t, r, c))
    .sort((a, b) => a.r - b.r || a.c - b.c);
}

/**
 * Banhistas vigiados por um salva-vidas: o seu troço da linha ou coluna, que acaba
 * num buraco ou numa rocha, com cada prancha do troço a multiplicar ×2.
 */
export function banhistasVigiados(t, r, c, dir) {
  const at = (pos) => (dir === 'h' ? get(t, r, pos) : get(t, pos, c));
  const pos = dir === 'h' ? c : r;
  const troco = [];
  for (let i = pos; at(i) && at(i).tipo !== 'rocha'; i--) troco.push(at(i));
  for (let i = pos + 1; at(i) && at(i).tipo !== 'rocha'; i++) troco.push(at(i));
  const mult = troco.reduce((m, p) => (p.tipo === 'prancha' ? m * 2 : m), 1);
  return troco.reduce((soma, p) => soma + p.banhistas, 0) * mult;
}

// ─── Objetivos ───────────────────────────────────────────────
function temLinha(t, fixo, len, dir) {
  const k = dir === 'h' ? 'c' : 'r';
  const m = celulas(t).filter((p) => (dir === 'h' ? p.r : p.c) === fixo).sort((a, b) => a[k] - b[k]);
  for (let i = 0; i + len <= m.length; i++) {
    let ok = true;
    for (let j = 1; j < len; j++) if (m[i + j][k] - m[i + j - 1][k] !== 1) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}
function temQuadrado(t, n) {
  return celulas(t).some(({ r, c }) => {
    for (let dr = 0; dr < n; dr++) for (let dc = 0; dc < n; dc++) if (!get(t, r + dr, c + dc)) return false;
    return true;
  });
}
const temPranchas = (t) => celulas(t).some(({ r, c }) => get(t, r, c).tipo === 'prancha'
  && [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => get(t, r + dr, c + dc)?.tipo === 'prancha'));
const temExcursao = (t) => celulas(t).some(({ r, c }) => [[0, 0], [0, 1], [1, 0], [1, 1]].every(([dr, dc]) => get(t, r + dr, c + dc)?.banhistas === 3));

export function objetivoFeito(id, t, r, c) {
  switch (id) {
    case 'quadrado3': return temQuadrado(t, 3);
    case 'quadrado5': return temQuadrado(t, 5);
    case 'linha5': return temLinha(t, r, 5, 'h');
    case 'linha7': return temLinha(t, r, 7, 'h');
    // 2.0.0: colunas de 4 e 6 (as linhas ficam 5 e 7). Com comprimentos ímpares e pares,
    // os objetivos deixam de calhar sempre ao mesmo jogador (ver CHANGELOG).
    case 'coluna4': return temLinha(t, c, 4, 'v');
    case 'coluna6': return temLinha(t, c, 6, 'v');
    case 'pranchas': return temPranchas(t);
    case 'excursao': return temExcursao(t);
    default: return false;
  }
}

const linhaVigiada = (s, r, c, dir) => s.salvaVidas.some((g) => g.dir === dir && (dir === 'h' ? g.r === r : g.c === c));
export const direcoesLivres = (s, r, c) => ['h', 'v'].filter((d) => !linhaVigiada(s, r, c, d));

// ─── Preparação ──────────────────────────────────────────────
export function setup(ctx) {
  const n = ctx.numPlayers;
  const objetivos = ctx.rng.shuffle(OBJETIVOS.map((o) => ({ ...o })));
  const s = {
    n,
    baralho: baralho(ctx.rng, n),
    tabuleiro: { '0,0': { id: 0, banhistas: 1, tipo: 'normal' } }, // peça inicial
    salvaVidas: [],
    jogadores: Array.from({ length: n }, () => ({ fichas: FICHAS[n] ?? 6, objPts: 0, pts: 0 })),
    objetivos: objetivos.slice(0, 4),     // revelados
    porRevelar: objetivos.slice(4),
    conquistados: [],
    fase: 'COLOCAR',
    vez: 0,
    peca: null,       // peça tirada pelo jogador da vez (só ele a vê)
    colocada: null,   // onde pôs a peça, à espera do salva-vidas
    ultima: null,
  };
  s.peca = s.baralho.shift();
  s.total = s.baralho.length + 1;
  return s;
}

// ─── Turno ───────────────────────────────────────────────────
function proximoTurno(s, ctx) {
  s.colocada = null;
  s.vez = (s.vez + 1) % s.n;
  s.fase = 'COLOCAR';
  // Acaba quando o baralho tem menos peças do que jogadores.
  if (s.baralho.length < s.n) return terminar(s, ctx);
  s.peca = s.baralho.shift();
  if (!posicoes(s.tabuleiro).length) return terminar(s, ctx);
  return undefined;
}

function terminar(s, ctx) {
  s.fase = 'FIM';
  s.peca = null;
  for (const j of s.jogadores) j.pts = 0;
  for (const g of s.salvaVidas) {
    g.pts = banhistasVigiados(s.tabuleiro, g.r, g.c, g.dir);
    s.jogadores[g.jogador].pts += g.pts;
  }
  for (const j of s.jogadores) j.pts += j.fichas * 2 + j.objPts;
  ctx.log('log.FIM');
}

export const moves = {
  COLOCAR(s, { r, c }, ctx) {
    if (s.fase !== 'COLOCAR') return ctx.invalid('err.FASE');
    if (!Number.isInteger(r) || !Number.isInteger(c) || !podeColocar(s.tabuleiro, r, c)) return ctx.invalid('err.POSICAO');
    const peca = s.peca;
    s.tabuleiro[`${r},${c}`] = peca;
    s.peca = null;
    s.ultima = { tipo: 'COLOCAR', r, c, jogador: ctx.seat };
    ctx.log('log.COLOCOU', { peca: `@peca.${peca.tipo}`, banhistas: peca.banhistas });
    // Objetivos revelados feitos com esta peça: são de quem a pôs; revela-se outro.
    for (const o of [...s.objetivos]) {
      if (!objetivoFeito(o.id, s.tabuleiro, r, c)) continue;
      s.objetivos = s.objetivos.filter((x) => x.id !== o.id);
      s.conquistados.push({ ...o, jogador: ctx.seat });
      s.jogadores[ctx.seat].objPts += o.pts;
      ctx.log('log.OBJETIVO', { objetivo: `@obj.${o.id}`, pts: o.pts });
      if (s.porRevelar.length) s.objetivos.push(s.porRevelar.shift());
    }
    // Salva-vidas: só se não for rocha, houver ficha e uma linha ou coluna livre.
    if (peca.tipo !== 'rocha' && s.jogadores[ctx.seat].fichas > 0 && direcoesLivres(s, r, c).length) {
      s.fase = 'SALVA_VIDAS';
      s.colocada = { r, c };
      return undefined;
    }
    return proximoTurno(s, ctx);
  },
  SALVA_VIDAS(s, { dir }, ctx) {
    if (s.fase !== 'SALVA_VIDAS') return ctx.invalid('err.FASE');
    if (dir !== 'h' && dir !== 'v') return ctx.invalid('err.DIRECAO');
    const { r, c } = s.colocada;
    if (!direcoesLivres(s, r, c).includes(dir)) return ctx.invalid(dir === 'h' ? 'err.LINHA_VIGIADA' : 'err.COLUNA_VIGIADA');
    s.jogadores[ctx.seat].fichas--;
    s.salvaVidas.push({ r, c, dir, jogador: ctx.seat });
    s.ultima = { tipo: 'SALVA_VIDAS', r, c, dir, jogador: ctx.seat };
    ctx.log(dir === 'h' ? 'log.SALVA_VIDAS_H' : 'log.SALVA_VIDAS_V');
    return proximoTurno(s, ctx);
  },
  SALTAR(s, _, ctx) {
    if (s.fase !== 'SALVA_VIDAS') return ctx.invalid('err.FASE');
    s.ultima = { tipo: 'SALTAR', jogador: ctx.seat };
    return proximoTurno(s, ctx);
  },
};

export const activePlayers = (s) => (s.fase === 'FIM' ? [] : [s.vez]);

export function enumerate(s, lugar) {
  if (s.fase === 'FIM' || lugar !== s.vez) return [];
  if (s.fase === 'COLOCAR') return posicoes(s.tabuleiro).map(({ r, c }) => ({ type: 'COLOCAR', payload: { r, c } }));
  return [
    ...direcoesLivres(s, s.colocada.r, s.colocada.c).map((dir) => ({ type: 'SALVA_VIDAS', payload: { dir } })),
    { type: 'SALTAR', payload: {} },
  ];
}

/** Todos veem a praia; a peça tirada só a vê o jogador da vez; o baralho só pelo número. */
export function view(s, lugar) {
  const { baralho: b, porRevelar, peca, ...resto } = s;
  return { ...resto, baralho: b.length, porRevelar: porRevelar.length, peca: peca && (lugar === s.vez ? peca : { escondida: true }) };
}

export function result(s) {
  if (s.fase !== 'FIM') return null;
  const scores = s.jogadores.map((j) => j.pts);
  const max = Math.max(...scores);
  return { scores, winners: scores.map((x, i) => i).filter((i) => scores[i] === max) };
}

/**
 * Posição relativa à peça inicial: C (cima), B (baixo), D (direita), E (esquerda)
 * e quantas casas. Ex.: C1 = logo acima da peça inicial; C1 D2 = uma acima, duas à direita.
 */
export function posicaoTexto(r, c) {
  const v = r < 0 ? { v: '@dir.C', vn: -r } : r > 0 ? { v: '@dir.B', vn: r } : null;
  const h = c > 0 ? { h: '@dir.D', hn: c } : c < 0 ? { h: '@dir.E', hn: -c } : null;
  if (v && h) return { key: 'pos.VH', params: { ...v, ...h } };
  return v ? { key: 'pos.V', params: v } : { key: 'pos.H', params: h };
}

export function describeMove(move) {
  const p = move.payload || {};
  if (move.type === 'COLOCAR') {
    const pos = posicaoTexto(p.r, p.c);
    return { key: `moveLabel.COLOCAR_${pos.key.slice(4)}`, params: pos.params };
  }
  if (move.type === 'SALVA_VIDAS') return { key: p.dir === 'h' ? 'moveLabel.SALVA_VIDAS_H' : 'moveLabel.SALVA_VIDAS_V', params: {} };
  return null;
}
