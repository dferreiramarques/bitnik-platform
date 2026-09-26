// Pacote de jogo: Praia das Percebes. Só depende de @bitnik/engine.
// Migrado do servidor antigo (repositório praiadaspercebes, server.js); ver CHANGELOG.md.
import { defineGame } from '@bitnik/engine';
import * as rules from './rules.js';
import { defaultBot } from './bot.js';
import pt from './i18n/pt.js';
import en from './i18n/en.js';

export default defineGame({
  id: 'praia-das-percebes',
  version: '1.0.0',
  players: { min: 2, max: 4 },
  author: 'David Marques',
  license: 'UNLICENSED',
  defaultLang: 'pt',
  i18n: { pt, en },

  setup: rules.setup,
  moves: rules.moves,
  activePlayers: rules.activePlayers,
  enumerate: rules.enumerate,
  view: rules.view,
  result: rules.result,
  describeMove: rules.describeMove,
  bots: { default: defaultBot },
});
