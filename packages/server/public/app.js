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
    notices: 'Avisos', back: 'Voltar ao lobby', howToPlay: 'Como se joga', seeTable: 'Ver a mesa', lobby: 'Lobby',
    writeName: 'Escreve o teu nome',
    homeNote: 'A tua mesa contra bots, as mesas com outras pessoas e as de aprovação estão no lobby de cada jogo.',
    playersRange: '{n} jogadores', or: 'ou', home: 'Início',
    yourTable: 'Mesa local', vsBots: 'Contra bots', vsBotsNote: 'Só tua: ninguém mais a vê e não ocupa uma mesa pública.',
    playWith: 'Jogar com', oneBot: '1 bot', nBots: '{n} bots',
    startGame: 'Começar', otherTables: 'Mesas online', freeOne: '1 lugar livre',
    enter: 'Entrar', noOther: 'Ainda não há mesas com outras pessoas.', earlier: 'Mesas abertas', inviteNote: 'por convite',
    botsFill: 'Os lugares vazios ficam com bots quando começares.', copyInvite: 'Copiar convite', inviteCopied: 'Convite copiado.',
    startShort: 'Começar', ready: 'pronto', waitingStart: 'À espera de que alguém carregue em Começar.',
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
    notices: 'Notices', back: 'Back to lobby', howToPlay: 'How to play', seeTable: 'See the table', lobby: 'Lobby',
    writeName: 'Type your name',
    homeNote: 'Your table against bots, tables with other people and review tables are in each game\'s lobby.',
    playersRange: '{n} players', or: 'or', home: 'Home',
    yourTable: 'Local table', vsBots: 'Against bots', vsBotsNote: 'Only yours: nobody else sees it and it does not take a public table.',
    playWith: 'Play with', oneBot: '1 bot', nBots: '{n} bots',
    startGame: 'Start', otherTables: 'Online tables', freeOne: '1 seat free',
    enter: 'Enter', noOther: 'No tables with other people yet.', earlier: 'Open tables', inviteNote: 'by invitation',
    botsFill: 'Empty seats get bots when you start.', copyInvite: 'Copy invite', inviteCopied: 'Invite copied.',
    startShort: 'Start', ready: 'ready', waitingStart: 'Waiting for someone to press Start.',
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
  fsPending: false,   // telemóvel: pedir ecrã inteiro no próximo toque na mesa
  proto: null,        // mesa em "modo protótipo" (UI genérica), só essa e só nesta sessão
  nameDraft: null,    // nome a meio de ser escrito (sobrevive aos redesenhos)
  uiFailed: new Set(), // jogos cuja UI própria não carregou: ficam na UI genérica
  ui: null,           // UI própria montada: { roomId, gameId, el, mod }
  appearance: null,   // afinações do deploy (consola), ao vivo
  status: 'connecting',
  noticesOpen: false, // painel dos avisos aberto (mesa em ecrã inteiro)
  resultClosed: null, // `${sala}:${seq}` do fim de jogo que o jogador fechou para ver a mesa
  regOpen: false,     // registo da mesa em ecrã inteiro (UI genérica): aberto ou fechado
  rulesOpen: false,   // modal "Como se joga" (botão ? durante a partida): aberta ou fechada
};

/** Skin do jogo (defaults + tema do deploy), antes de montar a mesa ou o tutorial. */
function skinFor(gameId) {
  const meta = gameMeta(gameId);
  return meta ? applyGameSkin(meta, app.appearance?.games?.[gameId]?.theme) : Promise.resolve();
}

// O modo protótipo era guardado no browser e ficava ligado em todas as mesas; já não é.
try { localStorage.removeItem('bitnik.proto'); } catch { /* sem storage */ }

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

// ─── Rotas: #/ (início), #/j/<jogo> (lobby do jogo) e #/r/<id> (mesa) ──
// Com um só jogo não há início (Marca-produto): #/ é o lobby desse jogo.
const routeRoom = () => (location.hash.match(/^#\/r\/(.+)$/) || [])[1] || null;
const routeTutorial = () => (location.hash.match(/^#\/tutorial\/([\w-]+)$/) || [])[1] || null;
const routeGame = () => (location.hash.match(/^#\/j\/([\w-]+)$/) || [])[1] || null;
const manyGames = () => (W()?.games.length || 0) > 1;

function go(roomId) {
  location.hash = roomId ? `#/r/${roomId}` : '#/';
}

/** Lobby de um jogo (ou o início, se não houver jogo ou só houver um). */
function goGame(gameId) {
  location.hash = gameId && manyGames() ? `#/j/${gameId}` : '#/';
}

window.addEventListener('hashchange', () => {
  const id = routeRoom();
  if (id) client.open(id); else { client.closeRoom(); app.room = null; }
  render();
});

// ─── Lobby ───────────────────────────────────────────────────
// Números de jogadores de uma mesa (players.counts do jogo, ou de min a max; a partir de 2).
const tableCounts = (p) => (p.counts ?? Array.from({ length: p.max - p.min + 1 }, (_, i) => p.min + i)).filter((n) => n >= 2);
/** Nome no campo: o que se está a escrever, senão o último guardado. */
const shownName = () => app.nameDraft ?? app.welcome?.name ?? '';

/** Guarda o nome do jogador: no servidor e já na página (o WELCOME só chega ao ligar). */
function saveName(name) {
  client.setName(name);
  if (app.welcome) app.welcome.name = name.trim() || app.welcome.name;
  app.nameDraft = null;
  $('#name').value = app.welcome?.name ?? name;
}

/** Linha de cima do Início e do lobby: marca (· jogo), nome, avisos, consola, voltar e língua. */
function renderBrandTop(game = null) {
  const brand = W()?.brand?.name || $('#brand').textContent;
  return `<header class="home-top">
    <div class="home-id"><strong class="home-brandname">${esc(brand)}</strong>${game ? `<span class="mesa-sep">·</span><strong class="home-gamename">${esc(t('game.name', {}, game))}</strong>` : ''}</div>
    <div class="mesa-actions">
      ${game ? `<input class="home-name-sm" data-name-input maxlength="24" autocomplete="nickname" aria-label="${esc(u('yourName'))}" placeholder="${esc(u('yourName'))}" value="${esc(shownName())}">` : ''}
      <span id="mesaNotices" class="mesa-notices">${renderNoticeChip()}</span>
      ${game && manyGames() ? `<button class="mesa-btn" data-home aria-label="${esc(u('home'))}" title="${esc(u('home'))}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>` : ''}
      <button class="mesa-btn" data-lang>${u('lang')}</button></div>
  </header>`;
}

const seatDots = (r) => `<span class="lob-dots" aria-hidden="true">${r.seats.map((x) => `<i${x.taken ? ' class="on"' : ''}></i>`).join('')}</span>`;

/**
 * Lobby de um jogo (quadro "Lobby" do template): a tua mesa contra bots
 * (escolher quantos, continuar ou nova) e as mesas com outras pessoas, em
 * cartões de vidro sobre o fundo da marca.
 */
function renderLobby(only = null) {
  const g = (W()?.games || []).find((x) => x.id === only) || (W()?.games || [])[0];
  if (!g) return `<section class="home">${renderBrandTop()}<p class="home-note">${u('connecting')}</p></section>`;
  const counts = tableCounts(g.players);
  app.botSel ??= {};
  const sel = counts.includes(app.botSel[g.id]) ? app.botSel[g.id] : counts[counts.length - 1];
  const mine = app.rooms.mine.filter((r) => r.gameId === g.id);
  const solos = mine.filter((r) => r.kind === 'solo');
  const earlier = solos.slice(0, 6);
  const others = [...mine.filter((r) => r.kind === 'invite'), ...app.rooms.public.filter((r) => r.gameId === g.id)];
  const bots = (n) => (n - 1 === 1 ? u('oneBot') : u('nBots', { n: n - 1 }));
  return `<section class="home lob${g.cover ? ' has-cover' : ''}"${g.cover ? ` style="--lob-cover:url('${esc(g.cover)}')"` : ''}>
    ${renderRulesModal(g)}
    ${renderBrandTop(g.id)}
    <div class="lob-main">
      <div class="lob-head">
        <div class="lob-title"><h1>${esc(t('game.name', {}, g.id))}${g.prototype ? ` <span class="home-proto">${u('prototype', { v: g.version })}</span>` : ''}</h1>
          <p>${playersText(g.players)}</p></div>
        ${guideLink(g, g.id)}
      </div>
      <h2 class="lob-lbl">${u('yourTable')}</h2>
      <div class="lob-grid">
        <div class="lob-card mine solo">
          <div class="lob-solo-id"><h3>${u('vsBots')}</h3><p>${u('vsBotsNote')}</p></div>
          <div class="lob-bots"><span>${u('playWith')}</span>${counts.map((n) => `<button class="lob-btn sm${n === sel ? ' on' : ''}" data-bots="${esc(g.id)}" data-n="${n}" aria-pressed="${n === sel}">${bots(n)}</button>`).join('')}</div>
          <div class="lob-acts"><button class="lob-btn pri" data-solo="${esc(g.id)}" data-n="${sel}">${u('startGame')}</button></div>
        </div>
      </div>
      <h2 class="lob-lbl">${u('otherTables')}</h2>
      ${others.length ? `<div class="lob-grid">${others.map((r) => {
        const free = r.seats.filter((x) => !x.taken).length;
        const seated = r.seats.some((x) => x.isYou);
        const invite = r.kind === 'invite';
        const title = invite ? esc(r.name || u('inviteTable')) : u('tableOf', { n: r.numPlayers });
        const note = r.status === 'waiting' ? (free === 1 ? u('freeOne') : u('free', { n: free })) : statusText(r);
        const act = seated ? ['open', u('enter')] : r.status === 'waiting' && !invite ? ['join', u('join')] : ['open', invite ? u('enter') : u('view')];
        return `<div class="lob-card${seated ? ' mine' : ''}">
          <div class="lob-row"><h3>${title}</h3>${seatDots(r)}</div>
          <p>${invite ? `${u('inviteNote')} · ` : ''}${note}</p>
          <div class="lob-acts"><button class="lob-btn${seated ? ' pri' : ''}" data-${act[0]}="${r.id}">${act[1]}</button></div>
        </div>`;
      }).join('')}</div>` : `<p class="lob-empty">${u('noOther')}</p>`}
      ${earlier.length ? `<h2 class="lob-lbl">${u('earlier')}</h2>
        <ul class="lob-list">${earlier.map((r) => `<li><span>${u('tableOf', { n: r.numPlayers })}<small>${statusText(r)}${g.prototype && r.version && r.version !== g.version ? ` · ${esc(r.version)}` : ''}</small></span>
          <button class="lob-btn sm" data-open="${r.id}">${u(r.status === 'over' || r.status === 'expired' ? 'view' : 'resume')}</button>
          <button class="lob-btn sm" data-remove="${r.id}" aria-label="${u('remove')}">✕</button></li>`).join('')}</ul>` : ''}
    </div>
  </section>`;
}

// ─── Início (marca com vários jogos; ADR-014, quadro "Início" do template) ──
const COVERS = ['#1a5276', '#7d6608', '#1d6a27', '#6c3483', '#117a65', '#7b241c'];

function playersText(p) {
  const c = tableCounts(p);
  const contiguous = c.every((n, i) => !i || n === c[i - 1] + 1);
  const n = c.length === 1 ? c[0] : contiguous ? `${c[0]}–${c[c.length - 1]}` : `${c.slice(0, -1).join(', ')} ${u('or')} ${c[c.length - 1]}`;
  return u('playersRange', { n });
}

function renderHome() {
  const brand = W()?.brand?.name || $('#brand').textContent;
  const games = W()?.games || [];
  return `<section class="home">
    ${renderBrandTop()}
    <div class="home-main">
      <div class="home-head">
        <h1 class="home-brand">${esc(brand)}</h1>
        <label class="home-name"><span>${u('writeName')}</span>
          <input id="homeName" data-name-input maxlength="24" autocomplete="nickname" placeholder="${esc(u('yourName'))}" value="${esc(shownName())}"></label>
      </div>
      <div class="home-grid" style="--cols:${Math.min(Math.max(games.length, 1), 5)}">${games.map((g, i) => {
        return `<a class="home-card" href="#/j/${esc(g.id)}" style="--cover:${COVERS[i % COVERS.length]}">
          <div class="home-cover"><span>${esc(t('game.name', {}, g.id))}</span></div>
          <div class="home-info"><b class="home-mname">${esc(t('game.name', {}, g.id))}</b>
            <small>${playersText(g.players)}${g.prototype ? ` <span class="home-proto">${u('prototype', { v: g.version })}</span>` : ''}</small></div>
        </a>`;
      }).join('')}</div>
      <p class="home-note">${u('homeNote')}</p>
    </div>
  </section>`;
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
    return `<div class="seat${msg.active?.includes(i) ? ' is-active' : ''}" data-seat="${i}">
      <div class="seat-name">${esc(s.taken ? s.name : u('emptySeat'))}</div>
      <small>${tags.join(', ') || '&nbsp;'}</small>
      ${typeof p?.score === 'number' ? `<div class="score">${p.score}</div>` : ''}
      ${typeof p?.summary === 'string' && p.summary ? `<div class="seat-summary">${esc(p.summary)}</div>` : ''}
    </div>`;
  }).join('')}</div>`;
}

/**
 * No telemóvel os jogadores ficam numa faixa com scroll horizontal (swipe para
 * os restantes), sem botão "+N". Mantém a posição entre desenhos e, quando a
 * vez muda, mostra quem joga.
 */
function keepSeatsStrip(x) {
  const strip = document.querySelector('.seats');
  if (!strip) return;
  strip.scrollLeft = x;
  const active = strip.querySelector('.seat.is-active');
  const key = active?.dataset.seat ?? null;
  if (keepSeatsStrip.last === key) return;
  keepSeatsStrip.last = key;
  if (!active || strip.scrollWidth <= strip.clientWidth) return;
  const s = strip.getBoundingClientRect();
  const c = active.getBoundingClientRect();
  if (c.left < s.left || c.right > s.right) strip.scrollTo({ left: strip.scrollLeft + c.left - s.left, behavior: 'smooth' });
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

/**
 * "Modo protótipo" (ADR-006): no Studio, trocar a UI própria de um protótipo
 * (0.x, da Forge) pela UI genérica, para ver as jogadas e o estado do motor.
 * Num jogo publicado não aparece.
 */
const protoAllowed = (meta) => !!(app.welcome?.studio && meta?.prototype && meta?.ui);

/** A mesa usa a UI própria do jogo (ADR-006)? Só com o jogo a decorrer ou acabado. */
function useGameUi(msg) {
  const meta = gameMeta(msg?.room.gameId);
  const proto = protoAllowed(meta) && app.proto === msg.room.id;
  return !!meta?.ui && !proto && !app.uiFailed.has(msg.room.gameId) && !!msg.view && ['playing', 'over'].includes(msg.room.status);
}

/** A mesa ocupa o ecrã inteiro (ADR-014): com UI própria ou com a genérica, a decorrer ou acabada. */
function usesFullMesa(msg) {
  return useGameUi(msg) || ['playing', 'over'].includes(msg.room.status);
}

/** Linha de cima da mesa em ecrã inteiro (ADR-014): marca, jogo, avisos, guia, sair e língua. */
function renderTableTop(gameId, meta, extra = '') {
  const brand = W()?.brand?.name || $('#brand').textContent;
  const offline = app.status === 'closed' ? `<span class="mesa-chip warn" role="status">${esc(u('closed'))}</span>` : '';
  return `<header class="mesa-top">
    <div class="mesa-id"><strong class="mesa-brand">${esc(brand)}</strong><span class="mesa-sep">·</span>
      <strong class="mesa-game">${esc(t('game.name', {}, gameId))}</strong><span class="mesa-meta">${meta}</span></div>
    <div class="mesa-actions">${offline}<span id="mesaNotices" class="mesa-notices">${renderNoticeChip()}</span>${extra}
      <button class="mesa-btn" data-lobby aria-label="${esc(u('back'))}" title="${esc(u('back'))}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
      <button class="mesa-btn" data-lang>${u('lang')}</button></div>
  </header>`;
}

/**
 * Botão "?" durante a partida: se o jogo tiver conteúdo de regras, abre a
 * modal "Como se joga" sem sair da mesa; senão (jogos mais antigos, sem
 * `rules`), mantém o atalho para o tutorial de sempre.
 */
function guideButton(meta) {
  if (meta?.rules) return `<button class="mesa-btn" data-rules aria-label="${esc(u('howToPlay'))}" title="${esc(u('howToPlay'))}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg></button>`;
  if (meta?.tutorial) return `<a class="mesa-btn" href="#/tutorial/${esc(meta.id)}" aria-label="${esc(u('howToPlay'))}" title="${esc(u('howToPlay'))}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg></a>`;
  return '';
}

/** Como guideButton(), mas com texto (lobby e sala de espera, antes da mesa). */
function guideLink(meta, id) {
  const icon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>';
  if (meta?.rules) return `<button class="lob-btn" data-rules>${icon}${u('howToPlay')}</button>`;
  if (meta?.tutorial) return `<a class="lob-btn" href="#/tutorial/${esc(id)}">${icon}${u('howToPlay')}</a>`;
  return '';
}

/**
 * Modal "Como se joga": secções do jogo, na língua atual (recua para pt).
 * `s.visual`, quando presente, é HTML de confiança (vem do pacote do jogo,
 * nunca de jogadores) com os componentes reais do jogo — não é escapado.
 */
function renderRulesModal(meta) {
  if (!app.rulesOpen || !meta?.rules) return '';
  const sections = meta.rules[app.lang] || meta.rules.pt || [];
  return `<div class="rules-modal" role="dialog" aria-modal="true" aria-label="${esc(u('howToPlay'))}">
    <div class="rules-box">
      <div class="rules-head"><h2>${esc(t('game.name', {}, meta.id))} · ${esc(u('howToPlay'))}</h2>
        <button class="mesa-btn" data-closerules aria-label="${esc(u('dismiss'))}">✕</button></div>
      <div class="rules-body">${sections.map((s) => `<h3>${esc(s.title)}</h3>${s.body.map((p) => `<p>${esc(p)}</p>`).join('')}${s.visual || ''}`).join('')}</div>
    </div>
  </div>`;
}

/** A mesa de um jogo com UI própria ocupa o ecrã; a plataforma só põe a linha de cima e o fim do jogo. */
function renderFullTable(msg) {
  const g = msg.room.gameId;
  const meta = gameMeta(g);
  const round = msg.view?.round;
  const canLeave = msg.room.kind !== 'solo' && msg.seat != null;
  const info = `${msg.room.kind === 'invite' ? `${esc(msg.room.name || u('inviteTable'))} · ` : ''}${u('tableOf', { n: msg.room.numPlayers })}${meta?.prototype ? ` · ${u('prototype', { v: meta.version })}` : ''}`;
  const extra = [
    renderTimers(msg),
    guideButton(meta),
    protoAllowed(meta) ? `<button class="mesa-btn" data-proto>${u('protoUi')}</button>` : '',
    canLeave ? `<button class="mesa-btn" data-leave>${u('leave')}</button>` : '',
  ].join('');
  const key = `${msg.room.id}:${msg.seq}`;
  const result = msg.result && app.resultClosed !== key
    ? `<div class="mesa-over" role="dialog" aria-modal="true" aria-label="${esc(u('gameOver'))}"><div class="mesa-card">${renderPalette(msg)}
        <div class="mesa-card-btns"><button class="btn btn-outline" data-closeresult="${esc(key)}">${u('seeTable')}</button><button class="btn btn-outline" data-lobby>${u('lobby')}</button></div></div></div>` : '';
  return `<section class="mesa" data-game="${esc(g)}">
    ${renderRulesModal(meta)}
    <div id="gameHost" class="game-host"><p class="mesa-loading">${u('loadingUi')}</p></div>
    <div id="mesaMsgHost"></div>
    ${renderTableTop(g, info + (round ? ` · ${u('round', { n: round })}` : ''), extra)}
    ${result}
  </section>`;
}

// Cores dos lugares na entrada (como --cat-p1…p4 do template).
const SEAT_COLORS = ['#b03a2e', '#1a5276', '#1d6a27', '#7d6608', '#6c3483', '#117a65'];

// ─── Mensagem da mesa (ADR-014): ao centro, uma de cada vez, sem bloquear cliques ──
const MSG_MS = 2600;
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fila de mensagens sobre um elemento persistente, para a animação não recomeçar a cada redesenho. */
function mountTableMessages(el) {
  const q = [];
  let busy = false;
  function next() {
    const m = q.shift();
    if (!m) { busy = false; el.className = 'mesa-msg'; return; }
    busy = true;
    el.innerHTML = `<b>${esc(m.title)}</b>${m.sub ? `<small>${esc(m.sub)}</small>` : ''}`;
    el.className = `mesa-msg${m.variant ? ` ${m.variant}` : ''}`;
    void el.offsetWidth; // recomeça a animação
    el.classList.add('on');
    setTimeout(next, reducedMotion() ? 1800 : MSG_MS);
  }
  return {
    announce(title, sub = '', variant = '') {
      q.push({ title, sub, variant });
      if (!busy) next();
    },
  };
}

let mesaMsg = null; // { roomId, el, api, mine } — mensagem da mesa genérica (persistente, fora do redesenho)

function unmountMesaMessage() {
  mesaMsg?.el.remove();
  mesaMsg = null;
}

/**
 * Monta (uma vez por mesa) o elemento persistente da mensagem da mesa e liga-o
 * ao #mesaMsgHost do redesenho atual. Devolve a fila (mesaMsg), para a UI
 * própria do jogo lhe mandar mensagens pelo ctx.announce, ou null se a mesa
 * não tiver mensagem da mesa (fora de uma mesa em ecrã inteiro).
 */
function syncMesaMessageEl(msg) {
  const host = document.getElementById('mesaMsgHost');
  if (!host) { if (mesaMsg) unmountMesaMessage(); return null; }
  if (mesaMsg && mesaMsg.roomId !== msg.room.id) unmountMesaMessage();
  if (!mesaMsg) {
    const el = document.createElement('div');
    el.className = 'mesa-msg';
    el.setAttribute('aria-live', 'polite');
    // O histórico já existente ao montar não é anunciado; só as entradas seguintes.
    const lastLogSeq = Math.max(0, ...(msg.log || []).map((l) => l.seq ?? 0));
    mesaMsg = { roomId: msg.room.id, el, api: mountTableMessages(el), mine: false, lastLogSeq };
  }
  const live = document.getElementById('mesaMsgHost');
  if (live && live !== mesaMsg.el) live.replaceWith(mesaMsg.el);
  return mesaMsg;
}

/**
 * UI genérica (sem código próprio): a plataforma manda "É a tua vez" sozinha
 * e passa as entradas do registo marcadas com ctx.log(..., { announce }).
 */
function syncMesaMessage(msg) {
  const m = syncMesaMessageEl(msg);
  if (!m) return;
  const mine = msg.seat != null && !!msg.active?.includes(msg.seat) && !msg.result;
  if (mine && !m.mine) m.api.announce(u('yourTurn'));
  m.mine = mine;
  const g = msg.room.gameId;
  for (const l of msg.log || []) {
    if (l.announce == null || (l.seq ?? 0) <= m.lastLogSeq) continue;
    m.api.announce(t(l.announce.key, l.announce.params, g), '', l.announce.variant);
  }
  m.lastLogSeq = Math.max(m.lastLogSeq, ...(msg.log || []).map((l) => l.seq ?? 0));
}

/** Jogadores da UI genérica em ecrã inteiro: um painel de vidro por lugar (ADR-014). */
function renderMesaPlayers(msg) {
  return `<div class="mesa-players">${msg.room.seats.map((s, i) => {
    const p = msg.view?.players?.[i];
    const active = msg.active?.includes(i);
    const state = p?.summary || [s.bot && u('bot'), s.away && u('away')].filter(Boolean).join(', ');
    return `<div class="mesa-player${active ? ' is-active' : ''}" data-seat="${i}">
      <div class="mesa-player-name"><i style="background:${SEAT_COLORS[i % SEAT_COLORS.length]}"></i><b>${esc(s.taken ? s.name : u('emptySeat'))}</b>${typeof p?.score === 'number' ? `<span class="mesa-player-score">${p.score}</span>` : ''}</div>
      ${state ? `<div class="mesa-player-state">${esc(state)}</div>` : ''}
    </div>`;
  }).join('')}</div>`;
}

/** Jogadas legais (ou a espera/expirada) num painel de vidro flutuante, em vez de um tabuleiro. */
function renderMesaAction(msg) {
  return `<div class="mesa-action">${renderPalette(msg)}</div>`;
}

/** Registo flutuante da mesa em ecrã inteiro: começa colapsado, cresce para cima ao abrir. */
function renderMesaLog(msg) {
  const g = msg.room.gameId;
  const items = [...(msg.log || [])].reverse();
  const body = items.length ? `<ol>${items.map((l) => `<li>${l.seat != null ? `<b>${esc(seatName(l.seat))}</b> ` : ''}${esc(t(l.key, l.params, g))}</li>`).join('')}</ol>` : `<p>${u('noLog')}</p>`;
  return `<div class="mesa-log">
    <button class="mesa-log-toggle" data-reg aria-expanded="${app.regOpen}">${u('log')} ${app.regOpen ? '▴' : '▾'}</button>
    <div class="mesa-log-body${app.regOpen ? ' is-open' : ''}">${body}</div>
  </div>`;
}

/**
 * Mesa em ecrã inteiro para jogos sem UI própria (Bulbous, Praia, Nine Oils):
 * sem tabuleiro, mas com o mesmo desenho da ADR-014 — jogadores, jogadas e
 * registo em painéis de vidro sobre o fundo da mesa.
 */
function renderGenericMesa(msg) {
  const g = msg.room.gameId;
  const meta = gameMeta(g);
  const round = msg.view?.round;
  const canLeave = msg.room.kind !== 'solo' && msg.seat != null;
  const info = `${msg.room.kind === 'invite' ? `${esc(msg.room.name || u('inviteTable'))} · ` : ''}${u('tableOf', { n: msg.room.numPlayers })}${meta?.prototype ? ` · ${u('prototype', { v: meta.version })}` : ''}`;
  const extra = [
    renderTimers(msg),
    guideButton(meta),
    canLeave ? `<button class="mesa-btn" data-leave>${u('leave')}</button>` : '',
  ].join('');
  const key = `${msg.room.id}:${msg.seq}`;
  const result = msg.result && app.resultClosed !== key
    ? `<div class="mesa-over" role="dialog" aria-modal="true" aria-label="${esc(u('gameOver'))}"><div class="mesa-card">${renderPalette(msg)}
        <div class="mesa-card-btns"><button class="btn btn-outline" data-closeresult="${esc(key)}">${u('seeTable')}</button><button class="btn btn-outline" data-lobby>${u('lobby')}</button></div></div></div>` : '';
  return `<section class="mesa mesa-generic" data-game="${esc(g)}">
    ${renderRulesModal(meta)}
    <div id="mesaMsgHost"></div>
    ${renderMesaPlayers(msg)}
    ${msg.result ? '' : renderMesaAction(msg)}
    ${renderMesaLog(msg)}
    ${renderTableTop(g, info + (round ? ` · ${u('round', { n: round })}` : ''), extra)}
    ${result}
  </section>`;
}

/**
 * Entrada na mesa (quadro "Entrada" do template): à espera de jogadores, no
 * fundo da marca. Lugares ocupados e livres, "Começar" (os vazios ficam com
 * bots), "Como se joga" e "Copiar convite".
 */
function renderEntrada(msg) {
  const g = msg.room.gameId;
  const meta = gameMeta(g);
  const brand = W()?.brand?.name || $('#brand').textContent;
  const seated = msg.seat != null;
  const canLeave = msg.room.kind !== 'solo' && seated;
  const info = msg.room.kind === 'invite' ? esc(msg.room.name || u('inviteTable')) : u('tableOf', { n: msg.room.numPlayers });
  const guide = guideLink(meta, g);
  return `<section class="home ent">
    ${renderRulesModal(meta)}
    <header class="home-top">
      <div class="home-id"><strong class="home-brandname">${esc(brand)}</strong><span class="mesa-sep">·</span><strong class="home-gamename">${esc(t('game.name', {}, g))}</strong><span class="ent-meta">${info}</span></div>
      <div class="mesa-actions"><span id="mesaNotices" class="mesa-notices">${renderNoticeChip()}</span>
        ${canLeave ? `<button class="mesa-btn" data-leave>${u('leave')}</button>` : ''}
        <button class="mesa-btn" data-lobby aria-label="${esc(u('back'))}" title="${esc(u('back'))}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
        <button class="mesa-btn" data-lang>${u('lang')}</button></div>
    </header>
    <div class="ent-main">
      <h1>${esc(t('game.name', {}, g))}</h1>
      <p class="ent-lead">${playersText(meta?.players || { min: msg.room.numPlayers, max: msg.room.numPlayers })}</p>
      <div class="ent-seats">${msg.room.seats.map((x, i) => x.taken
        ? `<div class="ent-seat${x.isYou ? ' you' : ''}"><div class="ent-name"><i style="background:${SEAT_COLORS[i % SEAT_COLORS.length]}"></i><b>${esc(x.name)}${x.isYou ? ` (${u('you')})` : ''}</b></div>
            <small>${x.bot ? u('bot') : x.away ? u('away') : u('ready')}</small></div>`
        : `<div class="ent-seat free"><small>${u('emptySeat')}</small>${!seated && msg.room.kind !== 'solo' ? `<button class="lob-btn sm" data-join="${msg.room.id}">${u('join')}</button>` : ''}</div>`).join('')}</div>
      ${renderTimers(msg)}
      <p class="ent-note">${seated ? u('botsFill') : msg.room.kind === 'invite' ? u('inviteJoin') : u('waitingStart')}</p>
      <div class="ent-bar">
        ${seated ? `<button class="lob-btn pri" data-start>${u('startShort')}</button>` : ''}
        ${guide}
        ${msg.room.kind !== 'solo' ? `<button class="lob-btn" data-copyinvite>${u('copyInvite')}</button>` : ''}
      </div>
    </div>
  </section>`;
}

function renderTable() {
  const msg = app.room;
  if (!msg) return `<p class="empty">${u('connecting')}</p>`;
  if (msg.room.status === 'waiting') return renderEntrada(msg);
  if (useGameUi(msg)) return renderFullTable(msg);
  if (usesFullMesa(msg)) return renderGenericMesa(msg);
  const g = msg.room.gameId;
  const round = msg.view?.round;
  const canLeave = msg.room.kind !== 'solo' && msg.seat != null;
  const own = useGameUi(msg);
  const protoBtn = protoAllowed(gameMeta(g)) && msg.view
    ? `<button class="btn btn-outline" data-proto>${u(app.proto === msg.room.id ? 'gameUi' : 'protoUi')}</button>` : '';
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
  syncMesaMessageEl(msg); // liga o elemento da mensagem da mesa; o jogo manda-lhe mensagens pelo ctx.announce
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
      app.uiFailed.add(gameId); // cai na UI genérica
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
      announce: (title, sub, variant) => mesaMsg?.api.announce(title, sub, variant),
    });
  }
  const live = document.getElementById('gameHost');
  if (live && live !== app.ui.el) live.replaceWith(app.ui.el);
  try { app.ui.mod.update(app.room); } catch (e) { console.error('[ui] update', e); }
  return undefined;
}

// ─── Avisos do publisher (faixa no topo; na mesa, uma ficha) ──
const activeNotices = () => {
  const t0 = Date.now() + app.noticesSkew;
  return app.notices.filter((n) => n.until > t0 && !app.dismissed.has(n.id));
};

/** Na mesa em ecrã inteiro (ADR-014) os avisos são uma ficha na linha de cima; a vermelho com manutenção. */
function renderNoticeChip() {
  const list = activeNotices();
  if (!list.length) return '';
  const t0 = Date.now() + app.noticesSkew;
  const maint = list.some((n) => n.maintenance && n.maintenance.from <= t0) || list.some((n) => n.level === 'warn');
  return `<button class="mesa-chip${maint ? ' warn' : ''}" data-notices aria-expanded="${app.noticesOpen}">${u('notices')} · ${list.length}</button>
    ${app.noticesOpen ? `<div class="mesa-panel" role="region" aria-label="${esc(u('notices'))}">${noticeItems(list)}</div>` : ''}`;
}

function noticeItems(list) {
  const t0 = Date.now() + app.noticesSkew;
  return list.map((n) => {
    const time = n.at ? new Date(n.at - app.noticesSkew).toLocaleTimeString(app.lang, { hour: '2-digit', minute: '2-digit' }) : '';
    const main = n.text ? (n.text[app.lang] || Object.values(n.text)[0]) : t(n.key, { time, ...n.params });
    const drain = n.maintenance && n.maintenance.from <= t0 ? ` ${t('notice.MAINTENANCE')}` : '';
    return `<div class="notice notice-${esc(n.level)}" role="status"><span>${esc(main + drain)}</span>
      <button class="btn btn-ghost" data-dismiss="${esc(n.id)}" aria-label="${u('dismiss')}">✕</button></div>`;
  }).join('');
}

function renderNotices() {
  const el = $('#notices');
  const list = activeNotices();
  el.hidden = !list.length;
  el.innerHTML = noticeItems(list);
  const chip = document.getElementById('mesaNotices');
  if (chip) chip.innerHTML = renderNoticeChip();
}

function setNotices(list, serverNow) {
  app.notices = list || [];
  if (serverNow) app.noticesSkew = serverNow - Date.now();
  renderNotices();
}
setInterval(renderNotices, 30_000); // a janela de manutenção pode começar entretanto

function onDismiss(e) {
  const b = e.target.closest('[data-dismiss]');
  if (!b) return false;
  app.dismissed.add(b.dataset.dismiss);
  if (!activeNotices().length) app.noticesOpen = false;
  renderNotices();
  return true;
}
$('#notices').addEventListener('click', onDismiss);

// ─── Tutorial (módulo do pacote; corre o motor no browser) ───
function renderTutorial(gameId) {
  return `<section class="mesa" data-game="${esc(gameId)}">
    <div id="tutHost" class="game-host"><p class="mesa-loading">${u('loadingUi')}</p></div>
    ${renderTableTop(gameId, u('tutorialOf'))}
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
  if (!mod || routeTutorial() !== gameId) { if (!mod) goGame(gameId); return; }
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
    exit: () => goGame(gameId),
    playReal: (n) => client.createSolo(gameId, n),
  });
}

// ─── Render e eventos ────────────────────────────────────────
function render() {
  const tut = routeTutorial();
  const inRoom = !!routeRoom();
  const gameLobby = routeGame();
  const home = !tut && !inRoom && !gameLobby && manyGames();
  const entrada = inRoom && app.room?.room.status === 'waiting';
  document.body.classList.toggle('is-home', !tut && (!inRoom || entrada));
  $('#back').hidden = !inRoom && !tut && !gameLobby;
  $('#lang').textContent = u('lang');
  $('#nameLabel').textContent = u('yourName');
  $('#name').placeholder = u('yourName');
  document.documentElement.lang = app.lang;
  const full = !!tut || (inRoom && !!app.room && usesFullMesa(app.room));
  if (full && !document.body.classList.contains('is-table')) app.fsPending = true;
  if (!inRoom && !tut) { app.fsPending = false; leaveFullscreen(); }
  document.body.classList.toggle('is-table', full);
  if (!full) app.noticesOpen = false;
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
  // A faixa de jogadores (telemóvel) não volta ao início a cada desenho.
  const seatsX = document.querySelector('.seats')?.scrollLeft ?? 0;
  // A UI própria não é redesenhada: sai do DOM antes e volta para o #gameHost.
  app.ui?.el.remove();
  mesaMsg?.el.remove();
  const typing = document.activeElement?.matches?.('[data-name-input]') ? document.activeElement : null;
  const caret = typing ? [typing.selectionStart, typing.selectionEnd] : null;
  $('#view').innerHTML = inRoom ? renderTable() : home ? renderHome() : renderLobby(gameLobby);
  if (typing) {
    const again = $('#view').querySelector('[data-name-input]');
    if (again) { again.focus(); again.setSelectionRange(...caret); }
  }
  keepSeatsStrip(seatsX);
  if (inRoom && app.room) syncGameUi(app.room); else if (app.ui) unmountGameUi();
  if (inRoom && app.room && usesFullMesa(app.room)) {
    if (!useGameUi(app.room)) syncMesaMessage(app.room); // UI própria: já ligado por syncGameUi, o jogo manda pelo ctx.announce
  } else if (mesaMsg) unmountMesaMessage();
  document.querySelectorAll('.inspect details').forEach((d) => {
    if (openPaths.includes(d.querySelector('summary')?.textContent)) d.open = true;
  });
  tickTimers();
}

function toggleLang() {
  app.lang = app.lang === 'pt' ? 'en' : 'pt';
  localStorage.setItem('bitnik.lang', app.lang);
  render();
}

// ─── Ecrã inteiro no telemóvel ──────────────────────────────
// Ao entrar numa mesa (ou no tutorial), o telemóvel passa a ecrã inteiro e
// esconde a barra de endereço. O browser só o deixa fazer num toque do
// jogador: no clique que entra na mesa ou, se se chegou por um link, no
// primeiro toque na mesa. Ao sair para o lobby ou o início, volta ao normal.
// (No iPhone o Safari não tem ecrã inteiro para páginas: aí é "Adicionar ao
// ecrã principal", que abre sem barra de endereço.)
const touchScreen = () => matchMedia('(pointer: coarse)').matches;
function enterFullscreen() {
  const de = document.documentElement;
  app.fsPending = false;
  if (!touchScreen() || document.fullscreenElement || !de.requestFullscreen) return;
  de.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
}
function leaveFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}
document.addEventListener('click', (e) => {
  const entering = e.target.closest('[data-solo], [data-open], [data-join], [data-start], [data-restart], a[href^="#/tutorial/"]');
  if (entering || (app.fsPending && document.body.classList.contains('is-table'))) enterFullscreen();
}, true);

$('#view').addEventListener('click', (e) => {
  if (onDismiss(e)) return;
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if ('lobby' in d) { goGame(app.room?.room.gameId || routeTutorial()); return; }
  if ('lang' in d) { toggleLang(); return; }
  if ('home' in d) { location.hash = '#/'; return; }
  if ('copyinvite' in d) {
    navigator.clipboard?.writeText(location.href).then(() => toast(u('inviteCopied')), () => toast(location.href));
    return;
  }
  if (d.bots) { app.botSel = { ...app.botSel, [d.bots]: Number(d.n) }; render(); return; }
  if ('notices' in d) { app.noticesOpen = !app.noticesOpen; renderNotices(); return; }
  if ('reg' in d) { app.regOpen = !app.regOpen; render(); return; }
  if ('closeresult' in d) { app.resultClosed = d.closeresult; render(); return; }
  if ('rules' in d) { app.rulesOpen = true; render(); return; }
  if ('closerules' in d) { app.rulesOpen = false; render(); return; }
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
    app.proto = app.proto === roomId ? null : roomId;
    render();
  } else if ('start' in d) client.start(roomId);
  else if ('restart' in d) client.restart(roomId);
  else if ('leave' in d) { client.leave(roomId); goGame(app.room?.room.gameId); }
});

$('#back').addEventListener('click', () => {
  // Da mesa ou do tutorial volta ao lobby do jogo; do lobby do jogo, ao início.
  const g = routeGame() ? null : app.room?.room.gameId || routeTutorial();
  goGame(g);
});
$('#lang').addEventListener('click', toggleLang);
$('#name').addEventListener('change', (e) => saveName(e.target.value));
$('#view').addEventListener('input', (e) => {
  if (e.target.matches('[data-name-input]')) app.nameDraft = e.target.value;
});
$('#view').addEventListener('change', (e) => {
  if (!e.target.matches('[data-name-input]')) return;
  saveName(e.target.value);
});

client.on('status', (s) => {
  const was = app.status;
  app.status = s;
  $('#status').textContent = u(s);
  if (document.body.classList.contains('is-table') && (was === 'closed') !== (s === 'closed')) render();
});
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
