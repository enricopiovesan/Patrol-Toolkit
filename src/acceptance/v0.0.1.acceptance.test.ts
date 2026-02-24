import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import validPack from "../resort-pack/fixtures/valid-pack.json";

vi.mock("../map/map-view", () => ({}));
vi.mock("../pwa/precache-pack-assets", () => ({
  requestPackAssetPrecache: () => {}
}));

describe("v0.0.1 acceptance", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    await waitForTick();
    await deleteDatabase("patrol-toolkit");
  });

  it("works offline by serving cached app shell for navigation", async () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const stores = new Map<string, Map<string, Response>>();
    const caches = createMockCaches(stores);
    const fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });

    const cleanup = loadServiceWorker(listeners, caches, fetchMock);

    const installListener = listeners.get("install");
    if (!installListener) {
      cleanup();
      throw new Error("Install listener not registered.");
    }

    const installPromise = createWaitUntilPromise(installListener);
    await installPromise;

    const fetchListener = listeners.get("fetch");
    if (!fetchListener) {
      cleanup();
      throw new Error("Fetch listener not registered.");
    }

    const response = await createRespondWithPromise(
      fetchListener,
      {
        url: "https://patrol.local/incident/123",
        method: "GET",
        mode: "navigate"
      } as Request
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("cached:/index.html");

    cleanup();
  });

  it("generates phrase under 2 seconds with run and tower context", async () => {
    const shell = await createReadyShell();

    const startedAt = performance.now();
    dispatchResortPageGeneratePhrase(shell);
    await waitForCondition(() => !readPhrase(shell).includes("No phrase generated yet"));
    const elapsedMs = performance.now() - startedAt;

    const phrase = readPhrase(shell);
    expect(elapsedMs).toBeLessThan(2000);
    expect(phrase).toContain("Easy Street");
    expect(phrase).toContain("tower 2");
  });

  it("keeps nearest lift tower context when nearest tower is outside configured threshold", async () => {
    const shell = await createReadyShell();
    await setActivePackThreshold(shell, 10);

    dispatchResortPageGeneratePhrase(shell);
    await waitForCondition(() => !readPhrase(shell).includes("No phrase generated yet"));
    const phrase = readPhrase(shell);

    expect(phrase).toContain("Easy Street");
    expect(phrase).toMatch(/\d+m (above|below|from) Summit Express tower 2/iu);
  });
});

async function createReadyShell(): Promise<HTMLElement> {
  mockCatalogFetch();
  const { PtkAppShell } = await import("../v4/ptk-app-shell");
  setWindowWidth(390);
  const shell = new PtkAppShell();
  document.body.appendChild(shell);

  await waitForCondition(
    () => (shell as unknown as { repository: unknown | null }).repository !== null
  );

  await waitForCondition(() => hasV4ResortCards(shell));
  dispatchV4ResortSelect(shell, "demo-resort");
  await waitForCondition(() => readShellPage(shell) === "install-blocking");
  clickShellButton(shell, "Install resort data");
  await waitForCondition(() => readShellPage(shell) === "resort");

  dispatchResortPageEvent(
    shell,
    "ptk-resort-position-update",
    new CustomEvent("position-update", {
      detail: {
        coordinates: [-106.9502, 39.1928],
        accuracy: 8
      },
      bubbles: true,
      composed: true
    })
  );

  return shell;
}

async function setActivePackThreshold(shell: HTMLElement, thresholdMeters: number): Promise<void> {
  const repository = (shell as unknown as { repository: {
    getActivePack: () => Promise<{ thresholds: { liftProximityMeters: number } } | null>;
    savePack: (pack: unknown) => Promise<void>;
  } | null }).repository;

  if (!repository) {
    throw new Error("Repository unavailable.");
  }

  const activePack = await repository.getActivePack();
  if (!activePack) {
    throw new Error("Active pack unavailable.");
  }

  const updatedPack = structuredClone(activePack);
  updatedPack.thresholds.liftProximityMeters = thresholdMeters;
  await repository.savePack(updatedPack);

  (shell as unknown as { selectedResortPack: unknown }).selectedResortPack = updatedPack;
  (shell as unknown as { requestUpdate: () => void }).requestUpdate();
  await waitForTick();
}

function readPhrase(shell: HTMLElement): string {
  const page = shell.shadowRoot?.querySelector("ptk-resort-page") as HTMLElement | null;
  const phrase = page?.shadowRoot?.querySelector(".phrase-output")?.textContent;
  return (phrase ?? "").replace(/\s+/gu, " ").trim();
}

function readStatusText(shell: HTMLElement): string {
  const page = shell.shadowRoot?.querySelector("ptk-resort-page") as HTMLElement | null;
  const status = page?.shadowRoot?.querySelector(".panel-note")?.textContent;
  return (status ?? "").replace(/\s+/gu, " ").trim();
}

function hasV4ResortCards(shell: HTMLElement): boolean {
  const page = shell.shadowRoot?.querySelector("ptk-select-resort-page") as HTMLElement | null;
  const cards = page?.shadowRoot?.querySelectorAll("ptk-resort-card");
  return (cards?.length ?? 0) > 0;
}

async function waitForCondition(assertion: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (assertion()) {
      return;
    }

    await waitForTick();
  }

  throw new Error("Condition not met in allotted time.");
}

function waitForTick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 5);
  });
}

function setWindowWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width
  });
}

function readShellPage(shell: HTMLElement): string {
  const root = shell.shadowRoot?.querySelector(".root");
  return root?.getAttribute("data-page") ?? "";
}

function dispatchV4ResortSelect(shell: HTMLElement, resortId: string): void {
  const page = shell.shadowRoot?.querySelector("ptk-select-resort-page");
  page?.dispatchEvent(
    new CustomEvent("ptk-resort-select", {
      detail: { resortId },
      bubbles: true,
      composed: true
    })
  );
}

function clickShellButton(shell: HTMLElement, label: string): void {
  const button = Array.from(shell.shadowRoot?.querySelectorAll("button") ?? []).find((node) =>
    (node.textContent ?? "").includes(label)
  ) as HTMLButtonElement | undefined;
  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }
  button.click();
}

function dispatchResortPageEvent(shell: HTMLElement, eventName: string, event: CustomEvent): void {
  const page = shell.shadowRoot?.querySelector("ptk-resort-page");
  if (!page) {
    throw new Error("Resort page not found.");
  }
  page.dispatchEvent(
    new CustomEvent(eventName, {
      detail: event.detail,
      bubbles: true,
      composed: true
    })
  );
}

function dispatchResortPageGeneratePhrase(shell: HTMLElement): void {
  const page = shell.shadowRoot?.querySelector("ptk-resort-page");
  if (!page) {
    throw new Error("Resort page not found.");
  }
  page.dispatchEvent(
    new CustomEvent("ptk-resort-generate-phrase", {
      bubbles: true,
      composed: true
    })
  );
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Failed to delete test database."));
    request.onblocked = () => resolve();
  });
}

function mockCatalogFetch(): void {
  const catalogPayload = {
    schemaVersion: "1.0.0",
    resorts: [
      {
        resortId: "demo-resort",
        resortName: "Demo Resort",
        versions: [
          {
            version: "v1",
            approved: true,
            packUrl: "/packs/demo-resort-v1.json",
            createdAt: "2026-02-19T16:35:00.000Z"
          }
        ]
      }
    ]
  };

  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes("/resort-packs/index.json")) {
      return new Response(JSON.stringify(catalogPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (url.includes("/packs/demo-resort-v1.json")) {
      return new Response(JSON.stringify(validPack), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("Not Found", { status: 404 });
  });
}

type ListenerMap = Map<string, (event: unknown) => void>;

type MockCache = {
  addAll: (requests: string[]) => Promise<void>;
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
        throw new Error("Missing cache store");
      }

      return {
        async addAll(requests: string[]) {
          for (const request of requests) {
            store.set(toAbsoluteUrl(request), new Response(`cached:${request}`, { status: 200 }));
          }
        },
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

function createWaitUntilPromise(listener: (event: unknown) => void): Promise<void> {
  let pending: Promise<unknown> | undefined;
  listener({
    waitUntil: (promise: Promise<unknown>) => {
      pending = promise;
    }
  });

  const promise = pending;
  if (!promise) {
    throw new Error("waitUntil was not called.");
  }

  return promise.then(() => undefined);
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

function toAbsoluteUrl(path: string): string {
  return new URL(path, "https://patrol.local").toString();
}
