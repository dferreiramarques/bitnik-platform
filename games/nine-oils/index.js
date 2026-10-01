// Pacote de jogo: Nine Oils. Só depende de @bitnik/engine.
// Migrado do servidor antigo (repositório nineoils-v2, server.js); ver CHANGELOG.md.
import { defineGame } from '@bitnik/engine';
import * as rules from './rules.js';
import { defaultBot } from './bot.js';
import pt from './i18n/pt.js';
import en from './i18n/en.js';
import rulesText from './ui/rules-text.js';

export default defineGame({
  id: 'nine-oils',
  version: '1.1.21',
  players: { min: 2, max: 2 },
  author: 'David Marques',
  license: 'UNLICENSED',
  defaultLang: 'pt',
  i18n: { pt, en },
  root: new URL('./', import.meta.url).href,
  ui: './ui/index.js',
  skin: './ui/skin.json',
  // Modal "Como se joga" (botão ? durante a partida, plataforma): condensado
  // do REGRAS.md, nas duas línguas — não é lido pelas regras.
  rules: rulesText,

  setup: rules.setup,
  moves: rules.moves,
  activePlayers: rules.activePlayers,
  enumerate: rules.enumerate,
  view: rules.view,
  result: rules.result,
  describeMove: rules.describeMove,
  bots: { default: defaultBot },
  // Um turno do bot pode ser várias jogadas seguidas (lança, escolhe combo,
  // descarta); 3s entre cada uma dá tempo a ler os dados e as mensagens.
  botDelayMs: [3000, 3000],
});
