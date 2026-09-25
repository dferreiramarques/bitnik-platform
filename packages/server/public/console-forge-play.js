// Forge › Partida (ADR-012): a IA joga uma partida em texto, jogada a jogada,
// só com as regras e os cartões; onde as regras não chegam, marca uma dúvida.
// Aqui monta-se o prompt, cola-se a resposta, lê-se a linha do tempo,
// resolvem-se as dúvidas e faz-se o commit das regras (versão 0.x).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Prompt para qualquer IA: regras, fluxo, cartões e o formato de resposta (JSON). */
export function buildPrompt(p, { cenario, jogadores }) {
  const nodeName = (id) => p.nodes.find((n) => n.id === id)?.label ?? '—';
  const byCat = (cat) => p.cards.filter((c) => c.category === cat);
  const card = (c) => `- [${c.id}] (${c.kind}${c.ref ? `, bloco "${nodeName(c.ref)}"` : `, ${c.scope}`}) ${c.title}\n  Dado ${c.given}\n  Quando ${c.when}\n  Então ${c.then}`;
  const order = p.edges.map((e) => `${nodeName(e.from)} → ${nodeName(e.to)}`).join('\n');
  return `És um playtester rigoroso de jogos de tabuleiro. Vais jogar uma partida de "${p.gameName}" em texto, jogada a jogada, usando APENAS as regras e os cartões abaixo.

Cenário: ${cenario || 'jogo completo, do início ao fim'}
Jogadores: ${jogadores}

REGRAS IMPORTANTES
1. Não inventes regras. Sempre que as regras e os cartões não disserem o que acontece numa situação, regista uma DÚVIDA: a pergunta, o que assumiste para continuar, e os cartões relacionados.
2. Em cada jogada indica que cartões aplicaste (pelos ids, ex.: "c4") e como fica o estado do jogo depois dela.
3. Joga até ao fim do jogo (ou até o cenário acabar) e diz quem ganha e porquê.
4. Escolhe jogadas variadas e plausíveis; procura situações que ponham as regras à prova (empates, recursos a acabar, fim do jogo).
5. Os cartões de PLATAFORMA descrevem o que o servidor faz (ligações, tempos, avisos): não os simules, só os de REGRA e de BOT.

DOCUMENTO DE REGRAS
${p.rules.filter((r) => r.text.trim()).map((r) => `## ${r.ref ? nodeName(r.ref) : r.title}\n${r.text.trim()}`).join('\n\n') || '(sem texto)'}

FLUXO DO JOGO (blocos e ligações)
${p.nodes.map((n) => `- ${n.kind}: ${n.label}`).join('\n')}
${order ? `\nOrdem:\n${order}` : ''}

CARTÕES DE REGRA
${byCat('regra').map(card).join('\n') || '(nenhum)'}

CARTÕES DE BOT
${byCat('bot').map(card).join('\n') || '(nenhum)'}

CARTÕES DE PLATAFORMA (só para contexto)
${byCat('plataforma').map((c) => `- [${c.id}] ${c.title}`).join('\n') || '(nenhum)'}

FORMATO DA RESPOSTA
Responde só com um objeto JSON, sem texto à volta:
{
  "cenario": "texto curto",
  "jogadores": ${jogadores},
  "jogadas": [
    { "n": 1, "jogador": 1, "acao": "o que o jogador faz", "cartoes": ["c4"], "resultado": "o que acontece", "estado": "estado do jogo depois (mãos, mesa, pontos)" }
  ],
  "duvidas": [
    { "jogada": 14, "pergunta": "o que as regras não dizem", "assumido": "o que assumiste para continuar", "cartoes": ["c12"] }
  ],
  "fim": "quem ganha, com a pontuação e o desempate, se houver"
}`;
}

/** Extrai o JSON da resposta da IA (tolera blocos ``` e texto à volta). */
export function parseNarration(text) {
  const t = String(text ?? '').replace(/```(?:json)?/gi, '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('sem JSON');
  return JSON.parse(t.slice(a, b + 1));
}

export function viewPartida(p, st, f) {
  const nar = p.narrations.find((n) => n.id === st.narration) ?? p.narrations.at(-1);
  const cardTitle = (id) => p.cards.find((c) => c.id === id)?.title;
  const chips = (ids) => ids.map((id) => `<span class="pill" title="${esc(cardTitle(id) ?? f('ptUnknownCard'))}">${esc(id)}${cardTitle(id) ? '' : ' ?'}</span>`).join(' ');
  const open = nar ? nar.duvidas.filter((d) => d.estado === 'aberta').length : 0;
  const commits = [...p.ruleCommits].reverse();
  return `<div class="fg-play">
    <section class="panel">
      <div class="fg-card-head"><h2>${f('ptRules', { v: p.version })}</h2></div>
      <form class="form" id="fgCommit">
        <label class="wide">${f('ptCommitMsg')}<input name="message" maxlength="500" placeholder="${f('ptCommitHint')}"></label>
        <label>${f('ptCommitKind')}<select name="kind"><option value="regras">${f('ptKindRules')}</option><option value="texto">${f('ptKindText')}</option></select></label>
        <button class="btn btn-primary">${f('ptCommit')}</button>
      </form>
      ${commits.length ? `<ul class="fg-commits">${commits.slice(0, 8).map((c) => `<li><b>${esc(c.version)}</b> ${esc(c.message || '—')} <small>${new Date(c.ts).toLocaleString()}</small></li>`).join('')}</ul>` : `<p class="empty">${f('ptNoCommits')}</p>`}
    </section>
    <section class="panel">
      <h2>${f('ptNew')}</h2>
      <p class="con-lead">${f('ptNewLead')}</p>
      <form class="form" id="fgPrompt" onsubmit="return false">
        <label class="wide">${f('ptScenario')}<input name="cenario" value="${esc(st.cenario ?? '')}" placeholder="${f('ptScenarioHint')}"></label>
        <label>${f('ptPlayers')}<input name="jogadores" type="number" min="1" max="12" value="${st.jogadores ?? 2}"></label>
        <button type="button" class="btn btn-primary" data-pt="copy">${f('ptCopy')}</button>
        <label class="wide">${f('ptPaste')}<textarea name="resposta" rows="5" placeholder='{ "jogadas": [ … ] }'></textarea></label>
        <button type="button" class="btn btn-outline" data-pt="save">${f('ptSave')}</button>
      </form>
    </section>
    ${p.narrations.length ? `<section class="panel">
      <div class="fg-card-head">
        <label>${f('ptWhich')} <select data-pt-pick>${p.narrations.map((n) => `<option value="${esc(n.id)}" ${n === nar ? 'selected' : ''}>${esc(n.cenario || n.id)} · ${f('ptRulesV', { v: n.versaoRegras ?? '—' })}${n.aprovada ? ' ✓' : ''}</option>`).join('')}</select></label>
        <span class="pill ${nar.aprovada ? 'pill-ok' : open ? 'pill-bad' : ''}">${nar.aprovada ? f('ptApproved') : f('ptOpenDoubts', { n: open })}</span>
        ${!nar.aprovada ? `<button class="btn btn-primary" data-pt="approve" ${open ? 'disabled' : ''}>${f('ptApprove')}</button>` : ''}
        <button class="btn btn-ghost" data-pt="delete">${f('ptDelete')}</button>
      </div>
      ${nar.versaoRegras && nar.versaoRegras !== p.version ? `<p class="ff-warn">⚠ ${f('ptOldRules', { v: nar.versaoRegras, now: p.version })}</p>` : ''}
      <ol class="fg-timeline">${nar.jogadas.map((m) => {
        const doubts = nar.duvidas.filter((d) => d.jogada === m.n);
        return `<li>
          <div class="fg-move"><b>${m.n}.</b> ${m.jogador != null ? `<span class="pill">${f('ptPlayer', { n: esc(m.jogador) })}</span>` : ''} ${esc(m.acao)} ${chips(m.cartoes)}</div>
          ${m.resultado ? `<div class="fg-result">→ ${esc(m.resultado)}</div>` : ''}
          ${m.estado && m.estado !== '""' ? `<details><summary>${f('ptState')}</summary><pre>${esc(m.estado)}</pre></details>` : ''}
          ${doubts.map((d) => doubtHtml(d, chips, f)).join('')}
        </li>`;
      }).join('')}</ol>
      ${nar.duvidas.filter((d) => !nar.jogadas.some((m) => m.n === d.jogada)).map((d) => doubtHtml(d, chips, f)).join('')}
      ${nar.fim ? `<p class="fg-end"><b>${f('ptEnd')}</b> ${esc(nar.fim.replace(/^"|"$/g, ''))}</p>` : ''}
    </section>` : ''}
  </div>`;
}

function doubtHtml(d, chips, f) {
  return `<div class="fg-doubt st-${d.estado}" data-doubt="${esc(d.id)}">
    <div><b>${f('ptDoubt')}</b> ${esc(d.pergunta)} ${chips(d.cartoes)}</div>
    ${d.assumido ? `<div class="fg-assumed">${f('ptAssumed')} ${esc(d.assumido)}</div>` : ''}
    <div class="fg-doubt-acts">
      ${d.estado === 'aberta'
        ? `<button class="btn btn-outline" data-dt="resolvida">${f('ptResolved')}</button><button class="btn btn-ghost" data-dt="ignorada">${f('ptIgnore')}</button>`
        : `<span class="pill">${f(d.estado === 'resolvida' ? 'ptIsResolved' : 'ptIsIgnored')}</span><button class="btn btn-ghost" data-dt="aberta">${f('ptReopen')}</button>`}
      <input data-dnote value="${esc(d.nota)}" placeholder="${f('ptNote')}">
    </div>
  </div>`;
}
