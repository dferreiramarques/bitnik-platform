// Pacote de jogo: Bulbous. Só depende de @bitnik/engine.
// Migrado do servidor antigo (repositório bulbous, game.js); ver CHANGELOG.md.
import { defineGame } from '@bitnik/engine';
import * as rules from './rules.js';
import { defaultBot } from './bot.js';
import pt from './i18n/pt.js';
import en from './i18n/en.js';

export default defineGame({
  id: 'bulbous',
  version: '1.0.0',
  // 2 jogadores, ou 4 (individual; em equipas com options.equipas). A 3 não se joga.
  players: { min: 2, max: 4, counts: [2, 4] },
  author: 'David Marques',
  license: 'UNLICENSED',
  defaultLang: 'pt',
  i18n: { pt, en },

  setup: rules.setup,
  moves: rules.moves,
  events: rules.events,
  activePlayers: rules.activePlayers,
  enumerate: rules.enumerate,
  view: rules.view,
  result: rules.result,
  describeMove: rules.describeMove,
  bots: { default: defaultBot },
});
