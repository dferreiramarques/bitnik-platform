// Ilha de Catania: disposição dos hexágonos e vizinhanças.
// Portado de catania-v2/server.js (mesmos layouts e o mesmo critério de vizinhança).

export const RESOURCES = ['cereais', 'vinho', 'peixe', 'calcario', 'azeite'];
export const BLACK_DISCS = [12, 11, 11, 10, 10, 8, 8, 6, 6, 4, 4, 2, 2];
export const RED_DISCS = [9, 7, 5, 3, 1];
export const RED = new Set(RED_DISCS);

const R = 62;
const W3 = Math.sqrt(3) * R;

// [col, row]; o índice 0 é sempre o vulcão (centro).
const LAYOUTS = {
  4: [[2, 1], [0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [3, 1], [0, 2], [1, 2], [2, 2]],
  3: [[2, 1], [0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [3, 1], [0, 2], [1, 2]],
  2: [[1, 1], [0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
};

const toPx = (col, row) => ({ x: W3 * col + (row & 1 ? W3 / 2 : 0), y: R * 1.5 * row });

export function buildIsland(numPlayers, rng) {
  const positions = LAYOUTS[numPlayers];
  const nRes = positions.length - 1;
  const extras = [];
  for (let i = RESOURCES.length; i < nRes; i++) extras.push(RESOURCES[i % RESOURCES.length]);
  rng.shuffle(extras);
  // Pelo menos um território de cada recurso.
  const pool = rng.shuffle([...RESOURCES, ...extras]);
  const hexes = positions.map(([col, row], id) => ({
    id, col, row,
    type: id === 0 ? 'vulcao' : pool[id - 1],
    px: toPx(col, row),
    workers: [],
  }));
  const thr = W3 * 1.2;
  for (const h of hexes) {
    h.adj = hexes
      .filter((x) => x.id !== h.id && Math.hypot(x.px.x - h.px.x, x.px.y - h.px.y) < thr)
      .map((x) => x.id);
  }
  return hexes;
}
