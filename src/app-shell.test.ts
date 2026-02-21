import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_VERSION } from "./app-version";
import validPack from "./resort-pack/fixtures/valid-pack.json";
import type { ResortPack } from "./resort-pack/types";
import { ResortPackRepository } from "./resort-pack/repository";

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
    const phrase = readPhrase(shell);
    expect(phrase).toContain("Easy Street");
    expect(phrase).toContain("middle section");
    expect(phrase).toMatch(/\d+m (above|below|from) Summit Express tower 2/iu);
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
    await waitForCondition(() =>
      /online=|sw=|style=|pmtiles=/iu.test(readWarningDetails(shell))
    );
  });

  it("replaces stale persisted active pack not present in catalog", async () => {
    const repository = await ResortPackRepository.open();
    try {
      const stalePack = structuredClone(validPack) as ResortPack;
      stalePack.resort.id = "legacy-resort";
      stalePack.resort.name = "Legacy Resort";
      stalePack.basemap.pmtilesPath = "packs/legacy-resort/base.pmtiles";
      stalePack.basemap.stylePath = "packs/legacy-resort/style.json";
      await repository.savePack(stalePack);
      await repository.setActivePackId(stalePack.resort.id);
    } finally {
      repository.close();
    }

    mockCatalogFetch();
    const { AppShell } = await import("./app-shell");

    const shell = new AppShell();
    document.body.appendChild(shell);

    await waitForCondition(() =>
      /Active pack: Demo Resort/iu.test(readStatusText(shell))
    );
  });

  it("restores previous selection when switching to an invalid resort pack fails", async () => {
    mockCatalogFetchWithInvalidAlternatePack();
    const { AppShell } = await import("./app-shell");

    const shell = new AppShell();
    document.body.appendChild(shell);

    await waitForCondition(() => /Active pack: Demo Resort/iu.test(readStatusText(shell)));

    const select = shell.shadowRoot?.querySelector("select");
    if (!select) {
      throw new Error("Resort select not found.");
    }

    select.value = "bad-resort";
    select.dispatchEvent(new Event("change"));

    await waitForCondition(() => /Invalid resort pack for bad-resort/iu.test(readStatusText(shell)));
    await waitForCondition(() => (select as HTMLSelectElement).value === "demo-resort");
    expect(
      (
        shell as unknown as {
          activePack: { resort: { id: string } } | null;
        }
      ).activePack?.resort.id
    ).toBe("demo-resort");
  });

  it("shows app update details from settings panel on manual check", async () => {
    mockCatalogFetchWithReleaseUpdate();
    const { AppShell } = await import("./app-shell");

    const shell = new AppShell();
    document.body.appendChild(shell);
    await waitForCondition(() => hasResortOptions(shell));

    clickButton(shell, "Settings/Help");
    await waitForCondition(() => hasButton(shell, "Check for updates"));
    clickButton(shell, "Check for updates");

    await waitForCondition(() => readSettingsResult(shell).includes("Update available"));
    expect(readSettingsResult(shell)).toContain("1.0.0");
    expect(readSettingsResult(shell)).toContain("Stability fixes");
  });

  it("applies selected pack updates and reports partial failures", async () => {
    mockCatalogFetchWithPackUpdateFailure();
    const { AppShell } = await import("./app-shell");

    const shell = new AppShell();
    document.body.appendChild(shell);

    await waitForCondition(() =>
      /Active pack: Demo Resort/iu.test(readStatusText(shell))
    );

    clickButton(shell, "Settings/Help");
    await waitForCondition(() => hasButton(shell, "Check pack updates"));
    clickButton(shell, "Check pack updates");
    await waitForCondition(() => getUpdateCheckboxes(shell).length === 2);

    const checkboxes = getUpdateCheckboxes(shell);
    if (checkboxes.length !== 2) {
      throw new Error("Expected at least one update candidate.");
    }
    for (const checkbox of checkboxes) {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change"));
    }

    clickButton(shell, "Apply selected pack updates");
    await waitForCondition(() => readSettingsResult(shell).includes("failed"));
    expect(readSettingsResult(shell)).toContain("1 succeeded, 1 failed");
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

function readWarningDetails(shell: HTMLElement): string {
  const details = shell.shadowRoot?.querySelector(".warning-details")?.textContent;
  return (details ?? "").replace(/\s+/gu, " ").trim();
}

function readSettingsResult(shell: HTMLElement): string {
  const results = shell.shadowRoot?.querySelectorAll(".settings-result");
  const last = results?.[results.length - 1]?.textContent;
  return (last ?? "").replace(/\s+/gu, " ").trim();
}

function getUpdateCheckboxes(shell: HTMLElement): HTMLInputElement[] {
  return Array.from(shell.shadowRoot?.querySelectorAll(".update-item input[type='checkbox']") ?? []) as HTMLInputElement[];
}

function clickButton(shell: HTMLElement, label: string): void {
  const buttons = Array.from(shell.shadowRoot?.querySelectorAll("button") ?? []);
  const target = buttons.find((button) => button.textContent?.trim() === label);
  if (!target) {
    throw new Error(`Button '${label}' not found.`);
  }
  target.click();
}

function hasButton(shell: HTMLElement, label: string): boolean {
  const buttons = Array.from(shell.shadowRoot?.querySelectorAll("button") ?? []);
  return buttons.some((button) => button.textContent?.trim() === label);
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

function mockCatalogFetchWithInvalidAlternatePack(): void {
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
      },
      {
        resortId: "bad-resort",
        resortName: "Zulu Resort",
        versions: [
          {
            version: "v1",
            approved: true,
            packUrl: "/packs/bad-resort-v1.json",
            createdAt: "2026-02-20T16:35:00.000Z"
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

    if (url.includes("/packs/bad-resort-v1.json")) {
      return new Response(
        JSON.stringify({
          schemaVersion: "1.0.0",
          resort: { id: "bad-resort" }
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return new Response("", { status: 404 });
  });
}

function mockCatalogFetchWithReleaseUpdate(): void {
  const catalogPayload = {
    schemaVersion: "2.0.0",
    release: {
      channel: "stable",
      appVersion: "1.0.0",
      manifestUrl: "/releases/stable-manifest.json",
      manifestSha256: "a".repeat(64),
      createdAt: "2026-02-21T16:00:00.000Z",
      notesSummary: "Stability fixes for update flow."
    },
    resorts: [
      {
        resortId: "demo-resort",
        resortName: "Demo Resort",
        versions: [
          {
            version: "v1",
            approved: true,
            packUrl: "/packs/demo-resort-v1.json",
            createdAt: "2026-02-19T16:35:00.000Z",
            compatibility: {
              minAppVersion: APP_VERSION,
              supportedPackSchemaVersions: ["1.0.0"]
            },
            checksums: {
              packSha256: "b".repeat(64),
              pmtilesSha256: "c".repeat(64),
              styleSha256: "d".repeat(64)
            }
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

function mockCatalogFetchWithPackUpdateFailure(): void {
  const initialCatalogPayload = {
    schemaVersion: "2.0.0",
    release: {
      channel: "stable",
      appVersion: APP_VERSION,
      manifestUrl: "/releases/stable-manifest.json",
      manifestSha256: "a".repeat(64),
      createdAt: "2026-02-21T16:00:00.000Z",
      notesSummary: "Pack update test release."
    },
    resorts: [
      {
        resortId: "demo-resort",
        resortName: "Demo Resort",
        versions: [
          {
            version: "v1",
            approved: true,
            packUrl: "/packs/demo-resort-v1.json",
            createdAt: "2026-02-19T16:35:00.000Z",
            compatibility: {
              minAppVersion: APP_VERSION,
              supportedPackSchemaVersions: ["1.0.0"]
            },
            checksums: {
              packSha256: "b".repeat(64),
              pmtilesSha256: "c".repeat(64),
              styleSha256: "d".repeat(64)
            }
          }
        ]
      },
      {
        resortId: "broken-resort",
        resortName: "Zulu Broken Resort",
        versions: [
          {
            version: "v1",
            approved: true,
            packUrl: "/packs/broken-resort-v1.json",
            createdAt: "2026-02-19T16:35:00.000Z",
            compatibility: {
              minAppVersion: APP_VERSION,
              supportedPackSchemaVersions: ["1.0.0"]
            },
            checksums: {
              packSha256: "e".repeat(64),
              pmtilesSha256: "f".repeat(64),
              styleSha256: "1".repeat(64)
            }
          }
        ]
      }
    ]
  };
  const updatedCatalogPayload = {
    ...initialCatalogPayload,
    resorts: [
      {
        ...initialCatalogPayload.resorts[0],
        versions: [
          {
            ...initialCatalogPayload.resorts[0].versions[0],
            version: "v2",
            packUrl: "/packs/demo-resort-v2.json",
            createdAt: "2026-02-20T16:35:00.000Z"
          }
        ]
      },
      {
        ...initialCatalogPayload.resorts[1],
        versions: [
          {
            ...initialCatalogPayload.resorts[1].versions[0],
            version: "v2",
            packUrl: "/packs/broken-resort-v2.json",
            createdAt: "2026-02-20T16:35:00.000Z"
          }
        ]
      }
    ]
  };
  let catalogCallCount = 0;

  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes("/resort-packs/index.json")) {
      catalogCallCount += 1;
      const payload = catalogCallCount === 1 ? initialCatalogPayload : updatedCatalogPayload;
      return new Response(JSON.stringify(payload), {
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

    if (url.includes("/packs/demo-resort-v2.json")) {
      return new Response(JSON.stringify(validPack), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (url.includes("/packs/broken-resort-v1.json")) {
      return new Response(JSON.stringify(validPack), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (url.includes("/packs/broken-resort-v2.json")) {
      return new Response("bad", { status: 500 });
    }

    return new Response("Not Found", { status: 404 });
  });
}
