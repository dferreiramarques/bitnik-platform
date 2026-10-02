// Pacote de jogo: Robot Maker. Só depende de @bitnik/engine.
import { defineGame } from '@bitnik/engine';
import * as rules from './rules.js';
import { defaultBot } from './bot.js';
import pt from './i18n/pt.js';
import en from './i18n/en.js';
import rulesText from './ui/rules-text.js';

export default defineGame({
  id: 'robot-maker',
  version: '2.1.0',
  // Em desenvolvimento: jogável por link direto (consola → Jogos → Abrir),
  // fora da lista pública da marca. Remover quando for para o público.
  hidden: true,
  players: { min: 2, max: 4 },
  author: 'David Marques',
  license: 'UNLICENSED',
  defaultLang: 'pt',
  i18n: { pt, en },
  root: new URL('./', import.meta.url).href,
  ui: './ui/index.js',
  tutorial: './ui/tutorial.js',
  skin: './ui/skin.json',
  rules: rulesText,

  setup: rules.setup,
  moves: rules.moves,
  activePlayers: rules.activePlayers,
  enumerate: rules.enumerate,
  view: rules.view,
  result: rules.result,
  describeMove: rules.describeMove,
  bots: { default: defaultBot },
});
