const CACHE_VERSION = "ptk-shell-v0.0.1";
const APP_SHELL_URLS = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-maskable.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await cache.addAll(APP_SHELL_URLS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          const cache = await caches.open(CACHE_VERSION);
          await cache.put("/index.html", networkResponse.clone());
          return networkResponse;
        } catch {
          const cachedDocument = await caches.match("/index.html");
          if (cachedDocument) {
            return cachedDocument;
          }

          const offlineDocument = await caches.match("/offline.html");
          if (offlineDocument) {
            return offlineDocument;
          }

          return new Response("Offline mode unavailable.", { status: 503 });
        }
      })()
    );

    return;
  }

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        const cache = await caches.open(CACHE_VERSION);
        await cache.put(request, networkResponse.clone());
      }

      return networkResponse;
    })()
  );
});
