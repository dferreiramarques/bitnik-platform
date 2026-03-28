// ═══════════════════════════════════════════════════════════════════
//  BGE LOADER
//  Lê o ficheiro .bge e compila-o num Graph navegável.
//  O Graph é a estrutura interna do runtime — adjacency lists,
//  trigger index, e validação.
// ═══════════════════════════════════════════════════════════════════

import type { BGEFile, BGENode, BGEEdge, Graph, GraphNode } from './types';

// ── Load & compile ────────────────────────────────────────────────────
export function loadBGE(raw: unknown): { graph: Graph; bge: BGEFile; errors: string[] } {
  const errors: string[] = [];

  // Basic shape validation
  if (!raw || typeof raw !== 'object') {
    return { graph: emptyGraph(), bge: raw as BGEFile, errors: ['Invalid .bge file'] };
  }
  const bge = raw as BGEFile;
  if (bge._format !== 'bge') errors.push('Missing or invalid _format field');
  if (!Array.isArray(bge.nodes))  errors.push('Missing nodes array');
  if (!Array.isArray(bge.edges))  errors.push('Missing edges array');

  if (errors.length > 0) return { graph: emptyGraph(), bge, errors };

  // Compile graph
  const graph = compile(bge.nodes, bge.edges, errors);
  return { graph, bge, errors };
}

function compile(nodes: BGENode[], edges: BGEEdge[], errors: string[]): Graph {
  const nodeMap = new Map<string, GraphNode>();
  const triggers = new Map<string, GraphNode[]>();
  let startId = '';

  // Build node map
  for (const n of nodes) {
    if (!n.id || !n.node) { errors.push(`Node missing id or type: ${JSON.stringify(n)}`); continue; }
    const gn: GraphNode = {
      id:      n.id,
      type:    n.node,
      label:   n.label || n.node,
      config:  n.config || {},
      outputs: new Map(),
      inputs:  new Map(),
    };
    nodeMap.set(n.id, gn);

    // Index trigger nodes
    if (isTriggerType(n.node)) {
      const list = triggers.get(n.node) || [];
      list.push(gn);
      triggers.set(n.node, list);
    }

    // Find entry point
    if (n.node === 'GAME_START') startId = n.id;
  }

  if (!startId) errors.push('No GAME_START node found');

  // Build adjacency lists from edges
  for (const e of edges) {
    const from = nodeMap.get(e.fromNode);
    const to   = nodeMap.get(e.toNode);
    if (!from) { errors.push(`Edge ${e.id}: source node ${e.fromNode} not found`); continue; }
    if (!to)   { errors.push(`Edge ${e.id}: target node ${e.toNode} not found`); continue; }

    // from.outputs[fromPort] → [{toNode, toPort}]
    const outs = from.outputs.get(e.fromPort) || [];
    outs.push({ nodeId: e.toNode, inPort: e.toPort });
    from.outputs.set(e.fromPort, outs);

    // to.inputs[toPort] → [{fromNode, fromPort}]
    const ins = to.inputs.get(e.toPort) || [];
    ins.push({ nodeId: e.fromNode, outPort: e.fromPort });
    to.inputs.set(e.toPort, ins);
  }

  return { nodes: nodeMap, triggers, startId };
}

function emptyGraph(): Graph {
  return { nodes: new Map(), triggers: new Map(), startId: '' };
}

// ── Trigger type detection ────────────────────────────────────────────
const TRIGGER_TYPES = new Set([
  'ON_TURN_S', 'ON_TURN_E', 'ON_ROUND_E', 'ON_TILE', 'ON_CARD',
  'ON_SCORE', 'ON_PIECE', 'ON_RES', 'ON_DECK_E', 'ON_COND',
  'ON_ACTION', 'AFTER_EFF',
]);

export function isTriggerType(type: string): boolean {
  return TRIGGER_TYPES.has(type);
}

// ── Graph traversal helpers ───────────────────────────────────────────
export function getNode(graph: Graph, id: string): GraphNode | undefined {
  return graph.nodes.get(id);
}

export function getNextNodes(graph: Graph, nodeId: string, port: string): GraphNode[] {
  const node = graph.nodes.get(nodeId);
  if (!node) return [];
  const edges = node.outputs.get(port) || [];
  return edges
    .map(e => graph.nodes.get(e.nodeId))
    .filter((n): n is GraphNode => n !== undefined);
}

export function getTriggersForEvent(graph: Graph, eventType: string): GraphNode[] {
  return graph.triggers.get(eventType) || [];
}

// ── Initial state builder ─────────────────────────────────────────────
// Creates a fresh GameState from a loaded graph.
// Called once when a game starts.
export function buildInitialState(
  graph:       Graph,
  bge:         BGEFile,
  playerNames: string[],
  gameId:      string,
): import('./types').GameState {
  const playerCount = playerNames.length;

  return {
    gameId,
    bge,
    graph,
    phase:         graph.startId,   // start at GAME_START
    currentPlayer: 0,
    playerCount,
    roundNum:      1,
    turnGen:       0,
    players: playerNames.map((name, idx) => ({
      idx,
      name,
      isBot:     false,
      score:     0,
      resources: new Map(),
      meta:      {},
    })),
    decks:          new Map(),
    discards:       new Map(),
    hands:          new Map(),
    counters:       new Map(),
    board:          new Map(),
    zones:          new Map(),
    activeTriggers: [],
    log:            [],
    pendingAction:  null,
    activeTimers:   new Map(),
    finalScores:    null,
  };
}

// ── Validation report ─────────────────────────────────────────────────
export function validateGraph(graph: Graph): string[] {
  const issues: string[] = [];

  if (!graph.startId) issues.push('Falta nó GAME_START');

  const hasEnd = [...graph.nodes.values()].some(n =>
    n.type === 'GAME_END' || n.type === 'INSTANT_WIN'
  );
  if (!hasEnd) issues.push('Falta nó GAME_END ou INSTANT_WIN');

  // Check for orphaned nodes (no inputs and not GAME_START, no outputs and not GAME_END)
  for (const [id, node] of graph.nodes) {
    const isStart    = node.type === 'GAME_START';
    const isEnd      = node.type === 'GAME_END' || node.type === 'INSTANT_WIN';
    const isTrigger  = isTriggerType(node.type);
    const isDataNode = ['DECK','HAND','COUNTER','PLAYER_ST','ZONE',
                        'SHARD_BOARD','STRUCTURE','LOCKED_SLOT','ROLE'].includes(node.type);
    const isAsset    = ['BOARD_LAY','PIECE_VIS','CARD_TPL'].includes(node.type);

    if (!isStart && !isTrigger && !isDataNode && !isAsset && node.inputs.size === 0)
      issues.push(`Nó "${node.label}" (${id}) não tem entradas ligadas`);
    if (!isEnd && !isTrigger && !isDataNode && !isAsset && node.outputs.size === 0)
      issues.push(`Nó "${node.label}" (${id}) não tem saídas ligadas`);
  }

  return issues;
}
