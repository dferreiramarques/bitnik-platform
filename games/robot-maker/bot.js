// Bots do Robot Maker: BETA-7 (agressivo), GRIX (defensivo) e LUMIS (eficiência).
// Mesma ordem de decisão; só mudam as preferências (cartões c-bot-*).
import { SLOTS, parsePeca, custoDe } from './rules.js';

const PERFIS = {
  beta7: { forja: ['arm', 'port', 'head', 'chest', 'legs'], compra: ['arm', 'port', 'combat', 'head', 'chest', 'legs'] },
  grix: { forja: ['chest', 'legs', 'head', 'arm', 'port'], compra: ['chest', 'legs', 'shield', 'head', 'arm', 'port'] },
  lumis: { forja: ['head', 'chest', 'legs', 'arm', 'port'], compra: ['head', 'bio', 'chest', 'legs', 'arm', 'port'] },
};
const PERFIL_DO_LUGAR = ['lumis', 'beta7', 'grix', 'lumis'];

const preferencia = (lista, p) => {
  const i = lista.indexOf(p.tipo === 'robot' ? p.slot : p.familia);
  return i < 0 ? lista.length : i;
};

export function escolher(view, seat, legal, perfilId) {
  const perfil = PERFIS[perfilId] ?? PERFIS.lumis;
  const j = view.jogadores[seat];
  const por = (type) => legal.filter((m) => m.type === type);
  // Fase do mercado: compra o que prefere, ou passa.
  if (view.fase === 'mercado') {
    const compras = por('COMPRAR')
      .map((m) => ({ m, p: parsePeca(m.payload.peca) }))
      .sort((a, b) => preferencia(perfil.compra, a.p) - preferencia(perfil.compra, b.p) || b.p.nivel - a.p.nivel);
    return compras[0]?.m ?? por('PASSAR')[0] ?? legal[0];
  }
  // Fase dos workers: Forja, Deploy com um worker a mais, Optimizador se a compra precisa de L2, senão Compilador.
  const forja = por('FORJA').sort((a, b) => perfil.forja.indexOf(a.payload.peca) - perfil.forja.indexOf(b.payload.peca))[0];
  if (forja) return forja;
  const deploy = por('DEPLOY')[0];
  if (deploy && ((j.workers >= 2 && j.livres < j.workers) || j.l1 >= 5)) return deploy;
  const precisaL2 = (view.compraveis || []).some((id) => custoDe(parsePeca(id))[1] > j.l2);
  if (j.l1 >= 2 && precisaL2) return por('OPTIMIZADOR')[0] ?? legal[0];
  return por('COMPILADOR')[0] ?? por('IR_AO_MERCADO')[0] ?? por('PASSAR')[0] ?? legal[0];
}

export const defaultBot = (view, seat, { legal }) => escolher(view, seat, legal, PERFIL_DO_LUGAR[seat % PERFIL_DO_LUGAR.length]);
export { SLOTS };
