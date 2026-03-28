// ═══════════════════════════════════════════════════════════════════
//  EXECUTORS — FLOW + LOGIC
//  Os primeiros dois executors do runtime.
//  Cada executor sabe correr os nós da sua família e avançar o grafo.
// ═══════════════════════════════════════════════════════════════════

import type {
  GraphNode, GameState, NodeExecutor,
  ExecutionContext, ExecutionResult,
} from '../engine/types';

// ── FLOW Executor ─────────────────────────────────────────────────────
export const FlowExecutor: NodeExecutor = {
  types: ['GAME_START', 'ROUND_START', 'TURN_START', 'TURN_END',
          'TURN_BLOCK', 'GAME_END', 'INSTANT_WIN', 'EXTRA_TURNS'],

  execute(node, state, inPort, ctx): ExecutionResult {
    switch (node.type) {

      case 'GAME_START': {
        // Initialise game-level config from node config
        const maxPlayers = Number(node.config.maxPlayers) || 4;
        ctx.emit('game_started', { name: state.bge.game.name, maxPlayers });
        state.phase = node.id;
        return { type: 'ADVANCE', port: 'next' };
      }

      case 'ROUND_START': {
        // Reset per-round state
        state.players.forEach(p => {
          p.meta.completedThisRound = false;
          p.meta.contestedThisRound = [];
          p.meta.trickNum = 0;
        });
        state.phase = node.id;
        ctx.emit('round_started', { round: state.roundNum });
        return { type: 'ADVANCE', port: 'next' };
      }

      case 'TURN_START': {
        state.phase = node.id;
        ctx.triggerEvent('ON_TURN_S', { player: state.currentPlayer });
        ctx.emit('turn_started', { player: state.currentPlayer });
        return { type: 'ADVANCE', port: 'next' };
      }

      case 'TURN_END': {
        ctx.triggerEvent('ON_TURN_E', { player: state.currentPlayer });
        // Advance to next player
        state.currentPlayer = (state.currentPlayer + 1) % state.playerCount;
        state.turnGen++;
        ctx.emit('turn_ended', { nextPlayer: state.currentPlayer });
        return { type: 'ADVANCE', port: 'next' };
      }

      case 'TURN_BLOCK': {
        // The Turn Block is a macro — it presents available actions to the player
        // and waits for them to choose (up to N, or one, etc.)
        const tb = node.config.tb as {
          constraint: string;
          max?: number;
          actions: Array<{ id: string; type: string; mand: boolean }>;
          outcomes: Array<{ id: string; label: string; color: string }>;
        } | undefined;

        if (!tb) return { type: 'ADVANCE', port: 'end_turn' };

        state.phase = node.id;

        // Initialise turn action tracking
        const p = state.players[state.currentPlayer];
        p.meta.turnActionsRemaining = tb.constraint === 'choose_1' ? 1 : (tb.max ?? 2);
        p.meta.turnActionsTaken = 0;
        p.meta.turnConstraint = tb.constraint;
        p.meta.turnActions = tb.actions;
        p.meta.turnOutcomes = tb.outcomes;
        p.meta.mandatoryActions = tb.actions.filter(a => a.mand).map(a => a.type);
        p.meta.completedMandatory = [];

        // Present action choices to the player
        return {
          type: 'WAIT',
          pending: {
            type:      'CHOOSE_ACTION',
            nodeId:    node.id,
            playerIdx: state.currentPlayer,
            options:   tb.actions.map(a => a.type),
          },
        };
      }

      case 'GAME_END': {
        state.phase = 'GAME_OVER';
        // Sort players by score for final ranking
        const ranked = [...state.players].sort((a, b) => b.score - a.score);
        state.finalScores = ranked.map(p => ({
          playerIdx:  p.idx,
          name:       p.name,
          score:      p.score,
          breakdown:  p.meta.scoreBreakdown as Record<string, number> || {},
        }));
        ctx.emit('game_ended', { finalScores: state.finalScores });
        return { type: 'END' };
      }

      case 'INSTANT_WIN': {
        const winner = state.players[state.currentPlayer];
        state.finalScores = [{ playerIdx: winner.idx, name: winner.name, score: 999, breakdown: {} }];
        state.phase = 'GAME_OVER';
        ctx.emit('instant_win', { winner: winner.idx, name: winner.name });
        return { type: 'END' };
      }

      case 'EXTRA_TURNS': {
        // Give each remaining player one more turn
        state.phase = node.id;
        const remaining = state.players.map(p => p.idx);
        ctx.emit('extra_turns_started', { players: remaining });
        // Mark state so TURN_END knows to go to 'done' instead of looping
        state.players.forEach(p => { p.meta.inExtraTurns = true; });
        return { type: 'ADVANCE', port: 'done' };
      }

      default:
        return { type: 'ADVANCE', port: 'next' };
    }
  },

  // ── TURN_BLOCK resolution ────────────────────────────────────────
  resolve_CHOOSE_ACTION(node, state, action, pending): { error?: string; port?: string } {
    const tb = node.config.tb as {
      constraint: string;
      max?: number;
      actions: Array<{ id: string; type: string; mand: boolean }>;
      outcomes: Array<{ id: string; label: string; color: string }>;
    };

    const p     = state.players[pending.playerIdx];
    const taken = (p.meta.turnActionsTaken as number) || 0;
    const max   = (p.meta.turnActionsRemaining as number) || 1;

    if (action.type === 'END_TURN') {
      // Check mandatory actions are done
      const mandatory  = (p.meta.mandatoryActions as string[]) || [];
      const completed  = (p.meta.completedMandatory as string[]) || [];
      const missing    = mandatory.filter(m => !completed.includes(m));
      if (missing.length > 0) return { error: `Acção obrigatória não completada: ${missing[0]}` };
      return { port: 'end_turn' };
    }

    // Record action taken
    p.meta.turnActionsTaken = taken + 1;
    const completed = (p.meta.completedMandatory as string[]) || [];
    completed.push(action.type as string);
    p.meta.completedMandatory = completed;

    // If reached max, auto-end turn
    if ((taken + 1) >= max || tb.constraint === 'choose_1') {
      const mandatory = (p.meta.mandatoryActions as string[]) || [];
      const missing   = mandatory.filter(m => !completed.includes(m));
      if (missing.length > 0) {
        // Still need mandatory — but give player one more chance
        state.pendingAction = {
          type:      'CHOOSE_ACTION',
          nodeId:    node.id,
          playerIdx: pending.playerIdx,
          options:   (p.meta.turnActions as Array<{ type: string }>)?.map(a => a.type) || [],
        };
        return {};
      }
      return { port: 'end_turn' };
    }

    // Still has actions left — re-present choice
    state.pendingAction = {
      type:      'CHOOSE_ACTION',
      nodeId:    node.id,
      playerIdx: pending.playerIdx,
      options:   (p.meta.turnActions as Array<{ type: string }>)?.map(a => a.type) || [],
    };
    return {};
  },
};

// ── LOGIC Executor ────────────────────────────────────────────────────
export const LogicExecutor: NodeExecutor = {
  types: ['CHECK_COND', 'CHECK_RES', 'CHECK_WIN', 'DICE_ROLL',
          'COMBO_DET', 'CONF_CHOICE', 'RANDOM'],

  execute(node, state, inPort, ctx): ExecutionResult {
    switch (node.type) {

      case 'CHECK_COND': {
        const cond = node.config.cond as string || 'false';
        // Use the engine's condition evaluator via a workaround
        // (In practice the engine passes itself or we evaluate inline)
        const result = evalCond(cond, state);
        return { type: 'ADVANCE', port: result ? 'true' : 'false' };
      }

      case 'CHECK_RES': {
        const res = node.config.res as string;
        const amt = Number(node.config.amt) || 1;
        const p   = state.players[state.currentPlayer];
        const has = (p.resources.get(res) || 0) >= amt;
        return { type: 'ADVANCE', port: has ? 'yes' : 'no' };
      }

      case 'CHECK_WIN': {
        const cond = node.config.cond as string || 'false';
        const won  = evalCond(cond, state);
        if (won) ctx.triggerEvent('ON_SCORE', { type: 'win', player: state.currentPlayer });
        return { type: 'ADVANCE', port: won ? 'win' : 'continue' };
      }

      case 'DICE_ROLL': {
        const count = Number(node.config.count) || 9;
        const sides = Number(node.config.sides) || 6;
        const dice  = Array.from({ length: count }, () => Math.ceil(Math.random() * sides));
        // Store result in current player meta for downstream COMBO_DET
        state.players[state.currentPlayer].meta.lastRoll = dice;
        ctx.emit('dice_rolled', { player: state.currentPlayer, dice });
        return { type: 'ADVANCE', port: 'result' };
      }

      case 'COMBO_DET': {
        const dice   = (state.players[state.currentPlayer].meta.lastRoll as number[]) || [];
        const combos = detectCombos(dice);
        state.players[state.currentPlayer].meta.lastCombos = combos;
        ctx.emit('combos_detected', { player: state.currentPlayer, combos });

        if (combos.length === 0) return { type: 'ADVANCE', port: 'combos' };

        // If multiple valid bundles → conflict choice needed
        if (combos.length > 1) {
          return {
            type: 'WAIT',
            pending: {
              type:      'CHOOSE_ACTION',
              nodeId:    node.id,
              playerIdx: state.currentPlayer,
              options:   combos.map(c => c.join('+')),
            },
          };
        }
        return { type: 'ADVANCE', port: 'combos' };
      }

      case 'CONF_CHOICE': {
        const options = (state.players[state.currentPlayer].meta.lastCombos as string[][]) || [];
        return {
          type: 'WAIT',
          pending: {
            type:      'CHOOSE_ACTION',
            nodeId:    node.id,
            playerIdx: state.currentPlayer,
            options:   options.map(c => (Array.isArray(c) ? c.join('+') : String(c))),
          },
        };
      }

      case 'RANDOM': {
        const options = node.outputs.size;
        const ports   = [...node.outputs.keys()];
        const chosen  = ports[Math.floor(Math.random() * ports.length)];
        return { type: 'ADVANCE', port: chosen || 'result' };
      }

      default:
        return { type: 'ADVANCE', port: 'next' };
    }
  },
};

// ── Helpers ───────────────────────────────────────────────────────────
function evalCond(cond: string, state: GameState): boolean {
  try {
    const p = state.players[state.currentPlayer];
    const vars: Record<string, unknown> = {
      score:         p?.score ?? 0,
      playerCount:   state.playerCount,
      roundNum:      state.roundNum,
      turnGen:       state.turnGen,
      currentPlayer: state.currentPlayer,
      endgameFired:  state.players.some(pl => pl.meta.endgameTriggered),
      anyCompletedThisRound: state.players.some(pl => pl.meta.completedThisRound),
      trickNum:      p?.meta?.trickNum ?? 0,
      winners:       (state.players[0]?.meta?.lastWinners as unknown[]) ?? [],
    };
    let expr = cond;
    for (const [k, v] of Object.entries(vars)) {
      if (typeof v === 'number' || typeof v === 'boolean') {
        expr = expr.replace(new RegExp(`\\b${k}\\b`, 'g'), String(v));
      } else if (Array.isArray(v)) {
        expr = expr.replace(new RegExp(`${k}\\.length`, 'g'), String((v as unknown[]).length));
      }
    }
    if (!/^[\d\s+\-*/<>=!&|().]+$/.test(expr)) return false;
    // eslint-disable-next-line no-new-func
    return Boolean(new Function(`return (${expr})`)());
  } catch {
    return false;
  }
}

// Nine Oils style combo detection for dice games
function detectCombos(dice: number[]): string[][] {
  const freq: Record<number, number> = {};
  dice.forEach(d => { freq[d] = (freq[d] || 0) + 1; });
  const max = Math.max(...Object.values(freq), 0);

  if (max === 9) return [['INSTANT_WIN']];
  if (max === 8) return [['DOUBLE_QUAD']];
  if (max === 7) return [['JOKER']];
  if (max === 6) return [['SIX_OF_KIND']];

  // Enumerate valid bundles
  const bundles: string[][] = [];
  const faces = Object.entries(freq).sort(([, a], [, b]) => b - a);

  for (const [fStr, count] of faces) {
    const f = Number(fStr);
    if (count >= 5) bundles.push(['PENTA']);
    if (count >= 4) bundles.push(['QUAD']);
    if (count >= 3) {
      // Find a pair from a different face
      const pairFace = faces.find(([g, c]) => Number(g) !== f && c >= 2);
      if (pairFace) bundles.push(['TRIPLE_DOUBLE']);
    }
    if (count >= 2) bundles.push(['DOUBLE']);
  }

  return bundles.length > 0 ? bundles : [];
}
