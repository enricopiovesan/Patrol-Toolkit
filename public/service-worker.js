const CACHE_PREFIX = "ptk";
const CACHE_VERSION = "v0.0.1";
const SHELL_CACHE = `${CACHE_PREFIX}-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const TILE_CACHE = `${CACHE_PREFIX}-tiles-${CACHE_VERSION}`;
const ACTIVE_CACHES = new Set([SHELL_CACHE, STATIC_CACHE, TILE_CACHE]);

const APP_SHELL_URLS = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-maskable.svg",
  "/resort-packs/index.json",
  "/packs/demo-resort-v1.json"
];

const TILE_HOSTS = new Set(["tile.openstreetmap.org"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
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
          .filter((name) => name.startsWith(`${CACHE_PREFIX}-`) && !ACTIVE_CACHES.has(name))
          .map((name) => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(handleSameOriginStaticRequest(request));
    return;
  }

  if (TILE_HOSTS.has(url.hostname)) {
    event.respondWith(handleTileRequest(request));
  }
});

async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    if (isCacheableResponse(networkResponse)) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put("/index.html", networkResponse.clone());
    }

    return networkResponse;
  } catch {
    const shellCache = await caches.open(SHELL_CACHE);
    const cachedDocument = await shellCache.match("/index.html");
    if (cachedDocument) {
      return cachedDocument;
    }

    const offlineDocument = await shellCache.match("/offline.html");
    if (offlineDocument) {
      return offlineDocument;
    }

    return new Response("Offline mode unavailable.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

async function handleSameOriginStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);

  const networkRequest = fetch(request)
    .then(async (networkResponse) => {
      if (isCacheableResponse(networkResponse)) {
        await cache.put(request, networkResponse.clone());
        await trimCache(STATIC_CACHE, 120);
      }

      return networkResponse;
    })
    .catch(() => null);

  if (cachedResponse) {
    void networkRequest;
    return cachedResponse;
  }

  const networkResponse = await networkRequest;
  if (networkResponse) {
    return networkResponse;
  }

  return new Response("Asset unavailable offline.", {
    status: 504,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

async function handleTileRequest(request) {
  const cache = await caches.open(TILE_CACHE);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);
  if (isCacheableResponse(networkResponse)) {
    await cache.put(request, networkResponse.clone());
    await trimCache(TILE_CACHE, 250);
  }

  return networkResponse;
}

function isCacheableResponse(response) {
  return response.ok || response.type === "opaque";
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  const overflow = keys.length - maxEntries;
  if (overflow <= 0) {
    return;
  }

  for (const key of keys.slice(0, overflow)) {
    await cache.delete(key);
  }
}
