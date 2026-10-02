// Texto da modal "Como se joga" (botão ? durante a partida e no lobby) — condensado
// a partir do REGRAS.md, nas duas línguas. Não é lido pelas regras (rules.js): é só
// conteúdo de UI, mostrado pela plataforma (app.js). Pode aparecer antes de entrar
// na mesa (lobby), por isso o `visual` usa estilo inline, sem depender do CSS do
// jogo, e caminhos absolutos para as imagens do pacote.
const IMG = '/games/praia-das-percebes/ui/pecas';
const shadow = 'box-shadow:0 2px 6px rgb(0 0 0 / .3);';

const tile = (file, w = 56) => `<img src="${IMG}/${file}.webp" alt="" style="display:block;width:${w}px;height:${w}px;object-fit:cover;border-radius:8px;${shadow}">`;
const slot = (inner, legenda) => `<div style="display:flex;flex-direction:column;align-items:center;gap:5px;font-size:12px;text-align:center;max-width:90px;">${inner}<span>${legenda}</span></div>`;
const row = (inner) => `<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;justify-content:center;margin:12px 0 4px;">${inner}</div>`;
const chip = (inner) => `<span class="rules-chip">${inner}</span>`;

// As peças da praia (as especiais com o seu efeito).
const pecas = (l) => row(`${slot(tile('banhistas3-1'), l.banhistas)}${slot(tile('prancha-1'), l.prancha)}${slot(tile('rocha'), l.rocha)}${slot(tile('areia'), l.areia)}`);
// Uma linha vigiada: 2 + 3 + 1 banhistas = 6, com uma prancha a dobrar.
const linha = (l) => row(`${slot(tile('banhistas2-1', 48), '2')}${slot(tile('banhistas3-2', 48), '3')}${slot(tile('banhistas1-1', 48), '1')}<span style="align-self:center;font-size:20px;">=</span>${chip('<b>6</b>')}`)
  + `<div class="rules-note" style="text-align:center;">${l.nota}</div>`;
const objetivos = (l) => `<div class="rules-visual" style="justify-content:center;">
  ${chip(`<b>2</b> ${l.q3}`)}${chip(`<b>2</b> ${l.q5}`)}${chip(`<b>4</b> ${l.l5}`)}${chip(`<b>4</b> ${l.c4}`)}${chip(`<b>4</b> ${l.pranchas}`)}${chip(`<b>6</b> ${l.l7}`)}${chip(`<b>6</b> ${l.c6}`)}${chip(`<b>6</b> ${l.excursao}`)}</div>`;

export default {
  pt: [
    { title: 'Objetivo', body: [
      'Coloca salva-vidas nas peças da praia. Cada salva-vidas vigia uma linha ou uma coluna e, no fim do jogo, vale os banhistas desse troço.',
      'Para 2 a 4 jogadores. Ganha quem tiver mais pontos; um empate partilha a vitória.',
    ] },
    { title: 'O teu turno', body: [
      '1. Tirar peça: tiras a peça do topo do baralho (só tu a vês).',
      '2. Colocar peça: ao lado de uma peça que já esteja na mesa (nunca na diagonal). A praia nunca passa de 7 × 7.',
      '3. Salva-vidas (opcional): pões 1 na peça que acabaste de colocar, a vigiar a linha (↔) ou a coluna (↕). Gasta 1 ficha. Só pode haver 1 salva-vidas por linha e por coluna em toda a praia, e nunca em rochas.',
      '4. Objetivos: se a tua peça completou um objetivo revelado (a formação tem de incluir essa peça), ficas logo com a carta e revela-se outra.',
    ] },
    { title: 'Peças da praia', body: [
      'Banhistas: peças com 1, 2 ou 3 banhistas, que são o que se conta.',
      'Prancha de surf: vale 1 banhista e dobra a linha ou coluna. Várias pranchas multiplicam (×4, ×8…).',
      'Rocha: vale 0 e corta a contagem da linha ou coluna.',
      'Areia: vale 0; ocupa espaço mas não pontua.',
    ], visual: pecas({ banhistas: 'Banhistas (1 a 3)', prancha: 'Prancha: ×2', rocha: 'Rocha: corta', areia: 'Areia: 0' }) },
    { title: 'Fim do jogo', body: [
      'O jogo acaba quando o baralho tem menos peças do que jogadores, ou quando já não há onde colocar. Quem ficar sem fichas continua a colocar peças, só não põe salva-vidas.',
    ] },
    { title: 'Pontuação (só no fim)', body: [
      'Salva-vidas: somas os banhistas do seu troço da linha ou coluna (um buraco ou uma rocha acabam o troço), com os multiplicadores das pranchas desse troço.',
      'Fichas por usar: +2 pontos cada. Objetivos: os pontos das cartas que conquistaste.',
    ], visual: linha({ nota: '2 + 3 + 1 banhistas na linha vigiada = 6 pontos' }) },
    { title: 'Objetivos', body: [
      'Há 8 cartas de objetivo e 4 começam reveladas. Ao conquistares uma, a carta é tua. O que já estava feito sem a tua peça não conta.',
    ], visual: objetivos({ q3: 'Quadrado 3×3', q5: 'Quadrado 5×5', l5: 'Linha de 5', c4: 'Coluna de 4', pranchas: '2 pranchas juntas', l7: 'Linha de 7', c6: 'Coluna de 6', excursao: 'Excursão (2×2 de 3)' }) },
  ],
  en: [
    { title: 'Goal', body: [
      'Place lifeguards on the beach tiles. Each lifeguard watches a row or a column and, at the end of the game, is worth the bathers on that stretch.',
      'For 2 to 4 players. The player with the most points wins; a tie shares the win.',
    ] },
    { title: 'Your turn', body: [
      '1. Draw a tile: you take the top tile of the deck (only you see it).',
      '2. Place the tile: next to a tile already on the table (never diagonally). The beach never grows past 7 × 7.',
      '3. Lifeguard (optional): put 1 on the tile you just placed, watching the row (↔) or the column (↕). It costs 1 token. There can be only 1 lifeguard per row and per column on the whole beach, and never on rocks.',
      '4. Objectives: if your tile completed a revealed objective (the formation must include that tile), you take the card at once and another is revealed.',
    ] },
    { title: 'Beach tiles', body: [
      'Bathers: worth 1, 2 or 3 bathers.',
      'Surfboard: worth 1 bather and doubles the row or column. Several surfboards multiply (×4, ×8…).',
      'Rock: worth 0 and cuts the count of the row or column.',
      'Sand: worth 0; takes up space but does not score.',
    ], visual: pecas({ banhistas: 'Bathers (1 to 3)', prancha: 'Surfboard: ×2', rocha: 'Rock: cuts', areia: 'Sand: 0' }) },
    { title: 'End of the game', body: [
      'The game ends when the deck has fewer tiles than players, or when there is nowhere left to place. A player with no tokens keeps placing tiles, just without lifeguards.',
    ] },
    { title: 'Scoring (at the end only)', body: [
      'Lifeguards: add up the bathers on their stretch of the row or column (a gap or a rock ends the stretch), with the multipliers of the surfboards on that stretch.',
      'Unused tokens: +2 points each. Objectives: the points of the cards you won.',
    ], visual: linha({ nota: '2 + 3 + 1 bathers on the watched row = 6 points' }) },
    { title: 'Objectives', body: [
      'There are 8 objective cards and 4 start revealed. When you win one, the card is yours. Anything already built without your tile does not count.',
    ], visual: objetivos({ q3: '3×3 Square', q5: '5×5 Square', l5: 'Line of 5', c4: 'Column of 4', pranchas: '2 boards together', l7: 'Line of 7', c6: 'Column of 6', excursao: 'Excursion (2×2 of 3)' }) },
  ],
};
