// Bitnik Studio — a instância da Bitnik.
// Fase 0: servidor com todos os jogos da Bitnik e a UI genérica de protótipo.
// Fases seguintes: Forge, simulação e mesas de aprovação por convite.
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createPlatform, fileStorage, memoryStorage } from '@bitnik/server';
import catania from '@bitnik/game-catania';
import bulbous from '@bitnik/game-bulbous';
import praia from '@bitnik/game-praia-das-percebes';
import nineOils from '@bitnik/game-nine-oils';
import nineOilsVanilla from '@bitnik/game-nine-oils-vanilla';
import capivaras from '@bitnik/game-capivaras';
import robotMaker from '@bitnik/game-robot-maker';
import startupPanic from '@bitnik/game-startup-panic';

export const bitnikBrand = {
  id: 'bitnik',
  name: 'Bitnik',
  lang: 'pt',
  fonts: 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap',
  stylesheets: [
    'https://cdn.jsdelivr.net/gh/dferreiramarques/bitnikgames-design-system@v1.0.0/src/index.css',
    'https://cdn.jsdelivr.net/gh/dferreiramarques/bitnikgames-design-system@v1.0.0/src/game-ui.css',
  ],
};

// Jogo no Studio ainda por aprovar: selo "protótipo" e modo protótipo na mesa; só depois de vendido passa para o runtime do cliente.
const comoPrototipo = (g) => Object.freeze({ ...g, prototype: true });

export function makeStudio({ dataDir = process.env.DATA_DIR, ...opts } = {}) {
  return createPlatform({
    brand: bitnikBrand,
    games: [catania, bulbous, praia, nineOils, nineOilsVanilla, capivaras, robotMaker, comoPrototipo(startupPanic)],
    storage: dataDir ? fileStorage(dataDir) : memoryStorage(),
    studio: true,
    // Protótipos da Forge: ficam com os dados; sem pasta de dados, numa pasta temporária.
    prototypeDir: join(dataDir || join(tmpdir(), 'bitnik-studio'), 'prototipos'),
    // "Publicar" grava o jogo 1.0.0 na pasta games/ deste repositório.
    gamesDir: fileURLToPath(new URL('../../games/', import.meta.url)),
    ...opts,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // "/" é a consola (a ferramenta); o lobby da Bitnik, o "produto" dela, fica em "/bitnik".
  const studio = makeStudio({ dataDir: process.env.DATA_DIR || './data/studio', consoleAtRoot: true });
  studio.listen(process.env.PORT || 3000);
  // Railway (e outros) param o processo com SIGTERM a cada deploy: fecha as ligações com calma.
  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.once(sig, () => {
      setTimeout(() => process.exit(0), 5000).unref(); // nunca fica pendurado
      studio.close().finally(() => process.exit(0));
    });
  }
}
