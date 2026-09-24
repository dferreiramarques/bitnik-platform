// Simulação com bots: joga N partidas completas e devolve métricas.
// Serve para testes de robustez (fuzz) e, no Studio, para balanceamento.
import { createMatch, applyMove, fireTimer, activeSeats, botMove } from './index.js';
import { createRng, seedFrom } from './rng.js';

/**
 * Relógio simulado, com a mesma regra do servidor: um timer vence em
 * (momento em que foi agendado + delayMs). Reagendar a mesma key
 * (seq diferente) recomeça a contagem. As jogadas não gastam tempo.
 */
function timerClock() {
  const due = new Map(); // key → { seq, at }
  let now = 0;
  return {
    /** O timer que vence primeiro (empate: ordem da key, determinística). */
    next(timers) {
      for (const t of timers) {
        const d = due.get(t.key);
        if (!d || d.seq !== t.seq) due.set(t.key, { seq: t.seq, at: now + t.delayMs });
      }
      let best = null;
      for (const t of timers) {
        const at = due.get(t.key).at;
        if (!best || at < best.at || (at === best.at && t.key < best.t.key)) best = { t, at };
      }
      return best;
    },
    advance(at) { now = Math.max(now, at); },
  };
}

/**
 * @param {object} opts
 * @param {number} [opts.idleRate=0] probabilidade de, com timers pendentes, os
 *   bots não jogarem e o tempo esgotar (exercita os `events` de timeout).
 */
export function simulate(game, {
  numPlayers, games = 100, seed = 1, maxSteps = 5000, level = 'default', idleRate = 0, onMatch,
} = {}) {
  const wins = Array(numPlayers).fill(0);
  const lengths = [];
  const failures = [];
  let timersFired = 0;

  for (let i = 0; i < games; i++) {
    let m = createMatch(game, { numPlayers, seed: `${seed}:${i}` });
    const clock = timerClock();
    const idle = createRng(seedFrom(`${seed}:${i}:idle`));
    let steps = 0;
    while (!m.result && steps < maxSteps) {
      steps++;
      const seats = activeSeats(game, m);
      // Ninguém pode jogar, ou os jogadores deixam esgotar o tempo: dispara o próximo timer.
      if (!seats.length || (m.timers.length && idleRate > 0 && idle.chance(idleRate))) {
        const next = clock.next(m.timers);
        if (!next) { failures.push({ game: i, seq: m.seq, reason: 'bloqueado sem timers' }); break; }
        clock.advance(next.at);
        const r = fireTimer(game, m, next.t.key);
        if (!r.ok) { failures.push({ game: i, seq: m.seq, reason: `@${next.t.event}: ${r.error.code}` }); break; }
        m = r.match;
        timersFired++;
        continue;
      }
      const seat = seats[0];
      const mv = botMove(game, m, seat, level);
      if (!mv) { failures.push({ game: i, seq: m.seq, reason: `bot do lugar ${seat} sem jogada` }); break; }
      const r = applyMove(game, m, seat, mv);
      if (!r.ok) { failures.push({ game: i, seq: m.seq, reason: `${mv.type}: ${r.error.code}`, move: mv, error: r.error }); break; }
      m = r.match;
    }
    if (!m.result && steps >= maxSteps) failures.push({ game: i, seq: m.seq, reason: 'maxSteps' });
    if (m.result) {
      for (const w of m.result.winners) wins[w] += 1 / m.result.winners.length;
      lengths.push(m.seq);
    }
    onMatch?.(m, i);
  }

  const avg = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1);
  return {
    games,
    finished: lengths.length,
    failures,
    timersFired,
    avgMoves: Math.round(avg * 10) / 10,
    winRateBySeat: wins.map((w) => Math.round((w / (lengths.length || 1)) * 1000) / 10),
  };
}
