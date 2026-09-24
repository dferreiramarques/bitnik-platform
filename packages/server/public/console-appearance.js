// Consola › Aparência (ADR-008): edita os tokens da marca e de cada jogo,
// escolhe o tema e pré-visualiza ao vivo com o cenário do pacote a correr
// no browser (o mesmo motor e a mesma UI das mesas).
import { applyGameSkin, applyOverrides, contrast } from '/appearance.js';
import { translate } from '/engine/i18n.js';
import { isDesignTokens, designTokensToAppearance } from '/design-tokens.js';

const MAX_IMAGE_KB = 300;
const BRAND_LABELS = {
  '--brand-primary': 'Primária', '--brand-secondary': 'Secundária', '--brand-accent': 'Acento',
  '--bg': 'Fundo', '--bg-alt': 'Fundo alternativo', '--text': 'Texto', '--text-muted': 'Texto secundário',
  '--border': 'Linhas', '--font-display': 'Letra de títulos', '--font-body': 'Letra de texto', '--radius-md': 'Arredondamento',
};
const BRAND_CONTRAST = [['--text', '--bg'], ['--text-muted', '--bg'], ['--text', '--bg-alt']];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const isHex = (v) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v).trim());
const clone = (x) => JSON.parse(JSON.stringify(x));
const empty = () => ({ brand: { tokens: {} }, games: {} });

let ctx = null;
const st = { catalog: null, draft: null, saved: '', target: null, preview: null, handlers: false };

export function init(context) { ctx = context; }

export async function load() {
  if (st.catalog) return;
  st.catalog = await ctx.api('appearance');
  st.draft = { ...empty(), ...clone(st.catalog.appearance) };
  st.saved = JSON.stringify(st.draft);
  st.target ??= st.catalog.games[0]?.id ?? 'brand';
}

export function leave() {
  try { st.preview?.mod.unmount?.(); } catch { /* nada */ }
  st.preview = null;
  if (st.catalog) applyOverrides(JSON.parse(st.saved)); // o que não foi guardado não fica
}

const game = () => st.catalog.games.find((g) => g.id === st.target) || null;
const gameCfg = (id) => { st.draft.games[id] ??= { theme: null, tokens: {} }; return st.draft.games[id]; };
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

function row(k, type, lbl, value, def) {
  const { u } = ctx;
  const id = `ap${k.replace(/[^a-z0-9]/gi, '')}`;
  const shown = value || def;
  const input = ['background', 'image'].includes(type)
    ? `<textarea id="${id}" data-tok="${esc(k)}" data-type="${type}" rows="2" placeholder="${esc(String(def).slice(0, 120))}">${esc(value)}</textarea>
       <label class="btn btn-ghost ap-file">${u('apUpload')}<input type="file" accept="image/*" data-upload="${esc(k)}" data-type="${type}" hidden></label>`
    : `${type === 'color' ? `<input type="color" class="ap-swatch" data-swatch="${esc(k)}" value="${isHex(shown) ? esc(shown) : '#000000'}" ${isHex(shown) ? '' : 'disabled'} aria-label="${esc(lbl)}">` : ''}
       <input id="${id}" data-tok="${esc(k)}" data-type="${type}" value="${esc(value)}" placeholder="${esc(def)}">`;
  return `<div class="ap-row${value ? ' set' : ''}">
    <label for="${id}">${esc(lbl)}<small>${esc(k)}${def && !['background', 'image'].includes(type) ? ` · ${esc(u('apDefault', { v: def }))}` : ''}</small></label>
    <div class="ap-input">${input}
      <button class="btn btn-ghost" data-reset="${esc(k)}" ${value ? '' : 'hidden'}>${u('apReset')}</button></div>
  </div>`;
}

function gameGroups(g) {
  const tokens = g.skin?.tokens || {};
  const cfg = st.draft.games[g.id] || { tokens: {} };
  const groups = new Map();
  for (const [k, def] of Object.entries(tokens)) {
    const grp = def.group || 'base';
    if (!groups.has(grp)) groups.set(grp, []);
    groups.get(grp).push(row(k, def.type, label(def.label) || k, cfg.tokens?.[k] ?? '', gameDefault(g, k)));
  }
  // A mesa primeiro (ADR-008).
  const order = ['table', ...[...groups.keys()].filter((x) => x !== 'table')];
  return order.filter((x) => groups.has(x)).map((grp) => `<fieldset class="ap-group"><legend>${esc(ctx.u(`grp_${grp}`))}</legend>${groups.get(grp).join('')}</fieldset>`).join('');
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
    move: (mv) => { const r = engine.applyMove(pkg, match, 0, mv); if (r.ok) { match = r.match; push(); } return r.ok; },
  });
  st.preview = { gameId: g.id, el, mod };
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
  const tokens = g ? gameCfg(g.id).tokens : st.draft.brand.tokens;
  if (v) tokens[k] = v; else delete tokens[k];
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
    const v = e.target.value.trim();
    setToken(k, v);
    const text = root.querySelector(`[data-tok="${CSS.escape(k)}"]`);
    if (sw && text) text.value = v;
    const swatch = root.querySelector(`[data-swatch="${CSS.escape(k)}"]`);
    if (tok && swatch) { swatch.disabled = !isHex(v || text?.placeholder); if (isHex(v)) swatch.value = v; }
    const reset = root.querySelector(`[data-reset="${CSS.escape(k)}"]`);
    if (reset) reset.hidden = !v;
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
      }
    } catch (err) {
      ctx.toast(err.message);
      return;
    }
    ctx.rerender();
  });
}
