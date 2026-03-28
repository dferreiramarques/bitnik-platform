'use strict';
// ═══════════════════════════════════════════════════════════════════
//  BITNIK SERVER
//  Serve ficheiros estáticos + WebSocket runtime em simultâneo.
//  Um processo, uma porta — Railway-ready.
// ═══════════════════════════════════════════════════════════════════
const http   = require('http');
const { WebSocketServer } = require('ws');
const fs     = require('fs');
const path   = require('path');

const PORT     = process.env.PORT || 3000;
const GAMES_DIR = path.join(__dirname, 'games');
const PUB_DIR   = path.join(__dirname, 'public');

// ── Load all .bge files at startup ───────────────────────────────
const GAME_REGISTRY = {}; // id → { bge, graph }

function loadGames() {
  if (!fs.existsSync(GAMES_DIR)) return;
  const files = fs.readdirSync(GAMES_DIR).filter(f => f.endsWith('.bge.json'));
  for (const file of files) {
    try {
      const raw  = fs.readFileSync(path.join(GAMES_DIR, file), 'utf8');
      const bge  = JSON.parse(raw);
      const id   = file.replace('.bge.json', '');
      const graph = compileBGE(bge);
      GAME_REGISTRY[id] = { bge, graph };
      console.log(`[BGE] Loaded: ${bge.game?.name || id} (${bge.nodes?.length} nodes)`);
    } catch (e) {
      console.error(`[BGE] Failed to load ${file}:`, e.message);
    }
  }
  console.log(`[BGE] ${Object.keys(GAME_REGISTRY).length} game(s) ready`);
}

// ── Compile .bge → in-memory graph ───────────────────────────────
function compileBGE(bge) {
  const nodes = new Map();
  const triggers = new Map();
  let startId = '';
  for (const n of (bge.nodes || [])) {
    nodes.set(n.id, {
      id: n.id, type: n.node, label: n.label || n.node,
      config: n.config || {}, outputs: new Map(), inputs: new Map(),
    });
    if (n.node === 'GAME_START') startId = n.id;
  }
  for (const e of (bge.edges || [])) {
    const from = nodes.get(e.fromNode);
    const to   = nodes.get(e.toNode);
    if (!from || !to) continue;
    const outs = from.outputs.get(e.fromPort) || [];
    outs.push({ nodeId: e.toNode, inPort: e.toPort });
    from.outputs.set(e.fromPort, outs);
    const ins = to.inputs.get(e.toPort) || [];
    ins.push({ nodeId: e.fromNode, outPort: e.fromPort });
    to.inputs.set(e.toPort, ins);
  }
  return { nodes, triggers, startId };
}

// ── Lobbies (per game) ────────────────────────────────────────────
const lobbies = {}; // gameId:tableN → lobby
let gameIdSeq = 1;

function getLobby(gameKey, tableNum) {
  const id = `${gameKey}:${tableNum}`;
  if (!lobbies[id]) {
    const reg = GAME_REGISTRY[gameKey];
    const maxP = reg?.bge?.game?.players?.max || 4;
    lobbies[id] = {
      id, gameKey, tableNum,
      name: `Mesa ${tableNum}`,
      maxP, players: new Array(maxP).fill(null),
      names: new Array(maxP).fill(''),
      game: null,
    };
  }
  return lobbies[id];
}

const wsState = new WeakMap();

// ── Game engine ───────────────────────────────────────────────────
function buildState(gameId, bge, graph, names) {
  return {
    gameId, bge, graph,
    phase: graph.startId,
    currentPlayer: 0,
    playerCount: names.length,
    roundNum: 0, turnGen: 0,
    players: names.map((name, idx) => ({
      idx, name, isBot: false, score: 0, resources: {}, meta: {},
    })),
    decks: {}, discards: {}, hands: {},
    log: [], pendingAction: null, finalScores: null,
    meta: {},
  };
}

function traverse(state, node, inPort, depth) {
  if (!node || (depth || 0) > 150) return;
  const result = executeNode(state, node, inPort);
  if (!result) return;
  if (result.type === 'WAIT') { state.pendingAction = result.pending; return; }
  if (result.type === 'END')  return;
  if (result.type === 'ADVANCE') {
    const edges = node.outputs.get(result.port) || [];
    for (const e of edges) {
      const next = state.graph.nodes.get(e.nodeId);
      if (next) traverse(state, next, e.inPort || 'in', (depth||0)+1);
    }
  }
  if (result.type === 'ADVANCE_MANY') {
    for (const port of result.ports) {
      const edges = node.outputs.get(port) || [];
      for (const e of edges) {
        const next = state.graph.nodes.get(e.nodeId);
        if (next) traverse(state, next, e.inPort || 'in', (depth||0)+1);
      }
    }
  }
}

function executeNode(state, node, inPort) {
  log(state, state.currentPlayer, node.type, node.label);
  switch (node.type) {

    case 'GAME_START':
      state.roundNum = 0;
      return adv('next');

    case 'ROUND_START':
      state.roundNum++;
      state.players.forEach(p => {
        p.meta.trickNum = 0;
        p.meta.completedThisRound = false;
      });
      return adv('next');

    case 'TURN_START':
      return adv('next');

    case 'TURN_END':
      state.currentPlayer = (state.currentPlayer + 1) % state.playerCount;
      state.turnGen++;
      return adv('next');

    case 'TURN_BLOCK': {
      const tb = node.config.tb;
      state.phase = node.id;
      if (!tb) return adv('end_turn');
      return wait({
        type: 'CHOOSE_ACTION', nodeId: node.id,
        playerIdx: state.currentPlayer,
        options: (tb.actions || []).map(a => a.type),
        constraint: tb.constraint, max: tb.max || 1,
        outcomes: tb.outcomes || [],
      });
    }

    case 'GAME_END': {
      state.phase = 'GAME_OVER';
      state.finalScores = [...state.players]
        .sort((a,b) => b.score - a.score)
        .map(p => ({ playerIdx: p.idx, name: p.name, score: p.score, breakdown: {} }));
      return { type: 'END' };
    }

    case 'INSTANT_WIN': {
      state.phase = 'GAME_OVER';
      const w = state.players[state.currentPlayer];
      state.finalScores = [{ playerIdx: w.idx, name: w.name, score: 999, breakdown: {} }];
      return { type: 'END' };
    }

    case 'CHECK_COND':
      return adv(safeEval(node.config.cond || 'false', state) ? 'true' : 'false');

    case 'CHECK_WIN':
      return adv(safeEval(node.config.cond || 'false', state) ? 'win' : 'continue');

    case 'CHECK_RES': {
      const has = (state.players[state.currentPlayer].resources[node.config.res] || 0)
                  >= (Number(node.config.amt) || 1);
      return adv(has ? 'yes' : 'no');
    }

    case 'SCORE_PTS': {
      const amt = Number(node.config.amt) || 1;
      if (node.config.who === 'all') state.players.forEach(p => { p.score += amt; });
      else state.players[state.currentPlayer].score += amt;
      return adv('next');
    }

    case 'NOTIFY_ALL':
    case 'NOTIFY_P':
      return adv('next');

    case 'MAJORITY':
    case 'COLL_BONUS':
    case 'SPATIAL_SC':
    case 'FIRST_CLAIM':
      return adv('next');

    case 'SIMULTAN':
      return wait({
        type: 'SIMULTANEOUS', nodeId: node.id,
        pending: state.players.map(p => p.idx),
      });

    case 'TIMER':
      return wait({
        type: 'TIE_BREAK', nodeId: node.id,
        players: state.players.map(p => p.idx),
        deadline: Date.now() + (Number(node.config.ms) || 20000),
      });

    case 'DRAW_CARD': {
      const amt = Number(node.config.amt) || 1;
      log(state, state.currentPlayer, 'DRAW', `+${amt}`);
      return adv('next');
    }

    case 'PLAY_CARD':
      log(state, state.currentPlayer, 'PLAY', 'card played');
      return adv('next');

    case 'DICE_ROLL': {
      const count = Number(node.config.count) || 9;
      const sides = Number(node.config.sides) || 6;
      const dice  = Array.from({ length: count }, () => Math.ceil(Math.random() * sides));
      state.players[state.currentPlayer].meta.lastRoll = dice;
      log(state, state.currentPlayer, 'DICE', dice.join(','));
      return adv('result');
    }

    case 'ROLE': {
      state.meta.roleHolder = ((state.meta.roleHolder || 0) + 1) % state.playerCount;
      return adv('holder');
    }

    case 'RANDOM': {
      const ports = [...node.outputs.keys()];
      return adv(ports[Math.floor(Math.random() * ports.length)] || 'result');
    }

    default: {
      const first = [...node.outputs.keys()][0];
      if (first) return adv(first);
      return { type: 'END' };
    }
  }
}

const adv  = port  => ({ type: 'ADVANCE', port });
const wait = pending => ({ type: 'WAIT', pending });

function handleAction(lobby, playerIdx, msg) {
  const state = lobby.game;
  if (!state || state.finalScores) return;
  const pending = state.pendingAction;
  if (!pending) return;
  state.pendingAction = null;

  if (pending.type === 'CHOOSE_ACTION') {
    if (msg.payload?.endTurn) {
      state.currentPlayer = (state.currentPlayer + 1) % state.playerCount;
      state.turnGen++;
    } else {
      log(state, playerIdx, 'ACT', msg.payload?.action || '?');
      // Re-present the turn block unless player ended turn
      const node = state.graph.nodes.get(pending.nodeId);
      const tb   = node?.config?.tb;
      if (tb) {
        state.pendingAction = {
          type: 'CHOOSE_ACTION', nodeId: pending.nodeId,
          playerIdx: state.currentPlayer,
          options: (tb.actions || []).map(a => a.type),
          constraint: tb.constraint, max: tb.max || 1,
          outcomes: tb.outcomes || [],
        };
        broadcastAll(lobby);
        return;
      }
    }
    const node  = state.graph.nodes.get(pending.nodeId);
    const edges = node?.outputs.get('end_turn') || [];
    for (const e of edges) {
      const next = state.graph.nodes.get(e.nodeId);
      if (next) traverse(state, next, e.inPort || 'in');
    }
  }

  if (pending.type === 'SIMULTANEOUS') {
    const rem = (pending.pending || []).filter(i => i !== playerIdx);
    if (rem.length > 0) {
      state.pendingAction = { ...pending, pending: rem };
      broadcastAll(lobby);
      return;
    }
    const node  = state.graph.nodes.get(pending.nodeId);
    const edges = node?.outputs.get('done') || [];
    for (const e of edges) {
      const next = state.graph.nodes.get(e.nodeId);
      if (next) traverse(state, next, e.inPort || 'in');
    }
  }

  if (pending.type === 'TIE_BREAK') {
    // Auto-resolve after deadline or when all submitted
    const node  = state.graph.nodes.get(pending.nodeId);
    const edges = node?.outputs.get('tick') || node?.outputs.get('done') || [];
    for (const e of edges) {
      const next = state.graph.nodes.get(e.nodeId);
      if (next) traverse(state, next, e.inPort || 'in');
    }
  }

  state.turnGen++;
  broadcastAll(lobby);
}

function startGame(lobby, names) {
  const reg   = GAME_REGISTRY[lobby.gameKey];
  if (!reg) return;
  const gameId = 'g' + (gameIdSeq++);
  const state  = buildState(gameId, reg.bge, reg.graph, names);
  lobby.game   = state;
  const start  = state.graph.nodes.get(state.graph.startId);
  if (start) traverse(state, start, 'start');
  broadcastAll(lobby);
}

function buildView(state, playerIdx) {
  return {
    gameId:        state.gameId,
    gameName:      state.bge.game?.name,
    phase:         state.phase,
    currentPlayer: state.currentPlayer,
    roundNum:      state.roundNum,
    turnGen:       state.turnGen,
    myIdx:         playerIdx,
    players:       state.players.map(p => ({
      idx: p.idx, name: p.name, score: p.score, resources: p.resources,
      isActive: p.idx === state.currentPlayer,
    })),
    pendingAction: filterPending(state.pendingAction, playerIdx),
    log:           state.log.slice(-20),
    finalScores:   state.finalScores,
    currentNode:   state.graph.nodes.get(state.phase)?.label || state.phase,
  };
}

function filterPending(p, idx) {
  if (!p) return null;
  if (p.playerIdx !== undefined && p.playerIdx !== idx)
    return { type: 'WAITING', for: p.playerIdx };
  if (p.pending && !p.pending.includes(idx))
    return { type: 'WAITING', for: p.pending };
  return p;
}

function broadcastAll(lobby) {
  if (!lobby.game) return;
  lobby.players.forEach((ws, seat) => {
    if (ws?.readyState === 1)
      ws.send(JSON.stringify({ type: 'GAME_STATE', state: buildView(lobby.game, seat) }));
  });
}

function lobbyInfo(l) {
  return {
    id: l.id, gameKey: l.gameKey, name: l.name, maxP: l.maxP,
    players: l.names.filter(Boolean).length,
    inGame: !!l.game && l.game.phase !== 'GAME_OVER',
    gameName: GAME_REGISTRY[l.gameKey]?.bge?.game?.name || l.gameKey,
  };
}

function safeEval(cond, state) {
  try {
    const p = state.players[state.currentPlayer] || {};
    let expr = (cond || 'false')
      .replace(/\bscore\b/g, p.score || 0)
      .replace(/\broundNum\b/g, state.roundNum)
      .replace(/\btrickNum\b/g, p.meta?.trickNum || 0)
      .replace(/\bendgameFired\b/g,
        state.players.some(pl => pl.meta?.endgameTriggered) ? 'true' : 'false')
      .replace(/\bwinners\.length\b/g,
        state.players[0]?.meta?.lastWinners?.length || 0);
    if (!/^[\d\s+\-*/<>=!&|().truefals]+$/.test(expr)) return false;
    return Boolean(Function(`"use strict"; return (${expr})`)());
  } catch { return false; }
}

function log(state, player, action, detail) {
  state.log.push({ ts: Date.now(), round: state.roundNum, player, action, detail });
  if (state.log.length > 200) state.log.shift();
}

// ── HTTP server ───────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // API: list games
  if (url === '/api/games') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(
      Object.entries(GAME_REGISTRY).map(([id, { bge }]) => ({
        id, name: bge.game?.name, players: bge.game?.players,
        nodes: bge.nodes?.length, edges: bge.edges?.length,
      }))
    ));
    return;
  }

  // API: upload new .bge
  if (url === '/api/upload-bge' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try {
        const bge = JSON.parse(body);
        const id  = (bge.game?.name || 'game')
          .toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const graph = compileBGE(bge);
        GAME_REGISTRY[id] = { bge, graph };
        // Also save to disk so it survives restart
        const filePath = path.join(GAMES_DIR, `${id}.bge.json`);
        fs.writeFileSync(filePath, JSON.stringify(bge, null, 2));
        // Create 3 lobbies for this game
        for (let t = 1; t <= 3; t++) getLobby(id, t);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id, nodes: bge.nodes?.length }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // /play/:gameId → play.html (game client reads gameKey from URL)
  if (url.startsWith('/play/')) {
    fs.readFile(path.join(PUB_DIR, 'play.html'), (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // Static files
  let filePath = path.join(PUB_DIR, url === '/' ? 'index.html' : url);
  const ext    = path.extname(filePath);
  if (!ext) filePath += '.html'; // /docs → /docs.html

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback → index.html
      fs.readFile(path.join(PUB_DIR, 'index.html'), (e2, d2) => {
        if (e2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(d2);
      });
      return;
    }
    const mime = MIME[path.extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

// ── WebSocket server ──────────────────────────────────────────────
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  // Expect client to JOIN with { type:'JOIN', gameKey, tableNum, name }
  send(ws, { type: 'WELCOME', games: Object.keys(GAME_REGISTRY) });

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'PING') { send(ws, { type: 'PONG' }); return; }

    if (msg.type === 'LIST_LOBBIES') {
      const key = msg.gameKey;
      // Ensure 3 lobbies exist for this game
      if (GAME_REGISTRY[key]) {
        for (let t = 1; t <= 3; t++) getLobby(key, t);
      }
      const list = Object.values(lobbies)
        .filter(l => !key || l.gameKey === key)
        .map(lobbyInfo);
      send(ws, { type: 'LOBBIES', lobbies: list });
      return;
    }

    if (msg.type === 'JOIN') {
      const { gameKey, tableNum = 1, name = 'Jogador' } = msg;
      if (!GAME_REGISTRY[gameKey]) {
        send(ws, { type: 'ERROR', text: 'Jogo não encontrado' }); return;
      }
      const lobby = getLobby(gameKey, tableNum);
      const seat  = lobby.players.findIndex(p => p === null);
      if (seat === -1) { send(ws, { type: 'ERROR', text: 'Mesa cheia' }); return; }
      lobby.players[seat] = ws;
      lobby.names[seat]   = name.trim().slice(0, 20) || 'Jogador';
      wsState.set(ws, { gameKey, tableNum, seat, lobbyId: lobby.id });
      send(ws, { type: 'JOINED', seat, gameKey, tableNum, name: lobby.names[seat] });
      // Notify others
      lobby.players.forEach((p, i) => {
        if (p && i !== seat)
          send(p, { type: 'PLAYER_JOINED', seat, name: lobby.names[seat] });
      });
      send(ws, { type: 'LOBBY_STATE', lobby: lobbyInfo(lobby), names: lobby.names, seat });
      if (lobby.game)
        send(ws, { type: 'GAME_STATE', state: buildView(lobby.game, seat) });
      return;
    }

    const st = wsState.get(ws);
    if (!st) return;
    const lobby = lobbies[st.lobbyId];
    if (!lobby) return;

    if (msg.type === 'START') {
      if (lobby.game) return;
      const names = lobby.names.filter(Boolean);
      const minP  = GAME_REGISTRY[st.gameKey]?.bge?.game?.players?.min || 1;
      if (names.length < minP) {
        send(ws, { type: 'ERROR', text: `Mínimo ${minP} jogadores` }); return;
      }
      startGame(lobby, names);
      // Broadcast lobby list update
      wss.clients.forEach(c => {
        if (c.readyState === 1) {
          const cst = wsState.get(c);
          if (!cst) return;
          const list = Object.values(lobbies)
            .filter(l => l.gameKey === cst.gameKey)
            .map(lobbyInfo);
          send(c, { type: 'LOBBIES', lobbies: list });
        }
      });
      return;
    }

    if (msg.type === 'PLAYER_ACT') {
      handleAction(lobby, st.seat, msg);
      return;
    }

    if (msg.type === 'REQUEST_STATE') {
      if (lobby.game)
        send(ws, { type: 'GAME_STATE', state: buildView(lobby.game, st.seat) });
      else
        send(ws, { type: 'LOBBY_STATE', lobby: lobbyInfo(lobby), names: lobby.names, seat: st.seat });
      return;
    }
  });

  ws.on('close', () => {
    const st = wsState.get(ws); if (!st) return;
    const lobby = lobbies[st.lobbyId]; if (!lobby) return;
    lobby.players[st.seat] = null;
    setTimeout(() => {
      if (!lobby.players[st.seat]) lobby.names[st.seat] = '';
    }, 45000);
  });
  ws.on('error', () => {});
});

function send(ws, msg) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(msg));
}

setInterval(() => {
  wss.clients.forEach(ws => { if (ws.readyState === 1) ws.ping(); });
}, 25000);

// ── Start ─────────────────────────────────────────────────────────
loadGames();
// Pre-create lobbies for known games
Object.keys(GAME_REGISTRY).forEach(key => {
  for (let t = 1; t <= 3; t++) getLobby(key, t);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Bitnik] Server on http://0.0.0.0:${PORT}`);
  console.log(`[Bitnik] Games: ${Object.keys(GAME_REGISTRY).join(', ') || 'none'}`);
});

// ── Serve /play/:gameId → play.html ──────────────────────────────
// Note: this is already handled by the SPA fallback above,
// but we add explicit routing for clarity.
// The play.html reads gameKey from location.pathname client-side.
