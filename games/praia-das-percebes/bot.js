// Bot da Praia das Percebes, igual ao do servidor antigo: põe a peça onde a
// linha e a coluna já têm mais peças e decide o salva-vidas pelo tamanho delas.

const pecasNaLinha = (t, r) => Object.keys(t).filter((k) => Number(k.split(',')[0]) === r).length;
const pecasNaColuna = (t, c) => Object.keys(t).filter((k) => Number(k.split(',')[1]) === c).length;

export function defaultBot(v, lugar, { rng, legal }) {
  if (!legal.length) return null;
  if (legal[0].type === 'COLOCAR') {
    return legal
      .map((m) => ({ m, s: pecasNaLinha(v.tabuleiro, m.payload.r) + pecasNaColuna(v.tabuleiro, m.payload.c) + rng.next() }))
      .sort((a, b) => b.s - a.s)[0].m;
  }
  // Salva-vidas: põe se a linha + coluna forem grandes (ou 60% das vezes), na direção mais cheia.
  const { r, c } = v.colocada;
  const linha = pecasNaLinha(v.tabuleiro, r);
  const coluna = pecasNaColuna(v.tabuleiro, c);
  const saltar = legal.find((m) => m.type === 'SALTAR');
  const opcoes = legal.filter((m) => m.type === 'SALVA_VIDAS');
  if (!opcoes.length || !(linha + coluna > 3 || rng.next() > 0.4)) return saltar;
  const quer = linha >= coluna ? 'h' : 'v';
  return opcoes.find((m) => m.payload.dir === quer) ?? opcoes[0];
}
