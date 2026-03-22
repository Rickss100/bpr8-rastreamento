// BPR-8 Service Worker — Offline First
const CACHE = "bpr8-v3";
const ASSETS = [
  "./index.html",
  "./app.js",
  "./manifest.json",
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
];

// Tiles OSM offline: cache sob demanda até 500 tiles
const TILE_CACHE = "bpr8-tiles-v1";
const MAX_TILES  = 500;

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, {cache:"force-cache"}))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()) // não bloqueia se CDN falhar
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== TILE_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = e.request.url;

  // Tiles OSM — cache sob demanda (estratégia: cache-first)
  if (url.includes("tile.openstreetmap.org")) {
    e.respondWith(
      caches.open(TILE_CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        try {
          const resp = await fetch(e.request);
          if (resp.ok) {
            // Limita tamanho do cache de tiles
            const keys = await cache.keys();
            if (keys.length >= MAX_TILES) await cache.delete(keys[0]);
            cache.put(e.request, resp.clone());
          }
          return resp;
        } catch {
          return new Response("", { status: 503 });
        }
      })
    );
    return;
  }

  // App shell + assets — cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok && (url.startsWith("https://cdnjs.cloudflare.com") || url.includes(self.location.origin))) {
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        }
        return resp;
      }).catch(() => caches.match("./index.html"));
    })
  );
});

// Mensagem de atualização para o app
self.addEventListener("message", e => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});
