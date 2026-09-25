// Publicar um protótipo da Forge como jogo 1.0.0 (etapa 5c): monta a pasta
// games/<id>/ a partir do pacote verificado, dos testes aprovados e das regras.
// Não mexe no Git: o commit é feito depois de rever as alterações.
import { composeTests } from './verify.js';

export const PUBLISH_VERSION = '1.0.0';

/** Muda a versão no index.js do pacote (a primeira `version: '…'`). */
export function setVersion(indexJs, version) {
  const re = /(\bversion\s*:\s*)(['"])[^'"]*\2/;
  if (!re.test(indexJs)) throw new Error('não encontrei a versão no index.js');
  return indexJs.replace(re, `$1'${version}'`);
}

/** O que publicar pede ao projeto, por ordem; devolve o primeiro problema ou null. */
export function publishProblem(p) {
  const b = p.build;
  if (!b?.report?.ok) return 'o pacote ainda não passou a verificação';
  if (b.versaoRegras !== p.version) return `o pacote verificado é das regras ${b.versaoRegras}; verifica outra vez com as regras ${p.version}`;
  if (!p.prototype || p.prototype.buildTs !== b.ts) return 'instala primeiro este pacote como protótipo e joga-o no Studio';
  if (p.published) return `já foi publicado como ${p.published.version}`;
  return null;
}

/** Ficheiros de games/<id>/ (caminho relativo → conteúdo). */
export function publicationFiles(p, slug, { engineVersion, date = new Date() }) {
  const files = { ...p.build.files, 'index.js': setVersion(p.build.files['index.js'], PUBLISH_VERSION) };
  const approved = (p.tests?.itens || []).filter((t) => t.aprovado);
  files['test/forge.test.js'] = composeTests(approved, p.tests?.auxiliares || '')
    .replace("import game from '../index.js';", "import game from '../index.js';\n// Testes aprovados na Forge: são as regras. Um teste por cartão e por partida narrada.");
  const nodeName = (id) => p.nodes.find((n) => n.id === id)?.label;
  const rules = p.rules.filter((r) => r.text.trim());
  files['REGRAS.md'] = `# ${p.gameName} — regras\n\n${rules.map((r) => `## ${(r.ref && nodeName(r.ref)) || r.title}\n\n${r.text.trim()}`).join('\n\n') || '(sem texto)'}\n`;
  const sim = p.build.report.simulation || [];
  const day = date.toISOString().slice(0, 10);
  files['CHANGELOG.md'] = [
    `# ${p.gameName} — histórico de regras`,
    '',
    `## ${PUBLISH_VERSION} — Publicado (${day})`,
    '',
    `Publicado a partir da Forge (regras ${p.version}, ${approved.length} testes aprovados).`,
    ...(sim.length ? ['', 'Vitórias por lugar em simulação com bots:', '', '| Jogadores | Vitórias por lugar (%) |', '|---|---|',
      ...sim.map((x) => `| ${x.numPlayers} | ${(x.winRateBySeat || []).join(' / ')} |`)] : []),
    '',
    '## Protótipos',
    '',
    ...[...p.ruleCommits].reverse().map((c) => `- ${c.version}: ${c.message || '—'}`),
    '',
  ].join('\n');
  const engine = `^${String(engineVersion).split('.').slice(0, 2).join('.')}.0`;
  files['package.json'] = `${JSON.stringify({
    name: `@bitnik/game-${slug}`,
    version: PUBLISH_VERSION,
    description: `${p.gameName} — pacote de jogo para @bitnik/engine.`,
    type: 'module',
    main: 'index.js',
    exports: { '.': './index.js' },
    files: [...Object.keys(p.build.files).filter((f) => !f.includes('/')), ...new Set(Object.keys(p.build.files).filter((f) => f.includes('/')).map((f) => `${f.split('/')[0]}/`)), 'REGRAS.md', 'CHANGELOG.md'],
    license: 'UNLICENSED',
    author: 'Bitnik Games',
    peerDependencies: { '@bitnik/engine': engine },
    scripts: { test: 'node --test test/*.test.js' },
    bitnik: { engine, langs: ['pt', 'en'], forge: { rules: p.version } },
  }, null, 2)}\n`;
  return files;
}
