import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

type ListenerMap = Map<string, (event: unknown) => void>;

type MockCache = {
  match: (request: Request | string) => Promise<Response | undefined>;
  put: (request: Request | string, response: Response) => Promise<void>;
  keys: () => Promise<Request[]>;
  delete: (request: Request | string) => Promise<boolean>;
};

type MockCaches = {
  open: (name: string) => Promise<MockCache>;
  keys: () => Promise<string[]>;
  delete: (name: string) => Promise<boolean>;
};

describe("service worker cache hardening", () => {
  it("precaches same-origin URLs on PRECACHE_URLS message", async () => {
    const listeners = new Map() as ListenerMap;
    const stores = new Map<string, Map<string, Response>>();
    const caches = createMockCaches(stores);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return new Response(`payload:${url}`, { status: 200 });
    });
    const cleanup = loadServiceWorker(listeners, caches, fetchMock as typeof fetch);

    const messageListener = listeners.get("message");
    if (!messageListener) {
      throw new Error("Message listener not registered");
    }

    await createMessageWaitUntilPromise(messageListener, {
      type: "PRECACHE_URLS",
      urls: ["/packs/demo/style.json", "/packs/demo/base.pmtiles", "https://example.com/skip.json"]
    });

    const staticStore = stores.get("ptk-static-v0.0.2");
    expect(staticStore?.has("https://patrol.local/packs/demo/style.json")).toBe(true);
    expect(staticStore?.has("https://patrol.local/packs/demo/base.pmtiles")).toBe(true);
    expect(staticStore?.has("https://example.com/skip.json")).toBe(false);
    cleanup();
  });

  it("trims static cache to configured max entries", async () => {
    const listeners = new Map() as ListenerMap;
    const stores = new Map<string, Map<string, Response>>();

    const caches = createMockCaches(stores);
    const staticCacheName = "ptk-static-v0.0.2";
    stores.set(staticCacheName, new Map());

    const staticStore = stores.get(staticCacheName);
    if (!staticStore) {
      throw new Error("Missing static cache store");
    }

    for (let index = 0; index < 121; index += 1) {
      staticStore.set(
        `https://patrol.local/assets/old-${index}.js`,
        new Response(`old-${index}`, { status: 200 })
      );
    }

    const fetchMock = vi.fn(async () => new Response("fresh", { status: 200 }));
    const cleanup = loadServiceWorker(listeners, caches, fetchMock);

    const fetchListener = listeners.get("fetch");
    if (!fetchListener) {
      throw new Error("Fetch listener not registered");
    }

    const responsePromise = createRespondWithPromise(fetchListener, new Request("https://patrol.local/assets/new.js"));
    await responsePromise;

    expect(staticStore.size).toBeLessThanOrEqual(120);
    expect(staticStore.has("https://patrol.local/assets/new.js")).toBe(true);
    cleanup();
  });

  it("trims tile cache to configured max entries", async () => {
    const listeners = new Map() as ListenerMap;
    const stores = new Map<string, Map<string, Response>>();

    const caches = createMockCaches(stores);
    const tileCacheName = "ptk-tiles-v0.0.2";
    stores.set(tileCacheName, new Map());

    const tileStore = stores.get(tileCacheName);
    if (!tileStore) {
      throw new Error("Missing tile cache store");
    }

    for (let index = 0; index < 251; index += 1) {
      tileStore.set(
        `https://tile.openstreetmap.org/14/${index}/0.png`,
        new Response(`tile-${index}`, { status: 200 })
      );
    }

    const fetchMock = vi.fn(async () => new Response("tile", { status: 200 }));
    const cleanup = loadServiceWorker(
      listeners,
      caches,
      fetchMock
    );

    const fetchListener = listeners.get("fetch");
    if (!fetchListener) {
      throw new Error("Fetch listener not registered");
    }

    const responsePromise = createRespondWithPromise(
      fetchListener,
      new Request("https://tile.openstreetmap.org/14/999/999.png")
    );
    await responsePromise;

    expect(tileStore.size).toBeLessThanOrEqual(250);
    expect(tileStore.has("https://tile.openstreetmap.org/14/999/999.png")).toBe(true);
    cleanup();
  });

  it("returns fallback response when tile fetch fails offline", async () => {
    const listeners = new Map() as ListenerMap;
    const stores = new Map<string, Map<string, Response>>();

    const caches = createMockCaches(stores);
    const fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });
    const cleanup = loadServiceWorker(listeners, caches, fetchMock);

    const fetchListener = listeners.get("fetch");
    if (!fetchListener) {
      throw new Error("Fetch listener not registered");
    }

    const response = await createRespondWithPromise(
      fetchListener,
      new Request("https://tile.openstreetmap.org/14/999/999.png")
    );

    expect(response.status).toBe(504);
    cleanup();
  });

  it("serves byte ranges from cached full same-origin assets while offline", async () => {
    const listeners = new Map() as ListenerMap;
    const stores = new Map<string, Map<string, Response>>();
    const caches = createMockCaches(stores);

    const staticCacheName = "ptk-static-v0.0.2";
    stores.set(staticCacheName, new Map());
    const staticStore = stores.get(staticCacheName);
    if (!staticStore) {
      throw new Error("Missing static cache store");
    }

    staticStore.set(
      "https://patrol.local/packs/demo/base.pmtiles",
      new Response(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), {
        status: 200,
        headers: { "Content-Type": "application/octet-stream" }
      })
    );

    const fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });
    const cleanup = loadServiceWorker(listeners, caches, fetchMock);

    const fetchListener = listeners.get("fetch");
    if (!fetchListener) {
      throw new Error("Fetch listener not registered");
    }

    const response = await createRespondWithPromise(
      fetchListener,
      new Request("https://patrol.local/packs/demo/base.pmtiles", {
        headers: { range: "bytes=2-5" }
      })
    );
    const payload = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 2-5/10");
    expect([...payload]).toEqual([2, 3, 4, 5]);
    cleanup();
  });

  it("backfills full asset cache after online range response for later offline use", async () => {
    const listeners = new Map() as ListenerMap;
    const stores = new Map<string, Map<string, Response>>();
    const caches = createMockCaches(stores);

    let online = true;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (!online) {
        throw new Error("offline");
      }

      const request = input instanceof Request ? input : new Request(input);
      const url = request.url;
      const range = request.headers.get("range");

      if (url === "https://patrol.local/packs/demo/base.pmtiles" && range) {
        return new Response(new Uint8Array([0]), {
          status: 206,
          headers: {
            "Content-Range": "bytes 0-0/10",
            "Accept-Ranges": "bytes",
            "Content-Type": "application/octet-stream"
          }
        });
      }

      if (url === "https://patrol.local/packs/demo/base.pmtiles") {
        return new Response(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), {
          status: 200,
          headers: { "Content-Type": "application/octet-stream" }
        });
      }

      return new Response("not found", { status: 404 });
    });

    const cleanup = loadServiceWorker(listeners, caches, fetchMock as typeof fetch);
    const fetchListener = listeners.get("fetch");
    if (!fetchListener) {
      throw new Error("Fetch listener not registered");
    }

    await createRespondWithPromise(
      fetchListener,
      new Request("https://patrol.local/packs/demo/base.pmtiles", {
        headers: { range: "bytes=0-0" }
      })
    );

    // Allow best-effort backfill promise to complete.
    await new Promise((resolve) => setTimeout(resolve, 0));

    online = false;

    const offlineResponse = await createRespondWithPromise(
      fetchListener,
      new Request("https://patrol.local/packs/demo/base.pmtiles", {
        headers: { range: "bytes=2-5" }
      })
    );
    const payload = new Uint8Array(await offlineResponse.arrayBuffer());

    expect(offlineResponse.status).toBe(206);
    expect(offlineResponse.headers.get("content-range")).toBe("bytes 2-5/10");
    expect([...payload]).toEqual([2, 3, 4, 5]);
    cleanup();
  });

  it("returns 416 for unsatisfiable cached range requests while offline", async () => {
    const listeners = new Map() as ListenerMap;
    const stores = new Map<string, Map<string, Response>>();
    const caches = createMockCaches(stores);

    const staticCacheName = "ptk-static-v0.0.2";
    stores.set(staticCacheName, new Map());
    const staticStore = stores.get(staticCacheName);
    if (!staticStore) {
      throw new Error("Missing static cache store");
    }

    staticStore.set(
      "https://patrol.local/packs/demo/base.pmtiles",
      new Response(new Uint8Array([0, 1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "application/octet-stream" }
      })
    );

    const fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });
    const cleanup = loadServiceWorker(listeners, caches, fetchMock);

    const fetchListener = listeners.get("fetch");
    if (!fetchListener) {
      throw new Error("Fetch listener not registered");
    }

    const response = await createRespondWithPromise(
      fetchListener,
      new Request("https://patrol.local/packs/demo/base.pmtiles", {
        headers: { range: "bytes=20-30" }
      })
    );

    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */4");
    cleanup();
  });

  it("does not return full cached file for invalid range requests while offline", async () => {
    const listeners = new Map() as ListenerMap;
    const stores = new Map<string, Map<string, Response>>();
    const caches = createMockCaches(stores);

    const staticCacheName = "ptk-static-v0.0.2";
    stores.set(staticCacheName, new Map());
    const staticStore = stores.get(staticCacheName);
    if (!staticStore) {
      throw new Error("Missing static cache store");
    }

    staticStore.set(
      "https://patrol.local/packs/demo/base.pmtiles",
      new Response(new Uint8Array([0, 1, 2, 3, 4, 5]), {
        status: 200,
        headers: { "Content-Type": "application/octet-stream" }
      })
    );

    const fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });
    const cleanup = loadServiceWorker(listeners, caches, fetchMock);

    const fetchListener = listeners.get("fetch");
    if (!fetchListener) {
      throw new Error("Fetch listener not registered");
    }

    const response = await createRespondWithPromise(
      fetchListener,
      new Request("https://patrol.local/packs/demo/base.pmtiles", {
        headers: { range: "bytes=abc-def" }
      })
    );

    expect(response.status).toBe(504);
    expect(await response.text()).toContain("Asset unavailable offline.");
    cleanup();
  });

  it("removes old ptk version caches and known legacy cache names on activate", async () => {
    const listeners = new Map() as ListenerMap;
    const stores = new Map<string, Map<string, Response>>();
    stores.set("ptk-shell-v0.0.1", new Map());
    stores.set("ptk-static-v0.0.1", new Map());
    stores.set("ptk-tiles-v0.0.1", new Map());
    stores.set("ptk-shell-v0.0.2", new Map());
    stores.set("ptk-static-v0.0.2", new Map());
    stores.set("ptk-tiles-v0.0.2", new Map());
    stores.set("patrol-shell", new Map());
    stores.set("patrol-static", new Map());
    stores.set("foreign-cache", new Map());

    const caches = createMockCaches(stores);
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    const cleanup = loadServiceWorker(listeners, caches, fetchMock as typeof fetch);

    const activateListener = listeners.get("activate");
    if (!activateListener) {
      cleanup();
      throw new Error("Activate listener not registered");
    }

    await createActivateWaitUntilPromise(activateListener);

    const cacheNames = await caches.keys();
    expect(cacheNames).toContain("ptk-shell-v0.0.2");
    expect(cacheNames).toContain("ptk-static-v0.0.2");
    expect(cacheNames).toContain("ptk-tiles-v0.0.2");
    expect(cacheNames).toContain("foreign-cache");
    expect(cacheNames).not.toContain("ptk-shell-v0.0.1");
    expect(cacheNames).not.toContain("ptk-static-v0.0.1");
    expect(cacheNames).not.toContain("ptk-tiles-v0.0.1");
    expect(cacheNames).not.toContain("patrol-shell");
    expect(cacheNames).not.toContain("patrol-static");
    cleanup();
  });
});

function loadServiceWorker(
  listeners: ListenerMap,
  caches: MockCaches,
  fetchMock: typeof fetch
): () => void {
  const originalSelf = (globalThis as { self?: unknown }).self;
  const originalCaches = (globalThis as { caches?: unknown }).caches;
  const originalFetch = (globalThis as { fetch?: unknown }).fetch;

  const selfMock = {
    location: new URL("https://patrol.local"),
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      listeners.set(type, handler);
    },
    skipWaiting: vi.fn(),
    clients: {
      claim: vi.fn()
    }
  };

  (globalThis as { self: unknown }).self = selfMock;
  (globalThis as { caches: unknown }).caches = caches;
  (globalThis as { fetch: unknown }).fetch = fetchMock;

  const code = readFileSync("public/service-worker.js", "utf8");
  // Execute the real service worker script in test runtime with mocked globals.
  new Function(code)();

  return () => {
    (globalThis as { self?: unknown }).self = originalSelf;
    (globalThis as { caches?: unknown }).caches = originalCaches;
    (globalThis as { fetch?: unknown }).fetch = originalFetch;
  };
}

function createMockCaches(stores: Map<string, Map<string, Response>>): MockCaches {
  return {
    async open(name: string) {
      if (!stores.has(name)) {
        stores.set(name, new Map());
      }

      const store = stores.get(name);
      if (!store) {
        throw new Error("Cache store not found");
      }

      return {
        async match(request: Request | string) {
          const key = typeof request === "string" ? toAbsoluteUrl(request) : request.url;
          return store.get(key);
        },
        async put(request: Request | string, response: Response) {
          const key = typeof request === "string" ? toAbsoluteUrl(request) : request.url;
          store.set(key, response);
        },
        async keys() {
          return [...store.keys()].map((url) => new Request(url));
        },
        async delete(request: Request | string) {
          const key = typeof request === "string" ? toAbsoluteUrl(request) : request.url;
          return store.delete(key);
        }
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    }
  };
}

function createRespondWithPromise(
  fetchListener: (event: unknown) => void,
  request: Request
): Promise<Response> {
  let responsePromise: Promise<Response> | null = null;

  fetchListener({
    request,
    respondWith: (promise: Promise<Response>) => {
      responsePromise = promise;
    }
  });

  if (!responsePromise) {
    throw new Error("Service worker did not call respondWith.");
  }

  return responsePromise;
}

function createMessageWaitUntilPromise(
  messageListener: (event: unknown) => void,
  data: unknown
): Promise<void> {
  let waitPromise: Promise<unknown> | null = null;

  messageListener({
    data,
    waitUntil: (promise: Promise<unknown>) => {
      waitPromise = promise;
    }
  });

  if (!waitPromise) {
    return Promise.resolve();
  }

  const settled = waitPromise as Promise<unknown>;
  return settled.then(() => undefined);
}

function createActivateWaitUntilPromise(activateListener: (event: unknown) => void): Promise<void> {
  let waitPromise: Promise<unknown> | null = null;

  activateListener({
    waitUntil: (promise: Promise<unknown>) => {
      waitPromise = promise;
    }
  });

  if (!waitPromise) {
    throw new Error("activate waitUntil was not called");
  }

  return (waitPromise as Promise<unknown>).then(() => undefined);
}

function toAbsoluteUrl(path: string): string {
  return new URL(path, "https://patrol.local").toString();
}
