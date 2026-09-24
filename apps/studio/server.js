// Bitnik Studio — a instância da Bitnik.
// Fase 0: servidor com todos os jogos da Bitnik e a UI genérica de protótipo.
// Fases seguintes: Forge, simulação e mesas de aprovação por convite.
import { fileURLToPath } from 'node:url';
import { createPlatform, fileStorage, memoryStorage } from '@bitnik/server';
import catania from '@bitnik/game-catania';

export const bitnikBrand = {
  id: 'bitnik',
  name: 'Bitnik',
  lang: 'pt',
  fonts: 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap',
  stylesheets: [
    'https://cdn.jsdelivr.net/gh/dferreiramarques/bitnikgames-design-system@main/src/index.css',
    'https://cdn.jsdelivr.net/gh/dferreiramarques/bitnikgames-design-system@main/src/game-ui.css',
  ],
};

export function makeStudio({ dataDir = process.env.DATA_DIR, ...opts } = {}) {
  return createPlatform({
    brand: bitnikBrand,
    games: [catania],
    storage: dataDir ? fileStorage(dataDir) : memoryStorage(),
    studio: true,
    ...opts,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  makeStudio({ dataDir: process.env.DATA_DIR || './data/studio' }).listen(process.env.PORT || 3000);
}
