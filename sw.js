const SW_BUILD_VERSION = '20261110-v3';
const CACHE_VERSION = 'betboy-ai-v' + SW_BUILD_VERSION;
const CACHE_NAME = CACHE_VERSION;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      let hadExistingCaches = false;
      try {
        const keys = await caches.keys();
        hadExistingCaches = keys.length > 0;
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (err) {}

      try {
        await self.clients.claim();
      } catch (err) {}

      try {
        const windowClients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        for (const client of windowClients) {
          try {
            client.postMessage({
              type: 'FORCE_RELOAD',
              version: SW_BUILD_VERSION,
              cacheVersion: CACHE_VERSION,
              hadStaleCache: hadExistingCaches,
            });
          } catch (e) {}
          if (hadExistingCaches) {
            try {
              if (typeof client.navigate === 'function' && client.url) {
                await client.navigate(client.url);
              }
            } catch (e) {}
          }
        }
      } catch (err) {}
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!req || req.method !== 'GET') return;

  const url = new URL(req.url);
  const path = url.pathname.toLowerCase();
  const dest = (req.destination || '').toLowerCase();
  const accept = (req.headers.get('accept') || '').toLowerCase();

  // Strict Network-First for all HTML, JS, and CSS requests
  const isHtmlOrDoc =
    req.mode === 'navigate' ||
    dest === 'document' ||
    path === '/' ||
    path.endsWith('.html') ||
    accept.includes('text/html');
  const isScript =
    dest === 'script' ||
    path.endsWith('.js') ||
    path.endsWith('.mjs') ||
    path.endsWith('.ts') ||
    path.endsWith('.tsx');
  const isStyle = dest === 'style' || path.endsWith('.css');

  if (isHtmlOrDoc || isScript || isStyle) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((networkRes) => {
          if (networkRes && networkRes.ok && url.origin === self.location.origin) {
            const clone = networkRes.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, clone))
              .catch(() => {});
          }
          return networkRes;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
  );
});

