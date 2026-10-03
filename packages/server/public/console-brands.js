// Consola › Marcas: perfis de lobby para clientes (publishers). Cada marca tem
// identidade (nome, língua, logótipo, cores e letra), os jogos escolhidos de
// entre todos os da plataforma e a aparência dos jogos. Abre-se em
// /marca/<id> para mostrar ao cliente e exporta-se como pacote (JSON) que o
// runtime do cliente carrega (`profile` do createPlatform / marca.json).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const clone = (x) => JSON.parse(JSON.stringify(x));
const MAX_LOGO_KB = 300;

const TXT = {
  pt: {
    title: 'Marcas', lead: 'Lobbies para clientes: escolhe os jogos, afina a identidade, mostra ao cliente e exporta o pacote para o runtime dele.',
    none: 'Ainda não há marcas.', add: 'Nova marca', edit: 'Editar', open: 'Abrir', export: 'Exportar pacote', remove: 'Apagar',
    removeConfirm: 'Apagar a marca "{name}"? Não se pode desfazer.', games: '{n} jogos',
    name: 'Nome da marca', id: 'Identificador (no link /marca/…)', lang: 'Língua do lobby', logo: 'Logótipo', logoUpload: 'Carregar logótipo', logoRemove: 'Tirar',
    logoHint: 'Substitui o nome no topo e é o ícone do separador. PNG, SVG ou WebP, até {kb} KB.',
    colors: 'Cores e letra', pickGames: 'Jogos desta marca', pickHint: 'Escolhe de entre todos os jogos da plataforma; só estes aparecem no lobby da marca.',
    proto: 'protótipo', skin: 'Aparência dos jogos', skinHint: 'Cores, temas e miniaturas de cada jogo. Copia as que tens agora em Aparência e afina-as aqui por marca.',
    skinCopy: 'Copiar a aparência atual do Studio', skinCopied: 'Aparência copiada ({n} jogos com afinações).', skinClear: 'Limpar',
    skinState: 'Afinações de {n} jogos', skinNone: 'Sem afinações próprias (usa os padrões de cada jogo).',
    save: 'Guardar', cancel: 'Fechar', saved: 'Marca guardada.', preview: 'Pré-visualização', refresh: 'Atualizar', openNew: 'Abrir noutra janela',
    previewHint: 'Guarda primeiro: a pré-visualização mostra a versão guardada.', needName: 'Dá um nome à marca.', needGame: 'Escolhe pelo menos um jogo.',
    langPt: 'Português', langEn: 'English', bigLogo: 'Logótipo demasiado grande (máx. {kb} KB).',
  },
  en: {
    title: 'Brands', lead: 'Lobbies for clients: pick the games, tune the identity, show it to the client and export the package for their runtime.',
    none: 'No brands yet.', add: 'New brand', edit: 'Edit', open: 'Open', export: 'Export package', remove: 'Delete',
    removeConfirm: 'Delete the brand "{name}"? This cannot be undone.', games: '{n} games',
    name: 'Brand name', id: 'Identifier (in the /marca/… link)', lang: 'Lobby language', logo: 'Logo', logoUpload: 'Upload logo', logoRemove: 'Remove',
    logoHint: 'Replaces the name at the top and is the tab icon. PNG, SVG or WebP, up to {kb} KB.',
    colors: 'Colours and type', pickGames: 'Games for this brand', pickHint: 'Pick from every game on the platform; only these show in the brand lobby.',
    proto: 'prototype', skin: 'Game appearance', skinHint: 'Colours, themes and thumbnails of each game. Copy what you have now in Appearance and tune it here per brand.',
    skinCopy: 'Copy the current Studio appearance', skinCopied: 'Appearance copied ({n} games with tweaks).', skinClear: 'Clear',
    skinState: 'Tweaks for {n} games', skinNone: 'No own tweaks (uses each game defaults).',
    save: 'Save', cancel: 'Close', saved: 'Brand saved.', preview: 'Preview', refresh: 'Refresh', openNew: 'Open in a new window',
    previewHint: 'Save first: the preview shows the saved version.', needName: 'Give the brand a name.', needGame: 'Pick at least one game.',
    langPt: 'Português', langEn: 'English', bigLogo: 'Logo too large (max {kb} KB).',
  },
};
const BRAND_LABELS = {
  pt: { '--brand-primary': 'Primária', '--brand-secondary': 'Secundária', '--brand-accent': 'Acento', '--bg': 'Fundo', '--bg-alt': 'Fundo alternativo', '--text': 'Texto', '--text-muted': 'Texto secundário', '--border': 'Linhas', '--font-display': 'Letra de títulos', '--font-body': 'Letra de texto', '--radius-md': 'Arredondamento' },
  en: { '--brand-primary': 'Primary', '--brand-secondary': 'Secondary', '--brand-accent': 'Accent', '--bg': 'Background', '--bg-alt': 'Alt background', '--text': 'Text', '--text-muted': 'Muted text', '--border': 'Lines', '--font-display': 'Display font', '--font-body': 'Body font', '--radius-md': 'Corner radius' },
};

let ctx = null;
// editing: null (lista) | { isNew, id, name, lang, logo, games[], appearance }
const st = { data: null, editing: null, previewKey: 0, bound: false };

export function init(context) { ctx = context; }
const tr = (k, p = {}) => (TXT[ctx.lang()] || TXT.pt)[k].replace(/\{(\w+)\}/g, (_, x) => p[x] ?? '');

export async function load() { st.data = await ctx.api('brands'); }
export function leave() { st.editing = null; }

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
const gamesWithSkin = (a) => Object.keys(a?.games || {}).length;

export function view() {
  if (!st.data) return '<p class="empty">…</p>';
  return `<h2>${tr('title')}</h2><p class="con-lead">${tr('lead')}</p>${st.editing ? editor() : list()}`;
}

function list() {
  const cards = st.data.brands.map((b) => `<li data-brand="${esc(b.id)}">
      <span class="grow"><strong>${esc(b.name)}</strong> <small>/marca/${esc(b.id)} · ${tr('games', { n: b.games.length })}</small></span>
      <button class="btn btn-ghost" data-br="edit">${tr('edit')}</button>
      <a class="btn btn-ghost" href="/marca/${esc(b.id)}" target="_blank" rel="noopener">${tr('open')}</a>
      <button class="btn btn-ghost" data-br="export">${tr('export')}</button>
      <button class="btn btn-ghost" data-br="remove">${tr('remove')}</button></li>`).join('');
  return `<div class="panel"><button class="btn btn-primary" data-br="new">${tr('add')}</button></div>
    <div class="panel">${cards ? `<ul class="rows">${cards}</ul>` : `<p class="empty">${tr('none')}</p>`}</div>`;
}

function tokenRow(k, type, value) {
  const label = BRAND_LABELS[ctx.lang()]?.[k] || k;
  const isColor = type === 'color';
  const hex = /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000';
  return `<div class="ap-row"><label for="brt${esc(k)}">${esc(label)}<small>${esc(k)}</small></label>
    <div class="ap-input">${isColor ? `<input type="color" data-br-swatch="${esc(k)}" value="${esc(hex)}" aria-label="${esc(label)}">` : ''}
      <input id="brt${esc(k)}" data-br-tok="${esc(k)}" value="${esc(value || '')}"></div></div>`;
}

function editor() {
  const e = st.editing;
  const tokens = e.appearance.brand.tokens;
  const gameRows = st.data.games.map((g) => `<label class="check"><input type="checkbox" data-br-game="${esc(g.id)}" ${e.games.includes(g.id) ? 'checked' : ''}> ${esc(g.name)}${g.prototype ? ` <small>(${tr('proto')})</small>` : ''}</label>`).join('');
  const n = gamesWithSkin(e.appearance);
  const saved = !e.isNew;
  return `<div class="panel"><div class="form-grid">
      <label>${tr('name')}<input data-br-f="name" value="${esc(e.name)}" maxlength="40"></label>
      <label>${tr('id')}<input data-br-f="id" value="${esc(e.id)}" maxlength="32" ${e.isNew ? '' : 'disabled'}></label>
      <label>${tr('lang')}<select data-br-f="lang"><option value="pt" ${e.lang === 'pt' ? 'selected' : ''}>${tr('langPt')}</option><option value="en" ${e.lang === 'en' ? 'selected' : ''}>${tr('langEn')}</option></select></label>
    </div>
    <fieldset class="ap-group"><legend>${tr('logo')}</legend>
      <div class="ap-input">${e.logo ? `<img src="${esc(e.logo)}" alt="" style="height:40px;max-width:160px;object-fit:contain;background:#8884;border-radius:6px;padding:4px">` : ''}
        <label class="btn btn-ghost ap-file">${tr('logoUpload')}<input type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" data-br-logo hidden></label>
        ${e.logo ? `<button class="btn btn-ghost" data-br="logo-clear">${tr('logoRemove')}</button>` : ''}</div>
      <small>${tr('logoHint', { kb: MAX_LOGO_KB })}</small></fieldset>
    <fieldset class="ap-group"><legend>${tr('pickGames')}</legend><small>${tr('pickHint')}</small>
      <div style="display:flex;gap:6px 18px;flex-wrap:wrap">${gameRows}</div></fieldset>
    <fieldset class="ap-group"><legend>${tr('colors')}</legend>
      ${Object.entries(st.data.brandTokens).map(([k, type]) => tokenRow(k, type, tokens[k])).join('')}</fieldset>
    <fieldset class="ap-group"><legend>${tr('skin')}</legend><small>${tr('skinHint')}</small>
      <div class="ap-input"><button class="btn btn-ghost" data-br="skin-copy">${tr('skinCopy')}</button>
        <button class="btn btn-ghost" data-br="skin-clear" ${n ? '' : 'disabled'}>${tr('skinClear')}</button>
        <small>${n ? tr('skinState', { n }) : tr('skinNone')}</small></div></fieldset>
    <div class="ap-input" style="margin-top:14px"><button class="btn btn-primary" data-br="save">${tr('save')}</button>
      <button class="btn btn-ghost" data-br="close">${tr('cancel')}</button></div></div>
    ${saved ? `<div class="panel"><h3>${tr('preview')}</h3>
      <div class="ap-input"><button class="btn btn-ghost" data-br="refresh">${tr('refresh')}</button>
        <a class="btn btn-ghost" href="/marca/${esc(e.id)}" target="_blank" rel="noopener">${tr('openNew')}</a></div>
      <iframe title="${tr('preview')}" src="/marca/${esc(e.id)}?v=${st.previewKey}" style="width:100%;height:560px;border:1px solid var(--ui-border,#8884);border-radius:10px;margin-top:8px;background:#000"></iframe></div>
      ` : `<p class="con-lead">${tr('previewHint')}</p>`}`;
}

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

function download(name, data) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function blank() {
  return { isNew: true, id: '', name: '', lang: 'pt', logo: '', games: st.data.games.filter((g) => !g.prototype).map((g) => g.id), appearance: { brand: { tokens: {} }, games: {} }, idTouched: false };
}

export function after(root) {
  if (st.bound) return;
  st.bound = true;
  root.addEventListener('input', (ev) => {
    const e = st.editing;
    if (!e) return;
    const f = ev.target.dataset?.brF;
    if (f) {
      e[f] = ev.target.value;
      if (f === 'name' && e.isNew && !e.idTouched) { e.id = slug(e.name); const idEl = root.querySelector('[data-br-f="id"]'); if (idEl) idEl.value = e.id; }
      if (f === 'id') e.idTouched = true;
    }
    const tok = ev.target.dataset?.brTok;
    if (tok) { if (ev.target.value.trim()) e.appearance.brand.tokens[tok] = ev.target.value.trim(); else delete e.appearance.brand.tokens[tok]; }
    const sw = ev.target.dataset?.brSwatch;
    if (sw) {
      e.appearance.brand.tokens[sw] = ev.target.value;
      const t = root.querySelector(`[data-br-tok="${sw}"]`); if (t) t.value = ev.target.value;
    }
  });
  root.addEventListener('change', async (ev) => {
    const e = st.editing;
    if (!e) return;
    const g = ev.target.dataset?.brGame;
    if (g) e.games = ev.target.checked ? [...new Set([...e.games, g])] : e.games.filter((x) => x !== g);
    if (ev.target.matches?.('[data-br-logo]') && ev.target.files?.[0]) {
      const file = ev.target.files[0];
      if (file.size > MAX_LOGO_KB * 1024) { ctx.toast(tr('bigLogo', { kb: MAX_LOGO_KB })); return; }
      e.logo = await fileToDataUrl(file);
      ctx.rerender();
    }
  });
  root.addEventListener('click', async (ev) => {
    const act = ev.target.closest('[data-br]')?.dataset.br;
    if (!act) return;
    const row = ev.target.closest('[data-brand]')?.dataset.brand;
    const e = st.editing;
    try {
      if (act === 'new') st.editing = blank();
      else if (act === 'close') { st.editing = null; await load(); }
      else if (act === 'edit') {
        const b = st.data.brands.find((x) => x.id === row);
        st.editing = { ...clone(b), isNew: false };
        st.previewKey++;
      } else if (act === 'remove') {
        const b = st.data.brands.find((x) => x.id === row);
        if (!b || !confirm(tr('removeConfirm', { name: b.name }))) return;
        await ctx.api(`brands/${b.id}`, { method: 'DELETE' });
        await load();
      } else if (act === 'export') {
        const pack = await ctx.api(`brands/${row}/export`);
        download(`marca-${row}.json`, pack);
        return;
      } else if (act === 'logo-clear') e.logo = '';
      else if (act === 'skin-copy') {
        const cur = clone(st.data.current || {});
        e.appearance.games = cur.games || {};
        // a marca (cores) só se copia se a do perfil ainda estiver vazia
        if (!Object.keys(e.appearance.brand.tokens).length) e.appearance.brand.tokens = cur.brand?.tokens || {};
        ctx.toast(tr('skinCopied', { n: gamesWithSkin(e.appearance) }));
      } else if (act === 'skin-clear') e.appearance.games = {};
      else if (act === 'refresh') st.previewKey++;
      else if (act === 'save') {
        if (!e.name.trim()) { ctx.toast(tr('needName')); return; }
        if (!e.games.length) { ctx.toast(tr('needGame')); return; }
        const id = e.id || slug(e.name);
        const { brand } = await ctx.api(`brands/${id}`, { method: 'PUT', body: { name: e.name, lang: e.lang, logo: e.logo, games: e.games, appearance: e.appearance } });
        await load();
        st.editing = { ...clone(brand), isNew: false };
        st.previewKey++;
        ctx.toast(tr('saved'));
      }
    } catch (err) {
      ctx.toast(err.message);
      return;
    }
    ctx.rerender();
  });
}
