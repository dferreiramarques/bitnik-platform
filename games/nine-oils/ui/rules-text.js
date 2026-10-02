// Texto da modal "Como se joga" (botão ? durante a partida) — condensado a
// partir do REGRAS.md, nas duas línguas. Não é lido pelas regras (rules.js):
// é só conteúdo de UI, mostrado pela plataforma (app.js). Pode aparecer antes
// de entrar na mesa (lobby), por isso o `visual` usa estilo inline, sem
// depender do nine-oils.css, e caminhos absolutos para as imagens do pacote.
const die = (n, size = 26) => `<img src="/games/nine-oils/ui/dados/${n}.webp" alt="${n}" style="width:${size}px;height:${size}px;border-radius:18%;object-fit:cover;">`;
const dieGroup = (faces, label, size) => `<div style="text-align:center;font-size:12px;">
  <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:2px;margin-bottom:4px;">${faces.map((n) => die(n, size)).join('')}</div>
  ${label}
</div>`;
const combosVisual = (labels) => `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(84px,1fr));gap:10px;margin:10px 0 2px;">
  ${dieGroup([3, 3], labels[0], 30)}
  ${dieGroup([5, 5, 5, 2, 2], labels[1], 24)}
  ${dieGroup([4, 4, 4, 4], labels[2], 26)}
  ${dieGroup([6, 6, 6, 6, 6], labels[3], 20)}
  ${dieGroup([1, 1, 1, 1, 1, 1], labels[4], 18)}
  ${dieGroup(Array(9).fill(2), labels[5], 14)}
</div>`;
const card = (file, alt) => `<img src="/games/nine-oils/ui/cartas/${file}" alt="${alt}" style="width:52px;height:70px;object-fit:cover;border-radius:6px;box-shadow:0 2px 6px rgb(0 0 0 / .3);">`;
const cardsVisual = (labels) => `<div style="display:flex;gap:10px;margin:10px 0 2px;flex-wrap:wrap;">
  <div style="text-align:center;font-size:12px;">${card('temptress.webp', labels[0])}<div>${labels[0]}</div></div>
  <div style="text-align:center;font-size:12px;">${card('boy.webp', labels[1])}<div>${labels[1]}</div></div>
  <div style="text-align:center;font-size:12px;">${card('bully.webp', labels[2])}<div>${labels[2]}</div></div>
</div>`;

export default {
  pt: [
    { title: 'Objetivo', body: [
      'Sê o primeiro a colocar garrafas de óleo de cobra nas 6 casas da tua banca.',
      'Cada turno tem até 4 passos: jogar cartas de personagem (opcional), lançar os 9 dados, resolver as combinações do lançamento e, se tiveres mais de 3 cartas, descartar até ficares com 3.',
    ] },
    { title: 'Combinações de dados', body: [
      'Cada valor de face produz só uma combinação por lançamento: 2 iguais é um Double (compras 1 carta); 3 de um valor + 2 de outro valor é um Triple+Double (colocas 1 garrafa); 4 iguais é um Quad (desbloqueia uma casa, removendo um cubo vermelho).',
      '5 iguais é um Penta (o adversário descarta a mão toda); 6 iguais compra 3 cartas; 9 iguais é vitória instantânea.',
      'Se a mesma face servir para mais do que uma combinação, escolhes uma só — os dados a mais dessa face são descartados.',
    ], visual: combosVisual(['Double', 'Triplo + Duplo', 'Quad', 'Seis', 'Penta', 'Nove (vitória)']) },
    { title: 'Cartas de personagem', body: [
      'Jogam-se no início do turno, antes de lançar os dados. A Sedutora dá 1 garrafa extra quando fizeres um Triple+Double nesse turno.',
      'O Rapaz tenta roubar 1 garrafa da banca do adversário; o Valentão, jogado no turno do adversário, bloqueia esse roubo (1 Valentão por Rapaz a bloquear). Jogar 2 Valentões no teu turno descarta às cegas 1 carta da mão do adversário.',
    ], visual: cardsVisual(['Sedutora', 'Rapaz', 'Valentão']) },
    { title: 'Fim de jogo', body: [
      'Vence quem primeiro tiver garrafa em todas as 6 casas da banca — as duas casas iniciais só se desbloqueiam com um Quad (ou um Oito de um Tipo, que desbloqueia as duas de uma vez).',
    ] },
  ],
  en: [
    { title: 'Objective', body: [
      'Be the first to place snake-oil bottles in all 6 slots of your stand.',
      'Each turn has up to 4 steps: play character cards (optional), roll all 9 dice, resolve the roll\'s combos, and, if you have more than 3 cards, discard down to 3.',
    ] },
    { title: 'Dice combos', body: [
      'Each face value only produces one combo per roll: 2 alike is a Double (draw 1 card); 3 of one value + 2 of another is a Triple+Double (place 1 bottle); 4 alike is a Quad (unlocks a slot, removing a red cube).',
      '5 alike is a Penta (opponent discards their whole hand); 6 alike draws 3 cards; 9 alike is an instant win.',
      'If the same face qualifies for more than one combo, you choose only one — the extra dice of that face are discarded.',
    ], visual: combosVisual(['Double', 'Triple + Double', 'Quad', 'Six', 'Penta', 'Nine (win)']) },
    { title: 'Character cards', body: [
      'Played at the start of your turn, before rolling. The Temptress grants 1 extra bottle when you land a Triple+Double that turn.',
      'The Boy tries to steal 1 bottle from the opponent\'s stand; the Bully, played on the opponent\'s turn, blocks that steal (1 Bully per Boy blocked). Playing 2 Bullies on your own turn blind-discards 1 card from the opponent\'s hand.',
    ], visual: cardsVisual(['Temptress', 'Boy', 'Bully']) },
    { title: 'End of game', body: [
      'Whoever first has a bottle in all 6 slots of their stand wins — the two starting slots only unlock with a Quad (or an Eight of a Kind, which unlocks both at once).',
    ] },
  ],
};
