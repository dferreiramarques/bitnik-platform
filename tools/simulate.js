// Simulação com bots a partir da linha de comandos.
//   npm run simulate -- catania 500
// Mostra, por número de jogadores: partidas acabadas, falhas,
// média de jogadas e % de vitórias por lugar (deteta vantagem de lugar).
import { simulate } from '@bitnik/engine';

const [gameId = 'catania', gamesArg = '300'] = process.argv.slice(2);
const game = (await import(`@bitnik/game-${gameId}`)).default;
const games = Number(gamesArg);

console.log(`${game.id} v${game.version}, ${games} partidas por configuração\n`);
for (let n = Math.max(2, game.players.min); n <= game.players.max; n++) {
  const t0 = Date.now();
  const r = simulate(game, { numPlayers: n, games, seed: `cli-${n}` });
  console.log(`${n} jogadores: ${r.finished}/${games} acabadas, ${r.failures.length} falhas, `
    + `${r.avgMoves} jogadas em média, vitórias por lugar ${r.winRateBySeat.map((x) => `${x}%`).join(' / ')} `
    + `(${Date.now() - t0} ms)`);
  for (const f of r.failures.slice(0, 3)) console.log('   falha:', JSON.stringify(f));
}
