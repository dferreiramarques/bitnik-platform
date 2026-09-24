// Aparência (ADR-008): aplica, por camadas, a skin de cada jogo e as
// afinações do deploy. Usado pela UI da plataforma e pela consola.
//
//   1. defaults do skin.json do pacote     [data-game="x"]            (0,1,0)
//   2. tema escolhido (tokens + CSS)       [data-game="x"]            (depois, ganha)
//   3. afinações do deploy (consola)       [data-game="x"][data-game] (0,2,0)
//
// Tudo em <style> próprios: tirar uma afinação devolve sempre o valor de baixo.

const cache = new Map(); // url → Promise<json>
const fetchJson = (url) => {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return cache.get(url);
};

function styleEl(id) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.append(el);
  }
  return el;
}

const decls = (tokens) => Object.entries(tokens || {})
  .filter(([k, v]) => /^--[a-z0-9-]+$/.test(k) && v != null && v !== '')
  .map(([k, v]) => `${k}:${v}`).join(';');

/** Carrega o skin.json e o tema de um jogo. */
export async function loadGameSkin(meta, themeName) {
  const skin = meta?.skin ? await fetchJson(meta.skin) : null;
  const themeUrl = themeName && meta?.themes?.[themeName];
  const theme = themeUrl ? await fetchJson(themeUrl) : null;
  return { skin, theme, themeUrl };
}

/** Camadas 1 e 2: defaults do pacote e tema. */
export async function applyGameSkin(meta, themeName) {
  const { skin, theme, themeUrl } = await loadGameSkin(meta, themeName);
  const sel = `[data-game="${meta.id}"]`;
  const defaults = Object.fromEntries(Object.entries(skin?.tokens || {}).map(([k, d]) => [k, d.value]));
  styleEl(`skin-${meta.id}`).textContent = `${sel}{${decls({ ...defaults, ...(theme?.tokens || {}) })}}`;
  // CSS do tema (design à medida), sempre dentro da área da mesa por convenção do tema.
  const linkId = `theme-${meta.id}`;
  document.getElementById(linkId)?.remove();
  if (theme?.css && themeUrl) {
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = new URL(theme.css, new URL(themeUrl, location.href)).href;
    document.head.append(link);
  }
  return { skin, theme };
}

/** Camada 3 dos jogos e tokens da marca (moldura). */
export function applyOverrides(appearance) {
  const games = appearance?.games || {};
  styleEl('appearance-games').textContent = Object.entries(games)
    .map(([id, g]) => `[data-game="${id}"][data-game]{${decls(g.tokens)}}`).join('\n');
  styleEl('appearance-brand').textContent = `:root{${decls(appearance?.brand?.tokens)}}`;
}

// ─── Contraste (WCAG) ────────────────────────────────────────
function rgb(hex) {
  const m = String(hex).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function lum([r, g, b]) {
  const f = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
/** Razão de contraste entre duas cores hex (null se não forem cores hex). */
export function contrast(a, b) {
  const [x, y] = [rgb(a), rgb(b)];
  if (!x || !y) return null;
  const [l1, l2] = [lum(x), lum(y)].sort((p, q) => q - p);
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
}
