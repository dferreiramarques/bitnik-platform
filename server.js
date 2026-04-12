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

  // API: proxy to Anthropic (avoids CORS)
  if (url === '/api/generate-bge' && req.method === 'POST') {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', async () => {
      try {
        const body = Buffer.concat(chunks).toString();
        let parsed;
        try { parsed = JSON.parse(body); } catch { res.writeHead(400); res.end(JSON.stringify({error:'Invalid JSON body'})); return; }
        const { prompt } = parsed;
        if (!prompt) { res.writeHead(400); res.end(JSON.stringify({error:'Missing prompt'})); return; }
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) { res.writeHead(500); res.end(JSON.stringify({error:'ANTHROPIC_API_KEY not set on server'})); return; }
        const https = require('https');
        const payload = JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }]
        });
        const options = {
          hostname: 'api.anthropic.com',
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Length': Buffer.byteLength(payload),
          }
        };
        const apiReq = https.request(options, apiRes => {
          const chunks2 = [];
          apiRes.on('data', c => chunks2.push(c));
          apiRes.on('end', () => {
            res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' });
            res.end(Buffer.concat(chunks2).toString());
          });
        });
        apiReq.on('error', err => {
          res.writeHead(502); res.end(JSON.stringify({error: err.message}));
        });
        apiReq.write(payload);
        apiReq.end();
      } catch(e) {
        res.writeHead(500); res.end(JSON.stringify({error: e.message}));
      }
    });
    return;
  }

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

  // /play/nineoils → dedicated Nine Oils client
  if (url === '/play/nineoils' || url === '/play/nineoils/') {
    fs.readFile(path.join(PUB_DIR, 'nineoils.html'), (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }
  // /play/catania → dedicated Catania client
  if (url === '/play/catania' || url === '/play/catania/') {
    fs.readFile(path.join(PUB_DIR, 'catania.html'), (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }
  if (url === '/play/catania' || url === '/play/catania/') {
    fs.readFile(path.join(PUB_DIR, 'catania.html'), (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }
  // /play/bulbous → dedicated Bulbous client
  if (url === '/play/bulbous' || url === '/play/bulbous/') {
    fs.readFile(path.join(PUB_DIR, 'bulbous.html'), (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  // /play/catania → Catania client
  if (url === '/play/catania' || url === '/play/catania/') {
    fs.readFile(path.join(PUB_DIR, 'catania.html'), (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }
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
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════




// CATANIA — in-process game
// Resources: cereais/vinho/peixe/calcario/azeite
// Village rule: keep majority, ONE chosen minority gets top tower disc
// ═══════════════════════════════════════════════════════════════
{
const CAT_RES=['cereais','vinho','peixe','calcario','azeite'];
const CAT_PT={cereais:'Cereais',vinho:'Vinho',peixe:'Peixe',calcario:'Calcário',azeite:'Azeite'};

// Tower: black=12,11,11,10,10,8,8,6,6,4,4,2,2 (13) + red=9,7,5,3,1 (5) = 18
const BLACK_DISCS=[12,11,11,10,10,8,8,6,6,4,4,2,2];
const RED_DISCS=[9,7,5,3,1];
const RED_SET=new Set(RED_DISCS);

function catMkTower(){
  const all=[...BLACK_DISCS,...RED_DISCS];
  all.sort((a,b)=>a-b);
  return all; // index 0=bottom, last=top
}

// Hex layout 2-4-3-2 pointy-top (col offset for odd rows)
// R=62 → W3=sqrt(3)*62 ≈ 107.4
const R=62, W3=Math.sqrt(3)*62;
const CAT_LAYOUT=[{row:0,count:2,colStart:1},{row:1,count:4,colStart:0},{row:2,count:3,colStart:0},{row:3,count:2,colStart:1}];
const VOL_ROW=1, VOL_COLIDX=1; // volcano = row1, 2nd hex (col=1)

function h2p(col,row){
  return{x:W3*col+(row&1?W3/2:0), y:R*1.5*row};
}

function catBuildHexes(){
  const pool=[];
  CAT_RES.forEach(r=>pool.push(r,r)); // 10 resource tiles
  catShuf(pool);
  const hexes=[]; let id=0,ri=0;
  CAT_LAYOUT.forEach(({row,count,colStart})=>{
    for(let ci=0;ci<count;ci++){
      const col=colStart+ci;
      const isVol=(row===VOL_ROW&&ci===VOL_COLIDX);
      const type=isVol?'vulcao':pool[ri++];
      hexes.push({id:id++,row,col,ci,type,px:h2p(col,row),tokens:[]});
    }
  });
  return hexes;
}

function catNeighbors(hexId,hexes){
  const h=hexes.find(x=>x.id===hexId); if(!h)return[];
  const thr=W3*1.2;
  return hexes.filter(x=>x.id!==hexId).filter(x=>{const dx=x.px.x-h.px.x,dy=x.px.y-h.px.y;return Math.sqrt(dx*dx+dy*dy)<thr;}).map(x=>x.id);
}

function catShuf(a){for(let i=a.length-1;i>0;i--){const j=0|Math.random()*(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}

function catNewGame(lobbyPlayers){
  const tower=catMkTower();
  const hexes=catBuildHexes();
  // Draw 5 discs from top for initial pile values
  const drawn=[];for(let i=0;i<5;i++)drawn.push(tower.pop());
  catShuf(drawn);
  const piles={};
  CAT_RES.forEach((r,i)=>{piles[r]={disc:drawn[i],totalCollected:0};});
  const players=lobbyPlayers.map((lp,idx)=>{
    const h={};CAT_RES.forEach(r=>h[r]=0);
    const col={};CAT_RES.forEach(r=>col[r]=0);
    return{name:lp.name,isBot:!!lp.isBot,colorIdx:idx,hand:h,collected:col,villages:[],turn:{collects:0,foundDone:false,sicelPending:false,thisHexes:[]}};
  });
  return{n:lobbyPlayers.length,players,hexes,tower,piles,
    sicel:hexes.find(h=>h.type==='vulcao').id,
    cur:0,round:1,phase:'ACTION',trigP:null,log:[]};
}

function catInitTurn(g,seat){
  g.hexes.forEach(h=>{h.tokens=h.tokens.filter(pi=>pi!==seat);});
  g.players[seat].turn={collects:0,foundDone:false,sicelPending:false,thisHexes:[]};
}

function catHandle(g,seat,msg){
  if(g.phase==='GAME_OVER')return{error:'Jogo terminado'};
  const p=g.players[seat];
  const t=p.turn;

  if(msg.type==='CAT_COLLECT'){
    if(g.cur!==seat)return{error:'Não é a tua vez'};
    if(t.sicelPending)return{error:'Move os Sicelos primeiro'};
    if(t.collects>=2)return{error:'Já fizeste 2 recolhas este turno'};
    const{hexIdx,take2}=msg;
    const hex=g.hexes[hexIdx];
    if(!hex||hex.type==='vulcao')return{error:'Hexágono inválido'};
    if(g.sicel===hexIdx)return{error:'Os Sicelos bloqueiam esse território'};
    if(hex.tokens.some(pi=>pi!==seat))return{error:'Território ocupado por outro jogador'};
    if(t.thisHexes.includes(hexIdx))return{error:'Já recolheste neste hex este turno'};
    if(take2&&g.tower.length===0)return{error:'Torre de discos vazia'};
    const r=hex.type;
    if(!hex.tokens.includes(seat))hex.tokens.push(seat);
    t.thisHexes.push(hexIdx);
    const amt=take2?2:1;
    p.hand[r]+=amt; p.collected[r]+=amt; g.piles[r].totalCollected+=amt;
    t.collects++;
    if(take2){
      const nd=g.tower.pop();
      const wasRed=RED_SET.has(nd);
      g.piles[r].disc=nd;
      catLog(g,`${p.name} recolheu 2 ${CAT_PT[r]} → disco ${nd}${wasRed?' 🔴':''}`);
      if(wasRed){t.sicelPending=true;return{ok:true,needSicels:true};}
    }else{
      catLog(g,`${p.name} recolheu 1 ${CAT_PT[r]}`);
    }
    return{ok:true};
  }

  if(msg.type==='CAT_SICELS'){
    if(g.cur!==seat||!p.turn.sicelPending)return{error:'Fase incorrecta'};
    const{hexIdx}=msg;
    if(!catNeighbors(g.sicel,g.hexes).includes(hexIdx))return{error:'Hex não é adjacente aos Sicelos'};
    g.sicel=hexIdx;
    p.turn.sicelPending=false;
    catLog(g,'💀 Sicelos moveram-se!');
    return{ok:true};
  }

  // VILLAGE: keep majority, ONE chosen minority gets top tower disc
  // msg.keepRes = majority resource to keep
  // msg.affectRes = minority resource that gets the tower's top disc (optional if only 1 minority)
  if(msg.type==='CAT_VILLAGE'){
    if(g.cur!==seat)return{error:'Não é a tua vez'};
    if(t.collects<1)return{error:'Faz pelo menos 1 recolha primeiro'};
    if(t.foundDone)return{error:'Já fundaste uma aldeia este turno'};
    const{keepRes,affectRes}=msg;
    // Validate
    const types=CAT_RES.filter(r=>p.hand[r]>0);
    const totalCards=types.reduce((s,r)=>s+p.hand[r],0);
    if(totalCards<5)return{error:'Precisas de pelo menos 5 cartas na mão para fundar uma aldeia'};
    if(types.length<2)return{error:'Precisas de 2+ tipos de recursos'};
    if(!p.hand[keepRes]||p.hand[keepRes]===0)return{error:'Não tens esse recurso'};
    const maxCount=Math.max(...types.map(r=>p.hand[r]));
    if(p.hand[keepRes]<maxCount)return{error:'O recurso de maioria tem que ser o mais numeroso'};
    const minorities=types.filter(r=>r!==keepRes);
    if(minorities.length>1&&!affectRes)return{error:'Escolhe qual minoria afeta a torre'};
    const chosenMinority=minorities.length===1?minorities[0]:(affectRes||minorities[0]);
    if(!minorities.includes(chosenMinority))return{error:'Minoria inválida'};
    // Execute: keep majority cards in village
    const keptCount=p.hand[keepRes];
    p.hand[keepRes]=0;
    // Discard minorities from hand
    minorities.forEach(r=>{p.hand[r]=0;});
    // Apply tower disc to chosen minority pile
    if(g.tower.length>0){
      g.piles[chosenMinority].disc=g.tower.pop();
    }
    // Record village
    p.villages.push({res:keepRes,cards:keptCount});
    t.foundDone=true;
    catLog(g,`🏘 ${p.name} fundou aldeia (${CAT_PT[keepRes]} ×${keptCount}), afetou ${CAT_PT[chosenMinority]}`);
    if(p.villages.length>=3&&g.phase==='ACTION'){
      g.phase='LAST_ROUND'; g.trigP=seat;
      catLog(g,`🏛 ${p.name} fundou a 3ª aldeia! Última ronda!`);
    }
    return{ok:true};
  }

  if(msg.type==='CAT_END_TURN'){
    if(g.cur!==seat)return{error:'Não é a tua vez'};
    if(p.turn.sicelPending)return{error:'Move os Sicelos antes de terminar'};
    if(p.turn.collects<1)return{error:'Faz pelo menos 1 recolha'};
    const next=(seat+1)%g.n;
    if(g.phase==='LAST_ROUND'&&next===g.trigP){catEndGame(g);return{ok:true};}
    g.cur=next; if(next===0)g.round++;
    catInitTurn(g,next);
    return{ok:true};
  }

  return{error:'Acção desconhecida'};
}

function catEndGame(g){
  g.phase='GAME_OVER';
  g.players.forEach(p=>{
    p.score=CAT_RES.reduce((s,r)=>s+(p.collected[r]||0)*(g.piles[r]?.disc||1),0);
  });
  catLog(g,'⚑ Jogo terminado! A contar pontos...');
}

function catBot(g){
  if(g.phase==='GAME_OVER')return null;
  const seat=g.cur; const p=g.players[seat];
  if(!p.isBot)return null;
  const t=p.turn;

  if(t.sicelPending){
    const adj=catNeighbors(g.sicel,g.hexes).filter(id=>!g.hexes.find(h=>h.id===id)?.tokens.some(pi=>!g.players[pi].isBot));
    const allAdj=catNeighbors(g.sicel,g.hexes);
    const choices=adj.length?adj:allAdj;
    return{type:'CAT_SICELS',hexIdx:choices[0|Math.random()*choices.length]};
  }

  if(t.collects<1||(t.collects<2&&Math.random()<0.55)){
    const avail=g.hexes.filter(h=>h.type!=='vulcao'&&g.sicel!==h.id&&!h.tokens.some(pi=>pi!==seat)&&!t.thisHexes.includes(h.id));
    if(avail.length){
      avail.sort((a,b)=>(g.piles[a.type]?.disc||99)-(g.piles[b.type]?.disc||99));
      const h=avail[0];
      const take2=g.tower.length>2&&Math.random()<0.38;
      return{type:'CAT_COLLECT',hexIdx:h.id,take2};
    }
  }

  if(t.collects>=1&&!t.foundDone){
    const types=CAT_RES.filter(r=>p.hand[r]>0);
    const totalCards=types.reduce((s,r)=>s+p.hand[r],0);
    if(types.length>=2&&totalCards>=5&&Math.random()<0.48){
      const maxC=Math.max(...types.map(r=>p.hand[r]));
      const majs=types.filter(r=>p.hand[r]===maxC);
      const keepRes=majs[0|Math.random()*majs.length];
      const minorities=types.filter(r=>r!==keepRes);
      const affectRes=minorities[0|Math.random()*minorities.length];
      return{type:'CAT_VILLAGE',keepRes,affectRes};
    }
  }

  return{type:'CAT_END_TURN'};
}

function catLog(g,msg){g.log.unshift(msg);if(g.log.length>20)g.log.pop();}

function catView(g,seat){
  const me=g.players[seat];
  const adj=catNeighbors(g.sicel,g.hexes);
  return{
    n:g.n,cur:g.cur,myIdx:seat,round:g.round,phase:g.phase,
    players:g.players.map((p,i)=>({
      name:p.name,colorIdx:p.colorIdx,isBot:p.isBot,
      handTotal:Object.values(p.hand).reduce((a,b)=>a+b,0),
      villages:p.villages,score:p.score||0,
      turn:i===seat?p.turn:null,
    })),
    myHand:me.hand,
    hexes:g.hexes.map(h=>({...h})),
    piles:g.piles,
    tower:g.tower,
    sicel:g.sicel,
    sicelAdj:adj,
    log:g.log,
  };
}

// ── Lobby ─────────────────────────────────────────────────────
const CAT_LOBBY_DEFS=[
  {id:'cat-4p-1',name:'Mesa 4J — 1',mode:'4p',maxP:4,solo:false},
  {id:'cat-4p-2',name:'Mesa 4J — 2',mode:'4p',maxP:4,solo:false},
  {id:'cat-4p-3',name:'Mesa 4J — 3',mode:'4p',maxP:4,solo:false},
  {id:'cat-2p-1',name:'Mesa 2J — 1',mode:'2p',maxP:2,solo:false},
  {id:'cat-2p-2',name:'Mesa 2J — 2',mode:'2p',maxP:2,solo:false},
  {id:'cat-solo-3',name:'Solo vs 3 Bots',mode:'4p',maxP:1,solo:true,bots:3},
  {id:'cat-solo-1',name:'Solo vs 1 Bot',mode:'2p',maxP:1,solo:true,bots:1},
];
const CAT_LOBBIES={};
CAT_LOBBY_DEFS.forEach(d=>{
  CAT_LOBBIES[d.id]={...d,players:Array(d.maxP).fill(null),names:Array(d.maxP).fill(''),
    tokens:Array(d.maxP).fill(null),game:null,graceTimers:Array(d.maxP).fill(null),botTimer:null};
});
const CAT_SESSIONS={};
const CAT_WS=new WeakMap();

function catSend(ws,obj){if(ws?.readyState===1)ws.send(JSON.stringify(obj));}
function catLobbyInfo(l){return{id:l.id,name:l.name,mode:l.mode,solo:l.solo,maxP:l.maxP,bots:l.bots||0,
  seated:l.players.filter(Boolean).length,playing:!!l.game&&l.game.phase!=='GAME_OVER',
  names:l.names.filter(Boolean)};}
function catBroadcastLobbies(){
  const list=Object.values(CAT_LOBBIES).map(catLobbyInfo);
  for(const ws of globalThis._catWss?.clients||[]){
    const st=CAT_WS.get(ws);if(!st?.lobbyId)catSend(ws,{type:'LOBBIES',lobbies:list});
  }
}
function catBroadcastGame(lobby){
  const g=lobby.game;if(!g)return;
  lobby.players.forEach((ws,i)=>{if(ws)catSend(ws,{type:'GAME_STATE',state:catView(g,i)});});
}
function catSendLobbyState(lobby,ws,seat){
  catSend(ws,{type:'LOBBY_STATE',lobby:catLobbyInfo(lobby),names:lobby.names,mySeat:seat});
}
function catScheduleBots(lobby){
  if(lobby.botTimer)return;
  lobby.botTimer=setTimeout(()=>{
    lobby.botTimer=null;
    const g=lobby.game;if(!g||g.phase==='GAME_OVER')return;
    const p=g.players[g.cur];if(!p?.isBot)return;
    const action=catBot(g);
    if(action){
      const result=catHandle(g,g.cur,action);
      catBroadcastGame(lobby);
      if(!result?.error&&g.phase!=='GAME_OVER')catScheduleBots(lobby);
    }
  },800+Math.random()*600);
}

function catHandleMsg(ws,msg){
  if(msg.type==='PING'){catSend(ws,{type:'PONG'});return;}
  if(msg.type==='LOBBIES'){catSend(ws,{type:'LOBBIES',lobbies:Object.values(CAT_LOBBIES).map(catLobbyInfo)});return;}
  if(msg.type==='RECONNECT'){
    const sess=CAT_SESSIONS[msg.token];
    if(!sess){catSend(ws,{type:'RECONNECT_FAIL'});return;}
    const lobby=CAT_LOBBIES[sess.lobbyId];if(!lobby){catSend(ws,{type:'RECONNECT_FAIL'});return;}
    const{seat}=sess;clearTimeout(lobby.graceTimers[seat]);
    lobby.players[seat]=ws;CAT_WS.set(ws,{lobbyId:lobby.id,seat,token:msg.token});
    catSend(ws,{type:'RECONNECTED',seat,solo:lobby.solo});
    if(lobby.game)catSend(ws,{type:'GAME_STATE',state:catView(lobby.game,seat)});
    else catSendLobbyState(lobby,ws,seat);
    catBroadcastLobbies();return;
  }
  if(msg.type==='JOIN_LOBBY'){
    const lobby=CAT_LOBBIES[msg.lobbyId];if(!lobby){catSend(ws,{type:'ERROR',text:'Mesa inválida'});return;}
    const seat=lobby.players.findIndex(p=>p===null);if(seat===-1){catSend(ws,{type:'ERROR',text:'Mesa cheia'});return;}
    const token=Math.random().toString(36).slice(2)+Date.now().toString(36);
    lobby.players[seat]=ws;lobby.names[seat]=msg.playerName;lobby.tokens[seat]=token;
    CAT_SESSIONS[token]={lobbyId:lobby.id,seat,name:msg.playerName};
    CAT_WS.set(ws,{lobbyId:lobby.id,seat,token});
    catSend(ws,{type:'JOINED',seat,token,lobbyId:lobby.id,solo:lobby.solo,lobby:catLobbyInfo(lobby),names:lobby.names});
    lobby.players.forEach((p,i)=>{if(p&&i!==seat)catSend(p,{type:'PLAYER_JOINED',name:msg.playerName});});
    catBroadcastLobbies();
    if(lobby.solo){
      const botNames=['Bot Arquimedes','Bot Pitágoras','Bot Euclides'].slice(0,lobby.bots||3);
      const lps=[{name:msg.playerName,isBot:false},...botNames.map(n=>({name:n,isBot:true}))];
      lobby.game=catNewGame(lps);
      catInitTurn(lobby.game,0);
      catBroadcastGame(lobby);catScheduleBots(lobby);
    }
    return;
  }
  const st=CAT_WS.get(ws);if(!st){catSend(ws,{type:'ERROR',text:'Não estás numa mesa'});return;}
  const lobby=CAT_LOBBIES[st.lobbyId];if(!lobby)return;
  const{seat}=st;
  if(msg.type==='LEAVE_LOBBY'){
    clearTimeout(lobby.graceTimers[seat]);
    if(CAT_SESSIONS[lobby.tokens[seat]])delete CAT_SESSIONS[lobby.tokens[seat]];
    const name=lobby.names[seat];
    lobby.players[seat]=null;lobby.names[seat]='';lobby.tokens[seat]=null;CAT_WS.delete(ws);
    if(lobby.game&&!lobby.solo){lobby.game=null;lobby.players.forEach(p=>{if(p)catSend(p,{type:'GAME_ABORTED',reason:`${name} saiu.`});});}
    if(lobby.game&&lobby.solo){lobby.game=null;if(lobby.botTimer){clearTimeout(lobby.botTimer);lobby.botTimer=null;}}
    lobby._abandonedAt=null;
    catBroadcastLobbies();return;
  }
  if(msg.type==='REQUEST_STATE'){
    if(lobby.game)catSend(ws,{type:'GAME_STATE',state:catView(lobby.game,seat)});
    else catSendLobbyState(lobby,ws,seat);return;
  }
  if(msg.type==='START'){
    if(seat!==0&&!lobby.solo){catSend(ws,{type:'ERROR',text:'Só o anfitrião pode iniciar'});return;}
    const seated=lobby.players.map((p,i)=>p?i:-1).filter(i=>i!==-1);
    if(!lobby.solo&&seated.length<lobby.maxP){catSend(ws,{type:'ERROR',text:`Precisas de ${lobby.maxP} jogadores`});return;}
    const lps=seated.map(i=>({name:lobby.names[i],isBot:false}));
    lobby.game=catNewGame(lps);
    catInitTurn(lobby.game,0);
    catBroadcastGame(lobby);catScheduleBots(lobby);return;
  }
  if(msg.type==='RESTART'){
    lobby.game=null;lobby.players.forEach((p,i)=>{if(p)catSendLobbyState(lobby,p,i);});catBroadcastLobbies();return;
  }
  const g=lobby.game;if(!g){catSend(ws,{type:'ERROR',text:'Sem jogo em curso'});return;}
  const result=catHandle(g,seat,msg);
  if(result&&result.error){catSend(ws,{type:'ERROR',text:result.error});return;}
  catBroadcastGame(lobby);
  if(g.phase!=='GAME_OVER')catScheduleBots(lobby);
}

// ── Periodic cleanup of abandoned lobbies ─────────────────────────
// Solo: if game is running but no human connected for >30min → reset
// MP: if game is running but no players for >60min → reset
setInterval(()=>{
  const now=Date.now();
  Object.values(CAT_LOBBIES).forEach(lobby=>{
    if(!lobby.game)return;
    const humanConnected=lobby.players.some(ws=>ws&&ws.readyState===1);
    if(!humanConnected){
      if(!lobby._abandonedAt) { lobby._abandonedAt=now; return; }
      const elapsed=now-lobby._abandonedAt;
      const timeoutMs=lobby.solo?30*60*1000:60*60*1000; // 30min solo, 60min mp
      if(elapsed>timeoutMs){
        console.log(`[CAT] Resetting abandoned lobby: ${lobby.id}`);
        if(lobby.botTimer){clearTimeout(lobby.botTimer);lobby.botTimer=null;}
        lobby.game=null;lobby._abandonedAt=null;
        lobby.players.fill(null);lobby.names.fill('');lobby.tokens.fill(null);
        // Clear sessions for this lobby
        Object.keys(CAT_SESSIONS).forEach(tok=>{
          if(CAT_SESSIONS[tok]?.lobbyId===lobby.id)delete CAT_SESSIONS[tok];
        });
        catBroadcastLobbies();
      }
    } else {
      lobby._abandonedAt=null; // reset timer if someone reconnects
    }
  });
}, 5*60*1000); // check every 5 minutes

globalThis._catSend=catSend;
globalThis._catHandleMsg=catHandleMsg;
globalThis._catBroadcastLobbies=catBroadcastLobbies;
globalThis._CAT_LOBBIES=CAT_LOBBIES;
globalThis._CAT_WS=CAT_WS;
globalThis._CAT_SESSIONS=CAT_SESSIONS;
}

const wss = new WebSocketServer({ noServer: true });
const capWss = { get clients() { return [...wss.clients].filter(w=>w._isCap); } }; // alias

wss.on('connection', (ws, req) => {
  // Route: Bulbous connections
  if (ws._isBU) {
    const _buH = globalThis._buHandle;
    const _buL = globalThis._BU_LOBBIES;
    if (ws.readyState===1) ws.send(JSON.stringify({
      type:'LOBBIES',
      lobbies: Object.values(_buL).map(l=>({id:l.id,name:l.name,mode:l.mode,solo:l.solo,maxP:l.maxP,
        seated:l.players.filter(Boolean).length,
        playing:!!l.game&&l.game.phase!=='GAME_OVER',
        names:l.names.filter(Boolean)}))
    }));
    ws.on('message', raw => { try { _buH(ws, JSON.parse(raw)); } catch(e) { console.error('BU err',e); } });
    ws.on('close', () => {
      const st = globalThis._BU_WS_STATE?.get(ws);
      if (!st || !st.lobbyId) return;
      const lobby = globalThis._BU_LOBBIES[st.lobbyId];
      if (!lobby) return;
      const { seat } = st;
      lobby.players[seat] = null;
      // Grace period: 45s to reconnect before clearing seat
      lobby.graceTimers[seat] = setTimeout(() => {
        lobby.names[seat] = ''; lobby.tokens[seat] = null;
        const tok = st.token; if (tok && globalThis._BU_SESSIONS?.[tok]) delete globalThis._BU_SESSIONS[tok];
        // Notify remaining players
        lobby.players.forEach(p => { if(p) p.send && p.send(JSON.stringify({type:'OPPONENT_DISCONNECTED',seat,name:lobby.names[seat]})); });
        // Abort game if non-solo and game in progress
        if (lobby.game && !lobby.solo) {
          lobby.game = null;
          lobby.players.forEach(p => { if(p) p.send && p.send(JSON.stringify({type:'GAME_ABORTED',reason:'Adversário desligou.'})); });
        }
        // Re-expose session maps for reconnect handler
        buBroadcastLobbies();
      }, 45000);
      buBroadcastLobbies();
    });
    ws.on('error', ()=>{});
    return;
  }
  // Route: Nine Oils connections
  if (ws._isNO) {
    noSend(ws, { type:'LOBBIES', lobbies: Object.values(NO_LOBBIES).map(noLobbyInfo) });
    ws.on('message', raw => { try { noHandle(ws, JSON.parse(raw)); } catch {} });
    ws.on('close', () => {
      const st = NO_WS_STATE.get(ws); if (!st||!st.lobbyId) return;
      const lobby = NO_LOBBIES[st.lobbyId]; if (!lobby) return;
      const {seat} = st;
      lobby.players[seat] = null;
      lobby.players.forEach(p => { if(p) noSend(p,{type:'OPPONENT_DISCONNECTED',seat,name:lobby.names[seat]}); });
      noBroadcastLobbies();
      lobby.graceTimers[seat] = setTimeout(() => {
        lobby.names[seat]=''; lobby.tokens[seat]=null;
        noBroadcastLobbies();
      }, 45000);
    });
    ws.on('error',()=>{});
    return;
  }
  // Route: Catania connections
  if (ws._isCAT) {
    globalThis._catWss = wss;
    const _cS = globalThis._catSend;
    _cS(ws, {type:'LOBBIES', lobbies:Object.values(globalThis._CAT_LOBBIES).map(l=>({
      id:l.id,name:l.name,mode:l.mode,solo:l.solo,maxP:l.maxP,
      seated:l.players.filter(Boolean).length,
      playing:!!l.game&&l.game.phase!=='GAME_OVER',
      names:l.names.filter(Boolean)}))});
    ws.on('message', raw => { try { globalThis._catHandleMsg(ws,JSON.parse(raw)); } catch(e){console.error('CAT err',e);} });
    ws.on('close', () => {
      const st=globalThis._CAT_WS?.get(ws);if(!st?.lobbyId)return;
      const lobby=globalThis._CAT_LOBBIES?.[st.lobbyId];if(!lobby)return;
      const{seat}=st;lobby.players[seat]=null;
      lobby.graceTimers[seat]=setTimeout(()=>{
        lobby.names[seat]='';lobby.tokens[seat]=null;
        if(globalThis._CAT_SESSIONS?.[st.token])delete globalThis._CAT_SESSIONS[st.token];
        if(lobby.game&&!lobby.solo){lobby.game=null;lobby.players.forEach(p=>{if(p)try{p.send(JSON.stringify({type:'GAME_ABORTED',reason:'Adversário desligou.'}));}catch{}});}
        if(globalThis._catBroadcastLobbies)globalThis._catBroadcastLobbies();
        if(globalThis._catBroadcastLobbies)globalThis._catBroadcastLobbies();
      },45000);
      if(globalThis._catBroadcastLobbies)globalThis._catBroadcastLobbies();
    });
    ws.on('error',()=>{});
    return;
  }
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
  capMkCard(5,[],false),capMkCard(5,[],true),            // img: cap5_bird
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

// ── WebSocket upgrade routing ─────────────────────────────────────
server.on('upgrade', (req, socket, head) => {
  const urlPath = (req.url || '').split('?')[0];
  wss.handleUpgrade(req, socket, head, ws => {
    ws._isCap  = (urlPath === '/ws/capivaras');
    ws._isPerc = (urlPath === '/ws/percebes');
    ws._isNO   = (urlPath === '/ws/nineoils');
    ws._isBU   = (urlPath === '/ws/bulbous');
    ws._isCAT  = (urlPath === '/ws/catania');
    wss.emit('connection', ws, req);
  });
});

setInterval(() => {
  for (const ws of wss.clients) if (ws.readyState === 1) ws.ping();
}, 25000);


server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Bitnik] Server running on port ${PORT}`);
});
