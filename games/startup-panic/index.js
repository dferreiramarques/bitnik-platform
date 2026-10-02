// Pacote de jogo: Startup Panic. Só depende de @bitnik/engine.
import { defineGame } from '@bitnik/engine';
import * as rules from './rules.js';
import pt from './i18n/pt.js';
import en from './i18n/en.js';

export default defineGame({
  id: 'startup-panic',
  version: '0.1.0',
  players: { min: 2, max: 4 },
  author: 'David Marques',
  license: 'UNLICENSED',
  defaultLang: 'pt',
  i18n: { pt, en },
  root: new URL('./', import.meta.url).href,

  setup: rules.setup,
  moves: rules.moves,
  activePlayers: rules.activePlayers,
  enumerate: rules.enumerate,
  view: rules.view,
  result: rules.result,
  describeMove: rules.describeMove,
});
