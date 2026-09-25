// Forge › Código (ADR-010 a 013): a IA escreve o pacote do jogo (regras,
// textos PT/EN) para passar os testes aprovados; cola-se aqui e o Studio
// verifica-o num processo isolado. Se falhar, o prompt de correção leva os
// erros de volta à IA.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const CONTRACT = `CONTRATO DE UM PACOTE (@bitnik/engine)
index.js:
  import { defineGame } from '@bitnik/engine';
  export default defineGame({
    id, version, players: { min, max }, defaultLang: 'pt', i18n: { pt, en },
    setup(ctx) → estado inicial (ctx.numPlayers, ctx.rng, ctx.options),
    moves: { NOME(state, payload, ctx) { altera o state; para recusar: return ctx.invalid('err.CODIGO') } },
    activePlayers(state) → [lugares que podem jogar agora],
    enumerate(state, lugar) → [{ type, payload }] com TODAS as jogadas legais (obrigatório),
    view(state, lugar) → o que esse lugar vê (esconde o que é secreto),
    result(state) → null enquanto o jogo decorre; no fim { scores: [...], winners: [lugares] },
    events: { NOME(state, payload, ctx) } (opcional, para tempos: ctx.schedule(chave, ms, 'NOME')),
    bots: { default(view, lugar, { rng, legal }) → uma jogada de legal } (opcional),
  });
ctx nas jogadas: ctx.seat, ctx.rng (next, int(n), chance(p), pick(arr), shuffle(arr)), ctx.log('log.CHAVE', params), ctx.invalid(code), ctx.schedule, ctx.cancel.
Regras PURAS: sem Math.random (usa ctx.rng), sem Date, sem setTimeout, sem rede; só importam '@bitnik/engine' e ficheiros próprios ('./...').
i18n/pt.js e i18n/en.js: export default { 'game.name': '…', 'game.tagline': 'uma frase curta', 'move.NOME': '…', 'err.CODIGO': '…', 'log.CHAVE': '…' } com AS MESMAS CHAVES nas duas línguas.`;

export function buildCodePrompt(p, slug) {
  const approved = (p.tests?.itens || []).filter((t) => t.aprovado);
  const regra = p.cards.filter((c) => c.category !== 'plataforma');
  const nodeName = (id) => p.nodes.find((n) => n.id === id)?.label ?? '—';
  return `Vais escrever o CÓDIGO de um jogo de tabuleiro, "${p.gameName}", como um pacote para a plataforma Bitnik. Tem de passar os testes já aprovados, que estão no fim.

${CONTRACT}

IDENTIDADE (obrigatório)
id: '${slug}'
version: '${p.version}'

MODELO DO ESTADO (acordado nos testes)
${p.tests?.estado || '(não definido: segue os testes)'}

DOCUMENTO DE REGRAS
${p.rules.filter((r) => r.text.trim()).map((r) => `## ${r.ref ? nodeName(r.ref) : r.title}\n${r.text.trim()}`).join('\n\n') || '(sem texto)'}

CARTÕES (regra e bot)
${regra.map((c) => `- [${c.id}] (${c.category}) ${c.title}: Dado ${c.given}; Quando ${c.when}; Então ${c.then}`).join('\n') || '(nenhum)'}

TESTES APROVADOS (não podem mudar; o código tem de os passar; têm à mão createMatch, applyMove, fireTimer, simulate, viewFor, legalMoves, game, tweak, assert e as funções auxiliares abaixo)
${p.tests?.auxiliares?.trim() ? `// Funções auxiliares dos testes\n${p.tests.auxiliares}\n\n` : ''}${approved.map((t) => t.codigo).join('\n\n') || '(nenhum: aprova os testes primeiro)'}

A plataforma vai também simular 50 partidas com bots por número de jogadores: todas têm de acabar sem erros.

FORMATO DA RESPOSTA
Responde só com um objeto JSON com o conteúdo de cada ficheiro:
{ "files": { "index.js": "…", "rules.js": "…", "i18n/pt.js": "…", "i18n/en.js": "…" } }`;
}

/** Prompt de correção: o relatório da verificação e o código atual. */
export function buildFixPrompt(p, slug) {
  const r = p.build?.report;
  const fails = (r?.steps || []).filter((s) => !s.ok).map((s) => `- ${s.id}: ${s.details.join(' | ') || 'falhou'}`).join('\n');
  const tests = (r?.tests?.failures || []).map((t) => `- teste "${t.name}": ${t.error}`).join('\n');
  const sim = (r?.simulation || []).filter((x) => x.error || x.failures?.length).map((x) => `- ${x.numPlayers} jogadores: ${x.error || JSON.stringify(x.failures)}`).join('\n');
  return `${buildCodePrompt(p, slug)}

A VERSÃO ANTERIOR FALHOU A VERIFICAÇÃO. Corrige-a (sem mudar os testes):
${fails}
${tests}
${sim}

CÓDIGO ANTERIOR
${Object.entries(p.build?.files || {}).map(([f, c]) => `### ${f}\n${c}`).join('\n\n')}`;
}

const STEP_NAMES = {
  ficheiros: 'Ficheiros', pureza: 'Regras puras', 'testes-aprovados': 'Há testes aprovados', importar: 'O pacote carrega',
  contrato: 'Cumpre o contrato', testes: 'Testes aprovados passam', simulacao: 'Partidas simuladas acabam', identidade: 'Nome e versão',
  tempo: 'Tempo limite', processo: 'Processo isolado', 'testes-auxiliares': 'Funções dos testes',
};

/** O relatório em texto, para copiar e colar numa conversa. */
export function reportText(p, slug) {
  const b = p.build;
  const r = b?.report;
  if (!r) return '';
  const lines = [
    `Relatório da Forge: ${p.gameName} (${slug}), regras ${b.versaoRegras ?? '—'}, ${new Date(b.ts).toISOString()}`,
    `Resultado: ${r.ok ? 'passou em tudo' : 'há falhas'} (${r.ms} ms)`,
    '',
    ...r.steps.map((s) => `${s.ok ? '✓' : '✗'} ${STEP_NAMES[s.id] ?? s.id}${s.details?.length ? `\n    ${s.details.join('\n    ')}` : ''}`),
    '',
    `Testes: ${r.tests.pass} passaram, ${r.tests.fail} falharam`,
    ...r.tests.failures.map((t) => `  ✗ ${t.name}: ${t.error.replace(/\s+/g, ' ')}`),
    '',
    'Simulação:',
    ...(r.simulation || []).map((x) => `  ${x.numPlayers} jogadores: ${x.error ? `erro ${x.error}` : `${x.finished}/${x.games} acabadas${x.failures?.length ? `, falha: ${x.failures[0].reason}` : ''}, vitórias ${(x.winRateBySeat || []).join('/')}`}`),
    '',
    `Ficheiros: ${Object.keys(b.files).join(', ')}`,
  ];
  return lines.join('\n');
}

export function viewCodigo(p, f) {
  const approved = (p.tests?.itens || []).filter((t) => t.aprovado).length;
  const b = p.build;
  const r = b?.report;
  const testSide = r && r.steps.some((s) => s.id === 'testes-auxiliares' && !s.ok);
  return `<div class="fg-play">
    <section class="panel">
      <h2>${f('cdTitle', { v: p.version })}</h2>
      <p class="con-lead">${f('cdLead')}</p>
      ${approved ? '' : `<p class="ff-warn">⚠ ${f('cdNoTests')}</p>`}
      ${p.prototype ? `<p class="fg-installed">✓ ${f('cdInstalled', { v: p.prototype.version, d: new Date(p.prototype.ts).toLocaleString() })}
        ${p.prototypes.length > 1 ? `<small>${f('cdOlder', { list: p.prototypes.slice(0, -1).map((x) => x.version).join(', ') })}</small>` : ''}
        <a class="btn btn-outline" href="/" target="_blank" rel="noopener">${f('cdOpenLobby')}</a></p>` : ''}
      <form class="form" id="fgCode" onsubmit="return false">
        <button type="button" class="btn btn-primary" data-cd="copy" ${approved ? '' : 'disabled'}>${f('ptCopy')}</button>
        ${r && !r.ok && !testSide ? `<button type="button" class="btn btn-outline" data-cd="fix">${f('cdCopyFix')}</button>` : ''}
        <label class="wide">${f('cdPaste')}<textarea name="resposta" rows="5" placeholder='{ "files": { "index.js": "…" } }'></textarea></label>
        <button type="button" class="btn btn-primary" data-cd="verify">${f('cdVerify')}</button>
      </form>
    </section>
    ${r ? `<section class="panel">
      <div class="fg-card-head">
        <h2>${f('cdReport')}</h2>
        <span class="pill ${r.ok ? 'pill-ok' : 'pill-bad'}">${r.ok ? f('cdOk') : f('cdFail')}</span>
        <small>${new Date(b.ts).toLocaleString()} · ${f('ptRulesV', { v: b.versaoRegras ?? '—' })} · ${r.ms} ms</small>
        <button type="button" class="btn btn-ghost" data-cd="report">${f('cdCopyReport')}</button>
        <button type="button" class="btn btn-outline" data-cd="reverify">${f('cdReverify')}</button>
      </div>
      ${testSide ? `<p class="ff-warn">⚠ ${f('cdTestSide')}</p>` : ''}
      ${b.versaoRegras !== p.version ? `<p class="ff-warn">⚠ ${f('cdOld', { v: p.version })}</p>` : ''}
      <ul class="fg-steps">${r.steps.map((s) => `<li class="${s.ok ? 'ok' : 'bad'}"><b>${s.ok ? '✓' : '✗'} ${esc(STEP_NAMES[s.id] ?? s.id)}</b>
        ${s.details?.length ? `<pre class="fg-pre">${esc(s.details.join('\n'))}</pre>` : ''}</li>`).join('')}</ul>
      ${r.tests.pass + r.tests.fail ? `<p>${f('cdTests', { pass: r.tests.pass, fail: r.tests.fail })}</p>` : ''}
      ${r.tests.failures.length ? `<ul class="fg-steps">${r.tests.failures.map((t) => `<li class="bad"><b>✗ ${esc(t.name)}</b><pre class="fg-pre">${esc(t.error)}</pre></li>`).join('')}</ul>` : ''}
      ${r.simulation?.length ? `<table class="tbl"><thead><tr><th>${f('cdPlayers')}</th><th>${f('cdFinished')}</th><th>${f('cdWins')}</th></tr></thead><tbody>
        ${r.simulation.map((x) => `<tr><td>${x.numPlayers}</td><td>${x.error ? `✗ ${esc(x.error)}` : `${x.finished}/${x.games}${x.failures?.length ? ` · ✗ ${esc(x.failures[0].reason)}` : ''}`}</td><td>${(x.winRateBySeat || []).map((w) => `${w}%`).join(' / ')}</td></tr>`).join('')}
      </tbody></table>` : ''}
      <details><summary>${f('cdFiles', { n: Object.keys(b.files).length })}</summary>${Object.entries(b.files).map(([n, c]) => `<p><b>${esc(n)}</b></p><pre class="fg-pre">${esc(c)}</pre>`).join('')}</details>
      ${r.ok ? `<div class="fg-card-head">
        <button type="button" class="btn btn-primary" data-cd="install">${f(p.prototype ? 'cdReinstall' : 'cdInstall')}</button>
        <span class="con-lead">${f('cdInstallHint')}</span>
      </div>` : ''}
    </section>` : ''}
  </div>`;
}
