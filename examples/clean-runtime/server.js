// Runtime limpo: o que um publisher cliente recebe.
// Só depende do motor, do servidor e dos pacotes de jogo entregues.
// Nada do Studio (Forge, simulação, protótipos) entra aqui.
import { fileURLToPath } from 'node:url';
import { createPlatform, fileStorage, memoryStorage } from '@bitnik/server';
import catania from '@bitnik/game-catania';

// Marca fictícia de exemplo: a mesma base do design system, outra skin.
export const clientBrand = {
  id: 'editora-exemplo',
  name: 'Editora Exemplo',
  lang: 'en',
  fonts: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Work+Sans:wght@400;500;600&display=swap',
  stylesheets: [
    'https://cdn.jsdelivr.net/gh/dferreiramarques/bitnikgames-design-system@main/src/index.css',
    'https://cdn.jsdelivr.net/gh/dferreiramarques/bitnikgames-design-system@main/src/game-ui.css',
  ],
  tokens: {
    '--color-yellow': '#8fb8a8', '--color-yellow-deep': '#5f8f7d',
    '--color-orange': '#3f6f8f', '--color-orange-deep': '#2d5470',
    '--color-brick': '#1f4e6b', '--color-brick-deep': '#143649',
    '--color-cream': '#f1f4f2', '--color-cream-soft': '#e2e9e5', '--color-cream-strong': '#c9d6cf',
    '--color-ink': '#15232b', '--color-ink-soft': '#46575f', '--color-white': '#fbfdfc',
    '--shadow-color-rgb': '21, 35, 43',
    '--font-display': '"Fraunces", Georgia, serif',
    '--font-body': '"Work Sans", system-ui, sans-serif',
  },
};

export function makeRuntime({ dataDir, ...opts } = {}) {
  return createPlatform({
    brand: clientBrand,
    games: [catania],
    storage: dataDir ? fileStorage(dataDir) : memoryStorage(),
    ...opts,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  makeRuntime({ dataDir: process.env.DATA_DIR || './data/runtime' }).listen(process.env.PORT || 3001);
}
