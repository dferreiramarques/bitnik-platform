'use strict';
// ═══════════════════════════════════════════════════════════════════
//  BITNIK SERVER
// Capivaras runs as a dedicated in-process game handler
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

    case 'BARRIER': {
      // Each player arrives independently; advance when all (or quorum) have checked in
      const waitFor = node.config.waitFor || 'all';
      const timeoutMs = Number(node.config.timeout_ms) || 0;
      const needed = waitFor === 'all' ? state.playerCount
                   : waitFor === 'majority' ? Math.floor(state.playerCount/2)+1
                   : 1; // 'first'
      const pending = state.players.map(p => p.idx);
      state.meta = state.meta || {};
      state.meta['barrier_'+node.id] = { arrived: [], needed };
      if (timeoutMs > 0) {
        const deadline = Date.now() + timeoutMs;
        const pending_action = {
          type: 'BARRIER', nodeId: node.id,
          players: pending, needed, deadline,
          on_timeout: node.config.on_timeout || 'auto_submit',
        };
        return wait(pending_action);
      }
      return wait({
        type: 'BARRIER', nodeId: node.id,
        players: pending, needed, deadline: 0,
        on_timeout: 'auto_submit',
      });
    }

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

  if (pending.type === 'BARRIER') {
    const meta = state.meta?.['barrier_'+pending.nodeId] || { arrived: [], needed: state.playerCount };
    if (!meta.arrived.includes(playerIdx)) meta.arrived.push(playerIdx);
    state.meta['barrier_'+pending.nodeId] = meta;
    if (meta.arrived.length >= meta.needed) {
      // Quorum reached — advance
      state.pendingAction = null;
      const node = state.graph.nodes.get(pending.nodeId);
      const edges = node?.outputs.get('next') || [];
      for (const e of edges) {
        const next = state.graph.nodes.get(e.nodeId);
        if (next) traverse(state, next, e.inPort || 'in');
      }
    } else {
      // Not everyone here yet — update pending
      state.pendingAction = { ...pending, arrived: meta.arrived };
    }
    broadcastAll(lobby);
    return;
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
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
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

  // /play/percebes → dedicated Percebes client
  if (url === '/play/percebes' || url === '/play/percebes/') {
    fs.readFile(path.join(PUB_DIR, 'percebes.html'), (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }
  // /play/capivaras → dedicated Capivaras client
  if (url === '/play/capivaras' || url === '/play/capivaras/') {
    fs.readFile(path.join(PUB_DIR, 'capivaras.html'), (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }
  // /play/:gameId → generic play.html
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
const wss = new WebSocketServer({ noServer: true });
const capWss = { get clients() { return [...wss.clients].filter(w=>w._isCap); } }; // alias

wss.on('connection', (ws, req) => {
  // Route: percebes connections
  if (ws._isPerc) {
    pbSend(ws, { type:'LOBBIES', lobbies: Object.values(PERC_LOBBIES).map(pbLobbyInfo) });
    ws.on('message', raw => { try { pbHandle(ws, JSON.parse(raw)); } catch {} });
    ws.on('close', () => {
      const st = PERC_WS_STATE.get(ws); if (!st||!st.lobbyId) return;
      const lobby = PERC_LOBBIES[st.lobbyId]; if (!lobby) return;
      const {seat} = st;
      lobby.players[seat] = null;
      lobby.players.forEach(p=>{ if(p) pbSend(p,{type:'OPPONENT_DISCONNECTED',seat,name:lobby.names[seat]}); });
      pbBroadcastLobbies();
      lobby.graceTimers[seat] = setTimeout(() => {
        lobby.names[seat]=''; lobby.tokens[seat]=null;
        const g=lobby.game;
        if(g&&g.phase!=='GAME_OVER'){
          const rem=lobby.seatMap?lobby.seatMap.filter(li=>lobby.players[li]).length:lobby.players.filter(Boolean).length;
          if(rem<2) pbEndGame(lobby);
        }
        pbBroadcastLobbies();
      }, 45000);
    });
    ws.on('error',()=>{});
    return;
  }
  // Route: capivaras connections go to dedicated handler
  if (ws._isCap) {
    capSend(ws, { type:'LOBBIES', lobbies: Object.values(CAP_LOBBIES).map(capLobbyInfo) });
    ws.on('message', raw => { try { capHandle(ws, JSON.parse(raw)); } catch {} });
    ws.on('close', () => {
      const st = CAP_WS_STATE.get(ws); if (!st||!st.lobbyId) return;
      const lobby = CAP_LOBBIES[st.lobbyId]; if (!lobby) return;
      const {seat} = st;
      lobby.players[seat] = null;
      lobby.players.forEach(p=>{ if(p) capSend(p,{type:'OPPONENT_DISCONNECTED',seat,name:lobby.names[seat],graceMs:45000}); });
      capBroadcastLobbies();
      const g=lobby.game;
      if(g&&g.phase==='BETTING'){
        const gs=capFindGs(lobby,seat);
        if(gs!==-1&&g.bets[gs]===null){
          const gen=g.turnGen;
          lobby.autoTimers[seat]=setTimeout(()=>{
            if(!lobby.game||lobby.game.turnGen!==gen||g.bets[gs]!==null)return;
            g.bets[gs]=Math.floor(Math.random()*g.n);capBroadcast(lobby);capCheckBets(lobby);
          },10000);
        }
      }
      lobby.graceTimers[seat]=setTimeout(()=>capHardLeave(lobby,seat),45000);
    });
    ws.on('error',()=>{});
    return;
  }
  // Generic BGE game connection
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


// ── CAPIVARAS EMBEDDED GAME ───────────────────────────────────────
// Full Capivaras game logic runs in-process, handling /ws/capivaras
const CAP_LOBBIES  = {};
const CAP_SESSIONS = {};
const CAP_WS_STATE = new WeakMap();

function capMkCard(cap, lilies, bird, imgOverride) {
  const l = [...lilies].sort().join('');
  const img = imgOverride || ('cap' + cap + (l ? '_' + l : '') + (bird ? '_bird' : ''));
  const fallback = 'cap' + cap;
  return { cap, lilies:[...lilies], bird, img, fallback };
}
const CAP_DECK = [
  capMkCard(1,[],false),capMkCard(1,[],false),capMkCard(1,['R'],false),capMkCard(1,['R'],false),
  capMkCard(1,['B','W'],false),capMkCard(1,['W'],true),
  capMkCard(2,[],false),capMkCard(2,[],false),capMkCard(2,[],false),capMkCard(2,[],false),
  capMkCard(2,[],false),capMkCard(2,[],false),capMkCard(2,['Y'],false),capMkCard(2,['Y'],false),
  capMkCard(2,['B'],false),capMkCard(2,['Y'],true),capMkCard(2,['R'],true),
  capMkCard(2,[],true),capMkCard(2,[],true),
  capMkCard(3,[],false),capMkCard(3,[],false),capMkCard(3,[],false),capMkCard(3,[],false),
  capMkCard(3,[],false),capMkCard(3,[],false),capMkCard(3,['Y'],false),
  capMkCard(3,['B'],false),capMkCard(3,['B'],false),capMkCard(3,[],true),capMkCard(3,[],true),
  capMkCard(4,[],false),capMkCard(4,[],false),capMkCard(4,[],true),capMkCard(4,[],true),
  capMkCard(5,[],false),capMkCard(5,[],true,'cap5'),  // cap5_bird missing → fallback
];
function capShuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
function capMakeLobby(id,name,solo,maxH){
  const n=solo?1:maxH;
  return{id,name,solo,maxH,players:new Array(n).fill(null),names:new Array(n).fill(''),
    tokens:new Array(n).fill(null),graceTimers:new Array(n).fill(null),
    autoTimers:new Array(n).fill(null),seatMap:null,game:null};
}
for(let i=1;i<=5;i++) CAP_LOBBIES['mp'+i]=capMakeLobby('mp'+i,'Mesa '+i,false,6);
CAP_LOBBIES['solo']=capMakeLobby('solo','Solo (vs 2 Bots)',true,1);

function capNewGame(names,isSolo){
  const n=names.length, deck=capShuffle(CAP_DECK);
  return{players:names.map(name=>({name,scored:[],birdCards:0})),n,deck,discard:[],
    table:deck.splice(0,n),bets:new Array(n).fill(null),birdHolder:null,
    phase:'BETTING',deckPass:0,lastResult:null,isSolo,turnGen:0,winnerIdx:null,finalScores:null};
}
function capScores(g){
  return g.players.map((p,i)=>{
    let pts=0;const lilies=new Set();
    for(const c of p.scored){pts+=c.cap;c.lilies.forEach(l=>lilies.add(l));}
    if(i===g.birdHolder)pts+=5;
    const allLilies=['Y','R','W','B'].every(c=>lilies.has(c));
    if(allLilies)pts+=10;
    return{name:p.name,pts,scored:p.scored,lilies:[...lilies],birdCards:p.birdCards,hasBird:i===g.birdHolder,allLilies};
  });
}
function capView(g,seat){
  const sc=capScores(g);
  return{phase:g.phase,n:g.n,table:g.table,myBet:g.bets[seat],betsPlaced:g.bets.map(b=>b!==null),
    lastResult:g.lastResult?{winners:g.lastResult.winners,birdUpdate:g.lastResult.birdUpdate,bets:g.lastResult.bets}:null,
    players:sc.map((s,i)=>({...s,isMe:i===seat,seat:i})),birdHolder:g.birdHolder,
    birdHolderCards:g.birdHolder!==null?g.players[g.birdHolder].birdCards:0,
    deckPass:g.deckPass,deckLeft:g.deck.length,winnerIdx:g.winnerIdx,finalScores:g.finalScores,
    mySeat:seat,isSolo:g.isSolo,myBirdCards:g.players[seat].birdCards,turnGen:g.turnGen};
}
function capSend(ws,msg){if(ws?.readyState===1)ws.send(JSON.stringify(msg));}
function capBroadcast(lobby){
  const g=lobby.game;if(!g)return;
  if(lobby.solo){capSend(lobby.players[0],{type:'GAME_STATE',state:capView(g,0)});}
  else if(lobby.seatMap){lobby.seatMap.forEach((ls,gs)=>{if(lobby.players[ls])capSend(lobby.players[ls],{type:'GAME_STATE',state:capView(g,gs)});});}
}
function capLobbyInfo(l){
  const seated=l.players.filter(Boolean).length;
  const playing=!!l.game&&l.game.phase!=='GAME_OVER';
  return{id:l.id,name:l.name,solo:l.solo,seated,maxH:l.maxH,playing,
    full:l.solo?false:seated>=l.maxH,  // solo never full — always joinable
    names:l.names.filter(Boolean)};}
function capBroadcastLobbies(){
  const list=Object.values(CAP_LOBBIES).map(capLobbyInfo);
  for(const ws of wss.clients){if(!ws._isCap)continue;if(ws.readyState!==1)continue;const st=CAP_WS_STATE.get(ws);if(!st||!st.lobbyId)capSend(ws,{type:'LOBBIES',lobbies:list});}
}
function capCheckBets(lobby){const g=lobby.game;if(!g||g.phase!=='BETTING')return;if(g.bets.every(b=>b!==null))capResolve(lobby);}
function capResolve(lobby){
  const g=lobby.game;
  const betCount=new Array(g.n).fill(0),betBySeat=new Array(g.n).fill(-1);
  g.bets.forEach((bet,seat)=>{if(bet!==null){betCount[bet]++;betBySeat[bet]=seat;}});
  const result={bets:[...g.bets],winners:{},birdUpdate:null};
  g.table.forEach((card,pos)=>{
    if(betCount[pos]===1){const seat=betBySeat[pos];g.players[seat].scored.push({...card,lilies:[...card.lilies]});result.winners[pos]=seat;if(card.bird)g.players[seat].birdCards++;}
  });
  const prev=g.birdHolder;
  if(prev===null){
    const bw=Object.entries(result.winners).filter(([pos])=>g.table[pos].bird).map(([,s])=>s);
    if(bw.length===1){g.birdHolder=bw[0];result.birdUpdate={type:'first',seat:bw[0],name:g.players[bw[0]].name};}
    else if(bw.length>1){result.birdUpdate={type:'tie_first',names:bw.map(s=>g.players[s].name)};}
  } else {
    const hc=g.players[prev].birdCards;
    const thieves=g.players.reduce((acc,p,i)=>{if(i!==prev&&p.birdCards>hc)acc.push(i);return acc;},[]);
    if(thieves.length===1){g.birdHolder=thieves[0];result.birdUpdate={type:'steal',seat:thieves[0],from:prev,name:g.players[thieves[0]].name,fromName:g.players[prev].name};}
    else if(thieves.length>1){result.birdUpdate={type:'tie_steal',names:thieves.map(s=>g.players[s].name)};}
  }
  g.discard.push(...g.table.map(c=>({...c,lilies:[...c.lilies]})));
  g.lastResult=result;g.phase='REVEAL';g.turnGen++;
  lobby.autoTimers.forEach((t,i)=>{if(t){clearTimeout(t);lobby.autoTimers[i]=null;}});
  capBroadcast(lobby);
  const gen=g.turnGen;
  setTimeout(()=>{if(!lobby.game||lobby.game.turnGen!==gen||lobby.game.phase!=='REVEAL')return;capNextRound(lobby);},5000);
}
function capNextRound(lobby){
  const g=lobby.game;
  if(g.deck.length<g.n){
    if(g.deckPass===0){g.deck.push(...capShuffle(g.discard));g.discard=[];g.deckPass=1;}
    else{capEndGame(lobby);return;}
  }
  if(g.deck.length<g.n){capEndGame(lobby);return;}
  g.table=g.deck.splice(0,g.n);g.bets=new Array(g.n).fill(null);
  g.lastResult=null;g.phase='BETTING';g.turnGen++;
  capBroadcast(lobby);
  if(g.isSolo)capBots(lobby);
  // multiplayer: no auto-bet, players choose freely
}
function capEndGame(lobby){
  const g=lobby.game;g.phase='GAME_OVER';g.finalScores=capScores(g);
  const max=Math.max(...g.finalScores.map(s=>s.pts));
  g.winnerIdx=g.finalScores.findIndex(s=>s.pts===max);
  capBroadcast(lobby);capBroadcastLobbies();
}
function capBotScore(card, bot) {
  // Bot 1: "Caçador de pontos" — prefere cartas com mais capivaras
  // Bot 2: "Coleccionador" — prefere nenúfares e pássaros
  if (bot === 1) {
    return card.cap * 3 + (card.bird ? 1 : 0) + card.lilies.length * 0.5;
  } else {
    return card.cap * 1 + (card.bird ? 4 : 0) + card.lilies.length * 2.5;
  }
}

function capBots(lobby){
  const g=lobby.game;if(!g||!g.isSolo||g.phase!=='BETTING')return;
  const gen=g.turnGen;
  [1,2].forEach(bot=>{
    if(g.bets[bot]!==null)return;
    // Asymmetric timing: bot1 faster, bot2 slower
    const delay = bot===1 ? 600+Math.random()*800 : 1400+Math.random()*1200;
    setTimeout(()=>{
      if(!lobby.game||lobby.game.turnGen!==gen||g.phase!=='BETTING'||g.bets[bot]!==null)return;
      // Score each card by this bot's playstyle
      const scored = g.table.map((c,i) => ({i, s: capBotScore(c, bot)}));
      // Add randomness: weighted random pick from top cards
      scored.sort((a,b) => b.s - a.s);
      // 70% pick best, 20% pick 2nd, 10% pick random — avoids always same choice
      const rand = Math.random();
      let pick;
      if (rand < 0.68 || scored.length === 1) pick = scored[0];
      else if (rand < 0.88 && scored.length >= 2) pick = scored[1];
      else pick = scored[Math.floor(Math.random() * scored.length)];
      // Avoid picking same as human (bot tries to be smart)
      const humanBet = g.bets[0];
      if (pick.i === humanBet && scored.length > 1) {
        pick = scored.find(s => s.i !== humanBet) || pick;
      }
      // Bots also try not to clash with each other
      const otherBot = bot === 1 ? 2 : 1;
      if (g.bets[otherBot] !== null && pick.i === g.bets[otherBot] && scored.length > 1) {
        pick = scored.find(s => s.i !== g.bets[otherBot] && s.i !== humanBet)
             || scored.find(s => s.i !== g.bets[otherBot])
             || pick;
      }
      g.bets[bot]=pick.i;capBroadcast(lobby);capCheckBets(lobby);
    }, delay);
  });
}
function capAutoBeats(lobby){
  const g=lobby.game;if(!g||g.isSolo||g.phase!=='BETTING')return;
  const gen=g.turnGen;
  g.bets.forEach((bet,seat)=>{
    if(bet!==null||lobby.autoTimers[seat])return;
    lobby.autoTimers[seat]=setTimeout(()=>{
      if(!lobby.game||lobby.game.turnGen!==gen||g.bets[seat]!==null)return;
      g.bets[seat]=Math.floor(Math.random()*g.n);capBroadcast(lobby);capCheckBets(lobby);
    },10000);
  });
}
function capFindGs(lobby,ls){return lobby.seatMap?lobby.seatMap.indexOf(ls):ls;}
function capHardLeave(lobby,seat){
  lobby.players[seat]=null;lobby.names[seat]='';lobby.tokens[seat]=null;
  const g=lobby.game;
  if(g&&g.phase!=='GAME_OVER'){
    const rem=lobby.seatMap?lobby.seatMap.filter(li=>lobby.players[li]).length:lobby.players.filter(Boolean).length;
    if(rem<2)capEndGame(lobby);
  }
  capBroadcastLobbies();
}
function capHandle(ws,msg){
  if(msg.type==='PING'){capSend(ws,{type:'PONG'});return;}
  if(msg.type==='LOBBIES'){capSend(ws,{type:'LOBBIES',lobbies:Object.values(CAP_LOBBIES).map(capLobbyInfo)});return;}
  if(msg.type==='RECONNECT'){
    const sess=CAP_SESSIONS[msg.token];
    if(!sess){capSend(ws,{type:'RECONNECT_FAIL'});return;}
    const lobby=CAP_LOBBIES[sess.lobbyId];if(!lobby){capSend(ws,{type:'RECONNECT_FAIL'});return;}
    const{seat,name}=sess;
    clearTimeout(lobby.graceTimers[seat]);lobby.graceTimers[seat]=null;
    lobby.players[seat]=ws;lobby.names[seat]=name;
    const gs=lobby.seatMap?lobby.seatMap.indexOf(seat):seat;
    CAP_WS_STATE.set(ws,{lobbyId:sess.lobbyId,seat,gameSeat:gs,token:msg.token});
    capSend(ws,{type:'RECONNECTED',seat,gameSeat:gs,name,solo:lobby.solo});
    capBroadcastLobbies();
    if(lobby.game)capBroadcast(lobby);
    else capSend(ws,{type:'LOBBY_STATE',lobby:capLobbyInfo(lobby),names:lobby.names,myLobbySeat:seat});
    return;
  }
  if(msg.type==='JOIN_LOBBY'){
    const lobby=CAP_LOBBIES[msg.lobbyId];
    if(!lobby){capSend(ws,{type:'ERROR',text:'Mesa não encontrada.'});return;}
    if(!lobby.solo&&lobby.game&&lobby.game.phase!=='GAME_OVER'){capSend(ws,{type:'ERROR',text:'Jogo em curso.'});return;}
    const seat=lobby.players.findIndex(p=>p===null);
    if(seat===-1){capSend(ws,{type:'ERROR',text:'Mesa cheia.'});return;}
    const name=(msg.playerName||'').trim().slice(0,20)||'Jogador';
    const token=Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
    lobby.players[seat]=ws;lobby.names[seat]=name;lobby.tokens[seat]=token;
    CAP_WS_STATE.set(ws,{lobbyId:msg.lobbyId,seat,gameSeat:seat,token});
    CAP_SESSIONS[token]={lobbyId:msg.lobbyId,seat,name};
    capSend(ws,{type:'JOINED',seat,token,lobbyId:msg.lobbyId,solo:lobby.solo,name,lobby:capLobbyInfo(lobby),names:lobby.names});
    lobby.players.forEach((p,i)=>{if(p&&i!==seat)capSend(p,{type:'PLAYER_JOINED',seat,name,lobby:capLobbyInfo(lobby)});});
    capBroadcastLobbies();
    if(lobby.solo){
      const s=CAP_WS_STATE.get(ws);if(s)s.gameSeat=0;
      lobby.game=capNewGame([name,'Bot 1','Bot 2'],true);
      capBroadcast(lobby);capBots(lobby);
    }
    return;
  }
  const st=CAP_WS_STATE.get(ws);if(!st||!st.lobbyId)return;
  const lobby=CAP_LOBBIES[st.lobbyId];if(!lobby)return;
  const ls=st.seat,g=lobby.game;
  if(msg.type==='LEAVE_LOBBY'){capHardLeave(lobby,ls);CAP_WS_STATE.delete(ws);capSend(ws,{type:'LOBBIES',lobbies:Object.values(CAP_LOBBIES).map(capLobbyInfo)});return;}
  if(msg.type==='REQUEST_STATE'){
    if(g)capSend(ws,{type:'GAME_STATE',state:capView(g,capFindGs(lobby,ls))});
    else capSend(ws,{type:'LOBBY_STATE',lobby:capLobbyInfo(lobby),names:lobby.names,myLobbySeat:ls});return;
  }
  if(msg.type==='START'){
    if(lobby.solo||ls!==0||(g&&g.phase!=='GAME_OVER'))return;
    const active=lobby.players.map((p,i)=>p?i:-1).filter(i=>i>=0);
    if(active.length<2){capSend(ws,{type:'ERROR',text:'Precisas de pelo menos 2 jogadores.'});return;}
    lobby.seatMap=active;lobby.game=capNewGame(active.map(i=>lobby.names[i]),false);
    active.forEach((li,gi)=>{const w=lobby.players[li];if(w){const s=CAP_WS_STATE.get(w);if(s)s.gameSeat=gi;}});
    capBroadcast(lobby);capBroadcastLobbies();return;  // no auto-bet: players must choose
  }
  if(msg.type==='BET'){
    if(!g||g.phase!=='BETTING'){if(g)capSend(ws,{type:'GAME_STATE',state:capView(g,capFindGs(lobby,ls))});return;}
    const gs=capFindGs(lobby,ls);if(gs===-1)return;
    const pos=parseInt(msg.position);if(isNaN(pos)||pos<0||pos>=g.n||g.bets[gs]!==null)return;
    g.bets[gs]=pos;capBroadcast(lobby);capCheckBets(lobby);return;
  }
  if(msg.type==='RESTART'){
    if(!g||g.phase!=='GAME_OVER')return;
    if(lobby.solo){const s=CAP_WS_STATE.get(ws);if(s)s.gameSeat=0;lobby.game=capNewGame([lobby.names[0]||'Jogador','Bot 1','Bot 2'],true);capBroadcast(lobby);capBots(lobby);}
    else{if(ls!==0)return;const active=lobby.players.map((p,i)=>p?i:-1).filter(i=>i>=0);if(active.length<2)return;
      lobby.seatMap=active;lobby.game=capNewGame(active.map(i=>lobby.names[i]),false);
      active.forEach((li,gi)=>{const w=lobby.players[li];if(w){const s=CAP_WS_STATE.get(w);if(s)s.gameSeat=gi;}});
      capBroadcast(lobby);}
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Bitnik] Server on http://0.0.0.0:${PORT}`);
  console.log(`[Bitnik] Games: ${Object.keys(GAME_REGISTRY).join(', ') || 'none'}`);
});

// ALL WebSocket upgrades routed here — single wss, path-based routing
server.on('upgrade', (req, socket, head) => {
  const urlPath = (req.url || '').split('?')[0];
  wss.handleUpgrade(req, socket, head, ws => {
    ws._isCap  = (urlPath === '/ws/capivaras');
    ws._isPerc = (urlPath === '/ws/percebes');
    wss.emit('connection', ws, req);
  });
});

setInterval(() => {
  for (const ws of wss.clients) if (ws.readyState === 1) ws.ping();
}, 25000);

// ── Serve /play/:gameId → play.html ──────────────────────────────
// Note: this is already handled by the SPA fallback above,
// but we add explicit routing for clarity.
// The play.html reads gameKey from location.pathname client-side.

// ═══════════════════════════════════════════════════════════════════
//  PRAIA DAS PERCEBES — Servidor embebido
//  Tile placement 7×7, salva-vidas, objectivos, fichas
// ═══════════════════════════════════════════════════════════════════
const PERC_LOBBIES  = {};
const PERC_SESSIONS = {};
const PERC_WS_STATE = new WeakMap();

// ── Board helpers ─────────────────────────────────────────────────
function pbGet(board,r,c){return board[`${r},${c}`]||null;}
function pbSet(board,r,c,tile){board[`${r},${c}`]=tile;}
function pbKeys(board){return Object.keys(board).map(k=>{const[r,c]=k.split(',');return{r:+r,c:+c};});}

function pbCanPlace(board,r,c){
  if(pbGet(board,r,c))return false;
  const occ=pbKeys(board);
  if(occ.length===0)return true;
  // must be orthogonally adjacent
  if(!occ.some(p=>(p.r===r&&Math.abs(p.c-c)===1)||(p.c===c&&Math.abs(p.r-r)===1)))return false;
  // max 7 in any row or col
  if(occ.filter(p=>p.r===r).length>=7)return false;
  if(occ.filter(p=>p.c===c).length>=7)return false;
  return true;
}

function pbValidPlacements(board){
  const occ=pbKeys(board);
  const cands=new Set();
  for(const p of occ){
    for(const n of [{r:p.r-1,c:p.c},{r:p.r+1,c:p.c},{r:p.r,c:p.c-1},{r:p.r,c:p.c+1}])
      cands.add(`${n.r},${n.c}`);
  }
  return [...cands].filter(k=>{const[r,c]=k.split(',');return pbCanPlace(board,+r,+c);}).map(k=>{const[r,c]=k.split(',');return{r:+r,c:+c};});
}

function pbGetAvailGuardDirs(guards,r,c){
  const usedH=guards.some(g=>g.r===r&&g.dir==='h');
  const usedV=guards.some(g=>g.c===c&&g.dir==='v');
  return{h:!usedH,v:!usedV};
}

function pbCountSegment(board,r,c,dir){
  const key=dir==='h'?'c':'r';
  const fixed=dir==='h'?r:c;
  const pos=dir==='h'?c:r;
  const cells=[];
  for(let i=pos-1;;i--){
    const t=dir==='h'?pbGet(board,fixed,i):pbGet(board,i,fixed);
    if(!t)break; if(t.type==='rock')break; cells.unshift({t,i}); }
  const self=pbGet(board,r,c);
  if(self&&self.type!=='rock') cells.push({t:self,i:pos});
  for(let i=pos+1;;i++){
    const t=dir==='h'?pbGet(board,fixed,i):pbGet(board,i,fixed);
    if(!t)break; if(t.type==='rock')break; cells.push({t,i}); }
  // Surf tiles multiply total bathers x2 each
  let multiplier=1;
  for(const{t} of cells) if(t.type==='surf') multiplier*=2;
  let total=0;
  for(const{t} of cells) total+=t.bathers;
  return total*multiplier;
}

function pbComputeFinalScores(g){
  // Guard pts already awarded live when placed — only add fichas + obj bonuses
  for(const p of g.players){ p.pts+=p.fichas*2; p.pts+=p.objPts; }
}

// ── Deck & Objectives ─────────────────────────────────────────────
function pbBuildDeck(n){
  const tiles=[]; let id=1;
  for(let i=0;i<8; i++) tiles.push({id:id++,bathers:1,type:'normal',v:i+1});
  for(let i=0;i<12;i++) tiles.push({id:id++,bathers:2,type:'normal',v:i+1});
  for(let i=0;i<6; i++) tiles.push({id:id++,bathers:3,type:'normal',v:i+1});
  for(let i=0;i<4; i++) tiles.push({id:id++,bathers:1,type:'surf',  v:i+1});
  for(let i=0;i<2; i++) tiles.push({id:id++,bathers:0,type:'rock',  v:i+1});
  for(let i=0;i<12;i++) tiles.push({id:id++,bathers:0,type:'sand',  v:i+1});
  for(let i=tiles.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[tiles[i],tiles[j]]=[tiles[j],tiles[i]];}
  return tiles.slice(0,n===3?42:44);
}

function pbBuildObjectives(){
  // Original 8 objectives — pick 5 at random each game
  const all=[
    {id:'obj1',descPt:'Quadrado 3×3 (9 tiles)',              descEn:'3×3 square (9 tiles)',          pts:2,type:'square3'},
    {id:'obj2',descPt:'Linha de 5 tiles',                    descEn:'Row of 5 tiles',                pts:4,type:'row5'},
    {id:'obj3',descPt:'Linha de 7 tiles',                    descEn:'Row of 7 tiles',                pts:6,type:'row7'},
    {id:'obj4',descPt:'Quadrado 5×5 (25 tiles)',             descEn:'5×5 square (25 tiles)',         pts:2,type:'square5'},
    {id:'obj5',descPt:'Coluna de 5 tiles',                   descEn:'Column of 5 tiles',             pts:4,type:'col5'},
    {id:'obj6',descPt:'Coluna de 7 tiles',                   descEn:'Column of 7 tiles',             pts:6,type:'col7'},
    {id:'obj7',descPt:'2 Pranchas adjacentes',               descEn:'2 adjacent surfboards',         pts:4,type:'surf2adj'},
    {id:'obj8',descPt:'Excursão (2×2 tiles com 3 banhistas)',descEn:'Excursion (2×2 tiles, 3 each)', pts:6,type:'excursion'},
  ];
  for(let i=all.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[all[i],all[j]]=[all[j],all[i]];}
  return all.slice(0,5);
}

function pbCheckObjectives(g,playerIdx){
  const claimed=[];
  if(!g._objSnapshots) g._objSnapshots={};
  for(const obj of g.revealedObjs){
    if(obj.claimedBy!==undefined) continue;
    // Snapshot-based: only count progress after obj became active
    const snapTile=g._objSnapshots[obj.id]||0;
    const boardSinceActive=pbBoardSince(g.board,snapTile);
    if(pbEvalObj(boardSinceActive,obj,g)){
      obj.claimedBy=playerIdx;
      g.players[playerIdx].objPts+=obj.pts;
      g.players[playerIdx].pts+=obj.pts;  // live pts for objectives too
      claimed.push(obj);
      if(g.remainingObjs.length>0){
        const next=g.remainingObjs.shift();
        // Snapshot: record how many tiles are on board when obj becomes active
        g._objSnapshots[next.id]=Object.keys(g.board).length;
        g.revealedObjs.push(next);
      }
    }
  }
  return claimed;
}

// Returns a board view containing only tiles placed AFTER tileCount tiles existed
function pbBoardSince(board,tileCount){
  // Since we don't timestamp tiles, we use the full board for count-based objs
  // and the full board for positional objs (acceptable simplification)
  return board;
}

function pbEvalObj(board,obj,g){
  const occ=pbKeys(board);
  switch(obj.type){
    case 'square3': {
      const rs=[...new Set(occ.map(p=>p.r))];
      for(const r of rs) for(const c of [...new Set(occ.map(p=>p.c))]) {
        if([0,1,2].every(dr=>[0,1,2].every(dc=>pbGet(board,r+dr,c+dc)))) return true;
      } return false;
    }
    case 'square5': {
      const rs=[...new Set(occ.map(p=>p.r))];
      for(const r of rs) for(const c of [...new Set(occ.map(p=>p.c))]) {
        let ok=true;
        outer: for(let dr=0;dr<5;dr++) for(let dc=0;dc<5;dc++) {
          if(!pbGet(board,r+dr,c+dc)){ok=false;break outer;}
        }
        if(ok) return true;
      } return false;
    }
    case 'row5':  return [...new Set(occ.map(p=>p.r))].some(r=>occ.filter(p=>p.r===r).length>=5);
    case 'row7':  return [...new Set(occ.map(p=>p.r))].some(r=>occ.filter(p=>p.r===r).length>=7);
    case 'col5':  return [...new Set(occ.map(p=>p.c))].some(c=>occ.filter(p=>p.c===c).length>=5);
    case 'col7':  return [...new Set(occ.map(p=>p.c))].some(c=>occ.filter(p=>p.c===c).length>=7);
    case 'surf2adj': {
      const surfs=occ.filter(p=>{const t=pbGet(board,p.r,p.c);return t&&t.type==='surf';});
      return surfs.some(a=>surfs.some(b=>a!==b&&((Math.abs(a.r-b.r)===1&&a.c===b.c)||(Math.abs(a.c-b.c)===1&&a.r===b.r))));
    }
    case 'excursion': {
      for(const p of occ) {
        const cells=[[0,0],[0,1],[1,0],[1,1]];
        if(cells.every(([dr,dc])=>{const t=pbGet(board,p.r+dr,p.c+dc);return t&&t.bathers>=1;})) return true;
      } return false;
    }
    case 'same5': {
      for(const type of ['normal','surf','rock','sand']){
        const typed=occ.filter(p=>{const t=pbGet(board,p.r,p.c);return t&&t.type===type;});
        const rows=[...new Set(typed.map(p=>p.r))];
        const cols=[...new Set(typed.map(p=>p.c))];
        if(rows.some(r=>typed.filter(p=>p.r===r).length>=5)) return true;
        if(cols.some(c=>typed.filter(p=>p.c===c).length>=5)) return true;
      } return false;
    }
    default: return false;
  }
}

// ── Game factory ─────────────────────────────────────────────────
function pbNewGame(names,isSolo){
  const n=names.length;
  const deck=pbBuildDeck(n);
  const allObjs=pbBuildObjectives();
  // 5 objectives total, start with 3 visible, reveal next when one claimed
  const objs=allObjs.slice(0,5);  // pick 5
  const fichasByN={2:6,3:5,4:4};
  const fichas=fichasByN[n]||6;
  const board={};
  pbSet(board,0,0,{id:0,bathers:1,type:'normal',v:1}); // starting tile
  return{
    players:names.map(name=>({name,pts:0,guards:[],fichas,objPts:0})),
    n, deck, totalDeck:deck.length, board,
    guards:[], guardIdSeq:1,
    revealedObjs:objs.slice(0,3), remainingObjs:objs.slice(3), claimedObjs:[],
    // Each obj tracks a snapshot of the board when it became active
    _objSnapshots: { [objs[0].id]: 0, [objs[1].id]: 0, [objs[2].id]: 0 },
    phase:'PLACE_TILE', currentPlayer:0,
    drawnTile:null, extraTurns:null,
    turnGen:0, isSolo, lastAction:null,
    winnerIdx:null, finalScores:null,
  };
}

// ── Visibility framework ─────────────────────────────────────────
// Three visibility levels for any piece of game state:
//   PUBLIC   — all players see the real value (board, scores, guards)
//   HIDDEN   — other players see only {hidden:true}, owner sees real value
//   SECRET   — only owner sees it; others see nothing (or a masked count)
//
// Usage: pbVisible(value, ownerSeat, viewerSeat, level)
function pbVisible(value, ownerSeat, viewerSeat, level='public') {
  if (level === 'public')  return value;
  if (level === 'hidden')  return ownerSeat === viewerSeat ? value : { hidden: true };
  if (level === 'secret')  return ownerSeat === viewerSeat ? value : null;
  return value;
}

// Filter player data by visibility:
//   name, pts, fichas, objPts → PUBLIC
//   drawnTile → HIDDEN (others know you drew, but not what)
//   hand cards (future) → SECRET
function pbPlayerView(player, playerIdx, viewerSeat) {
  return {
    name:   player.name,          // public
    pts:    player.pts,           // public
    fichas: player.fichas,        // public (count of remaining tokens)
    objPts: player.objPts,        // public at game end; could be hidden mid-game
  };
}

function pbBuildView(g,seat){
  const boardArr=Object.entries(g.board).map(([k,t])=>{
    const[r,c]=k.split(',');return{r:+r,c:+c,...t};});
  let avGuardDirs=null;
  if(g.phase==='PLACE_GUARD'&&g.currentPlayer===seat&&g.drawnTile){
    const{r,c}=g.drawnTile._placedAt||{};
    if(r!==undefined){
      const t=pbGet(g.board,r,c);
      avGuardDirs=(t&&t.type!=='rock')?pbGetAvailGuardDirs(g.guards,r,c):{h:false,v:false};
    }
  }
  return{
    mySeat:seat,
    players:g.players.map((p,i)=>pbPlayerView(p,i,seat)),
    n:g.n, board:boardArr, guards:g.guards,
    phase:g.phase, currentPlayer:g.currentPlayer,
    drawnTile:pbVisible(g.drawnTile, g.currentPlayer, seat, 'hidden'),
    validPlacements:g.currentPlayer===seat&&g.phase==='PLACE_TILE'?pbValidPlacements(g.board):[],
    deckSize:g.deck.length, totalDeck:g.totalDeck,
    revealedObjs:g.revealedObjs, claimedObjs:g.claimedObjs,
    availableGuardDirs:avGuardDirs,
    turnGen:g.turnGen, isSolo:g.isSolo,
    lastAction:g.lastAction,
    winnerIdx:g.winnerIdx, finalScores:g.finalScores,
  };
}

function pbSend(ws,msg){if(ws?.readyState===1)ws.send(JSON.stringify(msg));}
function pbBroadcast(lobby){
  const g=lobby.game;if(!g)return;
  if(lobby.solo) pbSend(lobby.players[0],{type:'GAME_STATE',state:pbBuildView(g,0)});
  else if(lobby.seatMap) lobby.seatMap.forEach((ls,gs)=>{
    if(lobby.players[ls]) pbSend(lobby.players[ls],{type:'GAME_STATE',state:pbBuildView(g,gs)});
  });
}

function pbLobbyInfo(l){
  return{id:l.id,name:l.name,solo:l.solo,seated:l.players.filter(Boolean).length,
    maxH:l.maxH,playing:!!l.game&&l.game.phase!=='GAME_OVER',
    full:l.solo?false:l.players.filter(Boolean).length>=l.maxH,
    names:l.names.filter(Boolean)};
}
function pbBroadcastLobbies(){
  const list=Object.values(PERC_LOBBIES).map(pbLobbyInfo);
  for(const ws of wss.clients){
    if(!ws._isPerc||ws.readyState!==1)continue;
    const st=PERC_WS_STATE.get(ws);
    if(!st||!st.lobbyId) pbSend(ws,{type:'LOBBIES',lobbies:list});
  }
}
function pbMakeLobby(id,name,solo,maxH){
  const n=solo?1:maxH;
  return{id,name,solo,maxH,players:new Array(n).fill(null),names:new Array(n).fill(''),
    tokens:new Array(n).fill(null),graceTimers:new Array(n).fill(null),seatMap:null,game:null};
}
for(let i=1;i<=4;i++) PERC_LOBBIES['mp'+i]=pbMakeLobby('mp'+i,'Mesa '+i,false,4);
PERC_LOBBIES['solo']=pbMakeLobby('solo','Solo (vs Bots)',true,1);

// ── Turn logic ────────────────────────────────────────────────────
function pbDrawAndStart(lobby){
  const g=lobby.game;
  const tile=g.deck.shift();
  if(!tile){pbEndGame(lobby);return;}
  g.drawnTile=tile;
  g.phase='PLACE_TILE';
  pbBroadcast(lobby);
  if(g.isSolo&&g.currentPlayer!==0) pbBotTurn(lobby);
}

function pbAdvanceTurn(lobby){
  const g=lobby.game;
  // check extra turns
  if(g.extraTurns){
    const rem=g.extraTurns.filter(i=>i!==g.currentPlayer);
    if(rem.length>0){g.extraTurns=rem;g.currentPlayer=rem[0];pbDrawAndStart(lobby);return;}
    else{pbEndGame(lobby);return;}
  }
  g.currentPlayer=(g.currentPlayer+1)%g.n;
  g.turnGen++;
  // check if fichas depleted → extra turns
  if(g.players.every(p=>p.fichas===0)&&!g.extraTurns){
    const initiator=g.currentPlayer;
    const others=Array.from({length:g.n},(_,i)=>i).filter(i=>i!==initiator);
    g.extraTurns=others;
    pbBroadcast(lobby);
    if(others.length===0){pbEndGame(lobby);return;}
    g.currentPlayer=others[0];
  }
  pbDrawAndStart(lobby);
}

function pbEndGame(lobby){
  const g=lobby.game;
  pbComputeFinalScores(g);
  g.phase='GAME_OVER';
  g.finalScores=[...g.players].map((p,i)=>({name:p.name,pts:p.pts,objPts:p.objPts,fichas:p.fichas,seat:i}))
    .sort((a,b)=>b.pts-a.pts);
  g.winnerIdx=g.players.indexOf(g.players.reduce((best,p)=>p.pts>best.pts?p:best,g.players[0]));
  pbBroadcast(lobby);pbBroadcastLobbies();
}

function pbFindGs(lobby,ls){return lobby.seatMap?lobby.seatMap.indexOf(ls):ls;}

// ── Bot AI (Percebes) ─────────────────────────────────────────────
function pbBotTurn(lobby){
  const g=lobby.game;
  if(!g||g.phase!=='PLACE_TILE'||g.currentPlayer===0)return;
  const bot=g.currentPlayer;
  setTimeout(()=>{
    if(!lobby.game||g.phase!=='PLACE_TILE'||g.currentPlayer!==bot)return;
    const valids=pbValidPlacements(g.board);
    if(valids.length===0){pbAdvanceTurn(lobby);return;}
    // Bot strategy: prefer placements that maximise bathers in existing lines
    let best=valids[0], bestScore=-1;
    for(const pos of valids){
      let sc=g.drawnTile.bathers;
      // bonus for extending a row/col with other tiles
      const row=pbKeys(g.board).filter(p=>p.r===pos.r).length;
      const col=pbKeys(g.board).filter(p=>p.c===pos.c).length;
      sc+=row+col;
      if(Math.random()<0.2) sc+=Math.random()*2; // slight randomness
      if(sc>bestScore){bestScore=sc;best=pos;}
    }
    // Place tile
    pbSet(g.board,best.r,best.c,{...g.drawnTile,placedBy:bot});
    g.drawnTile._placedAt={r:best.r,c:best.c};
    pbCheckObjectives(g,bot);
    // Bot places guard if has fichas and tile is not rock/sand
    const tile=pbGet(g.board,best.r,best.c);
    if(g.players[bot].fichas>0&&tile.type!=='rock'&&Math.random()<0.6){
      const dirs=pbGetAvailGuardDirs(g.guards,best.r,best.c);
      const dir=dirs.h&&dirs.v?(Math.random()<0.5?'h':'v'):dirs.h?'h':dirs.v?'v':null;
      if(dir){
        g.guards.push({r:best.r,c:best.c,dir,playerIdx:bot,id:g.guardIdSeq++});
        g.players[bot].fichas--;
        // Live scoring for bot guard
        const botPts=pbCountSegment(g.board,best.r,best.c,dir);
        g.players[bot].pts+=botPts;
      }
    }
    g.drawnTile=null; g.lastAction={type:'place',r:best.r,c:best.c,playerIdx:bot};
    pbBroadcast(lobby);
    setTimeout(()=>pbAdvanceTurn(lobby),600);
  },800+Math.random()*700);
}

// ── Message handler ───────────────────────────────────────────────
function pbHandle(ws,msg){
  if(msg.type==='PING'){pbSend(ws,{type:'PONG'});return;}
  if(msg.type==='LOBBIES'){pbSend(ws,{type:'LOBBIES',lobbies:Object.values(PERC_LOBBIES).map(pbLobbyInfo)});return;}
  if(msg.type==='RECONNECT'){
    const sess=PERC_SESSIONS[msg.token];
    if(!sess){pbSend(ws,{type:'RECONNECT_FAIL'});return;}
    const lobby=PERC_LOBBIES[sess.lobbyId];if(!lobby){pbSend(ws,{type:'RECONNECT_FAIL'});return;}
    const{seat,name}=sess;
    clearTimeout(lobby.graceTimers[seat]);lobby.graceTimers[seat]=null;
    lobby.players[seat]=ws;lobby.names[seat]=name;
    const gs=lobby.seatMap?lobby.seatMap.indexOf(seat):seat;
    PERC_WS_STATE.set(ws,{lobbyId:sess.lobbyId,seat,gameSeat:gs,token:msg.token});
    pbSend(ws,{type:'RECONNECTED',seat,gameSeat:gs,name,solo:lobby.solo});
    pbBroadcastLobbies();
    if(lobby.game)pbBroadcast(lobby);
    else pbSend(ws,{type:'LOBBY_STATE',lobby:pbLobbyInfo(lobby),names:lobby.names,myLobbySeat:seat});
    return;
  }
  if(msg.type==='JOIN_LOBBY'){
    const lobby=PERC_LOBBIES[msg.lobbyId];
    if(!lobby){pbSend(ws,{type:'ERROR',text:'Mesa não encontrada.'});return;}
    if(!lobby.solo&&lobby.game&&lobby.game.phase!=='GAME_OVER'){pbSend(ws,{type:'ERROR',text:'Jogo em curso.'});return;}
    const seat=lobby.players.findIndex(p=>p===null);
    if(seat===-1){pbSend(ws,{type:'ERROR',text:'Mesa cheia.'});return;}
    const name=(msg.playerName||'').trim().slice(0,20)||'Jogador';
    const token=Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
    lobby.players[seat]=ws;lobby.names[seat]=name;lobby.tokens[seat]=token;
    PERC_WS_STATE.set(ws,{lobbyId:msg.lobbyId,seat,gameSeat:seat,token});
    PERC_SESSIONS[token]={lobbyId:msg.lobbyId,seat,name};
    pbSend(ws,{type:'JOINED',seat,token,lobbyId:msg.lobbyId,solo:lobby.solo,name,lobby:pbLobbyInfo(lobby),names:lobby.names});
    lobby.players.forEach((p,i)=>{if(p&&i!==seat)pbSend(p,{type:'PLAYER_JOINED',seat,name,lobby:pbLobbyInfo(lobby)});});
    pbBroadcastLobbies();
    if(lobby.solo){
      const s=PERC_WS_STATE.get(ws);if(s)s.gameSeat=0;
      lobby.game=pbNewGame([name,'Bot Praia 1','Bot Praia 2'],true);
      pbDrawAndStart(lobby);
    }
    return;
  }
  const st=PERC_WS_STATE.get(ws);if(!st||!st.lobbyId)return;
  const lobby=PERC_LOBBIES[st.lobbyId];if(!lobby)return;
  const ls=st.seat,g=lobby.game;

  if(msg.type==='LEAVE_LOBBY'){
    lobby.players[ls]=null;lobby.names[ls]='';lobby.tokens[ls]=null;
    PERC_WS_STATE.delete(ws);
    pbSend(ws,{type:'LOBBIES',lobbies:Object.values(PERC_LOBBIES).map(pbLobbyInfo)});return;
  }
  if(msg.type==='REQUEST_STATE'){
    if(g)pbSend(ws,{type:'GAME_STATE',state:pbBuildView(g,pbFindGs(lobby,ls))});
    else pbSend(ws,{type:'LOBBY_STATE',lobby:pbLobbyInfo(lobby),names:lobby.names,myLobbySeat:ls});return;
  }
  if(msg.type==='START'){
    if(lobby.solo||ls!==0||(g&&g.phase!=='GAME_OVER'))return;
    const active=lobby.players.map((p,i)=>p?i:-1).filter(i=>i>=0);
    if(active.length<2){pbSend(ws,{type:'ERROR',text:'Precisas de pelo menos 2 jogadores.'});return;}
    lobby.seatMap=active;
    lobby.game=pbNewGame(active.map(i=>lobby.names[i]),false);
    active.forEach((li,gi)=>{const w=lobby.players[li];if(w){const s=PERC_WS_STATE.get(w);if(s)s.gameSeat=gi;}});
    pbBroadcastLobbies();pbDrawAndStart(lobby);return;
  }
  if(msg.type==='RESTART'){
    if(!g||g.phase!=='GAME_OVER')return;
    if(lobby.solo){
      const s=PERC_WS_STATE.get(ws);if(s)s.gameSeat=0;
      lobby.game=pbNewGame([lobby.names[0]||'Jogador','Bot Praia 1','Bot Praia 2'],true);
      pbDrawAndStart(lobby);
    } else {
      if(ls!==0)return;
      const active=lobby.players.map((p,i)=>p?i:-1).filter(i=>i>=0);
      if(active.length<2)return;
      lobby.seatMap=active;lobby.game=pbNewGame(active.map(i=>lobby.names[i]),false);
      active.forEach((li,gi)=>{const w=lobby.players[li];if(w){const s=PERC_WS_STATE.get(w);if(s)s.gameSeat=gi;}});
      pbBroadcastLobbies();pbDrawAndStart(lobby);
    }
    return;
  }
  if(!g||g.phase==='GAME_OVER')return;
  const gs=pbFindGs(lobby,ls);
  if(gs!==g.currentPlayer)return; // not your turn

  if(msg.type==='PLACE_TILE'){
    if(g.phase!=='PLACE_TILE')return;
    const{r,c}=msg;
    if(!pbCanPlace(g.board,r,c))return;
    pbSet(g.board,r,c,{...g.drawnTile,placedBy:gs});
    g.drawnTile._placedAt={r,c};
    pbCheckObjectives(g,gs);
    const tile=pbGet(g.board,r,c);
    const avDirs=pbGetAvailGuardDirs(g.guards,r,c);
    const canPlaceGuard=g.players[gs].fichas>0&&tile.type!=='rock'&&(avDirs.h||avDirs.v);
    g.lastAction={type:'place',r,c,playerIdx:gs,tile:{...tile}};
    if(canPlaceGuard){g.phase='PLACE_GUARD';pbBroadcast(lobby);}
    else{g.drawnTile=null;pbBroadcast(lobby);pbAdvanceTurn(lobby);}
    return;
  }
  if(msg.type==='PLACE_GUARD'){
    if(g.phase!=='PLACE_GUARD')return;
    const{dir}=msg; // 'h' | 'v' | 'skip'
    if(dir!=='skip'){
      const placed=g.drawnTile?._placedAt;
      if(!placed)return;
      const avDirs=pbGetAvailGuardDirs(g.guards,placed.r,placed.c);
      if(!avDirs[dir])return;
      const guardId=g.guardIdSeq++;
      g.guards.push({r:placed.r,c:placed.c,dir,playerIdx:gs,id:guardId});
      g.players[gs].fichas--;
      // ── Live scoring: award pts immediately when guard placed ──
      const livePts=pbCountSegment(g.board,placed.r,placed.c,dir);
      g.players[gs].pts+=livePts;
      g.lastAction={...g.lastAction,guardPts:livePts,guardDir:dir};
    }
    g.drawnTile=null;pbBroadcast(lobby);pbAdvanceTurn(lobby);return;
  }
}
