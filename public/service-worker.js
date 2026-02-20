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
  "/resort-packs/index.json"
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
    return;
  }

  if (event.data?.type === "PRECACHE_URLS" && Array.isArray(event.data.urls)) {
    const urls = event.data.urls.filter((url) => typeof url === "string");
    const work = precacheSameOriginUrls(urls);
    if (typeof event.waitUntil === "function") {
      event.waitUntil(work);
    } else {
      void work;
    }
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
  const rangeHeader = request.headers.get("range");
  const requestUrl = new URL(request.url);
  const cacheKey = requestUrl.toString();
  const cachedResponse = await cache.match(cacheKey);

  if (rangeHeader) {
    if (cachedResponse && cachedResponse.status === 200) {
      const partial = await buildPartialResponseFromFull(cachedResponse, rangeHeader);
      if (partial) {
        return partial;
      }
    }

    try {
      const networkRangeResponse = await fetch(request);
      if (isCacheableResponse(networkRangeResponse)) {
        void backfillFullAssetCache(cache, cacheKey);
      }
      return networkRangeResponse;
    } catch {
      if (cachedResponse) {
        return cachedResponse;
      }

      return new Response("Asset unavailable offline.", {
        status: 504,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  }

  const networkRequest = fetch(request)
    .then(async (networkResponse) => {
      if (isCacheableResponse(networkResponse)) {
        await cache.put(cacheKey, networkResponse.clone());
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

async function backfillFullAssetCache(cache, cacheKey) {
  try {
    const fullRequest = new Request(cacheKey, { method: "GET" });
    const fullResponse = await fetch(fullRequest);
    if (!isCacheableResponse(fullResponse)) {
      return;
    }

    await cache.put(cacheKey, fullResponse.clone());
    await trimCache(STATIC_CACHE, 120);
  } catch {
    // Best-effort cache warmup for future offline range requests.
  }
}

async function precacheSameOriginUrls(urls) {
  const cache = await caches.open(STATIC_CACHE);

  for (const url of urls) {
    try {
      const absoluteUrl = new URL(url, self.location.origin);
      if (absoluteUrl.origin !== self.location.origin) {
        continue;
      }

      const request = new Request(absoluteUrl.toString(), { method: "GET" });
      const response = await fetch(request);
      if (isCacheableResponse(response)) {
        await cache.put(absoluteUrl.toString(), response.clone());
      }
    } catch {
      // Best-effort prefetch for offline readiness.
    }
  }

  await trimCache(STATIC_CACHE, 120);
}

async function buildPartialResponseFromFull(fullResponse, rangeHeader) {
  const match = /^bytes=(\d+)-(\d*)$/iu.exec(rangeHeader.trim());
  if (!match) {
    return null;
  }

  const start = Number.parseInt(match[1], 10);
  if (!Number.isFinite(start) || start < 0) {
    return null;
  }

  const fullBuffer = await fullResponse.clone().arrayBuffer();
  const total = fullBuffer.byteLength;
  if (start >= total) {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${total}`,
        "Accept-Ranges": "bytes"
      }
    });
  }

  const hasEnd = Boolean(match[2] && match[2].length > 0);
  const requestedEnd = hasEnd ? Number.parseInt(match[2], 10) : total - 1;
  const end = Number.isFinite(requestedEnd) ? Math.min(requestedEnd, total - 1) : total - 1;
  if (end < start) {
    return null;
  }

  const chunk = fullBuffer.slice(start, end + 1);
  const headers = new Headers(fullResponse.headers);
  headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
  headers.set("Content-Length", String(chunk.byteLength));
  headers.set("Accept-Ranges", "bytes");

  return new Response(chunk, {
    status: 206,
    statusText: "Partial Content",
    headers
  });
}

async function handleTileRequest(request) {
  const cache = await caches.open(TILE_CACHE);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (isCacheableResponse(networkResponse)) {
      await cache.put(request, networkResponse.clone());
      await trimCache(TILE_CACHE, 250);
    }

    return networkResponse;
  } catch {
    return new Response("Tile unavailable offline.", {
      status: 504,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
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
