// Consola › Forge (ADR-009 a 013): projetos de jogo no Studio. Lista de
// projetos, importação do Rule Forge, e os separadores Cartões e Regras
// e Fluxo (a geração chega nas etapas seguintes). Guarda sozinho.

import { mountFlow } from '/console-forge-flow.js';
import { buildPrompt, parseNarration, viewPartida } from '/console-forge-play.js';
import { buildTestsPrompt, viewTestes } from '/console-forge-tests.js';
import { buildCodePrompt, buildFixPrompt, viewCodigo, reportText } from '/console-forge-code.js';

const T = {
  pt: {
    lead: 'Projetos de jogo: fluxo, cartões Gherkin e documento de regras. Daqui sai a partida narrada, depois os testes e o código.',
    newName: 'Nome do jogo', create: 'Criar projeto', import: 'Importar do Rule Forge (.json)', none: 'Ainda não há projetos.',
    open: 'Abrir', remove: 'Apagar', confirmRemove: 'Apagar o projeto "{name}"? Não dá para desfazer.', back: '← Projetos',
    cards: '{n} cartões', nodes: '{n} blocos', updated: 'alterado {when}', badJson: 'Não é um projeto do Rule Forge (JSON).',
    tab_fluxo: 'Fluxo', tab_cartoes: 'Cartões', tab_regras: 'Regras', tab_partida: 'Partida narrada',
    tab_codigo: 'Código', cdTitle: 'Código do jogo (versão {v})',
    cdLead: 'Copia o prompt para a tua IA: ela escreve o pacote do jogo para passar os testes aprovados. Cola a resposta e carrega em Verificar: o Studio corre tudo num processo isolado.',
    cdNoTests: 'Ainda não há testes aprovados. Aprova os testes primeiro (separador Testes).',
    cdCopyFix: 'Copiar prompt de correção', cdCopyNew: 'Copiar prompt (código novo)',
    cdCopyNewHint: 'A primeira vez, e sempre que os testes ou as regras mudarem.',
    cdCopyFixHint: 'Só quando o código está quase certo e os testes não mudaram: leva o código anterior e os erros.',
    cdTestsChanged: 'Os testes mudaram desde esta verificação. "Verificar outra vez" testa o código antigo: usa "Copiar prompt (código novo)".', cdPaste: 'Resposta da IA (JSON com os ficheiros)', cdVerify: 'Verificar',
    cdVerifying: 'A verificar…', cdBadJson: 'Não encontrei { "files": { … } } na resposta.', cdReport: 'Relatório',
    cdOk: 'Passou em tudo', cdFail: 'Há falhas', cdOld: 'Este pacote é de outra versão das regras; as regras estão na {v}.',
    cdTests: 'Testes: {pass} passaram, {fail} falharam.', cdPlayers: 'Jogadores', cdFinished: 'Partidas acabadas', cdWins: 'Vitórias por lugar',
    cdFiles: 'Ficheiros ({n})',
    cdInstall: 'Instalar protótipo', cdReinstall: 'Instalar esta versão', cdInstallHint: 'Fica a jogar no lobby do Studio, sem reiniciar.',
    cdPublish: 'Publicar como 1.0.0', cdPublishHint: 'Grava o jogo em games/ para rever e fazer commit. Só depois de o jogares e aprovares.',
    cdPublishConfirm: 'Publicar {name} como 1.0.0 em games/{id}? Isto só se faz uma vez.',
    cdPublished: 'Publicado como {v} em {dir} ({d}).', cdPublishDone: 'Publicado em games/.',
    cdPublishedNext: 'Falta: rever os ficheiros, juntar o jogo à lista do Studio e fazer o commit (pede ao Claude Code).',
    cdInstalled: 'Protótipo {v} instalado ({d}).', cdOlder: 'Versões anteriores ainda com mesas: {list}.', cdOpenLobby: 'Abrir o lobby', cdInstallDone: 'Protótipo instalado: já está no lobby.',
    cdCopyReport: 'Copiar relatório', cdReportCopied: 'Relatório copiado em texto.', cdReverify: 'Verificar outra vez',
    cdTestSide: 'Os testes usam funções que não existem. O problema é dos testes, não do código: acrescenta essas funções em Testes › Funções auxiliares e carrega em "Verificar outra vez" (o mesmo código).',
    tsHelpers: 'Funções auxiliares dos testes', tsHelpersHint: 'Código comum a vários testes (ex.: novo, jogar, montar a mesa). Entra no ficheiro de testes antes de todos os testes.',
    tab_testes: 'Testes', tsTitle: 'Testes a partir dos cartões',
    tsLead: 'Copia o prompt para a tua IA: ela propõe o modelo do estado e escreve um teste por cartão de regra (e um por partida narrada aprovada). Lê cada teste como Dado / Quando / Então e aprova. Os aprovados ficam fixos.',
    tsSave: 'Guardar testes', tsBadJson: 'Não encontrei o JSON dos testes na resposta.', tsList: '{n} testes ({a} aprovados)',
    tsOld: 'escritos com as regras {v}', tsApproveAll: 'Aprovar todos', tsUnlockAll: 'Desbloquear todos',
    tsUnlockAllConfirm: 'Desbloquear todos os testes? A próxima resposta da IA substitui-os, com funções auxiliares novas.',
    tsOffCards: 'Há testes de cartões que já não são de regra ({list}): a plataforma ou o bot tratam disso. Desbloqueia-os e apaga-os (✕).',
    tsOffCard: 'cartão de {cat}', tsMissing: 'Cartões de regra sem teste: {list}',
    tsCovered: 'Todos os cartões de regra têm teste.', tsOrphans: 'Testes de cartões que já não existem: {list}',
    tsModel: 'Modelo do estado', tsGame: 'partida', tsApproved: 'Aprovado', tsUnlock: 'Desbloquear', tsApprove: 'Aprovar',
    tsDelete: 'Apagar teste', tsCode: 'Código', tsCodeEdit: 'Código (editável enquanto não estiver aprovado)', tsNone: 'Ainda não há testes.',
    ptRules: 'Regras (versão {v})', ptCommitMsg: 'O que mudou', ptCommitHint: 'ex.: o baralho acabar a meio da ronda termina o jogo',
    ptCommitKind: 'Tipo', ptKindRules: 'Regras (sobe a versão)', ptKindText: 'Só texto (gralhas)', ptCommit: 'Commit das regras',
    ptNoCommits: 'Ainda não há commits: o primeiro dá a versão 0.1.0.', ptCommitted: 'Commit feito: versão {v}.',
    ptNew: 'Nova partida narrada', ptNewLead: 'Copia o prompt para a IA que quiseres; ela joga uma partida em texto e marca as dúvidas. Cola aqui a resposta.',
    ptScenario: 'Cenário', ptScenarioHint: 'ex.: jogo completo; ou: o baralho acaba a meio de uma ronda', ptPlayers: 'Jogadores',
    ptCopy: 'Copiar prompt', ptCopied: 'Prompt copiado. Cola-o na tua IA.', ptPaste: 'Resposta da IA (JSON)', ptSave: 'Guardar partida',
    ptBadJson: 'Não encontrei o JSON da partida na resposta.', ptWhich: 'Partida', ptRulesV: 'regras {v}',
    ptApproved: 'Aprovada', ptOpenDoubts: '{n} dúvidas em aberto', ptApprove: 'Aprovar partida', ptDelete: 'Apagar partida',
    ptConfirmDelete: 'Apagar esta partida narrada?', ptOldRules: 'Partida jogada com as regras {v}; as regras estão na {now}. Pede uma partida nova.',
    ptPlayer: 'Jogador {n}', ptState: 'Estado depois', ptEnd: 'Fim:', ptDoubt: 'Dúvida:', ptAssumed: 'A IA assumiu:',
    ptResolved: 'Resolvida', ptIgnore: 'Ignorar', ptIsResolved: 'resolvida', ptIsIgnored: 'ignorada', ptReopen: 'Reabrir',
    ptNote: 'Nota (o que corrigiste nos cartões)', ptUnknownCard: 'cartão que não existe',
    saving: 'A guardar…', saved: 'Guardado', unsaved: 'Por guardar', export: 'Exportar .json',
    fluxoSoon: 'O editor de fluxo chega na etapa 1d. Por agora, os blocos do projeto:',
    coverage: 'Cobertura', coverageOk: 'Todos os blocos têm pelo menos um cartão.', coverageMissing: 'Blocos sem cartões: {list}',
    catSummary: '{regra} regras · {plataforma} plataforma · {bot} bot',
    filterScope: 'Âmbito', filterCat: 'Categoria', all: 'Todos',
    scope_general: 'Geral', scope_player: 'Jogador', scope_component: 'Componente', scope_node: 'Bloco',
    cat_regra: 'Regra', cat_plataforma: 'Plataforma', cat_bot: 'Bot',
    catHelp: 'Regra: vira teste. Plataforma: a plataforma já trata (desligar, tempos, avisos). Bot: só se testa que o bot faz jogadas válidas. Esta vista é o repositório de todos os cartões; o trabalho do dia a dia faz-se no Fluxo, no painel de cada bloco.',
    title: 'Título', given: 'Dado', when: 'Quando', then: 'Então', block: 'Bloco', noBlock: '(sem bloco)', missingBlock: 'bloco em falta',
    addCard: '+ Cartão', delCard: 'Apagar cartão', kind: 'Tipo', scope: 'Âmbito', category: 'Categoria',
    addSection: '+ Secção geral', createAll: 'Criar as secções em falta', up: 'Subir', down: 'Descer', delSection: 'Apagar secção',
    sectionTitle: 'Título da secção', sectionText: 'Texto (linha em branco separa parágrafos; "- " faz lista; **negrito**)',
    exportMd: 'Exportar .md', rulesEmpty: 'Ainda não há secções. Cria as secções dos blocos ou uma secção geral (Objetivo, Preparação…).',
    ffKind: 'Tipo', ffAdd: '+ Bloco', ffLabel: 'Nome do bloco', ffDelete: 'Apagar', ffZoomIn: 'Aproximar', ffZoomOut: 'Afastar', ffFit: 'Ver tudo',
    ffCanvas: 'Fluxo do jogo', ffNew: 'Novo', ffCards: 'Cartões deste bloco', ffText: 'Texto nas regras', ffHandle: 'Arrasta para ligar a outro bloco',
    ffUndo: 'Anular', ffRedo: 'Refazer', ffLayout: 'Organizar', ffNoCards: 'Este bloco ainda não tem cartões.',
    ffKindMismatch: '{n} cartão(ões) com tipo diferente do bloco ({kind}).', ffFixKind: 'Pôr os cartões como {kind}',
    ffNoText: 'Falta o texto deste bloco nas regras.', ffCardsOf: 'Cartões ({n})', ffAddCard: '+ Cartão para este bloco',
    ffFull: '⛶ Ecrã inteiro', ffFullExit: '✕ Sair do ecrã inteiro', ffFullHint: 'O editor ocupa a página toda (Esc sai)',
    ffNoTitle: '(cartão sem título)', ffDelCard: 'Apagar cartão', ffDelCardConfirm: 'Apagar o cartão "{title}"?',
    ffRuleText: 'Texto nas regras', ffRuleHint: 'Como se joga esta parte, para o documento de regras.',
    ffHelp: 'Duplo clique no fundo cria um bloco. Arrasta a bolinha de um bloco para outro para os ligar (largar no vazio cria um bloco já ligado). Arrasta o fundo para mover a vista; a roda faz zoom. Del apaga; setas movem o bloco selecionado; Ctrl+Z anula.',
  },
  en: {
    lead: 'Game projects: flow, Gherkin cards and rules document. The narrated game, the tests and the code come from here.',
    newName: 'Game name', create: 'Create project', import: 'Import from Rule Forge (.json)', none: 'No projects yet.',
    open: 'Open', remove: 'Delete', confirmRemove: 'Delete project "{name}"? This cannot be undone.', back: '← Projects',
    cards: '{n} cards', nodes: '{n} blocks', updated: 'changed {when}', badJson: 'Not a Rule Forge project (JSON).',
    tab_fluxo: 'Flow', tab_cartoes: 'Cards', tab_regras: 'Rules', tab_partida: 'Narrated game',
    tab_codigo: 'Code', cdTitle: 'Game code (version {v})',
    cdLead: 'Copy the prompt into your AI: it writes the game package to pass the approved tests. Paste the answer and press Verify: the Studio runs everything in an isolated process.',
    cdNoTests: 'No approved tests yet. Approve the tests first (Tests tab).',
    cdCopyFix: 'Copy fix prompt', cdCopyNew: 'Copy prompt (new code)',
    cdCopyNewHint: 'The first time, and whenever the tests or rules change.',
    cdCopyFixHint: 'Only when the code is nearly right and the tests have not changed: it carries the previous code and the errors.',
    cdTestsChanged: 'The tests changed since this verification. "Verify again" tests the old code: use "Copy prompt (new code)".', cdPaste: 'AI answer (JSON with the files)', cdVerify: 'Verify',
    cdVerifying: 'Verifying…', cdBadJson: 'Could not find { "files": { … } } in the answer.', cdReport: 'Report',
    cdOk: 'Passed everything', cdFail: 'There are failures', cdOld: 'This package is from another rules version; the rules are at {v}.',
    cdTests: 'Tests: {pass} passed, {fail} failed.', cdPlayers: 'Players', cdFinished: 'Games finished', cdWins: 'Wins by seat',
    cdFiles: 'Files ({n})',
    cdInstall: 'Install prototype', cdReinstall: 'Install this version', cdInstallHint: 'It becomes playable in the Studio lobby, no restart.',
    cdPublish: 'Publish as 1.0.0', cdPublishHint: 'Writes the game into games/ to review and commit. Only after playing and approving it.',
    cdPublishConfirm: 'Publish {name} as 1.0.0 in games/{id}? This happens only once.',
    cdPublished: 'Published as {v} in {dir} ({d}).', cdPublishDone: 'Published in games/.',
    cdPublishedNext: 'Still to do: review the files, add the game to the Studio list and commit (ask Claude Code).',
    cdInstalled: 'Prototype {v} installed ({d}).', cdOlder: 'Earlier versions still in use by tables: {list}.', cdOpenLobby: 'Open the lobby', cdInstallDone: 'Prototype installed: it is in the lobby.',
    cdCopyReport: 'Copy report', cdReportCopied: 'Report copied as text.', cdReverify: 'Verify again',
    cdTestSide: 'The tests use functions that do not exist. The problem is in the tests, not the code: add those functions under Tests › Helper functions and press "Verify again" (same code).',
    tsHelpers: 'Test helper functions', tsHelpersHint: 'Code shared by several tests (e.g. new game, play, set up the table). It goes into the test file before all the tests.',
    tab_testes: 'Tests', tsTitle: 'Tests from the cards',
    tsLead: 'Copy the prompt into your AI: it proposes the state model and writes one test per rule card (and one per approved narrated game). Read each test as Given / When / Then and approve. Approved tests are frozen.',
    tsSave: 'Save tests', tsBadJson: 'Could not find the tests JSON in the answer.', tsList: '{n} tests ({a} approved)',
    tsOld: 'written with rules {v}', tsApproveAll: 'Approve all', tsUnlockAll: 'Unlock all',
    tsUnlockAllConfirm: 'Unlock all tests? The next AI answer replaces them, with new helper functions.',
    tsOffCards: 'Some tests belong to cards that are no longer rules ({list}): the platform or the bot handle that. Unlock and delete them (✕).',
    tsOffCard: '{cat} card', tsMissing: 'Rule cards without a test: {list}',
    tsCovered: 'Every rule card has a test.', tsOrphans: 'Tests for cards that no longer exist: {list}',
    tsModel: 'State model', tsGame: 'game', tsApproved: 'Approved', tsUnlock: 'Unlock', tsApprove: 'Approve',
    tsDelete: 'Delete test', tsCode: 'Code', tsCodeEdit: 'Code (editable until approved)', tsNone: 'No tests yet.',
    ptRules: 'Rules (version {v})', ptCommitMsg: 'What changed', ptCommitHint: 'e.g. running out of deck mid-round ends the game',
    ptCommitKind: 'Type', ptKindRules: 'Rules (bumps the version)', ptKindText: 'Text only (typos)', ptCommit: 'Commit rules',
    ptNoCommits: 'No commits yet: the first gives version 0.1.0.', ptCommitted: 'Committed: version {v}.',
    ptNew: 'New narrated game', ptNewLead: 'Copy the prompt into the AI of your choice; it plays a game in text and marks the doubts. Paste the answer here.',
    ptScenario: 'Scenario', ptScenarioHint: 'e.g. full game; or: the deck runs out mid-round', ptPlayers: 'Players',
    ptCopy: 'Copy prompt', ptCopied: 'Prompt copied. Paste it into your AI.', ptPaste: 'AI answer (JSON)', ptSave: 'Save game',
    ptBadJson: 'Could not find the game JSON in the answer.', ptWhich: 'Game', ptRulesV: 'rules {v}',
    ptApproved: 'Approved', ptOpenDoubts: '{n} open doubts', ptApprove: 'Approve game', ptDelete: 'Delete game',
    ptConfirmDelete: 'Delete this narrated game?', ptOldRules: 'Game played with rules {v}; the rules are now at {now}. Ask for a new game.',
    ptPlayer: 'Player {n}', ptState: 'State after', ptEnd: 'End:', ptDoubt: 'Doubt:', ptAssumed: 'The AI assumed:',
    ptResolved: 'Resolved', ptIgnore: 'Ignore', ptIsResolved: 'resolved', ptIsIgnored: 'ignored', ptReopen: 'Reopen',
    ptNote: 'Note (what you fixed in the cards)', ptUnknownCard: 'card that does not exist',
    saving: 'Saving…', saved: 'Saved', unsaved: 'Unsaved', export: 'Export .json',
    fluxoSoon: 'The flow editor arrives in stage 1d. For now, the project blocks:',
    coverage: 'Coverage', coverageOk: 'Every block has at least one card.', coverageMissing: 'Blocks without cards: {list}',
    catSummary: '{regra} rules · {plataforma} platform · {bot} bot',
    filterScope: 'Scope', filterCat: 'Category', all: 'All',
    scope_general: 'General', scope_player: 'Player', scope_component: 'Component', scope_node: 'Block',
    cat_regra: 'Rule', cat_plataforma: 'Platform', cat_bot: 'Bot',
    catHelp: 'Rule: becomes a test. Platform: the platform already handles it (disconnects, timing, notices). Bot: we only test that the bot plays valid moves. This view is the repository of all cards; day-to-day work happens in the Flow, in each block’s panel.',
    title: 'Title', given: 'Given', when: 'When', then: 'Then', block: 'Block', noBlock: '(no block)', missingBlock: 'missing block',
    addCard: '+ Card', delCard: 'Delete card', kind: 'Type', scope: 'Scope', category: 'Category',
    addSection: '+ General section', createAll: 'Create missing sections', up: 'Up', down: 'Down', delSection: 'Delete section',
    sectionTitle: 'Section title', sectionText: 'Text (blank line separates paragraphs; "- " makes a list; **bold**)',
    exportMd: 'Export .md', rulesEmpty: 'No sections yet. Create the block sections or a general one (Goal, Setup…).',
    ffKind: 'Type', ffAdd: '+ Block', ffLabel: 'Block name', ffDelete: 'Delete', ffZoomIn: 'Zoom in', ffZoomOut: 'Zoom out', ffFit: 'Fit all',
    ffCanvas: 'Game flow', ffNew: 'New', ffCards: 'Cards for this block', ffText: 'Text in the rules', ffHandle: 'Drag to link to another block',
    ffUndo: 'Undo', ffRedo: 'Redo', ffLayout: 'Arrange', ffNoCards: 'This block has no cards yet.',
    ffKindMismatch: '{n} card(s) with a different type from the block ({kind}).', ffFixKind: 'Set the cards to {kind}',
    ffNoText: 'This block has no text in the rules.', ffCardsOf: 'Cards ({n})', ffAddCard: '+ Card for this block',
    ffFull: '⛶ Full screen', ffFullExit: '✕ Exit full screen', ffFullHint: 'The editor fills the page (Esc exits)',
    ffNoTitle: '(untitled card)', ffDelCard: 'Delete card', ffDelCardConfirm: 'Delete the card "{title}"?',
    ffRuleText: 'Text in the rules', ffRuleHint: 'How this part is played, for the rules document.',
    ffHelp: 'Double-click the background to create a block. Drag a block’s dot onto another to link them (dropping on empty space creates a linked block). Drag the background to pan; the wheel zooms. Del deletes; arrows move the selected block; Ctrl+Z undoes.',
  },
};
const KINDS = ['DATA', 'FLOW', 'ACTION', 'SCORE'];
const SCOPES = ['general', 'player', 'component', 'node'];
const CATS = ['regra', 'plataforma', 'bot'];
const TABS = ['fluxo', 'cartoes', 'regras', 'partida', 'testes', 'codigo'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fill = (s, p = {}) => s.replace(/\{(\w+)\}/g, (_, k) => p[k] ?? '');
const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

let ctx = null;
const st = { list: null, slug: null, project: null, status: 'saved', timer: null, rev: 0, filters: { scope: '', cat: '' }, handlers: false, flow: null };
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
  st.rev++;
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
  const rev = st.rev;
  try {
    // O projeto local é a fonte: o editor de fluxo e os cartões mexem neste objeto.
    const saved = (await ctx.api(`forge/${encodeURIComponent(st.slug)}`, { method: 'PUT', body: st.project })).project;
    st.project.updatedAt = saved.updatedAt;
    st.status = st.rev === rev ? 'saved' : 'unsaved'; // mudou entretanto: guarda outra vez
    if (st.status === 'unsaved') st.timer = setTimeout(flush, 800);
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
    ${tab === 'fluxo' ? viewFluxo() : tab === 'regras' ? viewRegras() : tab === 'partida' ? viewPartida(p, st, f) : tab === 'testes' ? viewTestes(p, f) : tab === 'codigo' ? viewCodigo(p, f) : viewCartoes()}`;
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
  return '<div id="fgFlow"></div>';
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
  // O editor de fluxo tem DOM próprio: monta-se de novo a cada vista do separador.
  st.flow?.destroy();
  st.flow = null;
  const host = root.querySelector('#fgFlow');
  if (host && st.project) st.flow = mountFlow(host, st.project, { t: f, onChange: changed });
  if (st.handlers) return;
  st.handlers = true;
  root.addEventListener('input', (e) => {
    if (!st.project) return;
    if (e.target.id === 'fgName') { st.project.gameName = e.target.value; changed(); return; }
    if (e.target.hasAttribute('data-ts-helpers')) { st.project.tests.auxiliares = e.target.value; changed(); return; }
    if (e.target.hasAttribute('data-tt-code')) {
      const x = st.project.tests.itens.find((y) => y.id === e.target.closest('[data-test]')?.dataset.test);
      if (x && !x.aprovado) { x.codigo = e.target.value; changed(); }
      return;
    }
    if (e.target.hasAttribute('data-dnote')) {
      const nar = st.project.narrations.find((n) => n.id === st.narration) ?? st.project.narrations.at(-1);
      const doubt = nar?.duvidas.find((x) => x.id === e.target.closest('[data-doubt]')?.dataset.doubt);
      if (doubt) { doubt.nota = e.target.value; changed(); }
      return;
    }
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
    if (e.target.hasAttribute('data-pt-pick')) { st.narration = e.target.value; ctx.rerender(); return; }
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
    if (e.target.id === 'fgCommit') {
      e.preventDefault();
      e.stopImmediatePropagation();
      const data = new FormData(e.target);
      await flush();
      try {
        const r = await ctx.api(`forge/${encodeURIComponent(st.slug)}/commit`, { method: 'POST', body: { message: data.get('message'), kind: data.get('kind') } });
        st.project = r.project;
        ctx.toast(f('ptCommitted', { v: r.commit.version }));
        ctx.rerender();
      } catch (err) { ctx.toast(err.message); }
      return;
    }
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
    const nar = p && (p.narrations.find((n) => n.id === st.narration) ?? p.narrations.at(-1));
    if (d.pt === 'copy') {
      const form = b.closest('form');
      st.cenario = form.cenario.value;
      st.jogadores = Number(form.jogadores.value) || 2;
      await navigator.clipboard.writeText(buildPrompt(p, { cenario: st.cenario, jogadores: st.jogadores }));
      ctx.toast(f('ptCopied'));
      return;
    }
    if (d.pt === 'save') {
      let narration;
      try { narration = parseNarration(b.closest('form').resposta.value); } catch { ctx.toast(f('ptBadJson')); return; }
      await flush();
      try {
        const r = await ctx.api(`forge/${encodeURIComponent(st.slug)}/narrations`, { method: 'POST', body: { narration } });
        st.project = r.project;
        st.narration = r.narration.id;
        ctx.rerender();
      } catch (err) { ctx.toast(err.message); }
      return;
    }
    if (d.cd === 'copy' || d.cd === 'fix') {
      await flush();
      await navigator.clipboard.writeText(d.cd === 'fix' ? buildFixPrompt(p, st.slug) : buildCodePrompt(p, st.slug));
      ctx.toast(f('ptCopied'));
      return;
    }
    if (d.cd === 'report') {
      await navigator.clipboard.writeText(reportText(p, st.slug));
      ctx.toast(f('cdReportCopied'));
      return;
    }
    if (d.cd === 'publish') {
      if (!confirm(f('cdPublishConfirm', { name: p.gameName, id: st.slug }))) return;
      await flush();
      b.disabled = true;
      try {
        st.project = (await ctx.api(`forge/${encodeURIComponent(st.slug)}/publish`, { method: 'POST', body: {} })).project;
        ctx.toast(f('cdPublishDone'));
      } catch (err) { ctx.toast(err.message); }
      ctx.rerender();
      return;
    }
    if (d.cd === 'install') {
      await flush();
      b.disabled = true;
      try {
        st.project = (await ctx.api(`forge/${encodeURIComponent(st.slug)}/install`, { method: 'POST', body: {} })).project;
        ctx.toast(f('cdInstallDone'));
      } catch (err) { ctx.toast(err.message); }
      ctx.rerender();
      return;
    }
    if (d.cd === 'verify' || d.cd === 'reverify') {
      let files;
      if (d.cd === 'reverify') files = p.build?.files;
      else try { files = parseNarration(b.closest('form').resposta.value).files; } catch { /* abaixo */ }
      if (!files || typeof files !== 'object') { ctx.toast(f('cdBadJson')); return; }
      await flush();
      b.disabled = true;
      b.textContent = f('cdVerifying');
      try {
        st.project = (await ctx.api(`forge/${encodeURIComponent(st.slug)}/verify`, { method: 'POST', body: { files } })).project;
      } catch (err) { ctx.toast(err.message); }
      ctx.rerender();
      return;
    }
    if (d.ts === 'copy') {
      await navigator.clipboard.writeText(buildTestsPrompt(p));
      ctx.toast(f('ptCopied'));
      return;
    }
    if (d.ts === 'save') {
      let tests;
      try { tests = parseNarration(b.closest('form').resposta.value); } catch { ctx.toast(f('tsBadJson')); return; }
      await flush();
      try {
        st.project = (await ctx.api(`forge/${encodeURIComponent(st.slug)}/tests`, { method: 'POST', body: { tests } })).project;
        ctx.rerender();
      } catch (err) { ctx.toast(err.message); }
      return;
    }
    if (d.ts === 'unlock-all') {
      if (!confirm(f('tsUnlockAllConfirm'))) return;
      for (const x of p.tests.itens) x.aprovado = false;
      changed(); ctx.rerender(); return;
    }
    if (d.ts === 'approve-all') { for (const x of p.tests.itens) x.aprovado = true; changed(); ctx.rerender(); return; }
    if (d.tt) {
      const id = b.closest('[data-test]')?.dataset.test;
      const x = p.tests.itens.find((y) => y.id === id);
      if (!x) return;
      if (d.tt === 'approve') x.aprovado = true;
      if (d.tt === 'unlock') x.aprovado = false;
      if (d.tt === 'delete') p.tests.itens = p.tests.itens.filter((y) => y !== x);
      changed();
      ctx.rerender();
      return;
    }
    if (d.pt === 'approve' && nar) { nar.aprovada = true; changed(); ctx.rerender(); return; }
    if (d.pt === 'delete' && nar) {
      if (!confirm(f('ptConfirmDelete'))) return;
      p.narrations = p.narrations.filter((n) => n !== nar);
      st.narration = null;
      changed();
      ctx.rerender();
      return;
    }
    if (d.dt && nar) {
      const doubt = nar.duvidas.find((x) => x.id === b.closest('[data-doubt]')?.dataset.doubt);
      if (!doubt) return;
      doubt.estado = d.dt;
      if (d.dt === 'aberta') nar.aprovada = false;
      changed();
      ctx.rerender();
      return;
    }
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
