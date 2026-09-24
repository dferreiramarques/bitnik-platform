// Simulação com bots: joga N partidas completas e devolve métricas.
// Serve para testes de robustez (fuzz) e, no Studio, para balanceamento.
import { createMatch, applyMove, fireTimer, activeSeats, botMove } from './index.js';

export function simulate(game, { numPlayers, games = 100, seed = 1, maxSteps = 5000, level = 'default', onMatch } = {}) {
  const wins = Array(numPlayers).fill(0);
  const lengths = [];
  const failures = [];

  for (let i = 0; i < games; i++) {
    let m = createMatch(game, { numPlayers, seed: `${seed}:${i}` });
    let steps = 0;
    while (!m.result && steps < maxSteps) {
      steps++;
      const seats = activeSeats(game, m);
      if (!seats.length) {
        // Ninguém pode jogar: só um timer pode avançar o jogo.
        const t = m.timers[0];
        if (!t) { failures.push({ game: i, seq: m.seq, reason: 'bloqueado sem timers' }); break; }
        m = fireTimer(game, m, t.key).match;
        continue;
      }
      const seat = seats[0];
      const mv = botMove(game, m, seat, level);
      if (!mv) { failures.push({ game: i, seq: m.seq, reason: `bot do lugar ${seat} sem jogada` }); break; }
      const r = applyMove(game, m, seat, mv);
      if (!r.ok) { failures.push({ game: i, seq: m.seq, reason: `${mv.type}: ${r.error.code}`, move: mv }); break; }
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
    avgMoves: Math.round(avg * 10) / 10,
    winRateBySeat: wins.map((w) => Math.round((w / (lengths.length || 1)) * 1000) / 10),
  };
}
