// Verificação estática da pureza de um ficheiro de pacote de jogo.
// As regras não usam rede, relógio nem Math.random, e só importam
// @bitnik/engine e ficheiros próprios. Serve para os testes dos pacotes
// e para validar o código gerado pela Forge.

const FORBIDDEN = [
  [/\bMath\.random\s*\(/, 'Math.random (usa ctx.rng)'],
  [/\bDate\.now\s*\(/, 'Date.now (as regras não sabem a hora)'],
  [/\bnew\s+Date\s*\(/, 'new Date (as regras não sabem a hora)'],
  [/\bperformance\.now\s*\(/, 'performance.now (as regras não sabem a hora)'],
  [/\b(?:setTimeout|setInterval|setImmediate)\s*\(/, 'timer do sistema (usa ctx.schedule)'],
  [/\bfetch\s*\(/, 'fetch (sem rede)'],
  [/\bprocess\./, 'process (sem ambiente)'],
  [/\brequire\s*\(/, 'require (os pacotes são ESM)'],
  [/\bimport\s*\(/, 'import dinâmico'],
];

/** Tira comentários mantendo as linhas, para os números de linha baterem certo. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

/**
 * Devolve a lista de problemas de um ficheiro de pacote (vazia se estiver limpo).
 * @param {string} source
 * @param {string} [file] nome usado nas mensagens
 */
export function checkPurity(source, file = 'pacote') {
  const problems = [];
  const lines = stripComments(source).split('\n');
  lines.forEach((line, i) => {
    for (const [re, what] of FORBIDDEN) if (re.test(line)) problems.push(`${file}:${i + 1}: ${what}`);
    for (const [, spec] of line.matchAll(/(?:\bfrom\s+|^\s*import\s+)['"]([^'"]+)['"]/g)) {
      if (spec !== '@bitnik/engine' && !spec.startsWith('./')) problems.push(`${file}:${i + 1}: importa ${spec}`);
    }
  });
  return problems;
}
