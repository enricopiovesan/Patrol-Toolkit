import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SelectableResortPack } from "../resort-pack/catalog";
import type { ResortPackListItem } from "../resort-pack/repository";
import type { ResortPack } from "../resort-pack/types";
import { V4_THEME_STORAGE_KEY } from "./theme-preferences";
import { V4_LAST_POSITION_STORAGE_KEY } from "./position-cache";

const catalogEntriesFixture: SelectableResortPack[] = [
  {
    resortId: "CA_Golden_Kicking_Horse",
    resortName: "Kicking Horse",
    version: "v4",
    packUrl: "/packs/kicking-horse.json",
    createdAt: "2026-03-01T10:00:00Z"
  },
  {
    resortId: "CA_Fernie_Fernie",
    resortName: "Fernie",
    version: "v7",
    packUrl: "/packs/fernie.json",
    createdAt: "2026-03-02T10:00:00Z"
  }
];

const repoState: {
  installedPacks: ResortPackListItem[];
  activePackId: string | null;
  packsById: Record<string, ResortPack>;
} = {
  installedPacks: [],
  activePackId: null,
  packsById: {}
};

const packFixture: ResortPack = {
  schemaVersion: "1.0.0",
  resort: {
    id: "CA_Golden_Kicking_Horse",
    name: "Kicking Horse",
    timezone: "America/Edmonton"
  },
  basemap: {
    pmtilesPath: "/packs/base.pmtiles",
    stylePath: "/packs/style.json"
  },
  thresholds: {
    liftProximityMeters: 150
  },
  lifts: Array.from({ length: 3 }, (_, index) => ({
    id: `lift-${index + 1}`,
    name: `Lift ${index + 1}`,
    towers: [{ number: 1, coordinates: [-116.9, 51.2] as [number, number] }]
  })),
  runs: Array.from({ length: 5 }, (_, index) => ({
    id: `run-${index + 1}`,
    name: `Run ${index + 1}`,
    difficulty: "blue" as const,
    polygon: {
      type: "Polygon" as const,
      coordinates: [[[-116.9, 51.2], [-116.91, 51.21], [-116.92, 51.2], [-116.9, 51.2]]]
    },
    centerline: {
      type: "LineString" as const,
      coordinates: [
        [-116.9, 51.2],
        [-116.91, 51.21]
      ]
    }
  }))
};

const loadResortCatalogMock = vi.fn(async () => ({ schemaVersion: "2.0.0", resorts: [] }));
const selectLatestEligibleVersionsMock = vi.fn(() => catalogEntriesFixture);

class MockResortPackRepository {
  static async open(): Promise<MockResortPackRepository> {
    return new MockResortPackRepository();
  }

  close(): void {}

  async listPacks(): Promise<ResortPackListItem[]> {
    return repoState.installedPacks;
  }

  async getActivePackId(): Promise<string | null> {
    return repoState.activePackId;
  }

  async setActivePackId(packId: string | null): Promise<boolean> {
    const installed = repoState.installedPacks.some((pack) => pack.id === packId);
    if (packId && !installed) {
      return false;
    }
    repoState.activePackId = packId;
    return true;
  }

  async getPack(packId: string): Promise<ResortPack | null> {
    return repoState.packsById[packId] ?? null;
  }
}

vi.mock("../resort-pack/catalog", () => ({
  loadResortCatalog: loadResortCatalogMock,
  selectLatestEligibleVersions: selectLatestEligibleVersionsMock
}));

vi.mock("../resort-pack/repository", () => ({
  ResortPackRepository: MockResortPackRepository
}));

describe("ptk-app-shell", () => {
  beforeEach(() => {
    ensureCreateObjectUrlPolyfill();
    repoState.installedPacks = [];
    repoState.activePackId = null;
    repoState.packsById = {
      CA_Golden_Kicking_Horse: {
        ...packFixture,
        resort: { ...packFixture.resort, id: "CA_Golden_Kicking_Horse", name: "Kicking Horse" }
      },
      CA_Fernie_Fernie: {
        ...packFixture,
        resort: { ...packFixture.resort, id: "CA_Fernie_Fernie", name: "Fernie" }
      }
    };
    loadResortCatalogMock.mockClear();
    selectLatestEligibleVersionsMock.mockClear();
    selectLatestEligibleVersionsMock.mockReturnValue(catalogEntriesFixture);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders select resort page by default with catalog cards", async () => {
    await import("./ptk-app-shell");
    setWindowWidth(1200);
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);

    await waitFor(() => readMeta(element).includes("page=select-resort"));
    await waitFor(() => countResortCards(element) === 2);

    expect(loadResortCatalogMock).toHaveBeenCalledTimes(1);
    expect(selectLatestEligibleVersionsMock).toHaveBeenCalledTimes(1);
  });

  it("shows small viewport panel and fullscreen control", async () => {
    repoState.installedPacks = [
      {
        id: "CA_Golden_Kicking_Horse",
        name: "Kicking Horse",
        updatedAt: "2026-03-02T12:00:00Z",
        sourceVersion: "v4"
      }
    ];
    await import("./ptk-app-shell");
    setWindowWidth(430);
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);
    await waitFor(() => countResortCards(element) === 2);
    dispatchResortSelect(element, "CA_Golden_Kicking_Horse");
    await waitFor(() => readMeta(element).includes("page=resort"));

    expect(readMeta(element)).toContain("panel=bottom-sheet");
    await waitFor(() => listResortPageButtons(element).includes("Full screen"));
  });

  it("hides fullscreen control on large viewport", async () => {
    repoState.installedPacks = [
      {
        id: "CA_Golden_Kicking_Horse",
        name: "Kicking Horse",
        updatedAt: "2026-03-02T12:00:00Z",
        sourceVersion: "v4"
      }
    ];
    await import("./ptk-app-shell");
    setWindowWidth(1280);
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);
    await waitFor(() => countResortCards(element) === 2);
    dispatchResortSelect(element, "CA_Golden_Kicking_Horse");
    await waitFor(() => readMeta(element).includes("page=resort"));

    expect(readMeta(element)).toContain("fullscreen-supported=no");
    expect(listResortPageButtons(element)).not.toContain("Full screen");
  });

  it("opens hidden medium sidebar when toggled from resort page", async () => {
    repoState.installedPacks = [
      {
        id: "CA_Golden_Kicking_Horse",
        name: "Kicking Horse",
        updatedAt: "2026-03-02T12:00:00Z",
        sourceVersion: "v4"
      }
    ];
    await import("./ptk-app-shell");
    setWindowWidth(900);
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);
    await waitFor(() => countResortCards(element) === 2);
    dispatchResortSelect(element, "CA_Golden_Kicking_Horse");
    await waitFor(() => readMeta(element).includes("page=resort"));

    expect(readMeta(element)).toContain("panel-open=no");
    clickResortPageButtonByLabel(element, "Show tools");
    await waitFor(() => readMeta(element).includes("panel-open=yes"));
  });

  it("filters resorts using search query", async () => {
    await import("./ptk-app-shell");
    setWindowWidth(900);
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);
    await waitFor(() => countResortCards(element) === 2);

    dispatchSearchChange(element, "golden");
    await waitFor(() => countResortCards(element) === 1);
    expect(listCardNames(element)).toEqual(["Kicking Horse"]);
  });

  it("opens blocking install state when a non-installed resort is selected", async () => {
    await import("./ptk-app-shell");
    setWindowWidth(1024);
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);
    await waitFor(() => countResortCards(element) === 2);

    dispatchResortSelect(element, "CA_Golden_Kicking_Horse");
    await waitFor(() => readMeta(element).includes("page=install-blocking"));
    expect(readShellText(element)).toContain("Kicking Horse");
    expect(readShellText(element)).toContain("blocking install/download flow");
  });

  it("shows retry then cancel flow in blocking install state", async () => {
    await import("./ptk-app-shell");
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);
    await waitFor(() => countResortCards(element) === 2);

    dispatchResortSelect(element, "CA_Golden_Kicking_Horse");
    await waitFor(() => readMeta(element).includes("page=install-blocking"));
    clickButtonByLabel(element, "Retry");
    await waitFor(() => readShellText(element).includes("Install/download flow is not wired"));
    clickButtonByLabel(element, "Cancel");
    await waitFor(() => readMeta(element).includes("page=select-resort"));
  });

  it("opens resort handoff state when an installed resort is selected", async () => {
    repoState.installedPacks = [
      {
        id: "CA_Golden_Kicking_Horse",
        name: "Kicking Horse",
        updatedAt: "2026-03-02T12:00:00Z",
        sourceVersion: "v4"
      }
    ];
    await import("./ptk-app-shell");
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);
    await waitFor(() => countResortCards(element) === 2);

    dispatchResortSelect(element, "CA_Golden_Kicking_Horse");
    await waitFor(() => readMeta(element).includes("page=resort"));
    expect(readResortPageText(element)).toContain("Generate Phrase");
    expect(readResortPageText(element)).toContain("No phrase generated yet.");
  });

  it("returns to select resort and resets search query", async () => {
    await import("./ptk-app-shell");
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);
    await waitFor(() => countResortCards(element) === 2);

    dispatchSearchChange(element, "fernie");
    await waitFor(() => countResortCards(element) === 1);
    dispatchResortSelect(element, "CA_Fernie_Fernie");
    await waitFor(() => readMeta(element).includes("page=install-blocking"));
    clickButtonByLabel(element, "Retry");
    await waitFor(() => readShellText(element).includes("Cancel"));
    clickButtonByLabel(element, "Cancel");
    await waitFor(() => readMeta(element).includes("page=select-resort"));
    await waitFor(() => countResortCards(element) === 2);
    expect(findSearchInput(element)?.value ?? "").toBe("");
  });

  it("resumes to resort page when valid active resort exists", async () => {
    repoState.activePackId = "CA_Fernie_Fernie";
    repoState.installedPacks = [
      {
        id: "CA_Fernie_Fernie",
        name: "Fernie",
        updatedAt: "2026-03-02T12:00:00Z",
        sourceVersion: "v7"
      }
    ];
    await import("./ptk-app-shell");
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);

    await waitFor(() => readMeta(element).includes("page=resort"));
    expect(readResortPageHeaderTitle(element)).toBe("Fernie");
  });

  it("defaults resort page tab to my location and supports tab switching", async () => {
    repoState.activePackId = "CA_Fernie_Fernie";
    repoState.installedPacks = [
      {
        id: "CA_Fernie_Fernie",
        name: "Fernie",
        updatedAt: "2026-03-02T12:00:00Z",
        sourceVersion: "v7"
      }
    ];
    await import("./ptk-app-shell");
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);

    await waitFor(() => readMeta(element).includes("page=resort"));
    expect(readResortPageText(element)).toContain("No phrase generated yet.");

    clickResortPageButtonByLabel(element, "Runs Check");
    await waitFor(() => readResortPageText(element).includes("Run verification workflows"));
  });

  it("updates fullscreen-active meta when fullscreen is toggled on small", async () => {
    repoState.installedPacks = [
      {
        id: "CA_Golden_Kicking_Horse",
        name: "Kicking Horse",
        updatedAt: "2026-03-02T12:00:00Z",
        sourceVersion: "v4"
      }
    ];
    await import("./ptk-app-shell");
    setWindowWidth(430);
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);
    await waitFor(() => countResortCards(element) === 2);
    dispatchResortSelect(element, "CA_Golden_Kicking_Horse");
    await waitFor(() => readMeta(element).includes("page=resort"));

    expect(readMeta(element)).toContain("fullscreen-active=no");
    clickResortPageButtonByLabel(element, "Full screen");
    await waitFor(() => readMeta(element).includes("fullscreen-active=yes"));
    clickResortPageButtonByLabel(element, "Exit full screen");
    await waitFor(() => readMeta(element).includes("fullscreen-active=no"));
  });

  it("falls back to select page with message when previous active resort cannot be restored", async () => {
    repoState.activePackId = "CA_Unknown_Resort";
    await import("./ptk-app-shell");
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);

    await waitFor(() => readMeta(element).includes("page=select-resort"));
    expect(readSelectPageText(element)).toContain("Previous resort could not be restored");
  });

  it("switches theme at runtime and persists selection", async () => {
    repoState.activePackId = "CA_Fernie_Fernie";
    repoState.installedPacks = [
      {
        id: "CA_Fernie_Fernie",
        name: "Fernie",
        updatedAt: "2026-03-02T12:00:00Z",
        sourceVersion: "v7"
      }
    ];
    await import("./ptk-app-shell");
    setWindowWidth(1024);
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);
    await waitFor(() => readMeta(element).includes("page=resort"));

    const host = element.shadowRoot?.querySelector(".root");
    expect(host?.getAttribute("data-theme")).toBe("default");

    clickResortPageButtonByLabel(element, "Settings / Help");
    await waitFor(() => Boolean(findSettingsPanel(element)));
    clickSettingsPanelButtonByLabel(element, "High contrast");
    await (element as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;

    expect(host?.getAttribute("data-theme")).toBe("high-contrast");
    expect(window.localStorage.getItem(V4_THEME_STORAGE_KEY)).toBe("high-contrast");
  });

  it("restores theme from localStorage on startup", async () => {
    window.localStorage.setItem(V4_THEME_STORAGE_KEY, "high-contrast");
    await import("./ptk-app-shell");
    setWindowWidth(1280);
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);
    await waitFor(() => readMeta(element).includes("theme=high-contrast"));

    const host = element.shadowRoot?.querySelector(".root");
    expect(host?.getAttribute("data-theme")).toBe("high-contrast");
  });

  it("opens settings panel from resort page", async () => {
    repoState.activePackId = "CA_Fernie_Fernie";
    repoState.installedPacks = [
      {
        id: "CA_Fernie_Fernie",
        name: "Fernie",
        updatedAt: "2026-03-02T12:00:00Z",
        sourceVersion: "v7"
      }
    ];
    await import("./ptk-app-shell");
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);

    await waitFor(() => readMeta(element).includes("page=resort"));
    clickResortPageButtonByLabel(element, "Settings / Help");
    await waitFor(() => Boolean(findSettingsPanel(element)));
    expect(readSettingsPanelText(element)).toContain("Check for updates");
  });

  it("shows gps guidance modal, then non-blocking disabled state, then retry state", async () => {
    repoState.activePackId = "CA_Fernie_Fernie";
    repoState.installedPacks = [
      {
        id: "CA_Fernie_Fernie",
        name: "Fernie",
        updatedAt: "2026-03-02T12:00:00Z",
        sourceVersion: "v7"
      }
    ];
    await import("./ptk-app-shell");
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);
    await waitFor(() => readMeta(element).includes("page=resort"));

    dispatchResortGpsError(element, { kind: "permission-denied", message: "Location permission denied." });
    await waitFor(() => readResortPageText(element).includes("Turn On Location"));
    expect(readResortPageText(element)).toContain("Location permission denied.");
    expect(readResortPageText(element)).toContain("browser settings");

    clickResortPageButtonByLabel(element, "Close");
    await waitFor(() => !readResortPageText(element).includes("browser settings"));
    expect(readResortPageText(element)).toContain("Turn On Location");

    clickResortPageButtonByLabel(element, "Turn On Location");
    await waitFor(() => readResortPageText(element).includes("Retrying location access"));
  });

  it("generates phrase from cached last known location when fresh gps is unavailable", async () => {
    repoState.activePackId = "CA_Fernie_Fernie";
    repoState.installedPacks = [
      {
        id: "CA_Fernie_Fernie",
        name: "Fernie",
        updatedAt: "2026-03-02T12:00:00Z",
        sourceVersion: "v7"
      }
    ];
    window.localStorage.setItem(
      V4_LAST_POSITION_STORAGE_KEY,
      JSON.stringify({
        coordinates: [-116.9, 51.2],
        accuracy: 18,
        recordedAtIso: "2026-03-10T10:00:00.000Z"
      })
    );

    await import("./ptk-app-shell");
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);
    await waitFor(() => readMeta(element).includes("page=resort"));
    await waitFor(() => readResortPageText(element).includes("last known location"));

    clickResortPageButtonByLabel(element, "Generate Phrase");

    await waitFor(() => readResortPageText(element).includes("offline fallback"));
    expect(readResortPageText(element)).not.toContain("No phrase generated yet.");
  });
});

function setWindowWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width
  });
}

function ensureCreateObjectUrlPolyfill(): void {
  const urlObject = window.URL as typeof window.URL & { createObjectURL?: (value: Blob) => string };
  if (typeof urlObject.createObjectURL !== "function") {
    urlObject.createObjectURL = () => "blob:mock";
  }
}

function readMeta(element: HTMLElement): string {
  return Array.from(element.shadowRoot?.querySelectorAll(".chip") ?? [])
    .map((node) => node.textContent ?? "")
    .join(" | ");
}

function listButtons(element: HTMLElement): string[] {
  return Array.from(element.shadowRoot?.querySelectorAll("button") ?? []).map(
    (node) => ((node as HTMLElement).textContent ?? "").trim()
  );
}

function readShellText(element: HTMLElement): string {
  return (element.shadowRoot?.textContent ?? "").replace(/\s+/gu, " ").trim();
}

function readResortPageText(element: HTMLElement): string {
  const page = element.shadowRoot?.querySelector("ptk-resort-page") as HTMLElement | null;
  return (page?.shadowRoot?.textContent ?? "").replace(/\s+/gu, " ").trim();
}

function readResortPageHeaderTitle(element: HTMLElement): string {
  const page = element.shadowRoot?.querySelector("ptk-resort-page") as HTMLElement | null;
  const header = page?.shadowRoot?.querySelector("ptk-page-header") as (HTMLElement & { title?: string }) | null;
  return header?.title ?? "";
}

function countResortCards(element: HTMLElement): number {
  const page = element.shadowRoot?.querySelector("ptk-select-resort-page") as HTMLElement | null;
  return page?.shadowRoot?.querySelectorAll("ptk-resort-card").length ?? 0;
}

function readSelectPageText(element: HTMLElement): string {
  const page = element.shadowRoot?.querySelector("ptk-select-resort-page") as HTMLElement | null;
  return (page?.shadowRoot?.textContent ?? "").replace(/\s+/gu, " ").trim();
}

function findSearchInput(element: HTMLElement): HTMLInputElement | null {
  const page = element.shadowRoot?.querySelector("ptk-select-resort-page") as HTMLElement | null;
  const search = page?.shadowRoot?.querySelector("ptk-search-input") as HTMLElement | null;
  return (search?.shadowRoot?.querySelector("input") as HTMLInputElement | null) ?? null;
}

function listCardNames(element: HTMLElement): string[] {
  const page = element.shadowRoot?.querySelector("ptk-select-resort-page") as HTMLElement | null;
  const cards = Array.from(page?.shadowRoot?.querySelectorAll("ptk-resort-card") ?? []) as HTMLElement[];
  return cards
    .map((card) => (card.shadowRoot?.querySelector(".name")?.textContent ?? "").trim())
    .filter((name) => name.length > 0);
}

function dispatchSearchChange(element: HTMLElement, value: string): void {
  const page = element.shadowRoot?.querySelector("ptk-select-resort-page");
  page?.dispatchEvent(
    new CustomEvent("ptk-search-change", {
      detail: { value },
      bubbles: true,
      composed: true
    })
  );
}

function dispatchResortSelect(element: HTMLElement, resortId: string): void {
  const page = element.shadowRoot?.querySelector("ptk-select-resort-page");
  page?.dispatchEvent(
    new CustomEvent("ptk-resort-select", {
      detail: { resortId },
      bubbles: true,
      composed: true
    })
  );
}

function clickButtonByLabel(element: HTMLElement, label: string): void {
  const button = Array.from(element.shadowRoot?.querySelectorAll("button") ?? []).find((node) =>
    (node.textContent ?? "").includes(label)
  ) as HTMLButtonElement | undefined;
  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }
  button.click();
}

function listResortPageButtons(element: HTMLElement): string[] {
  const page = element.shadowRoot?.querySelector("ptk-resort-page") as HTMLElement | null;
  return Array.from(page?.shadowRoot?.querySelectorAll("button") ?? []).map((node) =>
    ((node as HTMLElement).textContent ?? "").trim()
  );
}

function clickResortPageButtonByLabel(element: HTMLElement, label: string): void {
  const page = element.shadowRoot?.querySelector("ptk-resort-page") as HTMLElement | null;
  const button = Array.from(page?.shadowRoot?.querySelectorAll("button") ?? []).find((node) =>
    (node.textContent ?? "").includes(label)
  ) as HTMLButtonElement | undefined;
  if (!button) {
    throw new Error(`Resort page button not found: ${label}`);
  }
  button.click();
}

function dispatchResortGpsError(
  element: HTMLElement,
  detail: { kind: "permission-denied" | "position-unavailable" | "timeout" | "unsupported" | "unknown"; message: string }
): void {
  const page = element.shadowRoot?.querySelector("ptk-resort-page");
  page?.dispatchEvent(
    new CustomEvent("ptk-resort-gps-error", {
      detail,
      bubbles: true,
      composed: true
    })
  );
}

function findSettingsPanel(element: HTMLElement): HTMLElement | null {
  return element.shadowRoot?.querySelector("ptk-settings-help-panel") as HTMLElement | null;
}

function clickSettingsPanelButtonByLabel(element: HTMLElement, label: string): void {
  const panel = findSettingsPanel(element);
  const button = Array.from(panel?.shadowRoot?.querySelectorAll("button") ?? []).find((node) =>
    (node.textContent ?? "").includes(label)
  ) as HTMLButtonElement | undefined;
  if (!button) {
    throw new Error(`Settings panel button not found: ${label}`);
  }
  button.click();
}

function readSettingsPanelText(element: HTMLElement): string {
  const panel = findSettingsPanel(element);
  return (panel?.shadowRoot?.textContent ?? "").replace(/\s+/gu, " ").trim();
}

async function waitFor(assertion: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (assertion()) {
      return;
    }
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for condition.");
}
