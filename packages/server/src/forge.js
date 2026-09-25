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
  return {
    gameName: str(input.gameName, 120).trim() || 'Jogo sem nome',
    nodes, edges, cards, rules, legacyCommits,
  };
}

/** Resumo para a lista de projetos. */
export const projectSummary = (slug, p) => ({
  slug, gameName: p.gameName, updatedAt: p.updatedAt, createdAt: p.createdAt,
  nodes: p.nodes.length, cards: p.cards.length, rules: p.rules.length,
});
