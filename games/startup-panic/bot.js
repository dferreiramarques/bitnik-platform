// Bot do Startup Panic, a jogar só sobre o view.
// Mercado: vende no Gate se tiver maioria; senão compra 1 ação, de preferência na startup onde já tem
// ações (para chegar à maioria) ou, na falta, numa das 3 mais caras que possa pagar, sem gastar o cash
// dos salários que já deve. Manutenção: contrata sempre o 1.º trabalhador (Estagiário, grátis, o que
// põe o dinheiro a render) e os seguintes só se o cash chegar para o custo, os salários e uma folga.
// Prefere Engenheiro onde tem ações e ainda não tem equipa, depois Advogado onde tem mais valor e CFO.
// Nunca propõe trocas nem arrisca salários; recusa as trocas que lhe propõem.

const MIN_CASH_PARA_COMPRAR = 3;
const MAX_EQUIPA = 4; // o 4.º já é Sénior e o salário pesa
const FOLGA = 2; // cash que sobra depois de contratar um trabalhador com custo

export function defaultBot(view, seat, { legal, rng }) {
  const por = (type) => legal.filter((m) => m.type === type);
  const fim = (type) => por(type)[0] ?? legal[0];
  const eu = view.jogadores[seat];
  const preco = (id) => view.startups.find((x) => x.id === id).preco;
  const tenho = (id) => eu.acoes.find((x) => x.id === id)?.n ?? 0;
  const escolher = (lista) => (rng && lista.length > 1 ? rng.pick(lista) : lista[0]);

  if (view.proposta) return fim('SP_TRADE_REJECT');

  if (view.fase === 'MERCADO') {
    const vendas = por('SP_SELL_STARTUP').sort((a, b) => preco(b.payload.startup) * tenho(b.payload.startup) - preco(a.payload.startup) * tenho(a.payload.startup));
    if (vendas.length) return vendas[0];
    if (view.meuCash >= MIN_CASH_PARA_COMPRAR) {
      const compras = por('SP_BUY').filter((m) => m.payload.qty === 1 && view.meuCash - preco(m.payload.startup) >= view.meusSalarios);
      const reforco = compras.filter((m) => tenho(m.payload.startup) > 0); // acumular onde já tem, rumo à maioria
      const caras = compras.sort((a, b) => preco(b.payload.startup) - preco(a.payload.startup)).slice(0, 3);
      const pick = reforco.length ? escolher(reforco) : caras.length ? escolher(caras) : null;
      if (pick) return pick;
    }
    return fim('SP_END_MARKET');
  }

  const meus = new Set(eu.acoes.map((x) => x.id));
  const cobertas = new Set(eu.trab.map((w) => w.startup));
  const p = view.proximo;
  const gratis = p.custo === 0 && p.salario === 0;
  const cabe = gratis || (eu.trab.length < MAX_EQUIPA && view.meuCash >= p.custo + view.meusSalarios + p.salario + FOLGA);
  if (!cabe) return fim('SP_END_TURN');

  const hires = por('SP_HIRE');
  const de = (tipo) => hires.filter((m) => m.payload.worker.startsWith(tipo));
  const engenheiro = de('engineer').find((m) => meus.has(m.payload.startup) && !cobertas.has(m.payload.startup));
  if (engenheiro) return engenheiro;
  // Advogado na startup onde tem mais valor investido (protege-a de implodir).
  const valor = (id) => tenho(id) * preco(id);
  const advogado = de('lawyer').filter((m) => meus.has(m.payload.startup)).sort((x, y) => valor(y.payload.startup) - valor(x.payload.startup))[0];
  if (advogado) return advogado;
  // CFO: renda fixa, não precisa de ações. É o que rende desde a ronda 1 a quem ainda não tem onde pôr um Engenheiro.
  const cfo = de('cfo')[0];
  if (cfo) return cfo;
  return fim('SP_END_TURN');
}
