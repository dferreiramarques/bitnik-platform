// Texto da modal "Como se joga" (botão ? durante a partida), nas duas línguas.
// Não é lido pelas regras: é só conteúdo de UI.
export default {
  pt: [
    { title: 'Objetivo', body: [
      'És um Business Angel: investe em startups, contrata equipas e vende no momento certo. Depois de 12 rondas ganha quem tiver mais valor: cash mais ações ao preço atual.',
      'Começas com 10M. Só o cash dos outros jogadores é escondido; ações e equipas são públicas.',
    ] },
    { title: 'A ronda', body: [
      'Em cada ronda sai um CEO: o seu setor ganha +1M e o efeito aplica-se a todos (com dado, quando tem). O preço de uma startup é o preço base mais o valor do setor.',
      'Depois cada jogador joga o seu turno: Mercado (comprar e vender ações) e Manutenção (equipa e salários). No fim da ronda pagam-se os dividendos.',
      'A ordem muda a cada ronda: joga primeiro quem tem ações na startup mais cara; quem não tem ações joga no fim. Empates mantêm a ordem anterior.',
    ] },
    { title: 'Mercado', body: [
      'Podes ter até 4 ações da mesma startup. Compras ao preço atual e podes vender no mercado a qualquer momento, também ao preço atual.',
      'Nas rondas 4, 8 e 12 abre o Gate de Venda: com maioria real (mais de 50% das ações) vendes a startup ao preço vezes o multiplicador (×5, ×10 e ×20, ajustado pelo CEO). Não podes vender no Gate uma startup em que compraste nesse turno.',
      'No Gate podes ainda propor uma troca de ações a outro jogador, que tem de aceitar.',
    ] },
    { title: 'Equipa e dividendos', body: [
      'Contrata trabalhadores (até 4, no máximo 1 de cada tipo por startup). O Estagiário é grátis; o Sénior custa 2M e 1M por ronda, mas rende o dobro.',
      'Engenheiro: 2M por ação e por ronda. Advogado: 1M por ação e protege a startup de implodir. PR: 1M por ação e sobe 1M ao preço da startup. CFO: renda fixa de 2M por ronda, mesmo sem ações.',
      'No fim da ronda recebes o que a tua equipa rende; o ecrã mostra quanto cada trabalhador rende e o total previsto. Ações numa startup sem equipa não pagam nada.',
    ] },
    { title: 'Implosões', body: [
      'Alguns CEOs fazem implodir a startup mais cara que não tenha um Advogado (de qualquer jogador): deixa de valer, de pagar dividendos e de se poder vender. Com preços iguais, sorteia-se.',
    ] },
  ],
  en: [
    { title: 'Goal', body: [
      'You are a Business Angel: invest in startups, hire teams and sell at the right moment. After 12 rounds the player with the most value wins: cash plus shares at the current price.',
      'You start with 10M. Only other players\' cash is hidden; shares and teams are public.',
    ] },
    { title: 'The round', body: [
      'Each round a CEO shows up: their sector gains +1M and the effect applies to everyone (with a die, when they have one). A startup\'s price is its base price plus the sector value.',
      'Then each player takes a turn: Market (buy and sell shares) and Maintenance (team and salaries). Dividends are paid at the end of the round.',
      'The order changes every round: whoever owns shares in the most expensive startup plays first; players with no shares play last. Ties keep the previous order.',
    ] },
    { title: 'Market', body: [
      'You can hold up to 4 shares of the same startup. You buy at the current price and can sell on the market at any time, also at the current price.',
      'In rounds 4, 8 and 12 the Sale Gate opens: with a real majority (more than 50% of the shares) you sell the startup at price times the multiplier (×5, ×10 and ×20, adjusted by the CEO). You cannot sell at the Gate a startup you bought into this turn.',
      'At the Gate you can also offer another player a share swap, which they must accept.',
    ] },
    { title: 'Team and dividends', body: [
      'Hire workers (up to 4, at most 1 of each type per startup). The Intern is free; the Senior costs 2M plus 1M per round, but earns double.',
      'Engineer: 2M per share per round. Lawyer: 1M per share and protects the startup from imploding. PR: 1M per share and adds 1M to the startup price. CFO: fixed income of 2M per round, even with no shares.',
      'At the end of the round you collect what your team earns; the screen shows what each worker earns and the expected total. Shares in a startup with no team pay nothing.',
    ] },
    { title: 'Implosions', body: [
      'Some CEOs make the most expensive startup without a Lawyer (anyone\'s) implode: it stops being worth anything, paying dividends and being sold. On equal prices, it is drawn.',
    ] },
  ],
};
