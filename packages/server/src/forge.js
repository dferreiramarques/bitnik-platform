// Forge (ADR-009 a 013): projetos de jogo no Studio. Um projeto tem o fluxo
// (nós DATA/FLOW/ACTION/SCORE e ligações), os cartões Gherkin, o documento de
// regras e o histórico. Aceita os projetos exportados pelo Rule Forge
// (bitnik-logic), no mesmo formato, e acrescenta a categoria de cada cartão.

export const KINDS = ['DATA', 'FLOW', 'ACTION', 'SCORE'];
export const SCOPES = ['general', 'player', 'component', 'node'];
/** regra: vira teste; plataforma: tratado pela plataforma; bot: só se testa que o bot joga jogadas válidas. */
export const CATEGORIES = ['regra', 'plataforma', 'bot'];

const str = (v, max = 2000) => String(v ?? '').slice(0, max);
const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
const idOf = (v, prefix, i) => (/^[\w-]{1,40}$/.test(String(v ?? '')) ? String(v) : `${prefix}${i + 1}`);

export function slugify(name) {
  const s = str(name, 60).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'jogo';
}

/**
 * Normaliza um projeto (novo, importado do Rule Forge ou gravado pela consola):
 * só campos conhecidos, tipos e tamanhos controlados, referências válidas.
 */
export function normalizeProject(input = {}) {
  const nodes = (Array.isArray(input.nodes) ? input.nodes : []).slice(0, 500).map((n, i) => ({
    id: idOf(n?.id, 'n', i),
    kind: KINDS.includes(n?.kind) ? n.kind : 'FLOW',
    label: str(n?.label, 120),
    x: num(n?.x),
    y: num(n?.y),
  }));
  const ids = new Set(nodes.map((n) => n.id));
  const seen = new Set();
  const edges = (Array.isArray(input.edges) ? input.edges : []).slice(0, 2000)
    .map((e) => ({ from: String(e?.from ?? ''), to: String(e?.to ?? '') }))
    .filter((e) => {
      const key = `${e.from}>${e.to}`;
      if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const cards = (Array.isArray(input.cards) ? input.cards : []).slice(0, 1000).map((c, i) => {
    const scope = SCOPES.includes(c?.scope) ? c.scope : 'general';
    // Uma referência a um bloco apagado fica guardada (o Rule Forge mostra-a como "sem bloco").
    const ref = scope === 'component' || scope === 'node' ? (c?.ref == null ? null : String(c.ref).slice(0, 40)) : null;
    return {
      id: idOf(c?.id, 'c', i),
      kind: KINDS.includes(c?.kind) ? c.kind : 'ACTION',
      category: CATEGORIES.includes(c?.category) ? c.category : 'regra',
      scope,
      ref,
      title: str(c?.title, 200),
      given: str(c?.given),
      when: str(c?.when),
      then: str(c?.then),
    };
  });
  const rules = (Array.isArray(input.rules) ? input.rules : []).slice(0, 500).map((r, i) => ({
    id: idOf(r?.id, 'r', i),
    ref: r?.ref == null ? null : String(r.ref).slice(0, 40),
    title: str(r?.title, 200),
    text: str(r?.text, 20000),
  }));
  // Commits do Rule Forge (PWA gerados) ficam como histórico antigo, só para consulta.
  const legacyCommits = (Array.isArray(input.legacyCommits) ? input.legacyCommits : Array.isArray(input.commits) ? input.commits : [])
    .slice(0, 200).map((c, i) => ({
      id: idOf(c?.id, 'k', i),
      ts: num(c?.ts),
      gameName: str(c?.gameName, 120),
      cardCount: num(c?.cardCount),
      nodeCount: num(c?.nodeCount),
      code: str(c?.code, 500_000),
    }));
  const narrations = (Array.isArray(input.narrations) ? input.narrations : []).slice(0, 100).map(normalizeNarration);
  // Commits das regras: fotografias do fluxo, cartões e regras, com a versão 0.x que deram.
  const ruleCommits = (Array.isArray(input.ruleCommits) ? input.ruleCommits : []).slice(0, 500).map((c, i) => ({
    id: idOf(c?.id, 'rc', i),
    ts: num(c?.ts),
    version: /^\d+\.\d+\.\d+$/.test(String(c?.version)) ? String(c.version) : '0.1.0',
    kind: c?.kind === 'texto' ? 'texto' : 'regras',
    message: str(c?.message, 500),
    snapshot: {
      nodes: Array.isArray(c?.snapshot?.nodes) ? c.snapshot.nodes : [],
      edges: Array.isArray(c?.snapshot?.edges) ? c.snapshot.edges : [],
      cards: Array.isArray(c?.snapshot?.cards) ? c.snapshot.cards : [],
      rules: Array.isArray(c?.snapshot?.rules) ? c.snapshot.rules : [],
    },
  }));
  const prototypes = (Array.isArray(input.prototypes) ? input.prototypes : input.prototype ? [input.prototype] : [])
    .filter((x) => x && /^[\w.-]{1,60}$/.test(x.folder ?? '')).slice(-20)
    .map((x) => ({ version: str(x.version, 20), folder: x.folder, ts: num(x.ts), buildTs: num(x.buildTs) }));
  return {
    gameName: str(input.gameName, 120).trim() || 'Jogo sem nome',
    nodes, edges, cards, rules, legacyCommits, narrations, ruleCommits,
    tests: normalizeTests(input.tests),
    // Última verificação de um pacote gerado: ficheiros e relatório (o servidor escreve-a).
    build: input.build && typeof input.build === 'object' ? {
      ts: num(input.build.ts), versaoRegras: input.build.versaoRegras ? str(input.build.versaoRegras, 20) : null,
      files: Object.fromEntries(Object.entries(input.build.files || {}).slice(0, 60).map(([k, v]) => [str(k, 200), str(v, 500_000)])),
      report: input.build.report ?? null,
    } : null,
    // Protótipos instalados no Studio (etapa 5), o mais recente no fim. A pasta
    // tem nome seguro e é o servidor que a escolhe.
    prototypes,
    prototype: prototypes.at(-1) ?? null,
    // Publicação em games/<id>/ (etapa 5c); escrita só pelo servidor.
    published: input.published && typeof input.published === 'object' ? {
      version: str(input.published.version, 20), ts: num(input.published.ts), dir: str(input.published.dir, 200),
      files: (Array.isArray(input.published.files) ? input.published.files : []).slice(0, 100).map((f) => str(f, 200)),
    } : null,
    version: ruleCommits.at(-1)?.version ?? '0.0.0',
  };
}

// ─── Partida narrada (ADR-012) ──────────────────────────────
export const DOUBT_STATUS = ['aberta', 'resolvida', 'ignorada'];

/** Normaliza uma partida narrada (colada da IA ou editada na consola). */
export function normalizeNarration(input = {}, i = 0) {
  const moves = (Array.isArray(input.jogadas) ? input.jogadas : []).slice(0, 2000).map((m, k) => ({
    n: num(m?.n) || k + 1,
    jogador: m?.jogador == null ? null : str(m.jogador, 60),
    acao: str(m?.acao, 1000),
    cartoes: (Array.isArray(m?.cartoes) ? m.cartoes : []).slice(0, 20).map((c) => str(c, 40)),
    resultado: str(m?.resultado, 2000),
    estado: str(typeof m?.estado === 'string' ? m.estado : JSON.stringify(m?.estado ?? ''), 4000),
  }));
  const doubts = (Array.isArray(input.duvidas) ? input.duvidas : []).slice(0, 500).map((d, k) => ({
    id: idOf(d?.id, 'd', k),
    jogada: d?.jogada == null ? null : num(d.jogada),
    pergunta: str(d?.pergunta, 2000),
    assumido: str(d?.assumido, 2000),
    cartoes: (Array.isArray(d?.cartoes) ? d.cartoes : []).slice(0, 20).map((c) => str(c, 40)),
    estado: DOUBT_STATUS.includes(d?.estado) ? d.estado : 'aberta',
    nota: str(d?.nota, 2000),
  }));
  return {
    id: idOf(input.id, 'p', i),
    criada: num(input.criada) || null,
    cenario: str(input.cenario, 500),
    jogadores: Math.max(0, Math.min(12, num(input.jogadores))),
    jogadas: moves,
    duvidas: doubts,
    fim: str(typeof input.fim === 'string' ? input.fim : JSON.stringify(input.fim ?? ''), 2000),
    aprovada: !!input.aprovada && doubts.every((d) => d.estado !== 'aberta'),
    versaoRegras: input.versaoRegras ? str(input.versaoRegras, 20) : null,
  };
}

// ─── Testes a partir dos cartões (ADR-012) ──────────────────
/**
 * Um teste por cartão de regra (e um por partida narrada aprovada), com o
 * Dado/Quando/Então legível e o código. Os aprovados ficam fixos: uma nova
 * resposta da IA só substitui os que ainda não foram aprovados.
 */
export function normalizeTests(input = {}) {
  const itens = (Array.isArray(input.itens) ? input.itens : Array.isArray(input.testes) ? input.testes : []).slice(0, 1000).map((t, i) => ({
    id: idOf(t?.id, 't', i),
    cartao: t?.cartao == null ? null : str(t.cartao, 40),
    narracao: t?.narracao == null ? null : str(t.narracao, 40),
    nome: str(t?.nome, 300),
    dado: str(t?.dado),
    quando: str(t?.quando),
    entao: str(t?.entao),
    codigo: str(t?.codigo, 50_000),
    aprovado: !!t?.aprovado,
  }));
  return {
    estado: str(input.estado, 20_000),
    // Funções comuns a todos os testes (montar um "Dado", jogar várias jogadas…).
    auxiliares: str(input.auxiliares, 50_000),
    versaoRegras: input.versaoRegras ? str(input.versaoRegras, 20) : null,
    itens,
  };
}

/** Junta uma resposta nova da IA aos testes existentes: os aprovados não mudam. */
export function mergeTests(current, incoming, versaoRegras) {
  const kept = (current?.itens || []).filter((t) => t.aprovado);
  const keyOf = (t) => t.cartao ? `c:${t.cartao}` : t.narracao ? `p:${t.narracao}` : `n:${t.nome}`;
  const keptKeys = new Set(kept.map(keyOf));
  const fresh = normalizeTests(incoming).itens
    .filter((t) => !keptKeys.has(keyOf(t)))
    .map((t, i) => ({ ...t, id: `t${Date.now().toString(36)}${i}`, aprovado: false }));
  const next = normalizeTests(incoming);
  return {
    estado: next.estado.trim() ? next.estado : current?.estado ?? '',
    auxiliares: next.auxiliares.trim() ? next.auxiliares : current?.auxiliares ?? '',
    versaoRegras,
    itens: [...kept, ...fresh],
  };
}

/** Versão do protótipo: 0.x (ADR-013). Mudança de regras sobe o minor; só texto, o patch. */
export function bumpVersion(v, kind) {
  const [maj, min, pat] = String(v || '0.0.0').split('.').map((x) => parseInt(x, 10) || 0);
  return kind === 'texto' ? `${maj}.${min}.${pat + 1}` : `${maj}.${min + 1}.0`;
}

/** Resumo para a lista de projetos. */
export const projectSummary = (slug, p) => ({
  slug, gameName: p.gameName, updatedAt: p.updatedAt, createdAt: p.createdAt,
  nodes: p.nodes.length, cards: p.cards.length, rules: p.rules.length,
});
