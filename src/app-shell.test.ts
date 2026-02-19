import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import validPack from "./resort-pack/fixtures/valid-pack.json";

vi.mock("./map/map-view", () => ({}));

describe("AppShell", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    await waitForTick();
    await deleteDatabase("patrol-toolkit");
  });

  it("renders the patrol toolkit heading", async () => {
    mockCatalogFetch();
    const { AppShell } = await import("./app-shell");

    const element = new AppShell();
    document.body.appendChild(element);

    await element.updateComplete;

    const heading = element.shadowRoot?.querySelector("h1")?.textContent;
    expect(heading).toBe("Patrol Toolkit");
  });

  it("auto-activates first available resort pack on startup", async () => {
    mockCatalogFetch();
    const { AppShell } = await import("./app-shell");

    const shell = new AppShell();
    document.body.appendChild(shell);

    await waitForCondition(() =>
      /Active pack: Demo Resort/iu.test(readStatusText(shell))
    );
  });

  it("selects a resort from catalog and restores active pack on next app load", async () => {
    mockCatalogFetch();
    const { AppShell } = await import("./app-shell");

    const firstInstance = new AppShell();
    document.body.appendChild(firstInstance);
    await waitForCondition(
      () =>
        (firstInstance as unknown as { repository: unknown | null }).repository !== null
    );

    await waitForCondition(() => hasResortOptions(firstInstance));
    const select = firstInstance.shadowRoot?.querySelector("select");
    if (!select) {
      throw new Error("Resort select not found.");
    }
    select.value = "demo-resort";
    select.dispatchEvent(new Event("change"));

    await waitForCondition(() =>
      /Active pack: Demo Resort/iu.test(readStatusText(firstInstance))
    );

    firstInstance.remove();
    await waitForTick();

    const secondInstance = new AppShell();
    document.body.appendChild(secondInstance);

    await waitForCondition(() =>
      readStatusText(secondInstance).includes("Active pack: Demo Resort")
    );
  });

  it("generates phrase from active pack and GPS event", async () => {
    mockCatalogFetch();
    const shell = await createReadyShell();

    await (shell as unknown as { generatePhrase: () => Promise<void> }).generatePhrase();
    expect(readPhrase(shell)).toBe("Easy Street, Mid, skier's left, below Summit Express tower 2");
    expect(readPhraseHint(shell)).toBe("Phrase generated.");
  });

  it("shows basemap warning when style or pmtiles assets are missing", async () => {
    mockCatalogFetch();
    const { AppShell } = await import("./app-shell");

    const shell = new AppShell();
    document.body.appendChild(shell);

    await waitForCondition(() =>
      /Basemap assets missing/iu.test(readWarningText(shell))
    );
  });
});

function readStatusText(shell: HTMLElement): string {
  const status = shell.shadowRoot?.querySelector(".status-line")?.textContent;
  return (status ?? "").replace(/\s+/gu, " ").trim();
}

function readPhrase(shell: HTMLElement): string {
  const phrase = shell.shadowRoot?.querySelector(".phrase-card")?.textContent;
  return (phrase ?? "").replace(/\s+/gu, " ").trim();
}

function readPhraseHint(shell: HTMLElement): string {
  const hint = shell.shadowRoot?.querySelector(".phrase-hint")?.textContent;
  return (hint ?? "").replace(/\s+/gu, " ").trim();
}

function readWarningText(shell: HTMLElement): string {
  const warning = shell.shadowRoot?.querySelector(".warning-line")?.textContent;
  return (warning ?? "").replace(/\s+/gu, " ").trim();
}

async function createReadyShell(): Promise<HTMLElement> {
  const { AppShell } = await import("./app-shell");
  const shell = new AppShell();
  document.body.appendChild(shell);
  await waitForCondition(
    () => (shell as unknown as { repository: unknown | null }).repository !== null
  );

  await waitForCondition(() => hasResortOptions(shell));
  const select = shell.shadowRoot?.querySelector("select");
  if (!select) {
    throw new Error("Resort select not found.");
  }
  select.value = "demo-resort";
  select.dispatchEvent(new Event("change"));

  await waitForCondition(() => /Active pack: Demo Resort/iu.test(readStatusText(shell)));

  (shell as unknown as {
    handlePositionUpdate: (event: CustomEvent<{ coordinates: [number, number]; accuracy: number }>) => void;
  }).handlePositionUpdate(
    new CustomEvent("position-update", {
      detail: {
        coordinates: [-106.9502, 39.1928],
        accuracy: 8
      }
    })
  );

  return shell;
}

function hasResortOptions(shell: HTMLElement): boolean {
  const options = shell.shadowRoot?.querySelectorAll("select option");
  return (options?.length ?? 0) > 0;
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
