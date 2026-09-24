// Ponte entre os tokens da plataforma (skin.json, aparência) e o formato
// W3C Design Tokens (DTCG), que o Figma importa e exporta como Variables.
// Funções puras: usadas pela consola (importar) e por tools/figma.js (exportar).
//
// Cada token leva $extensions.bitnik.token com o nome CSS original, para a
// volta (Figma → consola) não depender dos nomes que o designer der.

const DTCG_TYPE = { color: 'color', size: 'dimension', font: 'fontFamily', background: 'string', image: 'string' };

/** Converte um skin.json (e, opcionalmente, os valores de um tema) num documento DTCG. */
export function skinToDesignTokens(skin, { collection, mode = 'default', values = {}, lang = 'pt' } = {}) {
  const doc = {};
  for (const [name, def] of Object.entries(skin.tokens || {})) {
    const group = def.group || 'base';
    doc[group] ??= {};
    const key = name.replace(/^--/, '');
    const label = typeof def.label === 'string' ? def.label : def.label?.[lang];
    doc[group][key] = {
      $type: DTCG_TYPE[def.type] || 'string',
      $value: values[name] ?? def.value,
      ...(label ? { $description: label } : {}),
      $extensions: { bitnik: { token: name, type: def.type, collection, mode } },
    };
  }
  return doc;
}

/** Percorre um documento DTCG e devolve os tokens com o nome CSS e o valor. */
export function readDesignTokens(doc) {
  const out = [];
  const walk = (node, path) => {
    if (!node || typeof node !== 'object') return;
    if ('$value' in node) {
      const ext = node.$extensions?.bitnik || {};
      const name = ext.token || `--${path.join('-')}`;
      const v = node.$value;
      out.push({ name, value: typeof v === 'number' ? `${v}px` : String(v), collection: ext.collection ?? null, mode: ext.mode ?? null });
      return;
    }
    for (const [k, child] of Object.entries(node)) if (!k.startsWith('$')) walk(child, [...path, k]);
  };
  walk(doc, []);
  return out;
}

/** Diz se um JSON parece um documento DTCG (em vez de uma aparência exportada da consola). */
export const isDesignTokens = (doc) => readDesignTokens(doc).length > 0 && !('games' in (doc || {})) && !('brand' in (doc || {}));

/**
 * Converte tokens vindos do Figma numa aparência da consola:
 * a coleção 'brand' vai para brand.tokens; as outras para games[coleção].tokens.
 * O modo (ex.: 'dia') passa a ser o tema do jogo. Só ficam os valores diferentes
 * dos por omissão desse modo (`defaults(coleção, modo)`), para não fixar o que não mudou.
 */
export function designTokensToAppearance(doc, { defaults = () => ({}) } = {}) {
  const appearance = { brand: { tokens: {} }, games: {} };
  for (const t of readDesignTokens(doc)) {
    const col = t.collection;
    if (!col) continue;
    const mode = t.mode && t.mode !== 'default' ? t.mode : null;
    const same = defaults(col, mode)?.[t.name] === t.value;
    if (col === 'brand') {
      if (!same) appearance.brand.tokens[t.name] = t.value;
      continue;
    }
    appearance.games[col] ??= { theme: mode, tokens: {} };
    if (!same) appearance.games[col].tokens[t.name] = t.value;
  }
  return appearance;
}
