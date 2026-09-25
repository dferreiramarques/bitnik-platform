// Simulação com bots a partir da linha de comandos.
//   npm run simulate -- catania 500
//   npm run simulate -- bulbous 500 0.2   (idleRate: 20% das vezes o tempo esgota)
// Mostra, por número de jogadores: partidas acabadas, falhas,
// média de jogadas e % de vitórias por lugar (deteta vantagem de lugar).
import { simulate, playerCounts } from '@bitnik/engine';

const [gameId = 'catania', gamesArg = '300', idleArg = '0'] = process.argv.slice(2);
const game = (await import(`@bitnik/game-${gameId}`)).default;
const games = Number(gamesArg);
const idleRate = Number(idleArg);

console.log(`${game.id} v${game.version}, ${games} partidas por configuração\n`);
for (const n of playerCounts(game).filter((x) => x >= 2)) {
  const t0 = Date.now();
  const r = simulate(game, { numPlayers: n, games, seed: `cli-${n}`, idleRate });
  console.log(`${n} jogadores: ${r.finished}/${games} acabadas, ${r.failures.length} falhas, `
    + `${r.avgMoves} jogadas em média, vitórias por lugar ${r.winRateBySeat.map((x) => `${x}%`).join(' / ')} `
    + `${r.timersFired ? `, ${r.timersFired} timers ` : ''}(${Date.now() - t0} ms)`);
  for (const f of r.failures.slice(0, 3)) console.log('   falha:', JSON.stringify(f));
}
