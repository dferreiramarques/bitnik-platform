// UI genérica da plataforma: lobby + mesa de protótipo.
// Não conhece nenhum jogo: desenha as jogadas legais que o motor
// devolve (com os rótulos do pacote) e o estado visível do lugar.
// Uma UI feita à medida para um jogo usa o mesmo SDK.
import { BitnikClient } from '/sdk/client.js';
import { translate } from '/engine/i18n.js';

const UI = {
  pt: {
    connecting: 'A ligar…', open: '', closed: 'Sem ligação, a tentar de novo…',
    yourName: 'O teu nome', lang: 'EN',
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
  },
  en: {
    connecting: 'Connecting…', open: '', closed: 'Offline, retrying…',
    yourName: 'Your name', lang: 'PT',
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
};

const client = new BitnikClient({ lang: app.lang });
const u = (key, params) => fill((UI[app.lang] || UI.pt)[key] ?? key, params);
const gameMeta = (id) => app.welcome?.games.find((g) => g.id === id);

/** Traduz chaves do jogo, do motor ou da plataforma. */
function t(key, params, gameId) {
  const g = gameMeta(gameId);
  const bundle = {
    defaultLang: g?.defaultLang || 'pt',
    i18n: Object.fromEntries(['pt', 'en'].map((l) => [l, { ...app.welcome?.platformI18n?.[l], ...g?.i18n?.[l] }])),
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

function go(roomId) {
  location.hash = roomId ? `#/r/${roomId}` : '#/';
}

window.addEventListener('hashchange', () => {
  const id = routeRoom();
  if (id) client.open(id); else { client.closeRoom(); app.room = null; }
  render();
});

// ─── Lobby ───────────────────────────────────────────────────
function renderLobby() {
  const games = app.welcome?.games || [];
  return `<section class="lobby">${games.map((g) => {
    const counts = [];
    for (let n = Math.max(2, g.players.min); n <= g.players.max; n++) counts.push(n);
    const pub = app.rooms.public.filter((r) => r.gameId === g.id);
    const mine = app.rooms.mine.filter((r) => r.gameId === g.id);
    return `<article class="game-block">
      <div>
        <h1 class="game-title">${esc(t('game.name', {}, g.id))}</h1>
        <p class="game-tagline">${esc(t('game.tagline', {}, g.id))}</p>
      </div>
      <div class="solo-start"><span>${u('playBots')}</span>
        ${counts.map((n) => `<button class="btn btn-primary" data-solo="${g.id}" data-n="${n}">${u('players', { n })}</button>`).join('')}
      </div>
      <div class="lobby-cols">
        <div><h3>${u('myTables')}</h3>
          ${mine.length ? `<ul class="rows">${mine.map((r) => `<li>
            <span class="grow">${u('tableOf', { n: r.numPlayers })}<small>${statusText(r)}</small></span>
            <button class="btn btn-outline" data-open="${r.id}">${u(r.status === 'over' ? 'view' : 'resume')}</button>
            <button class="btn btn-ghost" data-remove="${r.id}" aria-label="${u('remove')}">✕</button>
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
  if (msg.room.status === 'waiting') {
    return msg.seat != null
      ? `<div class="palette"><p class="palette-wait">${u('seatedWait')}</p><button class="btn btn-primary" data-start>${u('start')}</button></div>`
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

function renderTable() {
  const msg = app.room;
  if (!msg) return `<p class="empty">${u('connecting')}</p>`;
  const g = msg.room.gameId;
  const round = msg.view?.round;
  const canLeave = msg.room.kind === 'public' && msg.seat != null;
  return `<section class="table">
    <div class="table-head">
      <h1>${esc(t('game.name', {}, g))}</h1>
      <span class="meta">${u('tableOf', { n: msg.room.numPlayers })}${round ? `, ${u('round', { n: round })}` : ''}</span>
      ${canLeave ? `<button class="btn btn-ghost" data-leave>${u('leave')}</button>` : ''}
    </div>
    ${renderSeats(msg)}
    ${renderTimers(msg)}
    <div class="play">
      <div>${renderPalette(msg)}</div>
      <div class="side">
        <div class="panel"><h3>${u('log')}</h3>${renderLog(msg)}</div>
        ${msg.view ? `<div class="panel inspect"><h3>${u('state')}</h3>${tree(msg.view)}</div>` : ''}
      </div>
    </div>
  </section>`;
}

// ─── Render e eventos ────────────────────────────────────────
function render() {
  const inRoom = !!routeRoom();
  $('#back').hidden = !inRoom;
  $('#lang').textContent = u('lang');
  $('#nameLabel').textContent = u('yourName');
  $('#name').placeholder = u('yourName');
  document.documentElement.lang = app.lang;
  // Preserva os <details> abertos do inspetor entre renders.
  const openPaths = [...document.querySelectorAll('.inspect details[open]')].map((d) => d.querySelector('summary')?.textContent);
  $('#view').innerHTML = inRoom ? renderTable() : renderLobby();
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
  if (d.solo) client.createSolo(d.solo, Number(d.n));
  else if (d.open) go(d.open);
  else if (d.join) { client.join(d.join); go(d.join); }
  else if (d.remove) { if (confirm(u('confirmRemove'))) client.remove(d.remove); }
  else if (d.move != null) {
    const mv = app.room.legal[Number(d.move)];
    if (client.move(roomId, { type: mv.type, payload: mv.payload })) b.setAttribute('aria-busy', 'true');
    else toast(u('notSent'));
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
  $('#name').value = w.name;
  if (!localStorage.getItem('bitnik.lang')) app.lang = w.brand.lang;
  const id = routeRoom();
  if (id) client.open(id);
  render();
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
