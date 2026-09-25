// UI genérica da plataforma: lobby + mesa de protótipo.
// Não conhece nenhum jogo: desenha as jogadas legais que o motor
// devolve (com os rótulos do pacote) e o estado visível do lugar.
// Uma UI feita à medida para um jogo usa o mesmo SDK.
import { BitnikClient } from '/sdk/client.js';
import { translate } from '/engine/i18n.js';
import { applyGameSkin, applyOverrides } from '/appearance.js';

const UI = {
  pt: {
    connecting: 'A ligar…', open: '', closed: 'Sem ligação, a tentar de novo…',
    yourName: 'O teu nome', lang: 'EN', prototype: 'protótipo {v}',
    playBots: 'Jogar contra bots:', players: '{n} jogadores',
    publicTables: 'Mesas públicas', myTables: 'As minhas mesas',
    noMine: 'Ainda não tens mesas. Começa um jogo contra bots.',
    tableOf: 'Mesa de {n}', free: '{n} lugares livres', playing: 'A decorrer', over: 'Terminado', waiting: 'À espera',
    join: 'Sentar', resume: 'Continuar', view: 'Ver', remove: 'Apagar', leave: 'Sair da mesa',
    round: 'Ronda {n}', you: 'tu', bot: 'bot', away: 'ausente', emptySeat: 'Lugar livre',
    yourTurn: 'É a tua vez', waitFor: 'À espera de {name}…', spectator: 'Estás a ver esta mesa.',
    start: 'Começar (lugares vazios ficam com bots)', seatedWait: 'Estás sentado. Começa quando quiseres.',
    log: 'Registo', state: 'Estado visível', noLog: 'Ainda não houve jogadas.',
    gameOver: 'Fim do jogo', wins: '{names} ganha', share: '{names} partilham a vitória',
    points: '{n} pts', again: 'Jogar outra vez', system: 'Jogo',
    confirmRemove: 'Apagar esta mesa?',
    notSent: 'Sem ligação: a jogada não foi enviada.',
    timer: '{event} em {s} s',
    expired: 'Versão antiga ({from}), já não pode ser retomada',
    expiredTable: 'Esta partida foi jogada com a versão {from} e o jogo está agora na {to}. Já não pode ser retomada.',
    newMatch: 'Começar nova partida', dismiss: 'Fechar',
    inviteTable: 'Mesa de aprovação', inviteJoin: 'Foste convidado para esta mesa. Senta-te para jogar.',
    protoUi: 'Modo protótipo', gameUi: 'Ver tabuleiro', loadingUi: 'A carregar a mesa…',
    tutorial: 'Tutorial', tutorialOf: 'Tutorial',
  },
  en: {
    connecting: 'Connecting…', open: '', closed: 'Offline, retrying…',
    yourName: 'Your name', lang: 'PT', prototype: 'prototype {v}',
    playBots: 'Play against bots:', players: '{n} players',
    publicTables: 'Public tables', myTables: 'My tables',
    noMine: 'No tables yet. Start a game against bots.',
    tableOf: 'Table for {n}', free: '{n} seats free', playing: 'In progress', over: 'Finished', waiting: 'Waiting',
    join: 'Sit down', resume: 'Resume', view: 'Watch', remove: 'Delete', leave: 'Leave table',
    round: 'Round {n}', you: 'you', bot: 'bot', away: 'away', emptySeat: 'Free seat',
    yourTurn: 'Your turn', waitFor: 'Waiting for {name}…', spectator: 'You are watching this table.',
    start: 'Start (empty seats get bots)', seatedWait: 'You are seated. Start whenever you like.',
    log: 'Log', state: 'Visible state', noLog: 'No moves yet.',
    gameOver: 'Game over', wins: '{names} wins', share: '{names} share the win',
    points: '{n} pts', again: 'Play again', system: 'Game',
    confirmRemove: 'Delete this table?',
    notSent: 'Offline: the move was not sent.',
    timer: '{event} in {s} s',
    expired: 'Old version ({from}), can no longer be resumed',
    expiredTable: 'This game was played with version {from} and the game is now on {to}. It can no longer be resumed.',
    newMatch: 'Start a new game', dismiss: 'Close',
    inviteTable: 'Review table', inviteJoin: 'You were invited to this table. Sit down to play.',
    protoUi: 'Prototype mode', gameUi: 'Show board', loadingUi: 'Loading the table…',
    tutorial: 'Tutorial', tutorialOf: 'Tutorial',
  },
};

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fill = (s, p = {}) => s.replace(/\{(\w+)\}/g, (_, k) => p[k] ?? '');

const app = {
  lang: localStorage.getItem('bitnik.lang') || document.documentElement.lang || 'pt',
  welcome: null,
  rooms: { public: [], mine: [] },
  room: null,
  notices: [],
  noticesSkew: 0,     // relógio do servidor − local
  dismissed: new Set(),
  proto: (() => { try { return localStorage.getItem('bitnik.proto') === '1'; } catch { return false; } })(),
  ui: null,           // UI própria montada: { roomId, gameId, el, mod }
  appearance: null,   // afinações do deploy (consola), ao vivo
};

/** Skin do jogo (defaults + tema do deploy), antes de montar a mesa ou o tutorial. */
function skinFor(gameId) {
  const meta = gameMeta(gameId);
  return meta ? applyGameSkin(meta, app.appearance?.games?.[gameId]?.theme) : Promise.resolve();
}

const client = new BitnikClient({ lang: app.lang });
const u = (key, params) => fill((UI[app.lang] || UI.pt)[key] ?? key, params);

// Sem rede, a app usa os jogos da última ligação (o tutorial funciona offline).
const WELCOME_KEY = 'bitnik.welcome';
app.cachedWelcome = (() => { try { return JSON.parse(localStorage.getItem(WELCOME_KEY)); } catch { return null; } })();
const W = () => app.welcome || app.cachedWelcome;
const gameMeta = (id) => W()?.games.find((g) => g.id === id);

/** Traduz chaves do jogo, do motor ou da plataforma. */
function t(key, params, gameId) {
  const g = gameMeta(gameId);
  const bundle = {
    defaultLang: g?.defaultLang || 'pt',
    i18n: Object.fromEntries(['pt', 'en'].map((l) => [l, { ...W()?.platformI18n?.[l], ...g?.i18n?.[l] }])),
  };
  return translate(bundle, app.lang, key, params);
}

function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.h);
  toast.h = setTimeout(() => { el.hidden = true; }, 3200);
}

// ─── Rotas: #/ (lobby) e #/r/<id> (mesa) ────────────────────
const routeRoom = () => (location.hash.match(/^#\/r\/(.+)$/) || [])[1] || null;
const routeTutorial = () => (location.hash.match(/^#\/tutorial\/([\w-]+)$/) || [])[1] || null;

function go(roomId) {
  location.hash = roomId ? `#/r/${roomId}` : '#/';
}

window.addEventListener('hashchange', () => {
  const id = routeRoom();
  if (id) client.open(id); else { client.closeRoom(); app.room = null; }
  render();
});

// ─── Lobby ───────────────────────────────────────────────────
// Números de jogadores de uma mesa (players.counts do jogo, ou de min a max; a partir de 2).
const tableCounts = (p) => (p.counts ?? Array.from({ length: p.max - p.min + 1 }, (_, i) => p.min + i)).filter((n) => n >= 2);
function renderLobby() {
  const games = W()?.games || [];
  return `<section class="lobby">${games.map((g) => {
    const counts = tableCounts(g.players);
    const pub = app.rooms.public.filter((r) => r.gameId === g.id);
    const mine = app.rooms.mine.filter((r) => r.gameId === g.id);
    return `<article class="game-block">
      <div>
        <h1 class="game-title">${esc(t('game.name', {}, g.id))}${g.prototype ? ` <span class="proto-badge">${u('prototype', { v: g.version })}</span>` : ''}</h1>
        ${t('game.tagline', {}, g.id) !== 'game.tagline' ? `<p class="game-tagline">${esc(t('game.tagline', {}, g.id))}</p>` : ''}
      </div>
      <div class="solo-start"><span>${u('playBots')}</span>
        ${counts.map((n) => `<button class="btn btn-primary" data-solo="${g.id}" data-n="${n}">${u('players', { n })}</button>`).join('')}
        ${g.tutorial ? `<a class="btn btn-outline" href="#/tutorial/${g.id}">${u('tutorial')}</a>` : ''}
      </div>
      <div class="lobby-cols">
        <div><h3>${u('myTables')}</h3>
          ${mine.length ? `<ul class="rows">${mine.map((r) => `<li>
            <span class="grow">${r.kind === 'invite' ? esc(r.name || u('inviteTable')) : u('tableOf', { n: r.numPlayers })}<small>${statusText(r)}${g.prototype && r.version && r.version !== g.version ? ` · ${esc(r.version)}` : ''}</small></span>
            <button class="btn btn-outline" data-open="${r.id}">${u(r.status === 'over' || r.status === 'expired' ? 'view' : 'resume')}</button>
            ${r.kind === 'solo' ? `<button class="btn btn-ghost" data-remove="${r.id}" aria-label="${u('remove')}">✕</button>` : ''}
          </li>`).join('')}</ul>` : `<p class="empty">${u('noMine')}</p>`}
        </div>
        <div><h3>${u('publicTables')}</h3>
          <ul class="rows">${pub.map((r) => {
            const freeSeats = r.seats.filter((s) => !s.taken).length;
            const seated = r.seats.some((s) => s.isYou);
            const names = r.seats.filter((s) => s.taken).map((s) => esc(s.name)).join(', ');
            return `<li>
              <span class="grow">${u('tableOf', { n: r.numPlayers })}
                <small>${r.status === 'waiting' ? u('free', { n: freeSeats }) : statusText(r)}${names ? `, ${names}` : ''}</small></span>
              <button class="btn ${seated ? 'btn-primary' : 'btn-outline'}" data-${seated || r.status !== 'waiting' ? 'open' : 'join'}="${r.id}">
                ${u(seated ? 'resume' : r.status === 'waiting' ? 'join' : 'view')}</button>
            </li>`;
          }).join('')}</ul>
        </div>
      </div>
    </article>`;
  }).join('')}</section>`;
}

function statusText(r) {
  if (r.status === 'expired') return u('expired', { from: r.expired?.from });
  if (r.status === 'playing') return r.round ? `${u('playing')}, ${u('round', { n: r.round })}` : u('playing');
  return u(r.status);
}

// ─── Mesa ────────────────────────────────────────────────────
function seatName(i) {
  const s = app.room?.room.seats[i];
  if (!s) return u('system');
  return s.name || u('emptySeat');
}

function renderSeats(msg) {
  return `<div class="seats">${msg.room.seats.map((s, i) => {
    const p = msg.view?.players?.[i];
    const tags = [s.isYou && u('you'), s.bot && u('bot'), s.away && u('away')].filter(Boolean);
    return `<div class="seat${msg.active?.includes(i) ? ' is-active' : ''}">
      <div class="seat-name">${esc(s.taken ? s.name : u('emptySeat'))}</div>
      <small>${tags.join(', ') || '&nbsp;'}</small>
      ${typeof p?.score === 'number' ? `<div class="score">${p.score}</div>` : ''}
    </div>`;
  }).join('')}</div>`;
}

function renderPalette(msg) {
  const g = msg.room.gameId;
  if (msg.result) {
    const { scores = [], winners = [] } = msg.result;
    const names = winners.map(seatName).join(', ');
    const order = scores.map((sc, i) => [sc, i]).sort((a, b) => b[0] - a[0]);
    return `<div class="result">
      <h2>${u('gameOver')}</h2>
      <p>${u(winners.length > 1 ? 'share' : 'wins', { names: esc(names) })}</p>
      <ol>${order.map(([sc, i]) => `<li>${esc(seatName(i))}: ${u('points', { n: sc })}</li>`).join('')}</ol>
      ${msg.seat != null ? `<button class="btn" data-restart>${u('again')}</button>` : ''}
    </div>`;
  }
  if (msg.room.status === 'expired') {
    const { from, to } = msg.room.expired || {};
    return `<div class="palette"><p class="palette-wait">${u('expiredTable', { from, to })}</p>
      <button class="btn btn-primary" data-restart>${u('newMatch')}</button></div>`;
  }
  if (msg.room.status === 'waiting') {
    if (msg.seat != null) {
      return `<div class="palette"><p class="palette-wait">${u('seatedWait')}</p><button class="btn btn-primary" data-start>${u('start')}</button></div>`;
    }
    const free = msg.room.seats.some((s) => !s.taken);
    return free && msg.room.kind !== 'solo'
      ? `<div class="palette"><p class="palette-wait">${u(msg.room.kind === 'invite' ? 'inviteJoin' : 'spectator')}</p><button class="btn btn-primary" data-join="${msg.room.id}">${u('join')}</button></div>`
      : `<p class="palette-wait">${u('spectator')}</p>`;
  }
  if (msg.seat == null) return `<p class="palette-wait">${u('spectator')}</p>`;
  if (!msg.legal?.length) {
    const who = (msg.active || []).map(seatName).join(', ');
    return `<p class="palette-wait">${u('waitFor', { name: esc(who) })}</p>`;
  }
  const groups = new Map();
  msg.legal.forEach((mv, i) => {
    if (!groups.has(mv.type)) groups.set(mv.type, []);
    groups.get(mv.type).push([mv, i]);
  });
  return `<div class="palette"><div class="palette-turn">${u('yourTurn')}</div>
    ${[...groups].map(([type, list]) => `<div class="move-group" data-type="${esc(type)}">
      <h3>${esc(t(`move.${type}`, {}, g))}</h3>
      <div class="moves">${list.map(([mv, i]) => `<button class="move" data-move="${i}">${esc(t(mv.label.key, mv.label.params, g))}</button>`).join('')}</div>
    </div>`).join('')}
  </div>`;
}

/** Contagens decrescentes dos timers do jogo (texto atualizado a cada segundo). */
function renderTimers(msg) {
  const list = (msg.timers || []).filter((x) => x.at != null);
  if (!list.length) return '';
  const g = msg.room.gameId;
  return `<div class="timers">${list.map((x) => {
    const key = `event.${x.event}`;
    const name = t(key, {}, g);
    return `<span class="timer" data-at="${x.at}" data-name="${esc(name === key ? x.event : name)}"></span>`;
  }).join('')}</div>`;
}

function tickTimers() {
  const skew = app.room ? app.room.now - app.roomAt : 0; // relógio do servidor − local
  document.querySelectorAll('.timer[data-at]').forEach((el) => {
    const s = Math.max(0, Math.ceil((Number(el.dataset.at) - (Date.now() + skew)) / 1000));
    el.textContent = `⏱ ${u('timer', { event: el.dataset.name, s })}`;
  });
}
setInterval(tickTimers, 1000);

function renderLog(msg) {
  const g = msg.room.gameId;
  const items = [...(msg.log || [])].reverse();
  if (!items.length) return `<p class="empty">${u('noLog')}</p>`;
  return `<ol class="log">${items.map((l) => `<li>${l.seat != null ? `<b>${esc(seatName(l.seat))}</b> ` : ''}${esc(t(l.key, l.params, g))}</li>`).join('')}</ol>`;
}

function tree(value, key) {
  const label = key != null ? `<span class="k">${esc(key)}:</span> ` : '';
  if (value === null || typeof value !== 'object') return `<div>${label}<span class="v">${esc(JSON.stringify(value))}</span></div>`;
  const entries = Array.isArray(value) ? value.map((v, i) => [i, v]) : Object.entries(value);
  const flat = entries.every(([, v]) => v === null || typeof v !== 'object');
  if (flat && entries.length <= 8) return `<div>${label}<span class="v">${esc(JSON.stringify(value))}</span></div>`;
  return `<details${key == null ? ' open' : ''}><summary>${label}${Array.isArray(value) ? `[${entries.length}]` : '{…}'}</summary>${entries.map(([k, v]) => tree(v, k)).join('')}</details>`;
}

/** A mesa usa a UI própria do jogo (ADR-006)? Só com o jogo a decorrer ou acabado. */
function useGameUi(msg) {
  const meta = gameMeta(msg?.room.gameId);
  return !!meta?.ui && !app.proto && !!msg.view && ['playing', 'over'].includes(msg.room.status);
}

function renderTable() {
  const msg = app.room;
  if (!msg) return `<p class="empty">${u('connecting')}</p>`;
  const g = msg.room.gameId;
  const round = msg.view?.round;
  const canLeave = msg.room.kind !== 'solo' && msg.seat != null;
  const own = useGameUi(msg);
  const protoBtn = app.welcome?.studio && gameMeta(g)?.ui && msg.view
    ? `<button class="btn btn-ghost" data-proto>${u(app.proto ? 'gameUi' : 'protoUi')}</button>` : '';
  return `<section class="table">
    <div class="table-head">
      <h1>${esc(t('game.name', {}, g))}</h1>
      <span class="meta">${msg.room.kind === 'invite' ? `${esc(msg.room.name || u('inviteTable'))}, ` : ''}${u('tableOf', { n: msg.room.numPlayers })}${round ? `, ${u('round', { n: round })}` : ''}</span>
      ${protoBtn}
      ${canLeave ? `<button class="btn btn-ghost" data-leave>${u('leave')}</button>` : ''}
    </div>
    ${renderTimers(msg)}
    ${own ? `${msg.result ? renderPalette(msg) : ''}<div id="gameHost" class="game-host"><p class="empty">${u('loadingUi')}</p></div></section>` : `${renderSeats(msg)}
    <div class="play">
      <div>${renderPalette(msg)}</div>
      <div class="side">
        <div class="panel"><h3>${u('log')}</h3>${renderLog(msg)}</div>
        ${msg.view ? `<div class="panel inspect"><h3>${u('state')}</h3>${tree(msg.view)}</div>` : ''}
      </div>
    </div>
  </section>`}`;
}

// ─── UI própria do jogo (módulo do pacote com mount/update) ──
const uiModules = new Map(); // url → Promise<módulo>

function unmountGameUi() {
  try { app.ui?.mod.unmount?.(); } catch (e) { console.error(e); }
  app.ui = null;
}

/** Monta (uma vez por mesa) e atualiza a UI do jogo no #gameHost. */
async function syncGameUi(msg) {
  const host = document.getElementById('gameHost');
  if (!host) { if (app.ui) unmountGameUi(); return; }
  const gameId = msg.room.gameId;
  if (app.ui && (app.ui.roomId !== msg.room.id || app.ui.gameId !== gameId)) unmountGameUi();
  if (!app.ui) {
    if (syncGameUi.loading === msg.room.id) return undefined; // já a carregar: o próximo render monta
    syncGameUi.loading = msg.room.id;
    const url = gameMeta(gameId).ui;
    if (!uiModules.has(url)) uiModules.set(url, import(url));
    let mod;
    try { [mod] = await Promise.all([uiModules.get(url), skinFor(gameId)]); } catch (e) {
      console.error('[ui]', url, e);
      uiModules.delete(url);
      app.proto = true; // cai na UI genérica
      return render();
    } finally { syncGameUi.loading = null; }
    if (app.room?.room.id !== msg.room.id || app.ui) return app.ui ? syncGameUi(app.room) : undefined;
    const el = document.createElement('div');
    el.className = 'game-root';
    el.dataset.game = gameId;
    app.ui = { roomId: msg.room.id, gameId, el, mod: mod.default ?? mod };
    app.ui.mod.mount(el, {
      gameId,
      lang: () => app.lang,
      t: (key, params) => t(key, params, gameId),
      move: (mv) => {
        const ok = client.move(msg.room.id, { type: mv.type, payload: mv.payload });
        if (!ok) toast(u('notSent'));
        return ok;
      },
      seatName,
      toast,
    });
  }
  const live = document.getElementById('gameHost');
  if (live && live !== app.ui.el) live.replaceWith(app.ui.el);
  try { app.ui.mod.update(app.room); } catch (e) { console.error('[ui] update', e); }
  return undefined;
}

// ─── Avisos do publisher (faixa no topo) ─────────────────────
function renderNotices() {
  const el = $('#notices');
  const t0 = Date.now() + app.noticesSkew;
  const list = app.notices.filter((n) => n.until > t0 && !app.dismissed.has(n.id));
  el.hidden = !list.length;
  el.innerHTML = list.map((n) => {
    const time = n.at ? new Date(n.at - app.noticesSkew).toLocaleTimeString(app.lang, { hour: '2-digit', minute: '2-digit' }) : '';
    const main = n.text ? (n.text[app.lang] || Object.values(n.text)[0]) : t(n.key, { time, ...n.params });
    const drain = n.maintenance && n.maintenance.from <= t0 ? ` ${t('notice.MAINTENANCE')}` : '';
    return `<div class="notice notice-${esc(n.level)}" role="status"><span>${esc(main + drain)}</span>
      <button class="btn btn-ghost" data-dismiss="${esc(n.id)}" aria-label="${u('dismiss')}">✕</button></div>`;
  }).join('');
}

function setNotices(list, serverNow) {
  app.notices = list || [];
  if (serverNow) app.noticesSkew = serverNow - Date.now();
  renderNotices();
}
setInterval(renderNotices, 30_000); // a janela de manutenção pode começar entretanto

$('#notices').addEventListener('click', (e) => {
  const b = e.target.closest('[data-dismiss]');
  if (!b) return;
  app.dismissed.add(b.dataset.dismiss);
  renderNotices();
});

// ─── Tutorial (módulo do pacote; corre o motor no browser) ───
function renderTutorial(gameId) {
  return `<section class="table">
    <div class="table-head"><h1>${esc(t('game.name', {}, gameId))}</h1><span class="meta">${u('tutorialOf')}</span></div>
    <div id="tutHost" class="game-host"><p class="empty">${u('loadingUi')}</p></div>
  </section>`;
}

function stopTutorial() {
  try { app.tut?.stop?.(); } catch (e) { console.error(e); }
  app.tut = null;
}

async function syncTutorial(gameId) {
  if (app.tut?.gameId === gameId) { document.getElementById('tutHost')?.replaceWith(app.tut.el); return; }
  stopTutorial();
  if (syncTutorial.loading) return;
  syncTutorial.loading = true;
  const meta = gameMeta(gameId);
  let mod;
  try { [mod] = meta?.tutorial ? await Promise.all([import(meta.tutorial), skinFor(gameId)]) : []; } catch (e) { console.error('[tutorial]', e); } finally { syncTutorial.loading = false; }
  if (!mod || routeTutorial() !== gameId) { if (!mod) go(null); return; }
  unmountGameUi();
  const el = document.createElement('div');
  el.className = 'tut-root';
  app.tut = { gameId, el, stop: null };
  document.getElementById('tutHost')?.replaceWith(el);
  app.tut.stop = mod.start(el, {
    gameId,
    lang: () => app.lang,
    t: (key, params) => t(key, params, gameId),
    toast,
    exit: () => go(null),
    playReal: (n) => client.createSolo(gameId, n),
  });
}

// ─── Render e eventos ────────────────────────────────────────
function render() {
  const tut = routeTutorial();
  const inRoom = !!routeRoom();
  $('#back').hidden = !inRoom && !tut;
  $('#lang').textContent = u('lang');
  $('#nameLabel').textContent = u('yourName');
  $('#name').placeholder = u('yourName');
  document.documentElement.lang = app.lang;
  renderNotices();
  if (tut) {
    if (!W()) return;
    app.tut?.el.remove();
    $('#view').innerHTML = renderTutorial(tut);
    syncTutorial(tut);
    return;
  }
  if (app.tut) stopTutorial();
  // Preserva os <details> abertos do inspetor entre renders.
  const openPaths = [...document.querySelectorAll('.inspect details[open]')].map((d) => d.querySelector('summary')?.textContent);
  // A UI própria não é redesenhada: sai do DOM antes e volta para o #gameHost.
  app.ui?.el.remove();
  $('#view').innerHTML = inRoom ? renderTable() : renderLobby();
  if (inRoom && app.room) syncGameUi(app.room); else if (app.ui) unmountGameUi();
  document.querySelectorAll('.inspect details').forEach((d) => {
    if (openPaths.includes(d.querySelector('summary')?.textContent)) d.open = true;
  });
  tickTimers();
}

$('#view').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  const roomId = app.room?.room.id;
  if (d.solo) { if (!client.createSolo(d.solo, Number(d.n))) toast(u('notSent')); }
  else if (d.open) go(d.open);
  else if (d.join) { client.join(d.join); go(d.join); }
  else if (d.remove) { if (confirm(u('confirmRemove'))) client.remove(d.remove); }
  else if (d.move != null) {
    const mv = app.room.legal[Number(d.move)];
    if (client.move(roomId, { type: mv.type, payload: mv.payload })) b.setAttribute('aria-busy', 'true');
    else toast(u('notSent'));
  } else if ('proto' in d) {
    app.proto = !app.proto;
    try { localStorage.setItem('bitnik.proto', app.proto ? '1' : '0'); } catch { /* sem storage */ }
    render();
  } else if ('start' in d) client.start(roomId);
  else if ('restart' in d) client.restart(roomId);
  else if ('leave' in d) { client.leave(roomId); go(null); }
});

$('#back').addEventListener('click', () => go(null));
$('#lang').addEventListener('click', () => {
  app.lang = app.lang === 'pt' ? 'en' : 'pt';
  localStorage.setItem('bitnik.lang', app.lang);
  render();
});
$('#name').addEventListener('change', (e) => client.setName(e.target.value));

client.on('status', (s) => { $('#status').textContent = u(s); });
client.on('welcome', (w) => {
  app.welcome = w;
  try {
    const { games, platformI18n, brand } = w;
    localStorage.setItem(WELCOME_KEY, JSON.stringify({ games, platformI18n, brand }));
  } catch { /* sem storage */ }
  app.appearance = w.appearance;
  applyOverrides(w.appearance);
  setNotices(w.notices, w.now);
  $('#name').value = w.name;
  if (!localStorage.getItem('bitnik.lang')) app.lang = w.brand.lang;
  const id = routeRoom();
  if (id) client.open(id);
  render();
});
client.on('notices', (m) => setNotices(m.notices, m.now));
client.on('appearance', (m) => {
  app.appearance = m.appearance;
  applyOverrides(m.appearance);
  const id = app.ui?.gameId || app.tut?.gameId;
  if (id) skinFor(id); // o tema pode ter mudado
});
client.on('rooms', (r) => { app.rooms = r; if (!routeRoom()) render(); });
client.on('room', (msg) => {
  app.room = msg;
  app.roomAt = Date.now();
  if (routeRoom() !== msg.room.id) go(msg.room.id);
  else render();
});
client.on('error', (e) => {
  toast(t(e.code, e.params, e.gameId));
  document.querySelectorAll('[aria-busy]').forEach((el) => el.removeAttribute('aria-busy'));
});

client.connect();
render();

// PWA: service worker (só em https ou localhost).
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('[sw]', e));
}
