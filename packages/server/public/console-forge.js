// Consola › Forge (ADR-009 a 013): projetos de jogo no Studio. Lista de
// projetos, importação do Rule Forge, e os separadores Cartões e Regras
// (o Fluxo e a geração chegam nas etapas seguintes). Guarda sozinho.

const T = {
  pt: {
    lead: 'Projetos de jogo: fluxo, cartões Gherkin e documento de regras. Daqui sai a partida narrada, depois os testes e o código.',
    newName: 'Nome do jogo', create: 'Criar projeto', import: 'Importar do Rule Forge (.json)', none: 'Ainda não há projetos.',
    open: 'Abrir', remove: 'Apagar', confirmRemove: 'Apagar o projeto "{name}"? Não dá para desfazer.', back: '← Projetos',
    cards: '{n} cartões', nodes: '{n} blocos', updated: 'alterado {when}', badJson: 'Não é um projeto do Rule Forge (JSON).',
    tab_fluxo: 'Fluxo', tab_cartoes: 'Cartões', tab_regras: 'Regras',
    saving: 'A guardar…', saved: 'Guardado', unsaved: 'Por guardar', export: 'Exportar .json',
    fluxoSoon: 'O editor de fluxo chega na etapa 1d. Por agora, os blocos do projeto:',
    coverage: 'Cobertura', coverageOk: 'Todos os blocos têm pelo menos um cartão.', coverageMissing: 'Blocos sem cartões: {list}',
    catSummary: '{regra} regras · {plataforma} plataforma · {bot} bot',
    filterScope: 'Âmbito', filterCat: 'Categoria', all: 'Todos',
    scope_general: 'Geral', scope_player: 'Jogador', scope_component: 'Componente', scope_node: 'Bloco',
    cat_regra: 'Regra', cat_plataforma: 'Plataforma', cat_bot: 'Bot',
    catHelp: 'Regra: vira teste. Plataforma: a plataforma já trata (desligar, tempos, avisos). Bot: só se testa que o bot faz jogadas válidas.',
    title: 'Título', given: 'Dado', when: 'Quando', then: 'Então', block: 'Bloco', noBlock: '(sem bloco)', missingBlock: 'bloco em falta',
    addCard: '+ Cartão', delCard: 'Apagar cartão', kind: 'Tipo', scope: 'Âmbito', category: 'Categoria',
    addSection: '+ Secção geral', createAll: 'Criar as secções em falta', up: 'Subir', down: 'Descer', delSection: 'Apagar secção',
    sectionTitle: 'Título da secção', sectionText: 'Texto (linha em branco separa parágrafos; "- " faz lista; **negrito**)',
    exportMd: 'Exportar .md', rulesEmpty: 'Ainda não há secções. Cria as secções dos blocos ou uma secção geral (Objetivo, Preparação…).',
  },
  en: {
    lead: 'Game projects: flow, Gherkin cards and rules document. The narrated game, the tests and the code come from here.',
    newName: 'Game name', create: 'Create project', import: 'Import from Rule Forge (.json)', none: 'No projects yet.',
    open: 'Open', remove: 'Delete', confirmRemove: 'Delete project "{name}"? This cannot be undone.', back: '← Projects',
    cards: '{n} cards', nodes: '{n} blocks', updated: 'changed {when}', badJson: 'Not a Rule Forge project (JSON).',
    tab_fluxo: 'Flow', tab_cartoes: 'Cards', tab_regras: 'Rules',
    saving: 'Saving…', saved: 'Saved', unsaved: 'Unsaved', export: 'Export .json',
    fluxoSoon: 'The flow editor arrives in stage 1d. For now, the project blocks:',
    coverage: 'Coverage', coverageOk: 'Every block has at least one card.', coverageMissing: 'Blocks without cards: {list}',
    catSummary: '{regra} rules · {plataforma} platform · {bot} bot',
    filterScope: 'Scope', filterCat: 'Category', all: 'All',
    scope_general: 'General', scope_player: 'Player', scope_component: 'Component', scope_node: 'Block',
    cat_regra: 'Rule', cat_plataforma: 'Platform', cat_bot: 'Bot',
    catHelp: 'Rule: becomes a test. Platform: the platform already handles it (disconnects, timing, notices). Bot: we only test that the bot plays valid moves.',
    title: 'Title', given: 'Given', when: 'When', then: 'Then', block: 'Block', noBlock: '(no block)', missingBlock: 'missing block',
    addCard: '+ Card', delCard: 'Delete card', kind: 'Type', scope: 'Scope', category: 'Category',
    addSection: '+ General section', createAll: 'Create missing sections', up: 'Up', down: 'Down', delSection: 'Delete section',
    sectionTitle: 'Section title', sectionText: 'Text (blank line separates paragraphs; "- " makes a list; **bold**)',
    exportMd: 'Export .md', rulesEmpty: 'No sections yet. Create the block sections or a general one (Goal, Setup…).',
  },
};
const KINDS = ['DATA', 'FLOW', 'ACTION', 'SCORE'];
const SCOPES = ['general', 'player', 'component', 'node'];
const CATS = ['regra', 'plataforma', 'bot'];
const TABS = ['fluxo', 'cartoes', 'regras'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fill = (s, p = {}) => s.replace(/\{(\w+)\}/g, (_, k) => p[k] ?? '');
const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

let ctx = null;
const st = { list: null, slug: null, project: null, status: 'saved', timer: null, filters: { scope: '', cat: '' }, handlers: false };
const f = (key, params) => fill((T[ctx.lang()] || T.pt)[key] ?? key, params);

export function init(context) {
  ctx = context;
  window.addEventListener('beforeunload', (e) => { if (st.status !== 'saved') e.preventDefault(); });
}

/** Rota: #/forge, #/forge/<slug>, #/forge/<slug>/<separador>. */
function route() {
  const [, slug, tab] = location.hash.slice(2).split('/');
  return { slug: slug ? decodeURIComponent(slug) : null, tab: TABS.includes(tab) ? tab : 'cartoes' };
}

export async function load() {
  const { slug } = route();
  if (!slug) { await flush(); st.slug = null; st.project = null; st.list = (await ctx.api('forge')).projects; return; }
  if (st.slug !== slug) {
    await flush();
    st.project = (await ctx.api(`forge/${encodeURIComponent(slug)}`)).project;
    st.slug = slug;
    st.status = 'saved';
  }
}

export async function leave() { await flush(); }

// ─── Guardar (automático, com atraso) ───────────────────────
function changed() {
  st.status = 'unsaved';
  paintStatus();
  clearTimeout(st.timer);
  st.timer = setTimeout(flush, 800);
}
async function flush() {
  clearTimeout(st.timer);
  if (!st.project || st.status === 'saved') return;
  st.status = 'saving';
  paintStatus();
  try {
    st.project = (await ctx.api(`forge/${encodeURIComponent(st.slug)}`, { method: 'PUT', body: st.project })).project;
    st.status = 'saved';
  } catch (e) { st.status = 'unsaved'; ctx.toast(e.message); }
  paintStatus();
}
function paintStatus() {
  const el = document.getElementById('fgStatus');
  if (el) { el.textContent = f(st.status); el.dataset.state = st.status; }
}

// ─── Vistas ─────────────────────────────────────────────────
export function view() {
  if (!st.slug) return viewList();
  if (!st.project) return '<p class="empty">…</p>';
  const { tab } = route();
  const p = st.project;
  return `<div class="fg-head">
      <a class="btn btn-ghost" href="#/forge">${f('back')}</a>
      <input class="fg-name" id="fgName" value="${esc(p.gameName)}" aria-label="${f('newName')}">
      <span class="fg-status" id="fgStatus" data-state="${st.status}">${f(st.status)}</span>
      <button class="btn btn-ghost" data-fg="export">${f('export')}</button>
    </div>
    <nav class="fg-tabs" role="tablist">${TABS.map((t) => `<a role="tab" href="#/forge/${encodeURIComponent(st.slug)}/${t}" ${t === tab ? 'aria-selected="true"' : ''}>${f(`tab_${t}`)}</a>`).join('')}</nav>
    ${tab === 'fluxo' ? viewFluxo() : tab === 'regras' ? viewRegras() : viewCartoes()}`;
}

function viewList() {
  const rows = (st.list || []).map((x) => `<tr>
    <td><strong>${esc(x.gameName)}</strong><small>${esc(x.slug)}</small></td>
    <td>${f('nodes', { n: x.nodes })}<small>${f('cards', { n: x.cards })}</small></td>
    <td><small>${f('updated', { when: new Date(x.updatedAt).toLocaleString(ctx.lang(), { dateStyle: 'short', timeStyle: 'short' }) })}</small></td>
    <td class="actions"><a class="btn btn-outline" href="#/forge/${encodeURIComponent(x.slug)}">${f('open')}</a>
      <button class="btn btn-ghost" data-fg-del="${esc(x.slug)}" data-name="${esc(x.gameName)}">${f('remove')}</button></td></tr>`).join('');
  return `<div><h1>Forge</h1><p class="con-lead">${f('lead')}</p></div>
    <div class="panel">
      <form class="form" id="fgNew">
        <label>${f('newName')}<input name="gameName" maxlength="120" required></label>
        <button class="btn btn-primary">${f('create')}</button>
        <label class="btn btn-outline ap-file">${f('import')}<input type="file" accept="application/json" data-fg="import" hidden></label>
      </form>
    </div>
    <div class="panel">${rows ? `<div class="tbl-wrap"><table class="tbl"><tbody>${rows}</tbody></table></div>` : `<p class="empty">${f('none')}</p>`}</div>`;
}

function viewFluxo() {
  const p = st.project;
  return `<div class="panel"><p class="con-lead">${f('fluxoSoon')}</p>
    <ul class="fg-blocks">${p.nodes.map((n) => `<li><span class="fg-kind k-${n.kind.toLowerCase()}">${n.kind}</span>${esc(n.label)}</li>`).join('')}</ul></div>`;
}

const nodeName = (id) => st.project.nodes.find((n) => n.id === id)?.label;

function viewCartoes() {
  const p = st.project;
  const withCards = new Set(p.cards.filter((c) => c.ref).map((c) => c.ref));
  const missing = p.nodes.filter((n) => !withCards.has(n.id));
  const counts = Object.fromEntries(CATS.map((c) => [c, p.cards.filter((x) => x.category === c).length]));
  const shown = p.cards.filter((c) => (!st.filters.scope || c.scope === st.filters.scope) && (!st.filters.cat || c.category === st.filters.cat));
  const opt = (vals, cur, label) => vals.map((v) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(label(v))}</option>`).join('');
  return `<div class="panel fg-cover">
      <h2>${f('coverage')}</h2>
      <p>${missing.length ? esc(f('coverageMissing', { list: missing.map((n) => n.label).join(', ') })) : `✓ ${f('coverageOk')}`}</p>
      <p><small>${f('catSummary', counts)}</small></p>
      <p class="con-lead"><small>${f('catHelp')}</small></p>
    </div>
    <div class="fg-bar">
      <label>${f('filterScope')}<select data-fg-filter="scope"><option value="">${f('all')}</option>${opt(SCOPES, st.filters.scope, (v) => f(`scope_${v}`))}</select></label>
      <label>${f('filterCat')}<select data-fg-filter="cat"><option value="">${f('all')}</option>${opt(CATS, st.filters.cat, (v) => f(`cat_${v}`))}</select></label>
      <button class="btn btn-primary" data-fg="add-card">${f('addCard')}</button>
    </div>
    <div class="fg-cards">${shown.map((c) => {
      const lost = (c.scope === 'node' || c.scope === 'component') && c.ref && !nodeName(c.ref);
      return `<article class="fg-card k-${c.kind.toLowerCase()}" data-card="${esc(c.id)}">
        <div class="fg-card-head">
          <select data-field="kind" aria-label="${f('kind')}">${opt(KINDS, c.kind, (v) => v)}</select>
          <select data-field="category" aria-label="${f('category')}" class="fg-cat cat-${c.category}">${opt(CATS, c.category, (v) => f(`cat_${v}`))}</select>
          <select data-field="scope" aria-label="${f('scope')}">${opt(SCOPES, c.scope, (v) => f(`scope_${v}`))}</select>
          ${c.scope === 'node' || c.scope === 'component' ? `<select data-field="ref" aria-label="${f('block')}"><option value="">${f('noBlock')}</option>${p.nodes.map((n) => `<option value="${esc(n.id)}" ${n.id === c.ref ? 'selected' : ''}>${esc(n.label)}</option>`).join('')}</select>` : ''}
          ${lost ? `<span class="pill pill-bad">${f('missingBlock')}</span>` : ''}
          <button class="btn btn-ghost" data-fg-delcard="${esc(c.id)}" aria-label="${f('delCard')}">✕</button>
        </div>
        <input class="fg-title" data-field="title" value="${esc(c.title)}" placeholder="${f('title')}">
        ${['given', 'when', 'then'].map((k) => `<label class="fg-g"><b>${f(k)}</b><textarea data-field="${k}" rows="2">${esc(c[k])}</textarea></label>`).join('')}
      </article>`;
    }).join('')}</div>`;
}

function viewRegras() {
  const p = st.project;
  const missing = p.nodes.filter((n) => !p.rules.some((r) => r.ref === n.id));
  return `<div class="fg-bar">
      <button class="btn btn-primary" data-fg="add-section">${f('addSection')}</button>
      ${missing.length ? `<button class="btn btn-outline" data-fg="create-all">${f('createAll')} (${missing.length})</button>` : ''}
      <button class="btn btn-ghost" data-fg="export-md">${f('exportMd')}</button>
    </div>
    ${p.rules.length ? p.rules.map((r, i) => `<section class="panel fg-rule" data-rule="${esc(r.id)}">
      <div class="fg-card-head">
        ${r.ref ? `<h3>${esc(nodeName(r.ref) ?? f('missingBlock'))}</h3>` : `<input class="fg-title" data-rfield="title" value="${esc(r.title)}" placeholder="${f('sectionTitle')}">`}
        <button class="btn btn-ghost" data-fg-move="${i}" data-dir="-1" ${i ? '' : 'disabled'} aria-label="${f('up')}">↑</button>
        <button class="btn btn-ghost" data-fg-move="${i}" data-dir="1" ${i < p.rules.length - 1 ? '' : 'disabled'} aria-label="${f('down')}">↓</button>
        <button class="btn btn-ghost" data-fg-delrule="${esc(r.id)}" aria-label="${f('delSection')}">✕</button>
      </div>
      <textarea data-rfield="text" rows="5" placeholder="${f('sectionText')}">${esc(r.text)}</textarea>
    </section>`).join('') : `<p class="empty">${f('rulesEmpty')}</p>`}`;
}

function rulesMarkdown() {
  const p = st.project;
  return `# ${p.gameName}\n\n${p.rules.filter((r) => r.text.trim()).map((r) => `## ${r.ref ? nodeName(r.ref) ?? r.title : r.title}\n\n${r.text.trim()}\n`).join('\n')}`;
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ─── Eventos ────────────────────────────────────────────────
export function after(root) {
  if (st.handlers) return;
  st.handlers = true;
  root.addEventListener('input', (e) => {
    if (!st.project) return;
    if (e.target.id === 'fgName') { st.project.gameName = e.target.value; changed(); return; }
    const card = e.target.closest('[data-card]');
    const field = e.target.dataset.field;
    if (card && field && e.target.tagName !== 'SELECT') {
      const c = st.project.cards.find((x) => x.id === card.dataset.card);
      if (c) { c[field] = e.target.value; changed(); }
      return;
    }
    const rule = e.target.closest('[data-rule]');
    if (rule && e.target.dataset.rfield) {
      const r = st.project.rules.find((x) => x.id === rule.dataset.rule);
      if (r) { r[e.target.dataset.rfield] = e.target.value; changed(); }
    }
  });
  root.addEventListener('change', async (e) => {
    if (e.target.dataset.fgFilter) { st.filters[e.target.dataset.fgFilter] = e.target.value; ctx.rerender(); return; }
    const card = e.target.closest('[data-card]');
    if (card && e.target.tagName === 'SELECT' && st.project) {
      const c = st.project.cards.find((x) => x.id === card.dataset.card);
      const k = e.target.dataset.field;
      c[k] = e.target.value || null;
      if (k === 'scope' && !['node', 'component'].includes(c.scope)) c.ref = null;
      // Escolher um bloco dá ao cartão o tipo desse bloco (como no Rule Forge).
      if (k === 'ref' && c.ref) c.kind = st.project.nodes.find((n) => n.id === c.ref)?.kind ?? c.kind;
      changed();
      ctx.rerender();
      return;
    }
    if (e.target.dataset.fg === 'import' && e.target.files?.[0]) {
      try {
        const project = JSON.parse(await e.target.files[0].text());
        if (!project || typeof project !== 'object' || !Array.isArray(project.cards ?? project.nodes)) throw new Error();
        const r = await ctx.api('forge', { method: 'POST', body: { project } });
        location.hash = `#/forge/${encodeURIComponent(r.slug)}`;
      } catch { ctx.toast(f('badJson')); }
    }
  });
  root.addEventListener('submit', async (e) => {
    if (e.target.id !== 'fgNew') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const name = new FormData(e.target).get('gameName');
    const r = await ctx.api('forge', { method: 'POST', body: { gameName: name } });
    location.hash = `#/forge/${encodeURIComponent(r.slug)}`;
  }, true);
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const p = st.project;
    const d = b.dataset;
    if (d.fgDel) {
      if (!confirm(f('confirmRemove', { name: d.name }))) return;
      await ctx.api(`forge/${encodeURIComponent(d.fgDel)}`, { method: 'DELETE' });
      st.list = null;
      await load();
      ctx.rerender();
      return;
    }
    if (!p) return;
    if (d.fg === 'export') { await flush(); download(`${st.slug}.json`, JSON.stringify(p, null, 2), 'application/json'); return; }
    if (d.fg === 'export-md') { download(`${st.slug}-regras.md`, rulesMarkdown(), 'text/markdown'); return; }
    if (d.fg === 'add-card') {
      p.cards.unshift({ id: uid('c'), kind: 'ACTION', category: 'regra', scope: 'general', ref: null, title: '', given: '', when: '', then: '' });
      st.filters = { scope: '', cat: '' };
    } else if (d.fgDelcard) {
      p.cards = p.cards.filter((c) => c.id !== d.fgDelcard);
    } else if (d.fg === 'add-section') {
      p.rules.push({ id: uid('r'), ref: null, title: '', text: '' });
    } else if (d.fg === 'create-all') {
      for (const n of p.nodes) if (!p.rules.some((r) => r.ref === n.id)) p.rules.push({ id: uid('r'), ref: n.id, title: n.label, text: '' });
    } else if (d.fgMove != null) {
      const i = Number(d.fgMove);
      const j = i + Number(d.dir);
      [p.rules[i], p.rules[j]] = [p.rules[j], p.rules[i]];
    } else if (d.fgDelrule) {
      p.rules = p.rules.filter((r) => r.id !== d.fgDelrule);
    } else return;
    changed();
    ctx.rerender();
  });
}
