// ═══════════════════════════════════════════════════════════════════
//  BGE RUNTIME — Types
//  O contrato central entre o loader, o engine, e os executors.
// ═══════════════════════════════════════════════════════════════════

// ── .bge file structure ──────────────────────────────────────────────
export interface BGEFile {
  _format:   'bge';
  _version:  string;
  game:      { name: string; players?: { min: number; max: number } };
  swimlanes: BGESwimlane[];
  nodes:     BGENode[];
  edges:     BGEEdge[];
  engine_nodes_used: string[];
}

export interface BGESwimlane {
  id: string; name: string; color: string;
  y: number; h: number; collapsed: boolean;
}

export interface BGENode {
  id:     string;
  node:   string;   // node type e.g. 'GAME_START', 'TURN_BLOCK'
  label:  string;
  x:      number;
  y:      number;
  config: Record<string, unknown>;
}

export interface BGEEdge {
  id:       string;
  fromNode: string; fromPort: string;
  toNode:   string; toPort:   string;
}

// ── Graph (compiled from .bge) ────────────────────────────────────────
export interface GraphNode {
  id:        string;
  type:      string;
  label:     string;
  config:    Record<string, unknown>;
  // adjacency — outPort → [{ nodeId, inPort }]
  outputs:   Map<string, Array<{ nodeId: string; inPort: string }>>;
  inputs:    Map<string, Array<{ nodeId: string; outPort: string }>>;
}

export interface Graph {
  nodes:    Map<string, GraphNode>;
  // trigger nodes indexed by their type for fast lookup
  triggers: Map<string, GraphNode[]>;
  // entry point
  startId:  string;
}

// ── Runtime Game State ────────────────────────────────────────────────
export interface GameState {
  gameId:        string;
  bge:           BGEFile;
  graph:         Graph;

  // Execution state
  phase:         string;          // current FLOW node id
  currentPlayer: number;
  playerCount:   number;
  roundNum:      number;
  turnGen:       number;

  // Player states (keyed by player index)
  players:       PlayerState[];

  // Generic data containers (populated by DATA node executors)
  decks:         Map<string, Card[]>;
  discards:      Map<string, Card[]>;
  hands:         Map<string, Card[]>;  // key: `${deckId}:${playerIdx}`
  counters:      Map<string, number>;
  board:         Map<string, CellData>; // key: 'r,c' for grids
  zones:         Map<string, ZoneData[]>;

  // Active effects from triggers
  activeTriggers: ActiveTrigger[];

  // Log
  log:           LogEntry[];

  // Pending: waiting for player input
  pendingAction: PendingAction | null;

  // Timer state
  activeTimers:  Map<string, TimerState>;

  // Endgame
  finalScores:   FinalScore[] | null;
}

export interface PlayerState {
  idx:      number;
  name:     string;
  isBot:    boolean;
  score:    number;
  resources: Map<string, number>;
  // extra per-game state (Turn Block actions taken this turn, etc.)
  meta:     Record<string, unknown>;
}

export interface Card {
  id:     string;
  type:   string;
  [key:   string]: unknown;
}

export interface CellData {
  r: number; c: number;
  terrain?: string;
  contents: unknown[];
}

export interface ZoneData {
  id:       string;
  ownedBy:  number;
  contents: unknown[];
}

export interface ActiveTrigger {
  nodeId:    string;
  type:      string;
  config:    Record<string, unknown>;
}

export interface TimerState {
  nodeId:    string;
  deadline:  number;
  onExpire:  string;
}

export interface LogEntry {
  ts:        number;
  round:     number;
  player:    number;
  action:    string;
  detail:    string;
}

export interface FinalScore {
  playerIdx: number;
  name:      string;
  score:     number;
  breakdown: Record<string, number>;
}

// ── Pending Action (waiting for player input) ────────────────────────
export type PendingAction =
  | { type: 'CHOOSE_ACTION';    nodeId: string; playerIdx: number; options: string[] }
  | { type: 'CHOOSE_TARGET';    nodeId: string; playerIdx: number; validTargets: unknown[] }
  | { type: 'PLAY_CARD';        nodeId: string; playerIdx: number; handId: string }
  | { type: 'SECRET_BET';       nodeId: string; players: number[]; targets: unknown[] }
  | { type: 'TIE_BREAK';        nodeId: string; players: number[]; deadline: number }
  | { type: 'REACTIVE_DEFENSE'; nodeId: string; defenderIdx: number; attacks: number }
  | { type: 'SIMULTANEOUS';     nodeId: string; pending: number[] };

// ── Executor interface ────────────────────────────────────────────────
// Each node family implements this. execute() runs the node and returns
// what port(s) to follow next (or null if waiting for player input).
export interface NodeExecutor {
  types: string[];  // which node types this executor handles
  execute(
    node:    GraphNode,
    state:   GameState,
    inPort:  string,
    context: ExecutionContext
  ): ExecutionResult;
}

export interface ExecutionContext {
  triggerEvent(eventType: string, data: unknown): void;
  scheduleTimer(nodeId: string, ms: number, onExpire: string): void;
  cancelTimer(nodeId: string): void;
  emit(event: string, data: unknown): void;  // broadcast to clients
}

export type ExecutionResult =
  | { type: 'ADVANCE'; port: string }           // follow this output port
  | { type: 'ADVANCE_MANY'; ports: string[] }   // follow multiple ports (fan-out)
  | { type: 'WAIT'; pending: PendingAction }     // waiting for player input
  | { type: 'END' }                              // terminal node reached
  | { type: 'ERROR'; message: string };

// ── Player action (sent from client) ─────────────────────────────────
export interface PlayerAction {
  gameId:    string;
  playerIdx: number;
  type:      string;
  payload:   Record<string, unknown>;
}
