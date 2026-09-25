// Pacote de jogo: Catania. Só depende de @bitnik/engine.
import { defineGame } from '@bitnik/engine';
import * as rules from './rules.js';
import { defaultBot } from './bot.js';
import pt from './i18n/pt.js';
import en from './i18n/en.js';

export default defineGame({
  id: 'catania',
  version: '4.0.0',
  players: { min: 2, max: 4 },
  author: 'David Marques',
  license: 'CC-BY-4.0',
  defaultLang: 'pt',
  i18n: { pt, en },
  // UI própria (ADR-006): servida pela plataforma a partir desta pasta.
  root: new URL('./', import.meta.url).href,
  ui: './ui/index.js',
  tutorial: './ui/tutorial.js',
  // Aparência (ADR-008): tokens por omissão e temas de design à medida.
  skin: './ui/skin.json',
  themes: { dia: './ui/themes/dia/theme.json' },
  preview: { scenario: 'tutorial-meio', players: 4 }, // cenário da pré-visualização na consola

  setup: rules.setup,
  moves: rules.moves,
  activePlayers: rules.activePlayers,
  enumerate: rules.enumerate,
  view: rules.view,
  result: rules.result,
  bots: { default: defaultBot },

  /** Rótulo legível de uma jogada (usado pela UI genérica de protótipo). */
  describeMove(move, view) {
    const hexName = (id) => `#${id}`;
    const p = move.payload || {};
    switch (move.type) {
      case 'COLLECT':
        return { key: 'moveLabel.COLLECT', params: { n: p.take2 ? 2 : 1, hex: hexName(p.hex), res: `@res.${view.hexes[p.hex].type}` } };
      case 'MOVE_FIRE':
        return p.stay ? { key: 'moveLabel.MOVE_FIRE_STAY' } : { key: 'moveLabel.MOVE_FIRE', params: { hex: hexName(p.hex), res: `@res.${view.hexes[p.hex].type}` } };
      case 'FOUND':
        return { key: 'moveLabel.FOUND', params: { keep: `@res.${p.keep}`, raise: `@res.${p.raise}` } };
      default:
        return { key: `moveLabel.${move.type}` };
    }
  },
});
