export default {
  'game.name': 'Barnacle Beach',
  'game.tagline': 'Build the beach and watch the bathers with your lifeguards.',

  'peca.normal': 'bathers', 'peca.prancha': 'surfboard', 'peca.rocha': 'rock', 'peca.areia': 'sand',
  'obj.quadrado3': '3×3 square', 'obj.quadrado5': '5×5 square', 'obj.linha5': 'Row of 5', 'obj.linha7': 'Row of 7',
  'obj.coluna5': 'Column of 5', 'obj.coluna7': 'Column of 7', 'obj.pranchas': '2 adjacent surfboards', 'obj.excursao': 'Excursion (2×2 with 3 bathers)',

  'move.COLOCAR': 'Place the tile',
  'move.SALVA_VIDAS': 'Place a lifeguard',
  'move.SALTAR': 'No lifeguard',
  'moveLabel.COLOCAR': 'Place at ({r}, {c})',
  'moveLabel.SALVA_VIDAS_H': 'Lifeguard watching the row ↔',
  'moveLabel.SALVA_VIDAS_V': 'Lifeguard watching the column ↕',
  'moveLabel.SALTAR': 'No lifeguard',

  'log.COLOCOU': 'placed a tile ({peca}, {banhistas})',
  'log.OBJETIVO': 'claimed the objective {objetivo} (+{pts})',
  'log.SALVA_VIDAS_H': 'placed a lifeguard watching the row',
  'log.SALVA_VIDAS_V': 'placed a lifeguard watching the column',
  'log.FIM': 'game over',

  'err.FASE': 'You cannot do that now.',
  'err.POSICAO': 'That position is not valid (it must touch a tile and the beach cannot exceed 7×7).',
  'err.DIRECAO': 'Choose row or column.',
  'err.LINHA_VIGIADA': 'That row already has a lifeguard.',
  'err.COLUNA_VIGIADA': 'That column already has a lifeguard.',
};
