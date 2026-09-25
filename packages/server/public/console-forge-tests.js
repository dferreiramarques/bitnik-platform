// Forge › Testes (ADR-012): um teste por cartão de regra e um por partida
// narrada aprovada, escritos antes do código. O designer lê cada um como
// Dado / Quando / Então e aprova; os aprovados ficam fixos e o código da
// etapa seguinte tem de os passar.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function buildTestsPrompt(p) {
  const nodeName = (id) => p.nodes.find((n) => n.id === id)?.label ?? '—';
  const regra = p.cards.filter((c) => c.category === 'regra');
  const data = p.nodes.filter((n) => n.kind === 'DATA');
  const approved = p.narrations.filter((n) => n.aprovada);
  const card = (c) => `- [${c.id}] ${c.title}${c.ref ? ` (bloco "${nodeName(c.ref)}")` : ''}\n  Dado ${c.given}\n  Quando ${c.when}\n  Então ${c.then}`;
  return `Vais escrever os TESTES de um jogo de tabuleiro, "${p.gameName}", ANTES de o código existir. Os testes são a especificação: o código vai ser escrito depois para os passar.

COMO É UM JOGO NESTA PLATAFORMA
- Pacote ESM com \`import game from '../index.js'\` (um objeto do contrato @bitnik/engine).
- Regras puras sobre um estado JSON; jogadas: \`applyMove(game, match, lugar, { type, payload })\` devolve \`{ ok, match }\` ou \`{ ok: false, error: { code: 'err.CODIGO' } }\`.
- \`createMatch(game, { numPlayers, seed, options })\` cria a partida; \`match.state\` é o estado; \`match.result\` é null ou \`{ scores, winners }\`.
- \`game.enumerate(state, lugar)\` lista as jogadas legais; \`game.view(state, lugar)\` o que cada lugar vê.
- Testes com node:test e node:assert/strict. Para montar um "Dado", copia o match e mexe no estado:
  const tweak = (m, fn) => { const c = structuredClone(m); fn(c.state); return c; };
- Já estão disponíveis: test, assert, createMatch, applyMove, fireTimer, simulate, viewFor, legalMoves, game, tweak.
- Funções comuns a vários testes (ex.: novo(n), jogar(m, lugar, tipo, payload), montar uma mesa) vão TODAS no campo "auxiliares", nunca no "estado" nem só num teste.
- A PLATAFORMA já trata de: sentar e começar a mesa (anfitrião, "Iniciar"), jogadores que se desligam, bots nos lugares vazios, "jogar outra vez". Não escrevas jogadas para isso; a partida começa já no createMatch.
- O TEMPO (esperas, revelações com pausa, limites) é um evento: a regra faz ctx.schedule(chave, ms, 'EVENTO') e o teste dispara-o com fireTimer(game, match, chave). Nunca uses um jogador falso (ex.: 'sistema') para jogadas de tempo: só os lugares de activePlayers podem jogar.

MODELO DO ESTADO
Propõe a forma do estado a partir dos blocos DATA (o que existe no jogo) e usa-a em todos os testes:
${data.map((n) => `- ${n.label}`).join('\n') || '(sem blocos DATA)'}

CARTÕES DE REGRA (um teste por cartão)
${regra.map(card).join('\n') || '(nenhum)'}

${approved.length ? `PARTIDAS NARRADAS APROVADAS (um teste de ponta a ponta por partida: joga as mesmas jogadas e confirma o estado e o fim)
${approved.map((n) => `### ${n.id}: ${n.cenario} (${n.jogadores} jogadores)\n${n.jogadas.map((m) => `${m.n}. J${m.jogador ?? '-'}: ${m.acao} → ${m.resultado}`).join('\n')}\nFim: ${n.fim}`).join('\n\n')}` : ''}

REGRAS
1. Um teste por cartão de regra; o nome do teste é o título do cartão.
2. Não inventes regras. Se um cartão não chegar para escrever o teste, escreve o teste com o que há e diz a dúvida no campo "entao".
3. Usa nomes de jogadas em MAIÚSCULAS (ex.: "APOSTAR") e códigos de erro "err.X"; mantém-nos iguais em todos os testes.

FORMATO DA RESPOSTA
Responde só com um objeto JSON:
{
  "estado": "a forma do estado, em JSON comentado ou texto (sem código)",
  "auxiliares": "código JavaScript com as funções comuns aos testes (const novo = …; const jogar = …;)",
  "testes": [
    { "cartao": "c4", "nome": "título do cartão", "dado": "em português simples", "quando": "…", "entao": "…",
      "codigo": "test('título do cartão', () => { … });" },
    { "narracao": "p1", "nome": "Partida narrada p1", "dado": "…", "quando": "…", "entao": "…", "codigo": "test('…', () => { … });" }
  ]
}`;
}

export function viewTestes(p, f) {
  const t = p.tests || { estado: '', itens: [] };
  const regra = p.cards.filter((c) => c.category === 'regra');
  const covered = new Set(t.itens.map((x) => x.cartao).filter(Boolean));
  const missing = regra.filter((c) => !covered.has(c.id));
  const orphans = t.itens.filter((x) => x.cartao && !p.cards.some((c) => c.id === x.cartao));
  const approvedN = t.itens.filter((x) => x.aprovado).length;
  const cardTitle = (id) => p.cards.find((c) => c.id === id)?.title;
  return `<div class="fg-play">
    <section class="panel">
      <h2>${f('tsTitle')}</h2>
      <p class="con-lead">${f('tsLead')}</p>
      <form class="form" id="fgTests" onsubmit="return false">
        <button type="button" class="btn btn-primary" data-ts="copy">${f('ptCopy')}</button>
        <label class="wide">${f('ptPaste')}<textarea name="resposta" rows="5" placeholder='{ "estado": "…", "testes": [ … ] }'></textarea></label>
        <button type="button" class="btn btn-outline" data-ts="save">${f('tsSave')}</button>
      </form>
    </section>
    ${t.itens.length ? `<section class="panel">
      <div class="fg-card-head">
        <h2>${f('tsList', { n: t.itens.length, a: approvedN })}</h2>
        ${t.versaoRegras && t.versaoRegras !== p.version ? `<span class="pill pill-bad">${f('tsOld', { v: t.versaoRegras })}</span>` : ''}
        <button class="btn btn-primary" data-ts="approve-all" ${approvedN === t.itens.length ? 'disabled' : ''}>${f('tsApproveAll')}</button>
      </div>
      <p>${missing.length ? `⚠ ${esc(f('tsMissing', { list: missing.map((c) => `${c.id} ${c.title}`).join(', ') }))}` : `✓ ${f('tsCovered')}`}</p>
      ${orphans.length ? `<p class="ff-warn">⚠ ${esc(f('tsOrphans', { list: orphans.map((x) => x.cartao).join(', ') }))}</p>` : ''}
      ${t.estado ? `<details><summary>${f('tsModel')}</summary><pre class="fg-pre">${esc(t.estado)}</pre></details>` : ''}
      <details ${t.auxiliares ? '' : 'open'}><summary>${f('tsHelpers')}</summary>
        <p class="con-lead"><small>${f('tsHelpersHint')}</small></p>
        <textarea class="fg-code" data-ts-helpers rows="10" spellcheck="false">${esc(t.auxiliares || '')}</textarea>
      </details>
      <div class="fg-tests">${t.itens.map((x) => `<article class="fg-test ${x.aprovado ? 'ok' : ''}" data-test="${esc(x.id)}">
        <div class="fg-card-head">
          <span class="pill">${x.cartao ? esc(x.cartao) : x.narracao ? `${f('tsGame')} ${esc(x.narracao)}` : '—'}</span>
          <strong>${esc(x.nome || cardTitle(x.cartao) || '')}</strong>
          ${x.aprovado
            ? `<span class="pill pill-ok">${f('tsApproved')}</span><button class="btn btn-ghost" data-tt="unlock">${f('tsUnlock')}</button>`
            : `<button class="btn btn-outline" data-tt="approve">${f('tsApprove')}</button><button class="btn btn-ghost" data-tt="delete" aria-label="${f('tsDelete')}">✕</button>`}
        </div>
        <dl class="fg-gwt"><dt>${f('given')}</dt><dd>${esc(x.dado)}</dd><dt>${f('when')}</dt><dd>${esc(x.quando)}</dd><dt>${f('then')}</dt><dd>${esc(x.entao)}</dd></dl>
        <details><summary>${f('tsCode')}</summary><pre class="fg-pre">${esc(x.codigo)}</pre></details>
      </article>`).join('')}</div>
    </section>` : `<p class="empty">${f('tsNone')}</p>`}
  </div>`;
}
