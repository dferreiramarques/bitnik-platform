// Cenários do Catania (ADR-007): estados iniciais fixos, pedidos com
// createMatch(game, { options: { scenario } }). Servem o tutorial, a
// pré-visualização da aparência e, na Forge, o "Dado…" dos cartões Gherkin.
// Portados do tutorial do catania-v2 (tutNewGame, tutMidGame).
import { RESOURCES, buildIsland } from './board.js';

// Ilha de 4 jogadores com um território de cada recurso à volta do Etna
// (mesma ordem de posições que LAYOUTS[4] em board.js).
const TUT_TYPES = ['vulcao', 'peixe', 'vinho', 'cereais', 'azeite', 'calcario', 'peixe', 'vinho', 'azeite', 'cereais', 'calcario'];

const zero = () => Object.fromEntries(RESOURCES.map((r) => [r, 0]));
const freshTurn = () => ({ collects: 0, founded: false, firePending: false, visited: [] });

function tutorialStart(ctx) {
  const hexes = buildIsland(4, ctx.rng).map((h, i) => ({ ...h, type: TUT_TYPES[i] }));
  const pile = (d) => ({ discs: [d], collected: 0 });
  return {
    hexes,
    tower: [1, 2, 2, 3, 4, 4, 5, 6, 6, 7, 8, 8, 9],
    piles: { cereais: pile(10), vinho: pile(12), peixe: pile(11), calcario: pile(10), azeite: pile(11) },
    fire: 0,
    players: Array.from({ length: 4 }, () => ({ hand: zero(), collected: zero(), villages: [], turn: freshTurn() })),
    cur: 0,
    round: 1,
    phase: 'PLAY',
    trigger: null,
  };
}

// Ronda 5: o Lugar 1 tem 2 aldeias e 4 cartas (Azeite ×3, Cereais ×1). Com
// uma recolha chega às 5 cartas e funda a 3.ª aldeia, que abre a última ronda.
function tutorialMid(ctx) {
  const s = tutorialStart(ctx);
  s.round = 5;
  s.fire = 10;
  s.tower = [1, 2, 2, 3, 4, 4, 5, 6, 7, 9];
  s.piles = {
    cereais: { discs: [10, 8], collected: 7 }, vinho: { discs: [12], collected: 6 }, peixe: { discs: [11, 6], collected: 8 },
    calcario: { discs: [10], collected: 5 }, azeite: { discs: [11, 8], collected: 9 },
  };
  const set = (i, hand, villages) => { Object.assign(s.players[i].hand, hand); s.players[i].villages = villages; };
  set(0, { azeite: 3, cereais: 1 }, [{ res: 'vinho', cards: 4 }, { res: 'peixe', cards: 3 }]);
  set(1, { peixe: 2, calcario: 1 }, [{ res: 'cereais', cards: 3 }]);
  set(2, { vinho: 2, cereais: 1 }, [{ res: 'azeite', cards: 4 }]);
  set(3, { peixe: 3, vinho: 1, cereais: 1 }, [{ res: 'vinho', cards: 3 }]);
  // Trabalhadores deixados pelos bots na ronda anterior.
  s.hexes[1].workers = [1];
  s.hexes[8].workers = [2];
  s.hexes[3].workers = [3];
  return s;
}

export const SCENARIOS = {
  'tutorial-inicio': { players: 4, setup: tutorialStart },
  'tutorial-meio': { players: 4, setup: tutorialMid },
};
