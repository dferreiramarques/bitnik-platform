// Verificação de um pacote gerado pela Forge (ADR-012/013), num processo
// isolado: o sistema de permissões do Node só deixa ler a pasta do pacote e
// o motor, não deixa lançar processos nem escrever, e há limite de tempo.
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile, symlink } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { checkPurity } from '@bitnik/engine';

const RUNNER = fileURLToPath(new URL('./verify-runner.mjs', import.meta.url));
const ENGINE_ROOT = resolve(dirname(fileURLToPath(import.meta.resolve('@bitnik/engine'))), '..');
const FILE = /^(?:[\w-]+\/)*[\w.-]+\.(?:js|json|md)$/;
const MAX_FILES = 60;
const MAX_BYTES = 1_000_000;

/** Junta os testes aprovados num ficheiro node:test, com o cabeçalho comum. */
export function composeTests(items) {
  const header = `// Gerado pela Forge a partir dos testes aprovados (não editar à mão).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, applyMove, fireTimer, simulate, viewFor, legalMoves } from '@bitnik/engine';
import game from '../index.js';
const tweak = (m, fn) => { const c = structuredClone(m); fn(c.state); return c; };
`;
  return header + items.map((t) => `\n// ${t.cartao ? `cartão ${t.cartao}` : `partida ${t.narracao}`}: ${String(t.nome).replace(/\n/g, ' ')}\n${t.codigo}\n`).join('');
}

/**
 * @param {{ files: Record<string,string>, tests: Array, timeoutMs?: number }} input
 * @returns {Promise<{ ok, steps, tests, simulation, ms }>}
 */
export async function verifyPackage({ files, tests, timeoutMs = 60_000 }) {
  const t0 = Date.now();
  const report = { ok: false, steps: [], tests: { pass: 0, fail: 0, failures: [] }, simulation: [], ms: 0 };
  const step = (id, ok, details = []) => { report.steps.push({ id, ok, details }); return ok; };
  const finish = () => { report.ms = Date.now() - t0; report.ok = report.steps.every((s) => s.ok); return report; };

  // 1. Ficheiros: nomes seguros, tamanhos, index.js presente.
  const entries = Object.entries(files || {});
  const bad = entries.filter(([p]) => !FILE.test(p) || p.includes('..') || p.startsWith('test/') || p.startsWith('node_modules/')).map(([p]) => p);
  const bytes = entries.reduce((s, [, c]) => s + String(c).length, 0);
  const fileProblems = [
    ...bad.map((p) => `nome de ficheiro não permitido: ${p}`),
    ...(!files?.['index.js'] ? ['falta index.js'] : []),
    ...(entries.length > MAX_FILES ? [`demasiados ficheiros (${entries.length})`] : []),
    ...(bytes > MAX_BYTES ? ['o pacote é demasiado grande'] : []),
  ];
  if (!step('ficheiros', !fileProblems.length, fileProblems)) return finish();

  // 2. Pureza das regras (a UI e os textos podem mais, mas nunca o servidor).
  const purity = entries.filter(([p]) => p.endsWith('.js') && !p.startsWith('ui/')).flatMap(([p, c]) => checkPurity(String(c), p));
  step('pureza', !purity.length, purity);

  // 3. Pasta de trabalho: pacote, testes aprovados e o motor ligado.
  const approved = (tests || []).filter((t) => t.aprovado && String(t.codigo || '').trim());
  if (!step('testes-aprovados', approved.length > 0, approved.length ? [] : ['não há testes aprovados'])) return finish();
  const work = join(tmpdir(), 'bitnik-forge', randomBytes(6).toString('hex'));
  const pkg = join(work, 'pkg');
  try {
    for (const [p, c] of entries) {
      await mkdir(dirname(join(pkg, p)), { recursive: true });
      await writeFile(join(pkg, p), String(c));
    }
    await writeFile(join(pkg, 'package.json'), JSON.stringify({ name: 'forge-candidato', type: 'module' }));
    await mkdir(join(pkg, 'test'), { recursive: true });
    await writeFile(join(pkg, 'test', 'forge.test.js'), composeTests(approved));
    await mkdir(join(pkg, 'node_modules', '@bitnik'), { recursive: true });
    await symlink(ENGINE_ROOT, join(pkg, 'node_modules', '@bitnik', 'engine'), 'junction');

    // 4. Processo isolado.
    const args = [
      '--permission',
      `--allow-fs-read=${work}${sep}*`, `--allow-fs-read=${ENGINE_ROOT}${sep}*`, `--allow-fs-read=${RUNNER}`,
      RUNNER, pkg,
    ];
    const { stdout, stderr, code, timedOut } = await new Promise((done) => {
      const child = spawn(process.execPath, args, { cwd: pkg, env: { NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'] });
      let so = '';
      let se = '';
      child.stdout.on('data', (d) => { so += d; if (so.length > 2_000_000) child.kill('SIGKILL'); });
      child.stderr.on('data', (d) => { se += d; if (se.length > 200_000) se = se.slice(-100_000); });
      const timer = setTimeout(() => { child.kill('SIGKILL'); done({ stdout: so, stderr: se, code: null, timedOut: true }); }, timeoutMs);
      child.on('close', (c) => { clearTimeout(timer); done({ stdout: so, stderr: se, code: c, timedOut: false }); });
    });
    if (timedOut) {
      step('tempo', false, [`a verificação passou de ${Math.round(timeoutMs / 1000)} s (ciclo infinito nas regras ou nos testes?)`]);
      return finish();
    }
    const marker = stdout.lastIndexOf('@@RELATORIO@@');
    if (marker < 0) {
      step('processo', false, [`o processo terminou sem relatório (código ${code})`, stderr.split('\n').slice(0, 8).join('\n')]);
      return finish();
    }
    const inner = JSON.parse(stdout.slice(marker + '@@RELATORIO@@'.length).split('\n')[0]);
    report.steps.push(...inner.steps);
    report.tests = inner.tests;
    report.simulation = inner.simulation;
    report.game = inner.game ?? null;
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
  return finish();
}
