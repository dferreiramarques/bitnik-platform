// Ponte com o Figma (ADR-008): exporta os tokens para Variables do Figma,
// em formato W3C Design Tokens (DTCG), e converte a volta para a consola.
//
//   npm run figma                     → design/figma/*.tokens.json
//   npm run figma -- import ficheiro  → aparência para "Importar JSON" na consola
//
// Um ficheiro por coleção e modo: brand, vanilla, e <jogo>.<modo> (o skin do
// pacote é o modo "default"; cada tema é um modo com o mesmo nome).
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { BRAND_TOKENS } from '@bitnik/server';
import { skinToDesignTokens, designTokensToAppearance } from '../packages/server/public/design-tokens.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'design', 'figma');
const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

// Valores de referência da marca (os do design system v1.0.0 usados pela UI por omissão).
const BRAND_DEFAULTS = {
  '--brand-primary': '#b8461f', '--brand-secondary': '#ea7c2e', '--brand-accent': '#e8a93b',
  '--bg': '#fbf3e4', '--bg-alt': '#f3e4cb', '--text': '#2b1b12', '--text-muted': '#5b4636', '--border': '#ecd6ac',
  '--font-display': "'Baloo 2', system-ui, sans-serif", '--font-body': 'Inter, system-ui, sans-serif', '--radius-md': '14px',
};
export const brandSkin = () => ({
  tokens: Object.fromEntries(Object.entries(BRAND_TOKENS).map(([k, type]) => [k, { value: BRAND_DEFAULTS[k], type, group: 'brand' }])),
});

/** Jogos do repo com skin: [{ id, skin, themes: { nome: tema } }]. */
export async function gameSkins() {
  const out = [];
  for (const dir of await readdir(join(ROOT, 'games'))) {
    const index = join(ROOT, 'games', dir, 'index.js');
    if (!existsSync(index)) continue;
    const game = (await import(pathToFileURL(index).href)).default;
    if (!game.skin) continue;
    const base = join(ROOT, 'games', dir);
    const skin = await readJson(join(base, game.skin));
    const themes = {};
    for (const [name, rel] of Object.entries(game.themes || {})) themes[name] = await readJson(join(base, rel));
    out.push({ id: game.id, skin, themes });
  }
  return out;
}

/** Todos os documentos a exportar: nome do ficheiro → documento DTCG. */
export async function exportAll() {
  const files = {
    'brand.tokens.json': { brand: skinToDesignTokens(brandSkin(), { collection: 'brand' }) },
    'vanilla.tokens.json': { vanilla: skinToDesignTokens(await readJson(join(ROOT, 'design', 'vanilla', 'skin.json')), { collection: 'vanilla' }) },
  };
  for (const g of await gameSkins()) {
    files[`${g.id}.default.tokens.json`] = { [g.id]: skinToDesignTokens(g.skin, { collection: g.id }) };
    for (const [name, theme] of Object.entries(g.themes)) {
      files[`${g.id}.${name}.tokens.json`] = { [g.id]: skinToDesignTokens(g.skin, { collection: g.id, mode: name, values: theme.tokens }) };
    }
  }
  return files;
}

/** Valores por omissão de uma coleção e modo, para a volta só guardar o que mudou. */
export async function defaultsFor() {
  const games = Object.fromEntries((await gameSkins()).map((g) => [g.id, g]));
  const brand = Object.fromEntries(Object.entries(brandSkin().tokens).map(([k, d]) => [k, d.value]));
  return (col, mode) => {
    if (col === 'brand') return brand;
    const g = games[col];
    if (!g) return {};
    const base = Object.fromEntries(Object.entries(g.skin.tokens).map(([k, d]) => [k, d.value]));
    return { ...base, ...(mode ? g.themes[mode]?.tokens : {}) };
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd = 'export', file] = process.argv.slice(2);
  if (cmd === 'import') {
    if (!file) throw new Error('uso: npm run figma -- import ficheiro.tokens.json');
    const appearance = designTokensToAppearance(await readJson(file), { defaults: await defaultsFor() });
    console.log(JSON.stringify(appearance, null, 2));
  } else {
    await mkdir(OUT, { recursive: true });
    const files = await exportAll();
    for (const [name, doc] of Object.entries(files)) await writeFile(join(OUT, name), `${JSON.stringify(doc, null, 2)}\n`);
    console.log(`Exportados para design/figma/: ${Object.keys(files).join(', ')}`);
  }
}
