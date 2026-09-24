// Textos do próprio motor (erros genéricos). Os jogos trazem os seus.
export const ENGINE_I18N = {
  pt: {
    'engine.GAME_OVER': 'O jogo já terminou.',
    'engine.NOT_ACTIVE': 'Não é a tua vez.',
    'engine.UNKNOWN_MOVE': 'Jogada desconhecida: {type}.',
    'engine.UNKNOWN_EVENT': 'Evento desconhecido: {event}.',
  },
  en: {
    'engine.GAME_OVER': 'The game is over.',
    'engine.NOT_ACTIVE': 'It is not your turn.',
    'engine.UNKNOWN_MOVE': 'Unknown move: {type}.',
    'engine.UNKNOWN_EVENT': 'Unknown event: {event}.',
  },
};

/**
 * Traduz uma chave. Procura no jogo, depois no motor, depois na
 * língua por omissão do jogo. Parâmetros entram como {nome}.
 */
export function translate(game, lang, key, params = {}) {
  const fallback = game?.defaultLang || 'pt';
  const bundles = [
    game?.i18n?.[lang], ENGINE_I18N[lang],
    game?.i18n?.[fallback], ENGINE_I18N[fallback],
  ];
  let text = key;
  for (const b of bundles) {
    if (b && b[key] != null) { text = b[key]; break; }
  }
  return String(text).replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    if (v == null) return `{${k}}`;
    // Parâmetros que começam por "@" são chaves a traduzir (ex.: nomes de recursos).
    if (typeof v === 'string' && v.startsWith('@')) return translate(game, lang, v.slice(1));
    return String(v);
  });
}

/** Lista as chaves em falta entre línguas (paridade de i18n). */
export function i18nGaps(game) {
  const langs = Object.keys(game.i18n || {});
  const all = new Set(langs.flatMap((l) => Object.keys(game.i18n[l])));
  const gaps = [];
  for (const l of langs) {
    for (const k of all) if (!(k in game.i18n[l])) gaps.push(`${l}:${k}`);
  }
  return gaps;
}
