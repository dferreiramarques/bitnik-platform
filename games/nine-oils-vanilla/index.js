// Pacote de jogo: Nine Oils (Vanilla Demo). Só depende de @bitnik/engine.
// Cópia congelada do nine-oils em 1.1.13 (ver CHANGELOG.md), para mostrar o
// template vanilla tal como ficou desenhado no Claude Design — o jogo a
// sério (fundo customizado, melhores componentes e interação) é o pacote
// nine-oils; este não recebe essas mudanças.
import { defineGame } from '@bitnik/engine';
import * as rules from './rules.js';
import { defaultBot } from './bot.js';
import pt from './i18n/pt.js';
import en from './i18n/en.js';
import rulesText from './ui/rules-text.js';

export default defineGame({
  id: 'nine-oils-vanilla',
  version: '1.0.1',
  // Instalado e acessível por link direto (consola → Jogos → Abrir); não
  // aparece na página da marca (a lista pública de jogos) para não duplicar
  // o Nine Oils a sério aos olhos de quem só vê essa página.
  hidden: true,
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
});
