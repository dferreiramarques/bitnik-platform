// Texto da modal "Como se joga" (botão ? durante a partida) — condensado a
// partir do REGRAS.md, nas duas línguas. Não é lido pelas regras (rules.js):
// é só conteúdo de UI, mostrado pela plataforma (app.js).
export default {
  pt: [
    { title: 'Objetivo', body: [
      'Termina o jogo com mais pontos do que os outros. Os pontos vêm das capivaras que apanhas, do token do pássaro e do bónus dos nenúfares.',
      'A cada ronda são colocadas na mesa tantas cartas quantos os jogadores, viradas para cima.',
    ] },
    { title: 'Apostar', body: [
      'Em segredo, cada jogador escolhe uma das cartas da mesa. Ninguém vê a escolha dos outros até todos terem decidido; depois de apostar, não podes mudar.',
      'As apostas revelam-se todas ao mesmo tempo. Se foste o único a escolher essa carta, é tua; se mais do que um jogador escolheu a mesma, ninguém a ganha — as capivaras fugiram.',
      'Apostar sempre na carta de maior valor nem sempre compensa: se for óbvia, outro jogador pode escolher a mesma.',
    ] },
    { title: 'Token do pássaro', body: [
      'A primeira vez que alguém apanha uma carta com pássaro, fica com o token. Para lho roubar, precisas de acumular mais cartas com pássaro do que quem o tem — empatar não chega.',
      'Quem tiver o token no final do jogo ganha +5 pontos.',
    ] },
    { title: 'Bónus dos nenúfares', body: [
      'Algumas cartas têm nenúfares de 4 cores (Amarelo, Vermelho, Branco, Azul). Reunir as 4 cores entre as cartas que apanhaste ao longo do jogo (não precisam de estar na mesma carta) dá +10 pontos no final.',
    ] },
    { title: 'Fim de jogo e pontuação', body: [
      'O baralho joga-se duas vezes: quando as cartas acabam a primeira vez, o descarte é baralhado e reutilizado; à segunda vez que acabam, o jogo termina.',
      'Pontuação final: 1 ponto por capivara nas cartas apanhadas, +5 pelo token do pássaro, +10 pelas 4 cores de nenúfar. Ganha quem tiver mais pontos; empate no máximo partilha a vitória.',
    ] },
  ],
  en: [
    { title: 'Objective', body: [
      'Finish the game with more points than everyone else. Points come from the capybaras you catch, the bird token, and the lily bonus.',
      'Each round, as many cards as there are players are placed on the table, face up.',
    ] },
    { title: 'Betting', body: [
      'In secret, each player picks one of the table cards. No one sees anyone else\'s pick until everyone has decided; once you bet, you can\'t change it.',
      'All bets are revealed at the same time. If you were the only one to pick that card, it\'s yours; if more than one player picked the same card, no one gets it — the capybaras ran off.',
      'Always betting on the highest-value card doesn\'t always pay off: if it\'s the obvious choice, someone else may pick it too.',
    ] },
    { title: 'Bird token', body: [
      'The first time someone catches a card with a bird, they get the token. To steal it, you need to have caught more bird cards than the current holder — a tie isn\'t enough.',
      'Whoever holds the token at the end of the game gets +5 points.',
    ] },
    { title: 'Lily bonus', body: [
      'Some cards have lilies in 4 colors (Yellow, Red, White, Blue). Collecting all 4 colors across the cards you\'ve caught over the game (not necessarily on the same card) gives +10 points at the end.',
    ] },
    { title: 'End of game and scoring', body: [
      'The deck is played twice through: when the cards run out the first time, the discard pile is reshuffled and reused; the second time it runs out, the game ends.',
      'Final score: 1 point per capybara on caught cards, +5 for the bird token, +10 for the 4 lily colors. Highest score wins; a tie at the top shares the win.',
    ] },
  ],
};
