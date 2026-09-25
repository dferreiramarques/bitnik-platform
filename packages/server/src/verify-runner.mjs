// Corre DENTRO do processo isolado da verificação (ver verify.js):
//   node --permission --allow-fs-read=<pasta> --allow-fs-read=<motor> verify-runner.mjs <pasta>
// Importa o pacote, confirma o contrato, corre os testes aprovados e simula
// partidas com bots. Escreve um relatório JSON numa linha no stdout.
import { run } from 'node:test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const dir = process.argv[2];
const out = { steps: [], tests: { pass: 0, fail: 0, failures: [] }, simulation: [] };
const step = (id, ok, details = []) => { out.steps.push({ id, ok, details }); return ok; };
const done = () => { process.stdout.write(`\n@@RELATORIO@@${JSON.stringify(out)}\n`); process.exit(0); };

let engine;
let game;
try {
  // O motor pela ligação dentro da pasta do pacote: a única que o isolamento deixa ler
  // (e a mesma instância que o pacote e os testes usam).
  engine = await import(pathToFileURL(join(dir, 'node_modules', '@bitnik', 'engine', 'src', 'index.js')).href);
  game = (await import(pathToFileURL(join(dir, 'index.js')).href)).default;
  step('importar', true);
} catch (e) {
  step('importar', false, [String(e?.stack || e).split('\n').slice(0, 4).join('\n')]);
  done();
}

out.game = { id: game?.id ?? null, version: game?.version ?? null, players: game?.players ?? null };
const problems = engine.checkGame(game);
if (!game.enumerate) problems.push('falta "enumerate" (obrigatório nos jogos da Forge: bots, simulação e UI genérica)');
step('contrato', !problems.length, problems);

// Testes aprovados, no mesmo processo (sem lançar processos filhos).
try {
  const stream = run({ files: [join(dir, 'test', 'forge.test.js')], isolation: 'none', timeout: 20_000 });
  for await (const ev of stream) {
    if (ev.type === 'test:pass' && ev.data.details?.type !== 'suite') out.tests.pass++;
    if (ev.type === 'test:fail' && ev.data.details?.type !== 'suite') {
      out.tests.fail++;
      const err = ev.data.details?.error;
      out.tests.failures.push({ name: ev.data.name, error: String(err?.cause?.message || err?.message || err).slice(0, 800) });
    }
  }
  step('testes', out.tests.fail === 0 && out.tests.pass > 0, out.tests.pass ? [] : ['nenhum teste passou (há testes aprovados?)']);
} catch (e) {
  step('testes', false, [String(e?.message || e)]);
}

// Simulação: partidas só com bots para cada número de jogadores.
if (problems.length === 0) {
  let ok = true;
  for (let n = Math.max(1, game.players.min); n <= game.players.max; n++) {
    try {
      const r = engine.simulate(game, { numPlayers: n, games: 50, seed: `forge-${n}`, maxSteps: 3000 });
      out.simulation.push({ numPlayers: n, finished: r.finished, games: r.games, failures: r.failures.slice(0, 3), winRateBySeat: r.winRateBySeat, avgMoves: r.avgMoves });
      if (r.failures.length || r.finished < r.games) ok = false;
    } catch (e) {
      ok = false;
      out.simulation.push({ numPlayers: n, error: String(e?.message || e) });
    }
  }
  step('simulacao', ok, ok ? [] : ['há partidas com falhas ou que não acabam']);
}
done();
