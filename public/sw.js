// BearMinds — Service Worker.
// Regra inegociável (spec 01/05): NUNCA cacheia /api/* (o servidor é a fonte da verdade).
// Estratégia: app-shell precache + network-first para navegação (fallback offline ao shell).
const CACHE = "bearminds-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // 1) API: sempre rede, nunca cache. Se falhar, propaga o erro (sem servir dado velho).
  if (url.pathname.startsWith("/api/")) return;

  // 2) Só GET same-origin é cacheável.
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;

  // 3) Navegação (HTML): network-first, cai no shell offline.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  // 4) Assets estáticos: cache-first com atualização em segundo plano.
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const fetchPromise = fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || fetchPromise;
    }),
  );
});
