// Consola do Studio / runtime: estado do servidor, jogos (com simulação),
// mesas de aprovação por convite e avisos. Fala só com /admin/*,
// autenticada com o ADMIN_TOKEN (guardado só nesta sessão do browser).

const UI = {
  pt: {
    console: 'Consola', lobby: 'Abrir o lobby', lang: 'EN', logout: 'Sair',
    loginTitle: 'Entrar na consola', loginLead: 'Usa o ADMIN_TOKEN deste servidor.', token: 'Token', enter: 'Entrar',
    badToken: 'Token inválido.', offline: 'Sem ligação ao servidor.', saved: 'Guardado.', copied: 'Link copiado.',
    nav_painel: 'Painel', nav_jogos: 'Jogos', nav_mesas: 'Mesas de aprovação', nav_avisos: 'Avisos', nav_forge: 'Forge', soon: 'Fase 1',
    painelLead: 'Estado deste servidor, atualizado a cada 10 s.',
    brand: 'Marca', studio: 'Studio', runtime: 'Runtime', engine: 'Motor', node: 'Node', uptime: 'Ligado há',
    games: 'Jogos', rooms: 'Mesas', playing: 'a decorrer', waiting: 'à espera', expired: 'expiradas', over: 'acabadas', online: 'Jogadores ligados',
    jogosLead: 'Pacotes instalados neste servidor. A simulação joga partidas só com bots, sem bloquear as mesas.',
    game: 'Jogo', version: 'Versão', players: 'Jogadores', langs: 'Línguas', contract: 'Contrato', live: 'A decorrer',
    ok: 'ok', simulate: 'Simular', matches: 'Partidas', idle: 'Tempo esgotado (%)', run: 'Correr', running: 'A simular…',
    finished: 'Acabadas', failures: 'Falhas', avgMoves: 'Jogadas (média)', winBySeat: 'Vitórias por lugar', seat: 'Lugar {n}',
    nPlayers: '{n} jogadores', timers: '{n} timers',
    mesasLead: 'Mesas privadas: só entra quem tem o link. Joga-se como numa mesa pública; os lugares vazios passam a bots.',
    newTable: 'Nova mesa', name: 'Nome (opcional)', create: 'Criar mesa', noTables: 'Ainda não há mesas de aprovação.',
    table: 'Mesa', state: 'Estado', seats: 'Lugares', link: 'Link', copy: 'Copiar', remove: 'Apagar', confirmRemove: 'Apagar esta mesa? Quem lá está é expulso.',
    free: 'livre', bot: 'bot', winners: 'Ganhou: {names}', created: 'criada {when}',
    avisosLead: 'Chegam a todos os jogadores ligados a este servidor e a quem se ligar depois, até expirarem.',
    newNotice: 'Novo aviso', kind: 'Tipo', kindUpdate: 'Atualização marcada', kindText: 'Texto livre',
    when: 'Hora da atualização', textPt: 'Texto (PT)', textEn: 'Texto (EN)', level: 'Nível', info: 'Informação', warn: 'Alerta',
    drain: 'Suspender partidas novas até à atualização', drainGames: 'Jogos afetados', allGames: 'Todos',
    publish: 'Publicar aviso', noNotices: 'Não há avisos ativos.', until: 'até {when}', drainOn: 'partidas novas suspensas',
    needWhen: 'Indica a hora da atualização.', needText: 'Escreve o texto do aviso.',
    nav_aparencia: 'Aparência',
    apLead: 'A marca (moldura) e a aparência de cada jogo neste deploy. As alterações aparecem já na pré-visualização; só chegam aos jogadores quando guardas.',
    apTarget: 'Editar', apBrand: 'Marca (moldura)', apTheme: 'Tema', apThemeDefault: 'Por omissão (skin do pacote)',
    apSave: 'Guardar', apDiscard: 'Descartar alterações', apResetAll: 'Repor tudo', apExport: 'Exportar JSON', apImport: 'Importar JSON',
    apReset: 'Repor', apDefault: 'por omissão: {v}', apUpload: 'Carregar imagem', apTooBig: 'Imagem demasiado grande (máx. {kb} KB).',
    apPreview: 'Pré-visualização', apPreviewNote: 'Cenário do tutorial, a correr no browser. Podes jogar.',
    apContrast: 'Contraste', apContrastOk: 'Contraste suficiente em todos os pares (AA).', apContrastLow: '{a} sobre {b}: {r}:1 (mínimo 4.5:1)',
    apUnsaved: 'Há alterações por guardar.', apSaved: 'Aparência guardada: já chegou aos jogadores ligados.', apImported: 'JSON importado. Revê e guarda.',
    apBadJson: 'JSON inválido.',
    grp_table: 'Mesa', grp_base: 'Base', grp_resources: 'Recursos', grp_players: 'Jogadores', grp_type: 'Letra', grp_shape: 'Forma', grp_art: 'Arte', grp_brand: 'Marca',
  },
  en: {
    console: 'Console', lobby: 'Open the lobby', lang: 'PT', logout: 'Sign out',
    loginTitle: 'Sign in to the console', loginLead: "Use this server's ADMIN_TOKEN.", token: 'Token', enter: 'Sign in',
    badToken: 'Invalid token.', offline: 'Cannot reach the server.', saved: 'Saved.', copied: 'Link copied.',
    nav_painel: 'Dashboard', nav_jogos: 'Games', nav_mesas: 'Review tables', nav_avisos: 'Notices', nav_forge: 'Forge', soon: 'Phase 1',
    painelLead: 'State of this server, refreshed every 10 s.',
    brand: 'Brand', studio: 'Studio', runtime: 'Runtime', engine: 'Engine', node: 'Node', uptime: 'Up for',
    games: 'Games', rooms: 'Tables', playing: 'in progress', waiting: 'waiting', expired: 'expired', over: 'finished', online: 'Players online',
    jogosLead: 'Packages installed on this server. Simulation plays bot-only games without blocking live tables.',
    game: 'Game', version: 'Version', players: 'Players', langs: 'Languages', contract: 'Contract', live: 'Live',
    ok: 'ok', simulate: 'Simulate', matches: 'Games', idle: 'Timeouts (%)', run: 'Run', running: 'Simulating…',
    finished: 'Finished', failures: 'Failures', avgMoves: 'Moves (avg)', winBySeat: 'Wins by seat', seat: 'Seat {n}',
    nPlayers: '{n} players', timers: '{n} timers',
    mesasLead: 'Private tables: only people with the link can join. Played like a public table; empty seats become bots.',
    newTable: 'New table', name: 'Name (optional)', create: 'Create table', noTables: 'No review tables yet.',
    table: 'Table', state: 'State', seats: 'Seats', link: 'Link', copy: 'Copy', remove: 'Delete', confirmRemove: 'Delete this table? Anyone seated is removed.',
    free: 'free', bot: 'bot', winners: 'Won: {names}', created: 'created {when}',
    avisosLead: 'Shown to every player connected to this server, and to anyone who connects later, until they expire.',
    newNotice: 'New notice', kind: 'Type', kindUpdate: 'Scheduled update', kindText: 'Free text',
    when: 'Update time', textPt: 'Text (PT)', textEn: 'Text (EN)', level: 'Level', info: 'Info', warn: 'Warning',
    drain: 'Stop new games until the update', drainGames: 'Affected games', allGames: 'All',
    publish: 'Publish notice', noNotices: 'No active notices.', until: 'until {when}', drainOn: 'new games stopped',
    needWhen: 'Set the update time.', needText: 'Write the notice text.',
    nav_aparencia: 'Appearance',
    apLead: 'The brand (frame) and the look of each game on this deploy. Changes show in the preview right away; players only get them when you save.',
    apTarget: 'Edit', apBrand: 'Brand (frame)', apTheme: 'Theme', apThemeDefault: 'Default (package skin)',
    apSave: 'Save', apDiscard: 'Discard changes', apResetAll: 'Reset all', apExport: 'Export JSON', apImport: 'Import JSON',
    apReset: 'Reset', apDefault: 'default: {v}', apUpload: 'Upload image', apTooBig: 'Image too large (max {kb} KB).',
    apPreview: 'Preview', apPreviewNote: 'Tutorial scenario, running in the browser. You can play.',
    apContrast: 'Contrast', apContrastOk: 'Enough contrast on every pair (AA).', apContrastLow: '{a} on {b}: {r}:1 (minimum 4.5:1)',
    apUnsaved: 'There are unsaved changes.', apSaved: 'Appearance saved: connected players already have it.', apImported: 'JSON imported. Review and save.',
    apBadJson: 'Invalid JSON.',
    grp_table: 'Table', grp_base: 'Base', grp_resources: 'Resources', grp_players: 'Players', grp_type: 'Type', grp_shape: 'Shape', grp_art: 'Art', grp_brand: 'Brand',
  },
};

import * as appearanceUi from '/console-appearance.js';
import * as forgeUi from '/console-forge.js';

const SECTIONS = ['painel', 'jogos', 'mesas', 'avisos', 'aparencia', 'forge'];
const ICONS = { painel: '◧', jogos: '♟', mesas: '🔗', avisos: '🔔', aparencia: '🎨', forge: '⚒' };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fill = (s, p = {}) => s.replace(/\{(\w+)\}/g, (_, k) => p[k] ?? '');

const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* sem storage */ } },
};
const prefs = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sem storage */ } },
};

const app = {
  lang: prefs.get('bitnik.lang') || document.documentElement.lang || 'pt',
  token: store.get('bitnik.admin'),
  status: null, games: [], tables: [], notices: [], sims: {},
};
const u = (key, params) => fill((UI[app.lang] || UI.pt)[key] ?? key, params);

function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.h);
  toast.h = setTimeout(() => { el.hidden = true; }, 3200);
}

async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/admin/${path}`, {
      method,
      headers: { Authorization: `Bearer ${app.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(u('offline'));
  }
  if (res.status === 401) { logout(); throw new Error(u('badToken')); }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data;
}

const section = () => {
  const s = location.hash.slice(2).split('/')[0];
  return SECTIONS.includes(s) ? s : 'painel';
};

const fmtTime = (ms) => new Date(ms).toLocaleString(app.lang, { dateStyle: 'short', timeStyle: 'short' });
function fmtUptime(ms) {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  return d ? `${d} d ${h % 24} h` : h ? `${h} h ${m % 60} min` : `${m} min`;
}
const gameName = (id) => app.games.find((g) => g.id === id)?.name || id;

// ─── Secções ────────────────────────────────────────────────
function viewLogin(error = '') {
  return `<section class="panel login">
    <h1>${u('loginTitle')}</h1>
    <p class="con-lead">${u('loginLead')}</p>
    <form class="form" id="loginForm" style="margin-top:12px">
      <label class="wide">${u('token')}<input type="password" name="token" autocomplete="current-password" required></label>
      ${error ? `<p class="err wide" role="alert">${esc(error)}</p>` : ''}
      <button class="btn btn-primary">${u('enter')}</button>
    </form>
  </section>`;
}

function viewPainel() {
  const s = app.status;
  if (!s) return `<p class="empty">…</p>`;
  const tile = (k, v, small = '') => `<div class="tile"><div class="k">${k}</div><div class="v">${esc(v)}</div>${small ? `<small>${small}</small>` : ''}</div>`;
  return `<div><h1>${u('nav_painel')}</h1><p class="con-lead">${u('painelLead')}</p></div>
    <div class="tiles">
      ${tile(u('brand'), s.brand.name, u(s.studio ? 'studio' : 'runtime'))}
      ${tile(u('engine'), s.engineVersion, `${u('node')} ${esc(s.node)}`)}
      ${tile(u('uptime'), fmtUptime(s.uptimeMs))}
      ${tile(u('games'), s.games)}
      ${tile(u('rooms'), s.rooms.total, `${s.rooms.playing} ${u('playing')} · ${s.rooms.waiting} ${u('waiting')}${s.rooms.expired ? ` · ${s.rooms.expired} ${u('expired')}` : ''}`)}
      ${tile(u('online'), s.online)}
    </div>
    <div class="panel"><h2>${u('games')}</h2>${gamesTable(false)}</div>`;
}

function gamesTable(withSim) {
  return `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>${u('game')}</th><th>${u('version')}</th><th>${u('players')}</th><th>${u('langs')}</th><th>${u('contract')}</th><th>${u('live')}</th>${withSim ? '<th></th>' : ''}</tr></thead>
    <tbody>${app.games.map((g) => `<tr>
      <td><strong>${esc(g.name)}</strong><small>${esc(g.id)}${g.author ? ` · ${esc(g.author)}` : ''}</small></td>
      <td>${esc(g.version)}</td>
      <td>${g.players.min}–${g.players.max}</td>
      <td>${g.langs.map(esc).join(', ')}</td>
      <td>${g.problems.length ? `<span class="pill pill-bad" title="${esc(g.problems.join('; '))}">${g.problems.length}</span>` : `<span class="pill pill-ok">${u('ok')}</span>`}</td>
      <td>${g.rooms.playing}</td>
      ${withSim ? `<td class="actions"><button class="btn btn-outline" data-sim-open="${esc(g.id)}">${u('simulate')}</button></td>` : ''}
    </tr>${withSim && app.sims[g.id] ? `<tr><td colspan="7">${simPanel(g)}</td></tr>` : ''}`).join('')}</tbody>
  </table></div>`;
}

function simPanel(g) {
  const sim = app.sims[g.id];
  return `<div class="sim">
    <form class="form" data-sim-form="${esc(g.id)}">
      <label>${u('matches')}<input type="number" name="games" min="10" max="2000" step="10" value="${sim.games ?? 200}"></label>
      <label>${u('idle')}<input type="number" name="idle" min="0" max="90" step="5" value="${sim.idle ?? 0}"></label>
      <button class="btn btn-primary" ${sim.busy ? 'disabled aria-busy="true"' : ''}>${sim.busy ? u('running') : u('run')}</button>
    </form>
    ${sim.results ? `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>${u('players')}</th><th>${u('finished')}</th><th>${u('failures')}</th><th>${u('avgMoves')}</th><th>${u('winBySeat')}</th></tr></thead>
      <tbody>${sim.results.map((r) => `<tr>
        <td>${u('nPlayers', { n: r.numPlayers })}${r.timersFired ? `<small>${u('timers', { n: r.timersFired })}</small>` : ''}</td>
        <td>${r.finished}/${r.games}</td>
        <td>${r.failures.length ? `<span class="pill pill-bad" title="${esc(r.failures.map((f) => f.reason).join('; '))}">${r.failures.length}</span>` : '0'}</td>
        <td>${r.avgMoves}</td>
        <td><div class="bars">${r.winRateBySeat.map((w, i) => `<div class="wbar"><span>${u('seat', { n: i + 1 })}</span>
          <span class="track"><i style="width:${Math.min(100, w)}%"></i></span><span>${w}%</span></div>`).join('')}</div></td>
      </tr>`).join('')}</tbody></table></div>` : ''}
  </div>`;
}

function viewJogos() {
  return `<div><h1>${u('nav_jogos')}</h1><p class="con-lead">${u('jogosLead')}</p></div>
    <div class="panel">${gamesTable(true)}</div>`;
}

function viewMesas() {
  const opts = app.games.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('');
  const g0 = app.games[0];
  const counts = (g) => (g ? Array.from({ length: g.players.max - Math.max(2, g.players.min) + 1 }, (_, i) => Math.max(2, g.players.min) + i) : []);
  return `<div><h1>${u('nav_mesas')}</h1><p class="con-lead">${u('mesasLead')}</p></div>
    <div class="panel"><h2>${u('newTable')}</h2>
      <form class="form" id="tableForm">
        <label>${u('game')}<select name="gameId" id="tableGame">${opts}</select></label>
        <label>${u('players')}<select name="numPlayers" id="tableN">${counts(g0).map((n) => `<option>${n}</option>`).join('')}</select></label>
        <label>${u('name')}<input name="name" maxlength="24"></label>
        <button class="btn btn-primary">${u('create')}</button>
      </form>
    </div>
    <div class="panel">${app.tables.length ? `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>${u('table')}</th><th>${u('state')}</th><th>${u('seats')}</th><th>${u('link')}</th><th></th></tr></thead>
      <tbody>${app.tables.map((t) => {
        const url = `${location.origin}${t.link}`;
        const names = t.result ? t.result.winners.map((w) => t.seats[w]?.name).filter(Boolean).join(', ') : '';
        return `<tr>
          <td><strong>${esc(t.name || gameName(t.gameId))}</strong><small>${esc(gameName(t.gameId))} · ${u('nPlayers', { n: t.numPlayers })} · ${u('created', { when: fmtTime(t.createdAt) })}</small></td>
          <td>${esc(u(t.status === 'over' ? 'over' : t.status))}${names ? `<small>${esc(u('winners', { names }))}</small>` : ''}</td>
          <td>${t.seats.map((s) => esc(s.taken ? `${s.name}${s.bot ? ` (${u('bot')})` : ''}` : u('free'))).join('<br>')}</td>
          <td><div class="linkbox"><code>${esc(url)}</code><button class="btn btn-outline" data-copy="${esc(url)}">${u('copy')}</button></div></td>
          <td class="actions"><button class="btn btn-ghost" data-del-table="${esc(t.id)}">${u('remove')}</button></td>
        </tr>`;
      }).join('')}</tbody></table></div>` : `<p class="empty">${u('noTables')}</p>`}</div>`;
}

function viewAvisos() {
  const soon = new Date(Date.now() + 3600_000);
  soon.setSeconds(0, 0);
  const local = new Date(soon.getTime() - soon.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return `<div><h1>${u('nav_avisos')}</h1><p class="con-lead">${u('avisosLead')}</p></div>
    <div class="panel"><h2>${u('newNotice')}</h2>
      <form class="form" id="noticeForm" novalidate>
        <label>${u('kind')}<select name="kind" id="noticeKind">
          <option value="update">${u('kindUpdate')}</option><option value="text">${u('kindText')}</option></select></label>
        <label>${u('when')}<input type="datetime-local" name="at" value="${local}"></label>
        <label>${u('level')}<select name="level"><option value="info">${u('info')}</option><option value="warn">${u('warn')}</option></select></label>
        <label class="wide" data-for="text" hidden>${u('textPt')}<textarea name="pt" maxlength="500"></textarea></label>
        <label class="wide" data-for="text" hidden>${u('textEn')}<textarea name="en" maxlength="500"></textarea></label>
        <label class="check wide"><input type="checkbox" name="drain" id="noticeDrain"> ${u('drain')}</label>
        <fieldset class="wide" id="drainGames" hidden style="border:0;padding:0;margin:0;display:flex;gap:16px;flex-wrap:wrap">
          <legend style="font-size:.9rem;margin-bottom:4px">${u('drainGames')}</legend>
          ${app.games.map((g) => `<label class="check"><input type="checkbox" name="g" value="${esc(g.id)}" checked> ${esc(g.name)}</label>`).join('')}
        </fieldset>
        <p class="err wide" id="noticeErr" role="alert" hidden></p>
        <button class="btn btn-primary">${u('publish')}</button>
      </form>
    </div>
    <div class="panel">${app.notices.length ? `<ul class="rows">${app.notices.map((n) => {
      const text = n.text ? (n.text[app.lang] || Object.values(n.text)[0]) : `${n.key}${n.at ? ` · ${fmtTime(n.at)}` : ''}`;
      return `<li><span class="grow">${n.level === 'warn' ? '<span class="pill pill-bad">!</span> ' : ''}${esc(text)}
        <small>${u('until', { when: fmtTime(n.until) })}${n.maintenance ? ` · ${u('drainOn')}${n.maintenance.games ? `: ${n.maintenance.games.map(gameName).map(esc).join(', ')}` : ''}` : ''}</small></span>
        <button class="btn btn-ghost" data-del-notice="${esc(n.id)}">${u('remove')}</button></li>`;
    }).join('')}</ul>` : `<p class="empty">${u('noNotices')}</p>`}</div>`;
}

// ─── Render ─────────────────────────────────────────────────
function render() {
  document.documentElement.lang = app.lang;
  $('#conTitle').textContent = u('console');
  $('#toLobby').textContent = u('lobby');
  $('#lang').textContent = u('lang');
  $('#logout').textContent = u('logout');
  $('#logout').hidden = !app.token;
  $('#nav').hidden = !app.token;
  document.querySelector('.con').classList.toggle('con-solo', !app.token);
  if (!app.token) { $('#view').innerHTML = viewLogin(render.error); return; }
  const cur = section();
  $('#nav').innerHTML = SECTIONS.map((s) => `<a href="#/${s}" ${s === cur ? 'aria-current="page"' : ''}>
    <span aria-hidden="true">${ICONS[s]}</span>${u(`nav_${s}`)}</a>`).join('');
  const views = {
    painel: viewPainel, jogos: viewJogos, mesas: viewMesas, avisos: viewAvisos,
    aparencia: () => appearanceUi.view(),
    forge: () => forgeUi.view(),
  };
  // Não redesenha um formulário que está a ser preenchido.
  if (document.activeElement?.closest?.('form') && render.section === cur) return;
  if (render.section === 'aparencia' && cur !== 'aparencia') appearanceUi.leave();
  if (render.section === 'forge' && cur !== 'forge') forgeUi.leave();
  render.section = cur;
  $('#view').innerHTML = views[cur]();
  if (cur === 'aparencia') appearanceUi.after($('#view'));
  if (cur === 'forge') forgeUi.after($('#view'));
}

async function load() {
  if (!app.token) return render();
  try {
    const cur = section();
    const [status, games] = await Promise.all([api('status'), api('games')]);
    app.status = status; app.games = games.games;
    if (cur === 'mesas') app.tables = (await api('tables')).tables;
    if (cur === 'avisos') app.notices = (await api('notices')).notices;
    if (cur === 'aparencia') await appearanceUi.load();
    if (cur === 'forge') await forgeUi.load();
    $('#status').textContent = '';
  } catch (e) {
    $('#status').textContent = e.message;
  }
  render();
}

function logout() {
  app.token = null;
  store.set('bitnik.admin', null);
  render();
}

// ─── Eventos ────────────────────────────────────────────────
$('#view').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const data = new FormData(f);
  try {
    if (f.id === 'loginForm') {
      app.token = String(data.get('token') || '').trim();
      render.error = '';
      try { await api('status'); store.set('bitnik.admin', app.token); } catch (err) { render.error = err.message; app.token = null; }
      render.section = null;
      return load();
    }
    if (f.dataset.simForm) {
      const id = f.dataset.simForm;
      const sim = app.sims[id];
      sim.games = Number(data.get('games')) || 200;
      sim.idle = Number(data.get('idle')) || 0;
      sim.busy = true;
      f.querySelector('button').blur();
      render();
      try {
        sim.results = (await api(`games/${id}/simulate`, { method: 'POST', body: { games: sim.games, idleRate: sim.idle / 100 } })).results;
      } finally { sim.busy = false; }
      return render();
    }
    if (f.id === 'tableForm') {
      await api('tables', { method: 'POST', body: { gameId: data.get('gameId'), numPlayers: Number(data.get('numPlayers')), name: data.get('name') } });
      f.reset();
      document.activeElement?.blur();
      toast(u('saved'));
      return load();
    }
    if (f.id === 'noticeForm') {
      const err = $('#noticeErr');
      const kind = data.get('kind');
      const at = data.get('at') ? new Date(data.get('at')).getTime() : null;
      const pt = String(data.get('pt') || '').trim();
      const en = String(data.get('en') || '').trim();
      let msg = '';
      if (kind === 'update' && !at) msg = u('needWhen');
      if (kind === 'text' && !pt && !en) msg = u('needText');
      err.textContent = msg;
      err.hidden = !msg;
      if (msg) return undefined;
      const body = { level: data.get('level'), at };
      if (kind === 'update') body.key = 'notice.UPDATE_AT';
      else body.text = Object.fromEntries([['pt', pt], ['en', en]].filter(([, v]) => v));
      if (kind === 'text' && !at) body.until = Date.now() + 24 * 3600_000;
      if (data.get('drain')) {
        const games = data.getAll('g');
        body.maintenance = { games: games.length === app.games.length ? null : games };
      }
      await api('notices', { method: 'POST', body });
      f.reset();
      document.activeElement?.blur();
      toast(u('saved'));
      return load();
    }
  } catch (err) {
    toast(err.message);
  }
  return undefined;
});

$('#view').addEventListener('change', (e) => {
  if (e.target.id === 'tableGame') {
    const g = app.games.find((x) => x.id === e.target.value);
    const n = [];
    for (let i = Math.max(2, g.players.min); i <= g.players.max; i++) n.push(`<option>${i}</option>`);
    $('#tableN').innerHTML = n.join('');
  }
  if (e.target.id === 'noticeKind') {
    document.querySelectorAll('[data-for="text"]').forEach((el) => { el.hidden = e.target.value !== 'text'; });
  }
  if (e.target.id === 'noticeDrain') $('#drainGames').hidden = !e.target.checked;
  if (e.target.closest('#noticeForm')) { const err = $('#noticeErr'); if (err) err.hidden = true; }
});

$('#view').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  try {
    if (d.simOpen) {
      app.sims[d.simOpen] = app.sims[d.simOpen] ? null : { games: 200, idle: 0 };
      render();
    } else if (d.copy) {
      await navigator.clipboard.writeText(d.copy);
      toast(u('copied'));
    } else if (d.delTable) {
      if (!confirm(u('confirmRemove'))) return;
      await api(`tables/${d.delTable}`, { method: 'DELETE' });
      load();
    } else if (d.delNotice) {
      await api(`notices/${d.delNotice}`, { method: 'DELETE' });
      load();
    }
  } catch (err) {
    toast(err.message);
  }
});

$('#lang').addEventListener('click', () => {
  app.lang = app.lang === 'pt' ? 'en' : 'pt';
  prefs.set('bitnik.lang', app.lang);
  render.section = null;
  render();
});
$('#logout').addEventListener('click', logout);
window.addEventListener('hashchange', () => { render.section = null; load(); });
setInterval(() => { if (app.token && section() === 'painel') load(); }, 10_000);

const rerender = () => { render.section = null; render(); };
appearanceUi.init({ api, u, lang: () => app.lang, toast, rerender });
forgeUi.init({ api, lang: () => app.lang, toast, rerender });
load();
