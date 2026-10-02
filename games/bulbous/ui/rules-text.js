// Texto da modal "Como se joga" (botão ? durante a partida e no lobby) — condensado
// a partir do REGRAS.md, nas duas línguas. Não é lido pelas regras (rules.js): é só
// conteúdo de UI, mostrado pela plataforma (app.js). Pode aparecer antes de entrar
// na mesa (lobby), por isso o `visual` usa estilo inline, sem depender do bulbous.css,
// e caminhos absolutos para as imagens do pacote.
const IMG = '/games/bulbous/ui/cards';
const COR = { red: '#c0392b', blue: '#2e86c1', green: '#2e8b57', yellow: '#d4a017' };
const shadow = 'box-shadow:0 2px 6px rgb(0 0 0 / .3);';

const img = (file, w = 56) => `<img src="${IMG}/${file}.webp" alt="" style="display:block;width:${w}px;height:auto;border-radius:6px;${shadow}">`;
const bolbo = (cor, size = 14) => `<i style="display:inline-block;width:${size}px;height:${size}px;border-radius:50%;background:${COR[cor]};box-shadow:0 0 0 1px rgb(0 0 0 / .3);"></i>`;
const slot = (inner, legenda) => `<div style="display:flex;flex-direction:column;align-items:center;gap:5px;font-size:12px;text-align:center;max-width:96px;">${inner}<span>${legenda}</span></div>`;
const row = (inner) => `<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;justify-content:center;margin:12px 0 4px;">${inner}</div>`;
const chip = (inner) => `<span class="rules-chip">${inner}</span>`;
const op = (s) => `<span style="align-self:center;font-size:20px;">${s}</span>`;

// As quatro Baelfungious de uma cor, do Juvenil (1 espaço) ao Líder (4).
const especimes = (l) => row([1, 2, 3, 4].map((n) => slot(img(`baelf_red_${n}`, 64), `${l.esp[n - 1]} · ${n}`)).join(''));
// As cartas de Charme: um número, um ×2 e os dois Jokers.
const cartas = (l) => row(`${slot(img('card_blue_9'), l.numero)}${slot(img('card_blue_x2'), l.duplo)}${slot(img('card_joker_triangle'), `${l.joker} ▲`)}${slot(img('card_joker_circle'), `${l.joker} ●`)}`);
// O ×2 multiplica as cartas da sua cor: 9 × 2 = 18.
const duplo = (l) => row(`${slot(img('card_blue_9', 50), '9')}${op('+')}${slot(img('card_blue_x2', 50), '×2')}${op('=')}${chip('<b>18</b>')}`) + `<div class="rules-note" style="text-align:center;">${l.nota}</div>`;
const pontos = (l) => `<div class="rules-visual" style="justify-content:center;">
  ${chip(`${bolbo('red')} <b>+1</b> ${l.bolbo}`)}${chip(`<b>+3</b> ${l.maioria}`)}${chip(`<b>+5</b> ${l.cores}`)}${chip(`<b>+10</b> ${l.especimes}`)}</div>`;

export default {
  pt: [
    { title: 'Objetivo', body: [
      'Ganha o controlo das criaturas Baelfungious com as Cartas de Charme. Quem ganha uma vaza põe um bolbo da sua cor numa Baelfungious.',
      'No fim, contam os bolbos que colocaste, os bónus de maioria e os bónus de coleção. Ganha quem tiver mais pontos (ou, no modo de equipas, a equipa com mais pontos).',
    ], visual: especimes({ esp: ['Juvenil', 'Adulto', 'Bailio', 'Líder'] }) },
    { title: 'Modos de jogo', body: [
      '2 jogadores: cada um joga com duas cores e tem 2 Baelfungious ativas, uma de cada cor. Mão de 9 cartas.',
      '4 jogadores (individual): cada um tem a sua cor e 1 Baelfungious ativa. Mão de 7 cartas.',
      '4 jogadores em equipas (2 contra 2): Círculo (azul e verde) contra Triângulo (amarelo e vermelho), sentados alternadamente. Joga-se como no individual; só o vencedor se decide pela soma da equipa.',
    ] },
    { title: 'A ronda', body: [
      'Cada ronda tem 4 vazas, uma por cada Baelfungious ativa. O Governante da ronda declara, de uma vez e antes de qualquer carta, a ordem em que as quatro vão ser disputadas, e coloca o seu Bolbo de Ronda na primeira. A ordem não muda até ao fim da ronda.',
      'O Bolbo de Ronda só marca o Governante: nunca é colocado numa Baelfungious nem conta pontos.',
    ] },
    { title: 'No teu turno', body: [
      'Jogas no sentido dos ponteiros do relógio e escolhes uma ação.',
      'Apostar: jogas qualquer número de cartas viradas para baixo, todas da cor da Baelfungious em disputa. Ganha a soma mais alta; se houver empate, os empatados podem jogar uma carta extra da cor.',
      'Trocar: descartas até 2 cartas e tiras o mesmo número do baralho.',
      'Passar: não apostas e tiras 1 carta (até ao limite da mão).',
    ], visual: cartas({ numero: 'Número (3 a 9)', duplo: '×2', joker: 'Joker' }) },
    { title: 'Cartas especiais', body: [
      'Joker: ganha logo a vaza numa Baelfungious do seu símbolo (▲ vermelho e amarelo; ● azul e verde), seja qual for a cor.',
      '×2: duplica as cartas da sua cor, e só se joga numa Baelfungious dessa cor. Um 9 azul com um ×2 azul valem 18.',
    ], visual: duplo({ nota: '×2 azul + 9 azul = 18' }) },
    { title: 'Fim da ronda', body: [
      'As Baelfungious completas (todos os espaços com bolbos) saem para a área do dono, que ativa outra: a mesma cor, a 2 jogadores.',
      'Se alguma ficou completa, todos reabastecem a mão. O Governante recupera o Bolbo de Ronda e a função passa ao jogador à esquerda (a 2 jogadores, alterna).',
    ] },
    { title: 'Fim do jogo', body: [
      'O jogo acaba quando um jogador traz a sua quarta Baelfungious para a mesa. Termina-se essa ronda e contam-se os pontos.',
    ] },
    { title: 'Pontuação', body: [
      'Cada bolbo colocado vale 1 ponto. Quem tem mais bolbos numa Baelfungious completa ganha +3 (em caso de empate, +1 cada).',
      'Bónus de coleção, contando as completas em que tens a maioria: +5 com as 4 cores; +10 com os 4 tipos (Líder, Bailio, Adulto, Juvenil).',
      'Em equipas, os bónus contam por jogador; soma-se no fim a pontuação de cada equipa. Empates partilham a vitória.',
    ], visual: pontos({ bolbo: 'por bolbo', maioria: 'maioria', cores: '4 cores', especimes: '4 tipos' }) },
  ],
  en: [
    { title: 'Goal', body: [
      'Take control of the Baelfungious creatures with Charm Cards. Whoever wins a trick puts a bulb of their colour on a Baelfungious.',
      'At the end, the bulbs you placed, the majority bonuses and the collection bonuses score. The player with the most points wins (in team mode, the team with the most points).',
    ], visual: especimes({ esp: ['Juvenile', 'Adult', 'Bailiff', 'Leader'] }) },
    { title: 'Game modes', body: [
      '2 players: each plays two colours and has 2 active Baelfungious, one of each colour. Hand of 9 cards.',
      '4 players (individual): each has their own colour and 1 active Baelfungious. Hand of 7 cards.',
      '4 players in teams (2 vs 2): Circle (blue and green) against Triangle (yellow and red), seated alternately. Played like the individual game; only the winner is decided by the team total.',
    ] },
    { title: 'The round', body: [
      'Each round has 4 tricks, one per active Baelfungious. The round Ruler declares, all at once and before any card is played, the order in which the four will be contested, and puts their Round Bulb on the first. The order stays until the end of the round.',
      'The Round Bulb only marks the Ruler: it is never placed on a Baelfungious and scores nothing.',
    ] },
    { title: 'On your turn', body: [
      'You play clockwise and choose one action.',
      'Bet: play any number of face-down cards, all in the colour of the contested Baelfungious. The highest total wins; on a tie, the tied players may play one extra card of the colour.',
      'Swap: discard up to 2 cards and draw the same number from the deck.',
      'Pass: you do not bet and draw 1 card (up to the hand limit).',
    ], visual: cartas({ numero: 'Number (3 to 9)', duplo: '×2', joker: 'Joker' }) },
    { title: 'Special cards', body: [
      'Joker: wins the trick outright on a Baelfungious of its symbol (▲ red and yellow; ● blue and green), whatever the colour.',
      '×2: doubles the cards of its colour, and can only be played on a Baelfungious of that colour. A blue 9 with a blue ×2 is worth 18.',
    ], visual: duplo({ nota: 'blue ×2 + blue 9 = 18' }) },
    { title: 'End of the round', body: [
      'Complete Baelfungious (every slot holds a bulb) leave for their owner\'s area, and the owner activates another: the same colour, with two players.',
      'If any was completed, everyone refills their hand. The Ruler takes back the Round Bulb and the role passes to the player on the left (with two players, it alternates).',
    ] },
    { title: 'End of the game', body: [
      'The game ends when a player brings their fourth Baelfungious into play. That round is finished and points are counted.',
    ] },
    { title: 'Scoring', body: [
      'Each bulb placed is worth 1 point. Whoever has the most bulbs on a complete Baelfungious gets +3 (on a tie, +1 each).',
      'Collection bonuses, counting the complete ones where you hold the majority: +5 with all 4 colours; +10 with all 4 types (Leader, Bailiff, Adult, Juvenile).',
      'In teams, bonuses count per player; each team\'s scores are added at the end. Ties share the win.',
    ], visual: pontos({ bolbo: 'per bulb', maioria: 'majority', cores: '4 colours', especimes: '4 types' }) },
  ],
};
