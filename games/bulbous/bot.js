// Bot do Bulbous, igual ao do servidor antigo: escolhe com alguma sorte entre
// estratégias simples. Vê só o que um jogador vê (view) e escolhe das jogadas legais.

const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

export function defaultBot(v, lugar, { rng, legal }) {
  if (!legal.length) return null;
  const tipos = new Set(legal.map((m) => m.type));
  const eu = v.jogadores[lugar];
  const mao = v.minhaMao;

  // Ativar uma Baelfungious: 40% a mais pequena (completa depressa), 30% a maior, 30% ao acaso.
  if (tipos.has('ESCOLHER')) {
    const r = rng.next();
    const por = (m) => eu.baelfs[m.payload.baelf].espacos;
    if (r < 0.4) return [...legal].sort((a, b) => por(a) - por(b))[0];
    if (r < 0.7) return [...legal].sort((a, b) => por(b) - por(a))[0];
    return rng.pick(legal);
  }

  // Declarar a sequência: a mesma mistura, aplicada à ordem.
  if (tipos.has('DECLARAR')) {
    const espacos = (o) => { const j = v.jogadores[o.jogador]; return j.baelfs[j.ativas[o.posicao]].espacos; };
    const chave = (m) => m.payload.ordem.map(espacos);
    const r = rng.next();
    const crescente = (m) => chave(m).every((x, i, a) => i === 0 || a[i - 1] <= x);
    const decrescente = (m) => chave(m).every((x, i, a) => i === 0 || a[i - 1] >= x);
    const pool = r < 0.4 ? legal.filter(crescente) : r < 0.7 ? legal.filter(decrescente) : legal;
    return rng.pick(pool.length ? pool : legal);
  }

  // Desempate: 60% das vezes joga a numérica mais alta da cor.
  if (tipos.has('DESEMPATAR')) {
    const nums = legal.filter((m) => m.payload.carta != null)
      .map((m) => ({ m, c: mao.find((c) => c.id === m.payload.carta) }))
      .filter((x) => x.c?.tipo === 'numero')
      .sort((a, b) => b.c.valor - a.c.valor);
    if (nums.length && rng.chance(0.6)) return nums[0].m;
    return legal.find((m) => m.payload.carta == null);
  }

  // Descartar o excesso: as cartas mais baixas.
  if (tipos.has('DESCARTAR')) {
    const baixo = [...mao].sort((a, b) => (a.valor || 0) - (b.valor || 0)).map((c) => c.id);
    return legal.find((m) => same(m.payload.cartas, baixo.slice(0, m.payload.cartas.length))) ?? legal[0];
  }

  // A vaza: 65% aposta, 20% troca, 15% passa.
  const apostas = legal.filter((m) => m.type === 'APOSTAR');
  const trocas = legal.filter((m) => m.type === 'TROCAR');
  const passar = legal.find((m) => m.type === 'PASSAR');
  if (!apostas.length) return trocas.length ? rng.pick(trocas.filter((m) => m.payload.cartas.length === 1)) : passar;
  const r = rng.next();
  if (r < 0.65) {
    const joker = mao.find((c) => c.tipo === 'joker' && apostas.some((m) => same(m.payload.cartas, [c.id])));
    if (joker) return apostas.find((m) => same(m.payload.cartas, [joker.id]));
    const n = rng.chance(0.5) ? 1 : 2;
    const pool = apostas.filter((m) => m.payload.cartas.length === n);
    return rng.pick(pool.length ? pool : apostas);
  }
  if (r < 0.85 && trocas.length) {
    const baixo = [...mao].sort((a, b) => (a.valor || 0) - (b.valor || 0)).map((c) => c.id);
    const n = rng.chance(0.5) ? 1 : Math.min(2, baixo.length);
    return trocas.find((m) => same(m.payload.cartas, baixo.slice(0, n))) ?? rng.pick(trocas);
  }
  return passar;
}
