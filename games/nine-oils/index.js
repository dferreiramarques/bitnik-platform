// Pacote de jogo: Nine Oils. Só depende de @bitnik/engine.
// Migrado do servidor antigo (repositório nineoils-v2, server.js); ver CHANGELOG.md.
import { defineGame } from '@bitnik/engine';
import * as rules from './rules.js';
import { defaultBot } from './bot.js';
import pt from './i18n/pt.js';
import en from './i18n/en.js';

export default defineGame({
  id: 'nine-oils',
  version: '1.1.0',
  players: { min: 2, max: 2 },
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
