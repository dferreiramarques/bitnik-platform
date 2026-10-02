// Consola › Aparência (ADR-008): edita os tokens da marca e de cada jogo,
// escolhe o tema e pré-visualiza ao vivo com o cenário do pacote a correr
// no browser (o mesmo motor e a mesma UI das mesas).
import { applyGameSkin, applyOverrides, contrast } from '/appearance.js';
import { translate } from '/engine/i18n.js';
import { isDesignTokens, designTokensToAppearance } from '/design-tokens.js';
import { ANIMATIONS, MAX_FRAMES, watchAnimations } from '/animation.js';

const MAX_IMAGE_KB = 300;
// Sentinela para reutilizar a fiação de input/upload/reset dos tokens (data-tok
// etc.) num campo que não é um token CSS: a miniatura do jogo (página da
// marca) vive em draft.games[id].thumbnail, não em .tokens (setToken trata
// este caso à parte). O fundo do lobby não tem campo nenhum — é sempre o
// --table-bg do próprio jogo, escurecido (app.css).
const THUMB_KEY = '__thumbnail';
const BRAND_LABELS = {
  '--brand-primary': 'Primária', '--brand-secondary': 'Secundária', '--brand-accent': 'Acento',
  '--bg': 'Fundo', '--bg-alt': 'Fundo alternativo', '--text': 'Texto', '--text-muted': 'Texto secundário',
  '--border': 'Linhas', '--font-display': 'Letra de títulos', '--font-body': 'Letra de texto', '--radius-md': 'Arredondamento',
};
const BRAND_CONTRAST = [['--text', '--bg'], ['--text-muted', '--bg'], ['--text', '--bg-alt']];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const isHex = (v) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v).trim());
/** rgb()/rgba() → { hex, a }; o seletor de cor só mostra hex, a transparência guarda-se à parte. */
const parseRgb = (v) => {
  const m = String(v).trim().match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
  if (!m) return null;
  const hex = `#${[m[1], m[2], m[3]].map((n) => Math.min(255, +n).toString(16).padStart(2, '0')).join('')}`;
  const a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4];
  return { hex, a };
};
/** Valor do seletor de cor para um token (hex, ou a parte rgb de um rgba); null se não for cor simples. */
const swatchOf = (v) => (isHex(v) ? String(v).trim() : parseRgb(v)?.hex ?? null);
/** Cor escolhida no seletor, mantendo a transparência do valor atual (rgba). */
const fromSwatch = (hex, current) => {
  const rgb = parseRgb(current);
  if (!rgb || rgb.a >= 1) return hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${+rgb.a.toFixed(3)})`;
};
const clone = (x) => JSON.parse(JSON.stringify(x));
const empty = () => ({ brand: { tokens: {} }, games: {} });

let ctx = null;
const st = { catalog: null, draft: null, saved: '', target: null, preview: null, handlers: false, tab: 'components' };

export function init(context) { ctx = context; }

export async function load() {
  if (st.catalog) return;
  st.catalog = await ctx.api('appearance');
  st.draft = { ...empty(), ...clone(st.catalog.appearance) };
  st.saved = JSON.stringify(st.draft);
  st.target ??= st.catalog.games[0]?.id ?? 'brand';
}

export function leave() {
  st.preview?.anim?.stop();
  try { st.preview?.mod.unmount?.(); } catch { /* nada */ }
  st.preview = null;
  if (st.catalog) applyOverrides(JSON.parse(st.saved)); // o que não foi guardado não fica
}

const game = () => st.catalog.games.find((g) => g.id === st.target) || null;
const gameCfg = (id) => { st.draft.games[id] ??= { theme: null, tokens: {}, thumbnail: null }; return st.draft.games[id]; };
const lang = () => ctx.lang();
const label = (l) => (typeof l === 'string' ? l : l?.[lang()] ?? l?.pt ?? '');
const dirty = () => JSON.stringify(st.draft) !== st.saved;

/** Valores por omissão de uma coleção e modo (para importar do Figma só o que mudou). */
function defaultsFor(col, mode) {
  if (col === 'brand') {
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(Object.keys(st.catalog.brandTokens).map((k) => [k, cs.getPropertyValue(k).trim()]));
  }
  const g = st.catalog.games.find((x) => x.id === col);
  if (!g) return {};
  const base = Object.fromEntries(Object.entries(g.skin?.tokens || {}).map(([k, d]) => [k, d.value]));
  return { ...base, ...(mode ? g.themes?.[mode]?.tokens : {}) };
}

/** Valor por omissão de um token de jogo: o do tema escolhido, senão o do skin.json. */
function gameDefault(g, k) {
  const theme = st.draft.games[g.id]?.theme;
  return g.themes?.[theme]?.tokens?.[k] ?? g.skin?.tokens?.[k]?.value ?? '';
}

// ─── Vista ───────────────────────────────────────────────────
export function view() {
  const { u } = ctx;
  if (!st.catalog) return '<p class="empty">…</p>';
  const g = game();
  const opts = [`<option value="brand" ${st.target === 'brand' ? 'selected' : ''}>${u('apBrand')}</option>`,
    ...st.catalog.games.map((x) => `<option value="${esc(x.id)}" ${x.id === st.target ? 'selected' : ''}>${esc(x.name)}</option>`)].join('');
  const themeSel = g ? `<label>${u('apTheme')}<select id="apTheme">
      <option value="">${u('apThemeDefault')}</option>
      ${Object.entries(g.themes || {}).map(([k, th]) => `<option value="${esc(k)}" ${st.draft.games[g.id]?.theme === k ? 'selected' : ''}>${esc(label(th?.name) || k)}</option>`).join('')}
    </select></label>` : '';
  return `<div><h1>${u('nav_aparencia')}</h1><p class="con-lead">${u('apLead')}</p></div>
    <div class="ap">
      <div class="panel ap-editor">
        <form class="form" id="apHead" onsubmit="return false">
          <label>${u('apTarget')}<select id="apTarget">${opts}</select></label>
          ${themeSel}
        </form>
        ${presetsHtml()}
        ${g ? gameGroups(g) : brandGroups()}
        <div class="ap-contrast" id="apContrast">${contrastHtml()}</div>
        <p class="ap-dirty" id="apDirty" ${dirty() ? '' : 'hidden'}>${u('apUnsaved')}</p>
        <div class="ap-actions">
          <button class="btn btn-primary" data-ap="save">${u('apSave')}</button>
          <button class="btn btn-outline" data-ap="discard">${u('apDiscard')}</button>
          <button class="btn btn-ghost" data-ap="reset-all">${u('apResetAll')}</button>
          <button class="btn btn-ghost" data-ap="export">${u('apExport')}</button>
          <label class="btn btn-ghost ap-file">${u('apImport')}<input type="file" accept="application/json" data-ap="import" hidden></label>
        </div>
      </div>
      <div class="panel ap-preview">
        <h2>${u('apPreview')}</h2>
        ${g ? `<p class="con-lead">${u('apPreviewNote')}</p><div id="apPreview" class="ap-stage"></div>` : brandSample()}
      </div>
    </div>`;
}

/** Animação de uma imagem: escolhe-se o efeito e juntam-se frames com o + (o frame 1 é a própria imagem). */
function animHtml(k, cfg) {
  const { u } = ctx;
  const a = cfg.anims?.[k];
  const hasImg = !!cfg.tokens?.[k];
  const options = Object.entries(ANIMATIONS)
    .map(([id, name]) => `<option value="${id}" ${a?.name === id ? 'selected' : ''}>${esc(name)}</option>`).join('');
  let frames = '';
  if (a && hasImg) {
    const list = [cfg.tokens[k], ...(a.frames || [])];
    const thumbs = list.map((f, i) => `<span class="ap-frame" title="${esc(u('apFrame', { n: i + 1 }))}"><i style="background-image:${esc(f)}"></i><small>${i + 1}</small>${i
      ? `<button type="button" class="ap-frame-x" data-frame-del="${esc(k)}" data-i="${i - 1}" aria-label="${esc(u('apDelFrame'))}">✕</button>` : ''}</span>`).join('');
    const add = list.length < MAX_FRAMES
      ? `<label class="ap-frame ap-frame-add" title="${esc(u('apAddFrame'))}">+<input type="file" accept="image/*" data-frame-upload="${esc(k)}" hidden></label>` : '';
    frames = `<div class="ap-frames">${thumbs}${add}</div><small>${esc(u('apAnimHint'))}</small>`;
  }
  return `<div class="ap-anim"><label>${esc(u('apAnim'))}
      <select data-anim-sel="${esc(k)}" ${hasImg ? '' : 'disabled'}><option value="">${esc(u('apAnimNone'))}</option>${options}</select></label>
    ${hasImg ? '' : `<small>${esc(u('apAnimNeedsImage'))}</small>`}${frames}</div>`;
}

function row(k, type, lbl, value, def, extra = '') {
  const { u } = ctx;
  const id = `ap${k.replace(/[^a-z0-9]/gi, '')}`;
  const shown = value || def;
  const input = ['background', 'image'].includes(type)
    ? `<textarea id="${id}" data-tok="${esc(k)}" data-type="${type}" rows="2" placeholder="${esc(String(def).slice(0, 120))}">${esc(value)}</textarea>
       <label class="btn btn-ghost ap-file">${u('apUpload')}<input type="file" accept="image/*" data-upload="${esc(k)}" data-type="${type}" hidden></label>`
    : `${type === 'color' ? `<input type="color" class="ap-swatch" data-swatch="${esc(k)}" value="${esc(swatchOf(shown) || '#000000')}" ${swatchOf(shown) ? '' : 'disabled'} aria-label="${esc(lbl)}">` : ''}
       <input id="${id}" data-tok="${esc(k)}" data-type="${type}" value="${esc(value)}" placeholder="${esc(def)}">`;
  return `<div class="ap-row${value ? ' set' : ''}">
    <label for="${id}">${esc(lbl)}<small>${esc(k)}${def && !['background', 'image'].includes(type) ? ` · ${esc(u('apDefault', { v: def }))}` : ''}</small></label>
    <div class="ap-input">${input}
      <button class="btn btn-ghost" data-reset="${esc(k)}" ${value ? '' : 'hidden'}>${u('apReset')}</button></div>
    ${extra}
  </div>`;
}

/** Miniatura do jogo na página da marca: não é um token do skin.json, mas
 * reutiliza a mesma fiação (data-tok/data-upload/data-reset) através do
 * sentinela THUMB_KEY. O fundo do lobby não tem campo — é sempre o
 * --table-bg do próprio jogo (tokens da mesa, acima), escurecido. */
function thumbRow(g) {
  const { u } = ctx;
  const value = st.draft.games[g.id]?.thumbnail || '';
  return `<fieldset class="ap-group"><legend>${esc(u('grp_thumb'))}</legend>
    <div class="ap-row${value ? ' set' : ''}">
      <label for="apThumb">${esc(u('apThumb'))}<small>${esc(u('apThumbHint'))}</small></label>
      <div class="ap-input">
        <textarea id="apThumb" data-tok="${THUMB_KEY}" data-type="image" rows="2" placeholder="url(&quot;/games/${esc(g.id)}/ui/thumbnail.jpg&quot;)">${esc(value)}</textarea>
        <label class="btn btn-ghost ap-file">${u('apUpload')}<input type="file" accept="image/*" data-upload="${THUMB_KEY}" data-type="image" hidden></label>
        <button class="btn btn-ghost" data-reset="${THUMB_KEY}" ${value ? '' : 'hidden'}>${u('apReset')}</button>
      </div>
    </div>
  </fieldset>`;
}

// Grupos de "aspeto do jogo" (identidade: cores base, letra, forma, arte); o
// resto — mesa incluída — é "aspeto dos componentes" (as peças da mesa).
const GAME_TAB_GROUPS = new Set(['base', 'type', 'shape', 'art']);

function gameGroups(g) {
  const tokens = g.skin?.tokens || {};
  const cfg = st.draft.games[g.id] || { tokens: {} };
  const groups = new Map();
  for (const [k, def] of Object.entries(tokens)) {
    const grp = def.group || 'base';
    if (!groups.has(grp)) groups.set(grp, []);
    groups.get(grp).push(row(k, def.type, label(def.label) || k, cfg.tokens?.[k] ?? '', gameDefault(g, k), def.type === 'image' ? animHtml(k, cfg) : ''));
  }
  // A mesa primeiro dentro de "componentes" (ADR-008) — é o --table-bg que também pinta o lobby.
  const order = ['table', ...[...groups.keys()].filter((x) => x !== 'table')];
  const tab = st.tab === 'game' ? 'game' : 'components';
  const fieldsets = order.filter((x) => groups.has(x) && (GAME_TAB_GROUPS.has(x) === (tab === 'game')))
    .map((grp) => `<fieldset class="ap-group"><legend>${esc(ctx.u(`grp_${grp}`))}</legend>${groups.get(grp).join('')}</fieldset>`).join('');
  const { u } = ctx;
  const tabs = `<div class="ap-tabs" role="tablist">
    <button type="button" class="ap-tab${tab === 'game' ? ' on' : ''}" role="tab" aria-selected="${tab === 'game'}" data-tab="game">${u('apTabGame')}</button>
    <button type="button" class="ap-tab${tab === 'components' ? ' on' : ''}" role="tab" aria-selected="${tab === 'components'}" data-tab="components">${u('apTabComponents')}</button>
  </div>`;
  return tabs + (tab === 'game' ? fieldsets + thumbRow(g) : fieldsets);
}

function presetsHtml() {
  const { u } = ctx;
  const target = st.target;
  const list = (st.catalog.presets || []).filter((p) => p.target === target);
  const opts = [`<option value="">${u('apPresetNone')}</option>`,
    ...list.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`)].join('');
  return `<fieldset class="ap-group ap-presets">
    <legend>${u('apPresets')}</legend>
    <div class="ap-preset-row">
      <select id="apPresetSelect">${opts}</select>
      <button class="btn btn-outline" type="button" data-ap="preset-apply" ${list.length ? '' : 'disabled'}>${u('apPresetApply')}</button>
      <button class="btn btn-ghost" type="button" data-ap="preset-delete" ${list.length ? '' : 'disabled'}>${u('apPresetDelete')}</button>
    </div>
    <div class="ap-preset-row">
      <input id="apPresetName" placeholder="${esc(u('apPresetNamePh'))}">
      <button class="btn btn-primary" type="button" data-ap="preset-save">${u('apPresetSaveAs')}</button>
    </div>
  </fieldset>`;
}

function brandGroups() {
  const tokens = st.draft.brand.tokens;
  const cs = getComputedStyle(document.documentElement);
  const rows = Object.entries(st.catalog.brandTokens).map(([k, type]) => row(k, type, BRAND_LABELS[k] || k, tokens[k] ?? '', cs.getPropertyValue(k).trim()));
  return `<fieldset class="ap-group"><legend>${ctx.u('grp_brand')}</legend>${rows.join('')}</fieldset>`;
}

function brandSample() {
  return `<div class="ap-sample">
    <h3 style="font-family:var(--ui-display)">Catania</h3>
    <p>Funda aldeias na sombra do Etna.</p>
    <div class="ap-sample-btns"><button class="btn btn-primary" type="button">2 jogadores</button>
      <button class="btn btn-outline" type="button">Sentar</button><button class="btn" type="button">Ver</button></div>
    <ul class="rows"><li><span class="grow">Mesa de 2<small>A decorrer, Ronda 3</small></span></li></ul>
  </div>`;
}

function contrastHtml() {
  const { u } = ctx;
  const g = game();
  let pairs;
  let value;
  if (g) {
    pairs = g.skin?.contrast || [];
    value = (k) => st.draft.games[g.id]?.tokens?.[k] || gameDefault(g, k);
  } else {
    pairs = BRAND_CONTRAST;
    const cs = getComputedStyle(document.documentElement);
    value = (k) => cs.getPropertyValue(k).trim();
  }
  const low = pairs.map(([a, b]) => ({ a, b, r: contrast(value(a), value(b)) })).filter((x) => x.r != null && x.r < 4.5);
  return `<h3>${u('apContrast')}</h3>${low.length
    ? `<ul>${low.map((x) => `<li>⚠ ${esc(u('apContrastLow', { a: x.a, b: x.b, r: x.r }))}</li>`).join('')}</ul>`
    : `<p>✓ ${u('apContrastOk')}</p>`}`;
}

// ─── Pré-visualização (motor + UI do pacote no browser) ─────
async function mountPreview(host) {
  const g = game();
  if (!g?.meta?.ui || !g.meta.pkg) return;
  await applyGameSkin(g.meta, st.draft.games[g.id]?.theme);
  if (st.preview?.gameId === g.id) { host.replaceChildren(st.preview.el); return; }
  st.preview?.anim?.stop();
  try { st.preview?.mod.unmount?.(); } catch { /* nada */ }
  const [{ default: pkg }, engine, mod] = await Promise.all([import(g.meta.pkg), import('@bitnik/engine'), import(g.meta.ui)]);
  const pv = g.meta.preview || { players: pkg.players.min };
  let match = engine.createMatch(pkg, { numPlayers: pv.players, seed: 'preview', options: pv.scenario ? { scenario: pv.scenario } : {} });
  const el = document.createElement('div');
  el.className = 'game-root';
  el.dataset.game = g.id;
  const names = ['Tu', 'Tales', 'Platão', 'Zenão'];
  const push = () => mod.update({ ...engine.viewFor(pkg, match, 0), seat: 0 });
  mod.mount(el, {
    gameId: g.id, lang: () => lang(),
    t: (key, params) => translate(pkg, lang(), key, params),
    seatName: (i) => names[i] ?? `#${i + 1}`,
    toast: ctx.toast,
    messages: false, // sem "É a tua vez" por cima da pré-visualização
    move: (mv) => { const r = engine.applyMove(pkg, match, 0, mv); if (r.ok) { match = r.match; push(); } return r.ok; },
  });
  st.preview = { gameId: g.id, el, mod, anim: watchAnimations(el, () => st.draft.games[g.id]) };
  host.replaceChildren(el);
  push();
}

// ─── Eventos ────────────────────────────────────────────────
function refresh(root) {
  applyOverrides(st.draft);
  const c = root.querySelector('#apContrast');
  if (c) c.innerHTML = contrastHtml();
  const d = root.querySelector('#apDirty');
  if (d) d.hidden = !dirty();
}

function setToken(k, v) {
  const g = game();
  if (k === THUMB_KEY) { if (g) gameCfg(g.id).thumbnail = v || null; return; }
  const tokens = g ? gameCfg(g.id).tokens : st.draft.brand.tokens;
  if (v) tokens[k] = v; else { delete tokens[k]; dropAnim(g, k); } // sem imagem, não há o que animar
}

function dropAnim(g, k) {
  const anims = g && st.draft.games[g.id]?.anims;
  if (!anims) return;
  delete anims[k];
  if (!Object.keys(anims).length) delete st.draft.games[g.id].anims;
}

function download(name, data) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const readFile = (file, how) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  if (how === 'text') r.readAsText(file); else r.readAsDataURL(file);
});

export function after(root) {
  applyOverrides(st.draft);
  st.preview?.anim?.rescan(); // a configuração de animação pode ter mudado
  const host = root.querySelector('#apPreview');
  if (host) mountPreview(host).catch((e) => { console.error('[aparência]', e); host.textContent = String(e.message || e); });
  if (st.handlers) return;
  st.handlers = true;
  // Delegação no #view: os elementos são redesenhados, os listeners ficam.
  root.addEventListener('input', (e) => {
    const tok = e.target.dataset.tok;
    const sw = e.target.dataset.swatch;
    if (!tok && !sw) return;
    const k = tok || sw;
    const text = root.querySelector(`[data-tok="${CSS.escape(k)}"]`);
    const v = sw ? fromSwatch(e.target.value.trim(), text?.value || text?.placeholder) : e.target.value.trim();
    setToken(k, v);
    if (sw && text) text.value = v;
    const swatch = root.querySelector(`[data-swatch="${CSS.escape(k)}"]`);
    if (tok && swatch) { const c = swatchOf(v || text?.placeholder); swatch.disabled = !c; if (c) swatch.value = c; }
    const reset = root.querySelector(`[data-reset="${CSS.escape(k)}"]`);
    if (reset) reset.hidden = !v;
    const animSel = root.querySelector(`[data-anim-sel="${CSS.escape(k)}"]`);
    if (animSel) animSel.disabled = !v; // sem imagem (frame 1) não há animação
    e.target.closest('.ap-row')?.classList.toggle('set', !!v);
    refresh(root);
  });
  root.addEventListener('change', async (e) => {
    const { u } = ctx;
    if (e.target.id === 'apTarget') { st.target = e.target.value; ctx.rerender(); return; }
    if (e.target.id === 'apTheme') {
      const g = game();
      gameCfg(g.id).theme = e.target.value || null;
      await applyGameSkin(g.meta, gameCfg(g.id).theme);
      ctx.rerender();
      return;
    }
    const animSel = e.target.dataset.animSel;
    if (animSel) {
      const c = gameCfg(game().id);
      if (e.target.value) (c.anims ??= {})[animSel] = { name: e.target.value, frames: c.anims?.[animSel]?.frames || [] };
      else dropAnim(game(), animSel);
      ctx.rerender();
      return;
    }
    const frameUp = e.target.dataset.frameUpload;
    if (frameUp && e.target.files?.[0]) {
      const file = e.target.files[0];
      if (file.size > MAX_IMAGE_KB * 1024) { ctx.toast(u('apTooBig', { kb: MAX_IMAGE_KB })); return; }
      const a = gameCfg(game().id).anims?.[frameUp];
      if (!a || a.frames.length >= MAX_FRAMES - 1) return;
      a.frames.push(`url("${await readFile(file, 'url')}")`);
      ctx.rerender();
      return;
    }
    const up = e.target.dataset.upload;
    if (up && e.target.files?.[0]) {
      const file = e.target.files[0];
      if (file.size > MAX_IMAGE_KB * 1024) { ctx.toast(u('apTooBig', { kb: MAX_IMAGE_KB })); return; }
      const data = await readFile(file, 'url');
      const v = e.target.dataset.type === 'background' ? `url("${data}") center / cover no-repeat` : `url("${data}")`;
      setToken(up, v);
      ctx.rerender();
      return;
    }
    if (e.target.dataset.ap === 'import' && e.target.files?.[0]) {
      try {
        const data = JSON.parse(await readFile(e.target.files[0], 'text'));
        if (typeof data !== 'object' || !data) throw new Error();
        if (isDesignTokens(data)) {
          // Variables exportadas do Figma (W3C Design Tokens): só as coleções que vêm no ficheiro mudam.
          const got = designTokensToAppearance(data, { defaults: defaultsFor });
          if (Object.keys(got.brand.tokens).length) st.draft.brand.tokens = got.brand.tokens;
          for (const [id, cfg] of Object.entries(got.games)) if (st.catalog.games.some((g) => g.id === id)) st.draft.games[id] = cfg;
        } else {
          st.draft = { brand: { tokens: { ...(data.brand?.tokens || {}) } }, games: clone(data.games || {}) };
        }
        ctx.toast(u('apImported'));
      } catch { ctx.toast(u('apBadJson')); }
      ctx.rerender();
    }
  });
  root.addEventListener('click', async (e) => {
    const { u } = ctx;
    const reset = e.target.closest('[data-reset]')?.dataset.reset;
    if (reset) { setToken(reset, ''); ctx.rerender(); return; }
    const del = e.target.closest('[data-frame-del]');
    if (del) {
      gameCfg(game().id).anims?.[del.dataset.frameDel]?.frames.splice(Number(del.dataset.i), 1);
      ctx.rerender();
      return;
    }
    const tab = e.target.closest('button[data-tab]')?.dataset.tab;
    if (tab) { st.tab = tab; ctx.rerender(); return; }
    const act = e.target.closest('button[data-ap]')?.dataset.ap;
    if (!act) return;
    const g = game();
    try {
      if (act === 'save') {
        const { appearance } = await ctx.api('appearance', { method: 'PUT', body: st.draft });
        st.draft = { ...empty(), ...clone(appearance) };
        st.saved = JSON.stringify(st.draft);
        ctx.toast(u('apSaved'));
      } else if (act === 'discard') {
        st.draft = JSON.parse(st.saved);
        if (g) await applyGameSkin(g.meta, st.draft.games[g.id]?.theme);
      } else if (act === 'reset-all') {
        if (g) delete st.draft.games[g.id]; else st.draft.brand.tokens = {};
        if (g) await applyGameSkin(g.meta, null);
      } else if (act === 'export') {
        download(`aparencia-${new Date().toISOString().slice(0, 10)}.json`, st.draft);
        return;
      } else if (act === 'preset-apply') {
        const sel = root.querySelector('#apPresetSelect');
        const p = (st.catalog.presets || []).find((x) => x.id === sel?.value);
        if (!p) return;
        if (p.target === 'brand') st.draft.brand.tokens = { ...p.tokens };
        else Object.assign(gameCfg(p.target), { tokens: { ...p.tokens }, theme: p.theme ?? null });
        if (g) await applyGameSkin(g.meta, st.draft.games[g.id]?.theme);
        ctx.toast(u('apPresetApplied', { name: p.name }));
      } else if (act === 'preset-delete') {
        const sel = root.querySelector('#apPresetSelect');
        const p = (st.catalog.presets || []).find((x) => x.id === sel?.value);
        if (!p || !confirm(u('apPresetDeleteConfirm', { name: p.name }))) return;
        await ctx.api(`appearance/presets/${p.id}`, { method: 'DELETE' });
        st.catalog.presets = (st.catalog.presets || []).filter((x) => x.id !== p.id);
        ctx.toast(u('apPresetDeleted'));
      } else if (act === 'preset-save') {
        const name = root.querySelector('#apPresetName')?.value.trim();
        if (!name) { ctx.toast(u('apPresetNameNeeded')); return; }
        const body = g ? { target: g.id, name, theme: st.draft.games[g.id]?.theme ?? null, tokens: st.draft.games[g.id]?.tokens || {} }
          : { target: 'brand', name, tokens: st.draft.brand.tokens };
        const { preset } = await ctx.api('appearance/presets', { method: 'POST', body });
        st.catalog.presets = [...(st.catalog.presets || []).filter((x) => !(x.target === preset.target && x.name === preset.name)), preset];
        ctx.toast(u('apPresetSaved', { name: preset.name }));
      }
    } catch (err) {
      ctx.toast(err.message);
      return;
    }
    ctx.rerender();
  });
}
