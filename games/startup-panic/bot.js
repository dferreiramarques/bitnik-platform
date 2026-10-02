// Bot do Startup Panic: porta o `spBot` do servidor original, a jogar só sobre o view.
// Mercado: vende no Gate se tiver maioria; senão compra 1 ação da startup mais cara que possa pagar
// (com pelo menos 3M em caixa). Manutenção: contrata Engenheiros Estagiários onde tem ações e ainda
// não tem trabalhadores, depois um Advogado onde tem mais valor e um CFO. Nunca contrata Séniores
// nem propõe trocas; recusa as que lhe propõem.

const MIN_CASH_PARA_COMPRAR = 3;

export function defaultBot(view, seat, { legal }) {
  const por = (type) => legal.filter((m) => m.type === type);

  if (view.proposta) return por('SP_TRADE_REJECT')[0] ?? legal[0];

  if (view.fase === 'MERCADO') {
    const preco = (id) => view.startups.find((x) => x.id === id).preco;
    const vendas = por('SP_SELL_STARTUP').sort((a, b) => preco(b.payload.startup) - preco(a.payload.startup));
    if (vendas.length) return vendas[0];
    if (view.meuCash >= MIN_CASH_PARA_COMPRAR) {
      const compras = por('SP_BUY')
        .filter((m) => m.payload.qty === 1)
        .sort((a, b) => preco(b.payload.startup) - preco(a.payload.startup));
      if (compras.length) return compras[0];
    }
    return por('SP_END_MARKET')[0] ?? legal[0];
  }

  const meus = new Set(view.jogadores[seat].acoes.map((x) => x.id));
  const cobertas = new Set(view.jogadores[seat].trab.map((w) => w.startup));
  const contratar = por('SP_HIRE').find((m) => !m.payload.senior && m.payload.worker.startsWith('engineer') && meus.has(m.payload.startup) && !cobertas.has(m.payload.startup));
  if (contratar) return contratar;
  // Advogado na startup onde tem mais valor investido (protege-a de implodir); depois um CFO de renda fixa.
  const valor = (id) => (view.jogadores[seat].acoes.find((x) => x.id === id)?.n ?? 0) * view.startups.find((x) => x.id === id).preco;
  const advogado = por('SP_HIRE')
    .filter((m) => !m.payload.senior && m.payload.worker.startsWith('lawyer') && meus.has(m.payload.startup))
    .sort((x, y) => valor(y.payload.startup) - valor(x.payload.startup))[0];
  if (advogado) return advogado;
  const cfo = por('SP_HIRE').find((m) => !m.payload.senior && m.payload.worker.startsWith('cfo'));
  if (cfo) return cfo;
  return por('SP_END_TURN')[0] ?? legal[0];
}
