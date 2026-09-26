export const CORES = ['Y', 'R', 'W', 'B'];

const DISTRIBUICAO = [[1, 6], [2, 13], [3, 11], [4, 4], [5, 2]];

export function criarBaralho() {
  const cartas = [];
  let i = 0;
  for (const [capivaras, quantidade] of DISTRIBUICAO) {
    for (let k = 0; k < quantidade; k++) {
      const nenufares = [];
      if (capivaras <= 2) nenufares.push(CORES[i % 4]);
      if (capivaras === 1) nenufares.push(CORES[(i + 1) % 4]);
      if (capivaras === 3 && i % 2 === 0) nenufares.push(CORES[i % 4]);
      cartas.push({
        id: 'c' + String(i + 1).padStart(2, '0'),
        capivaras,
        passaro: i % 4 === 1,
        nenufares
      });
      i++;
    }
  }
  return cartas;
}

export function baralhar(lista, rng) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

export function letraDe(i) {
  return String.fromCharCode(65 + i);
}

export function porNaMesa(state, n) {
  state.mesa = [];
  for (let i = 0; i < n; i++) state.mesa.push({ letra: letraDe(i), carta: state.baralho.pop() });
}

export function atualizarToken(state, novasAves) {
  if (state.tokenPassaro === null || state.tokenPassaro === undefined) {
    state.tokenPassaro = novasAves.length === 1 ? novasAves[0] : null;
    return;
  }
  const detentor = state.tokenPassaro;
  const dele = state.jogadores[detentor].passaros;
  const acima = [];
  state.jogadores.forEach((j, s) => { if (s !== detentor && j.passaros > dele) acima.push(s); });
  if (acima.length === 1) state.tokenPassaro = acima[0];
}

export function resolver(state) {
  const apostas = state.apostas.slice();
  const ganhos = {};
  const novasAves = [];
  for (const x of state.mesa) {
    const quem = [];
    apostas.forEach((a, s) => { if (a === x.letra) quem.push(s); });
    if (quem.length === 1) {
      const s = quem[0];
      ganhos[x.letra] = s;
      state.jogadores[s].apanhadas.push(x.carta);
      if (x.carta.passaro) {
        state.jogadores[s].passaros += 1;
        novasAves.push(s);
      }
    } else {
      ganhos[x.letra] = null;
    }
  }
  atualizarToken(state, novasAves);
  state.revelacao = { apostas, ganhos, duracaoMs: 5000 };
  state.fase = 'REVELACAO';
  return { ganhos, novasAves };
}

export function coresDe(jogador) {
  return new Set(jogador.apanhadas.flatMap((c) => c.nenufares));
}

export function pontuar(state) {
  return state.jogadores.map((j, s) => {
    let p = j.apanhadas.reduce((t, c) => t + c.capivaras, 0);
    if (state.tokenPassaro === s) p += 5;
    const cs = coresDe(j);
    if (CORES.every((c) => cs.has(c))) p += 10;
    return p;
  });
}

/** Todos os que têm a pontuação máxima: um empate partilha a vitória. */
export function vencedores(scores) {
  const max = Math.max(...scores);
  return scores.map((_, i) => i).filter((i) => scores[i] === max);
}
