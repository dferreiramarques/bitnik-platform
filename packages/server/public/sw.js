// Service worker da plataforma (PWA). O servidor preenche a versão e a lista
// de ficheiros a guardar; a versão muda sozinha quando muda o motor, um jogo
// ou a UI, e os caches antigos são apagados.
//
// - HTML: primeiro a rede (um deploy novo chega logo); sem rede, a cópia.
// - Motor, SDK, UI e ficheiros dos jogos: da cache, atualizados em fundo.
// - Nunca em cache: consola, /admin, /health e o WebSocket.
const VERSION = '{{VERSION}}';
const PRECACHE = {{PRECACHE}};
const CACHE = `bitnik-${VERSION}`;
const CDN = /^https:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
const NEVER = /^\/(admin\/|console|health|ws)/;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Um a um, e um ficheiro que falhe não impede a instalação (fica para a 1.ª visita).
    for (const url of PRECACHE) {
      try { if (!(await cache.match(url))) await cache.add(url); } catch { /* segue */ }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('bitnik-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put('/', res.clone()).catch(() => {});
    return res;
  } catch {
    return (await cache.match('/')) || Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const fresh = fetch(req).then((res) => {
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone()).catch(() => {});
    return res;
  }).catch(() => null);
  return hit || (await fresh) || Response.error();
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (NEVER.test(url.pathname)) return;
    // A app é uma página só (rotas no #): qualquer navegação usa a página principal.
    if (req.mode === 'navigate') { if (url.pathname === '/') e.respondWith(networkFirst(req)); return; }
    e.respondWith(staleWhileRevalidate(req));
  } else if (CDN.test(req.url)) {
    e.respondWith(staleWhileRevalidate(req));
  }
});
