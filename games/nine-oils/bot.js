// Bot do Nine Oils, igual ao do servidor antigo: joga as Sedutoras (ou um
// Rapaz se houver garrafas para roubar), escolhe a melhor combinação, bloqueia
// sempre que pode e descarta primeiro as cartas de menos valor.
import { valorConjunto } from './rules.js';

const PRIORIDADE = { BULLY: 3, BOY: 2, TEMPTRESS: 1 };

export function defaultBot(v, lugar, { rng, legal }) {
  if (!legal.length) return null;
  const mao = v.minhaMao;
  const tipo = legal[0].type;
  if (tipo === 'LANCAR') {
    const opp = v.jogadores[1 - lugar];
    const sedutoras = mao.map((c, i) => (c === 'TEMPTRESS' ? i : -1)).filter((i) => i >= 0);
    let quer = sedutoras;
    if (!quer.length && mao.includes('BOY') && opp.banca.includes(2)) quer = [mao.indexOf('BOY')];
    const tipos = (m) => m.payload.cartas.map((i) => mao[i]).sort().join('|');
    const alvo = quer.map((i) => mao[i]).sort().join('|');
    return legal.find((m) => tipos(m) === alvo) ?? legal[0];
  }
  if (tipo === 'DEFENDER') return legal.at(-1); // bloqueia o máximo possível
  if (tipo === 'ESCOLHA_CEGA') return rng.pick(legal);
  if (tipo === 'CONTINUAR') return legal[0];
  if (tipo === 'ESCOLHER_COMBO') {
    return legal.reduce((best, m) => (valorConjunto(v.opcoes[m.payload.opcao]) > valorConjunto(v.opcoes[best.payload.opcao]) ? m : best));
  }
  if (tipo === 'DESCARTAR') {
    return legal.reduce((best, m) => ((PRIORIDADE[mao[m.payload.carta]] ?? 0) < (PRIORIDADE[mao[best.payload.carta]] ?? 0) ? m : best));
  }
  return legal[0];
}
