// Texto da modal "Como se joga" (botão ? durante a partida), nas duas línguas.
// Não é lido pelas regras: é só conteúdo de UI.
export default {
  pt: [
    { title: 'Objetivo', body: [
      'Constrói o robot mais eficiente. O jogo acaba quando alguém o completa (6 slots, com pelo menos uma peça L3 e três de nível 2 ou mais: 1×L3, 2×L2, 3×L1) e ganha quem tiver mais pontos.',
      'Cada jogador começa com 1 worker e nenhum bloco. Um turno usa todos os teus workers, um por ação, e só depois joga o seguinte.',
    ] },
    { title: 'Tabuleiro', body: [
      'Compilador (ilimitado): +3 blocos L1 por worker. Optimizador (ilimitado): 2 blocos L1 viram 1 bloco L2; sem 2 L1, o worker gasta-se sem efeito.',
      'Forja (exclusiva): escolhes uma peça L1 grátis para um slot vazio. Deploy (exclusivo): +6 pontos cada vez que o usas.',
      'No fim da ronda os workers regressam e a ordem roda uma posição.',
    ] },
    { title: 'Peças e mercado', body: [
      'Podes comprar peças à vista no mercado com blocos L1 e L2. Cada slot sobe um nível de cada vez: L1 num slot vazio, L2 sobre L1, L3 sobre L2. A peça antiga sai do jogo.',
      'Se numa ronda ninguém adquire peças de um nível, a mais à esquerda desse nível vai para o fundo e entra uma nova.',
      'Comprar não dá pontos na hora: as peças só contam no fim.',
    ] },
    { title: 'CPU e circuitos', body: [
      'A CPU multiplica os pontos das zonas que amplifica (×2, ×2.5 e ×3 conforme o nível; o Omni Core L3 dá ×1.5 a tudo).',
      'Cada circuito (3 slots preenchidas) dá um worker permanente, no máximo 1 circuito e 3 workers por jogador. Cada circuito só existe uma vez no jogo.',
    ] },
    { title: 'Fim de jogo', body: [
      'Quem completa o robot (6 slots, uma peça L3 e três de nível 2 ou mais) acaba o turno e deixa de jogar; os outros jogam mais uma ronda e o jogo acaba. Bónus: +8 com o robot completo e +5 com uma peça L3.',
    ] },
  ],
  en: [
    { title: 'Goal', body: [
      'Build the most efficient robot. The game ends when someone completes theirs (6 slots with at least one L3 part and three parts of level 2 or higher: 1×L3, 2×L2, 3×L1) and whoever has the most points wins.',
      'Each player starts with 1 worker and no blocks. A turn uses all your workers, one per action, and only then does the next player go.',
    ] },
    { title: 'Board', body: [
      'Compiler (unlimited): +3 L1 blocks per worker. Optimizer (unlimited): 2 L1 blocks become 1 L2 block; without 2 L1, the worker is spent for nothing.',
      'Forge (exclusive): pick a free L1 part for an empty slot. Deploy (exclusive): +6 points every time you use it.',
      'At the end of the round the workers return and the turn order shifts by one.',
    ] },
    { title: 'Parts and market', body: [
      'You can buy parts on display in the market with L1 and L2 blocks. Each slot goes up one level at a time: L1 on an empty slot, L2 on L1, L3 on L2. The old part leaves the game.',
      'If nobody gets parts of a level in a round, the leftmost one of that level goes to the bottom and a new one comes in.',
      'Buying gives no points right away: parts only count at the end.',
    ] },
    { title: 'CPU and circuits', body: [
      'The CPU multiplies the points of the zones it amplifies (×2, ×2.5 and ×3 by level; Omni Core L3 gives ×1.5 to everything).',
      'Each circuit (3 filled slots) gives a permanent worker, at most 1 circuit and 3 workers per player. Each circuit exists only once in the game.',
    ] },
    { title: 'End of the game', body: [
      'Whoever completes the robot (6 slots, an L3 part and three parts of level 2 or higher) finishes their turn and stops playing; the others play one more round and the game ends. Bonus: +8 for a complete robot and +5 for an L3 part.',
    ] },
  ],
};
