// ═══════════════════════════════════════════════════════════════════
//  GRAPH ENGINE
//  O coração do runtime. Recebe uma acção do jogador, avança o grafo,
//  chama os executors certos, e devolve o novo estado.
//
//  É uma máquina de estados que usa o grafo .bge como definição.
// ═══════════════════════════════════════════════════════════════════

import type {
  GameState, GraphNode, NodeExecutor, ExecutionContext,
  ExecutionResult, PlayerAction, PendingAction,
} from './types';
import { getNode, getNextNodes, getTriggersForEvent } from './loader';

// ── Engine class ──────────────────────────────────────────────────────
export class BGEEngine {
  private executors: Map<string, NodeExecutor>;
  private eventHandlers: Map<string, (data: unknown) => void>;

  constructor(executors: NodeExecutor[]) {
    this.executors = new Map();
    this.eventHandlers = new Map();
    for (const ex of executors) {
      for (const type of ex.types) {
        this.executors.set(type, ex);
      }
    }
  }

  // ── Start a new game ─────────────────────────────────────────────
  start(state: GameState): { state: GameState; broadcast: unknown } {
    const startNode = getNode(state.graph, state.graph.startId);
    if (!startNode) throw new Error('GAME_START node not found in graph');

    this.log(state, -1, 'GAME_START', `Jogo "${state.bge.game.name}" iniciado`);

    // Execute GAME_START and follow the graph until we hit a WAIT or END
    const result = this.traverse(state, startNode, 'start');
    return { state, broadcast: this.buildBroadcast(state) };
  }

  // ── Process a player action ──────────────────────────────────────
  handleAction(state: GameState, action: PlayerAction): {
    state: GameState;
    broadcast: unknown;
    error?: string;
  } {
    // Validate it's this player's turn (for most actions)
    if (state.finalScores) {
      return { state, broadcast: null, error: 'Jogo já terminou' };
    }

    const pending = state.pendingAction;
    if (!pending) {
      return { state, broadcast: null, error: 'Nenhuma acção pendente' };
    }

    // Route to the appropriate resolver
    const result = this.resolvePending(state, action, pending);
    if (result.error) return { state, broadcast: null, error: result.error };

    // Continue traversal from where we left off
    if (result.continueFrom) {
      this.traverse(state, result.continueFrom.node, result.continueFrom.port);
    }

    state.turnGen++;
    return { state, broadcast: this.buildBroadcast(state) };
  }

  // ── Core traversal loop ──────────────────────────────────────────
  // Walks the graph node by node until it hits WAIT, END, or a dead end.
  private traverse(state: GameState, startNode: GraphNode, inPort: string): void {
    const MAX_STEPS = 200; // safety limit — prevents infinite loops
    let steps = 0;
    let current: GraphNode | null = startNode;
    let port = inPort;

    while (current && steps < MAX_STEPS) {
      steps++;
      const result = this.executeNode(state, current, port);

      if (result.type === 'END') {
        break;
      }

      if (result.type === 'WAIT') {
        state.pendingAction = result.pending;
        break;
      }

      if (result.type === 'ERROR') {
        this.log(state, state.currentPlayer, 'ERROR', result.message);
        break;
      }

      if (result.type === 'ADVANCE') {
        const nexts = getNextNodes(state.graph, current.id, result.port);
        if (nexts.length === 0) break;
        // Follow first (primary) edge; fan-out handled below
        current = nexts[0];
        port = this.getInPort(state.graph, current.id, result.port, current.id);
      }

      if (result.type === 'ADVANCE_MANY') {
        // Fan-out: follow all ports (e.g. Notify All → Score → Log)
        for (const p of result.ports) {
          const nexts = getNextNodes(state.graph, current.id, p);
          for (const next of nexts) {
            this.traverse(state, next, p);
          }
        }
        break;
      }
    }

    if (steps >= MAX_STEPS) {
      this.log(state, -1, 'ERROR', 'Max traversal steps reached — possible cycle');
    }
  }

  // ── Execute a single node ────────────────────────────────────────
  private executeNode(state: GameState, node: GraphNode, inPort: string): ExecutionResult {
    const executor = this.executors.get(node.type);
    if (!executor) {
      // Unknown node type — skip and follow first output
      const firstOutput = node.outputs.keys().next().value as string | undefined;
      if (firstOutput) return { type: 'ADVANCE', port: firstOutput };
      return { type: 'END' };
    }

    const ctx = this.buildContext(state, node);
    try {
      return executor.execute(node, state, inPort, ctx);
    } catch (err) {
      return { type: 'ERROR', message: `Node ${node.id} (${node.type}): ${err}` };
    }
  }

  // ── Resolve pending player input ─────────────────────────────────
  private resolvePending(
    state:   GameState,
    action:  PlayerAction,
    pending: PendingAction,
  ): { error?: string; continueFrom?: { node: GraphNode; port: string } } {

    const node = getNode(state.graph, pending.nodeId);
    if (!node) return { error: `Pending node ${pending.nodeId} not found` };

    const executor = this.executors.get(node.type);
    if (!executor) return { error: `No executor for ${node.type}` };

    // Delegate resolution to the executor
    // Each executor that can produce WAIT must also handle resolution
    const resolverKey = `resolve_${pending.type}`;
    const resolver = (executor as Record<string, unknown>)[resolverKey] as
      ((node: GraphNode, state: GameState, action: PlayerAction, pending: PendingAction) =>
        { error?: string; port?: string }) | undefined;

    if (!resolver) {
      // Default: clear pending and follow first output port
      state.pendingAction = null;
      const firstPort = node.outputs.keys().next().value as string | undefined;
      if (firstPort) {
        const nexts = getNextNodes(state.graph, node.id, firstPort);
        if (nexts.length > 0) return { continueFrom: { node: nexts[0], port: firstPort } };
      }
      return {};
    }

    const res = resolver.call(executor, node, state, action, pending);
    if (res.error) return { error: res.error };

    state.pendingAction = null;
    if (res.port) {
      const nexts = getNextNodes(state.graph, node.id, res.port);
      if (nexts.length > 0) return { continueFrom: { node: nexts[0], port: res.port } };
    }
    return {};
  }

  // ── Trigger system ────────────────────────────────────────────────
  fireTriggers(state: GameState, eventType: string, data: unknown): void {
    const triggers = getTriggersForEvent(state.graph, eventType);
    for (const trigger of triggers) {
      // Check if trigger condition is met (if it has one)
      const cond = trigger.config.cond as string | undefined;
      if (cond && !this.evalCondition(state, cond)) continue;

      // Check repeat policy
      const rep = trigger.config.rep as string | undefined;
      if (rep === 'once') {
        const key = `trigger_fired:${trigger.id}`;
        if (state.players[0]?.meta[key]) continue;
        state.players.forEach(p => { p.meta[key] = true; });
      }
      if (rep === 'per_turn') {
        const key = `trigger_fired:${trigger.id}:turn:${state.turnGen}`;
        if (state.players[0]?.meta[key]) continue;
        state.players.forEach(p => { p.meta[key] = true; });
      }

      // Follow the trigger's output
      const nexts = getNextNodes(state.graph, trigger.id, 'fire');
      for (const next of nexts) {
        this.traverse(state, next, 'fire');
      }
    }
  }

  // ── Condition evaluator ───────────────────────────────────────────
  // Simple safe evaluator for conditions like "score >= 10", "trickNum >= 4"
  // Runs in a sandboxed context with game state variables exposed.
  evalCondition(state: GameState, cond: string): boolean {
    try {
      const p = state.players[state.currentPlayer];
      // Build a safe evaluation context
      const ctx = {
        score:         p?.score ?? 0,
        playerCount:   state.playerCount,
        roundNum:      state.roundNum,
        turnGen:       state.turnGen,
        currentPlayer: state.currentPlayer,
        // Shortcuts for common patterns
        endgameFired:  state.players.some(pl => (pl.meta.endgameTriggered as boolean)),
        anyCompletedThisRound: state.players.some(pl => (pl.meta.completedThisRound as boolean)),
      };
      // Replace variable names in condition
      let expr = cond;
      for (const [k, v] of Object.entries(ctx)) {
        expr = expr.replace(new RegExp(`\\b${k}\\b`, 'g'), String(v));
      }
      // Evaluate simple arithmetic/comparison only
      // Allowed: numbers, >=, <=, >, <, ===, ==, !==, &&, ||, !
      if (!/^[\d\s+\-*/<>=!&|().]+$/.test(expr)) return false;
      // eslint-disable-next-line no-new-func
      return Boolean(new Function(`return (${expr})`)());
    } catch {
      return false;
    }
  }

  // ── Context builder ───────────────────────────────────────────────
  private buildContext(state: GameState, node: GraphNode): ExecutionContext {
    return {
      triggerEvent: (eventType, data) => this.fireTriggers(state, eventType, data),
      scheduleTimer: (nodeId, ms, onExpire) => {
        state.activeTimers.set(nodeId, {
          nodeId, onExpire,
          deadline: Date.now() + ms,
        });
      },
      cancelTimer: (nodeId) => { state.activeTimers.delete(nodeId); },
      emit: (event, data) => {
        const handler = this.eventHandlers.get(event);
        if (handler) handler(data);
      },
    };
  }

  // ── Event handler registration ────────────────────────────────────
  on(event: string, handler: (data: unknown) => void): void {
    this.eventHandlers.set(event, handler);
  }

  // ── Build client broadcast ────────────────────────────────────────
  // Privacy-aware: each player only sees their own hand.
  buildView(state: GameState, playerIdx: number): unknown {
    return {
      gameId:        state.gameId,
      phase:         state.phase,
      currentPlayer: state.currentPlayer,
      roundNum:      state.roundNum,
      myIdx:         playerIdx,
      players:       state.players.map(p => ({
        idx:       p.idx,
        name:      p.name,
        score:     p.score,
        resources: Object.fromEntries(p.resources),
      })),
      pendingAction: this.filterPending(state.pendingAction, playerIdx),
      // Game-specific data exposed for the generic client renderer
      decks:   Object.fromEntries([...state.decks.entries()].map(([k,v]) => [k, v.length])),
      myHand:  Object.fromEntries(
        [...state.hands.entries()]
          .filter(([k]) => k.endsWith(`:${playerIdx}`))
          .map(([k, v]) => [k, v])
      ),
      board:   Object.fromEntries(state.board),
      zones:   Object.fromEntries(state.zones),
      log:     state.log.slice(-20),
      finalScores: state.finalScores,
    };
  }

  private buildBroadcast(state: GameState): Record<number, unknown> {
    const views: Record<number, unknown> = {};
    for (let i = 0; i < state.playerCount; i++) {
      views[i] = this.buildView(state, i);
    }
    return views;
  }

  private filterPending(pending: PendingAction | null, playerIdx: number): unknown {
    if (!pending) return null;
    // Only send pending info relevant to this player
    if ('playerIdx' in pending && pending.playerIdx !== playerIdx) return { type: 'OTHER_WAITING' };
    if ('players' in pending && !pending.players.includes(playerIdx)) return { type: 'OTHER_WAITING' };
    return pending;
  }

  private getInPort(_graph: unknown, _toNodeId: string, _fromPort: string, _nodeId: string): string {
    // In most cases the in port is simply the name of the connection
    // The loader already built the adjacency; here we just need the inPort name
    // Default: 'in' for most nodes
    return 'in';
  }

  private log(state: GameState, player: number, action: string, detail: string): void {
    state.log.push({ ts: Date.now(), round: state.roundNum, player, action, detail });
  }
}
