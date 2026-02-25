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
const loadPackFromCatalogEntryMock = vi.fn(async () => packFixture);
const requestPackAssetPrecacheMock = vi.fn();

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

  async savePack(
    pack: ResortPack,
    metadata: {
      sourceVersion: string;
      sourceCreatedAt?: string;
    }
  ): Promise<void> {
    repoState.packsById[pack.resort.id] = pack;
    const existingIndex = repoState.installedPacks.findIndex((item) => item.id === pack.resort.id);
    const record: ResortPackListItem = {
      id: pack.resort.id,
      name: pack.resort.name,
      updatedAt: metadata.sourceCreatedAt ?? new Date().toISOString(),
      sourceVersion: metadata.sourceVersion,
      sourceCreatedAt: metadata.sourceCreatedAt
    };
    if (existingIndex >= 0) {
      repoState.installedPacks[existingIndex] = record;
    } else {
      repoState.installedPacks.push(record);
    }
  }
}

vi.mock("../resort-pack/catalog", () => ({
  loadResortCatalog: loadResortCatalogMock,
  selectLatestEligibleVersions: selectLatestEligibleVersionsMock,
  loadPackFromCatalogEntry: loadPackFromCatalogEntryMock,
  isCatalogVersionCompatible: () => true
}));

vi.mock("../resort-pack/repository", () => ({
  ResortPackRepository: MockResortPackRepository
}));

vi.mock("../pwa/precache-pack-assets", () => ({
  requestPackAssetPrecache: requestPackAssetPrecacheMock
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
    loadPackFromCatalogEntryMock.mockClear();
    requestPackAssetPrecacheMock.mockClear();
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

    await waitFor(() => readShellAttr(element, "page") === "select-resort");
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
    await waitFor(() => readShellAttr(element, "page") === "resort");

    expect(readShellAttr(element, "panel-presentation")).toBe("bottom-sheet");
    await waitFor(() => listResortPageButtons(element).includes("Full screen"));
  });

  it("shows fullscreen control on large viewport", async () => {
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
    await waitFor(() => readShellAttr(element, "page") === "resort");

    expect(readShellAttr(element, "fullscreen-supported")).toBe("yes");
    expect(listResortPageButtons(element)).toContain("Full screen");
  });

  it("keeps medium sidebar visible by default in resort page", async () => {
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
    await waitFor(() => readShellAttr(element, "page") === "resort");

    expect(readShellAttr(element, "panel-open")).toBe("yes");
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
    await waitFor(() => readShellAttr(element, "page") === "install-blocking");
    expect(readShellText(element)).toContain("Kicking Horse");
    expect(readShellText(element)).toContain("blocking install/download flow");
    expect(readShellText(element)).toContain("Install resort data");
    expect(readShellText(element)).not.toContain("selected=CA_Golden_Kicking_Horse");
  });

  it("installs resort data from blocking state and enters resort page on retry", async () => {
    await import("./ptk-app-shell");
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);
    await waitFor(() => countResortCards(element) === 2);

    dispatchResortSelect(element, "CA_Golden_Kicking_Horse");
    await waitFor(() => readShellAttr(element, "page") === "install-blocking");
    clickButtonByLabel(element, "Install resort data");
    await waitFor(() => readShellAttr(element, "page") === "resort");
    expect(requestPackAssetPrecacheMock).toHaveBeenCalled();
  });

  it("shows retry then cancel flow in blocking install state when install fails", async () => {
    loadPackFromCatalogEntryMock.mockRejectedValueOnce(new Error("download failed"));
    await import("./ptk-app-shell");
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);
    await waitFor(() => countResortCards(element) === 2);

    dispatchResortSelect(element, "CA_Golden_Kicking_Horse");
    await waitFor(() => readShellAttr(element, "page") === "install-blocking");
    clickButtonByLabel(element, "Install resort data");
    await waitFor(() => readShellText(element).includes("download failed"));
    clickButtonByLabel(element, "Cancel");
    await waitFor(() => readShellAttr(element, "page") === "select-resort");
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
    await waitFor(() => readShellAttr(element, "page") === "resort");
    expect(readResortPageText(element)).toContain("Re generate");
    expect(readResortPageText(element)).toContain("No phrase generated yet.");
  });

  it("returns to select resort and resets search query", async () => {
    await import("./ptk-app-shell");
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);
    await waitFor(() => countResortCards(element) === 2);

    dispatchSearchChange(element, "fernie");
    await waitFor(() => countResortCards(element) === 1);
    loadPackFromCatalogEntryMock.mockRejectedValueOnce(new Error("download failed"));
    dispatchResortSelect(element, "CA_Fernie_Fernie");
    await waitFor(() => readShellAttr(element, "page") === "install-blocking");
    clickButtonByLabel(element, "Install resort data");
    await waitFor(() => readShellText(element).includes("Cancel"));
    clickButtonByLabel(element, "Cancel");
    await waitFor(() => readShellAttr(element, "page") === "select-resort");
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

    await waitFor(() => readShellAttr(element, "page") === "resort");
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

    await waitFor(() => readShellAttr(element, "page") === "resort");
    expect(readResortPageText(element)).toContain("No phrase generated yet.");

    clickResortPageButtonByLabel(element, "Runs Check");
    await waitFor(() => readResortPageText(element).includes("Not defined yet."));
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
    await waitFor(() => readShellAttr(element, "page") === "resort");

    expect(readShellAttr(element, "fullscreen-active")).toBe("no");
    clickResortPageButtonByLabel(element, "Full screen");
    await waitFor(() => readShellAttr(element, "fullscreen-active") === "yes");
    clickResortPageButtonByLabel(element, "Exit full screen");
    await waitFor(() => readShellAttr(element, "fullscreen-active") === "no");
  });

  it("falls back to select page with message when previous active resort cannot be restored", async () => {
    repoState.activePackId = "CA_Unknown_Resort";
    await import("./ptk-app-shell");
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);

    await waitFor(() => readShellAttr(element, "page") === "select-resort");
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
    await waitFor(() => readShellAttr(element, "page") === "resort");

    const host = element.shadowRoot?.querySelector(".root");
    expect(host?.getAttribute("data-theme")).toBe("default");

    clickResortPageButtonByLabel(element, "Open settings");
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
    await waitFor(() => readShellAttr(element, "theme") === "high-contrast");

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

    await waitFor(() => readShellAttr(element, "page") === "resort");
    clickResortPageButtonByLabel(element, "Open settings");
    await waitFor(() => Boolean(findSettingsPanel(element)));
    expect(readSettingsPanelText(element)).toContain("Check for updates");
  });

  it("opens settings from icon without toggling sidebar on medium landscape", async () => {
    repoState.activePackId = "CA_Fernie_Fernie";
    repoState.installedPacks = [
      {
        id: "CA_Fernie_Fernie",
        name: "Fernie",
        updatedAt: "2026-03-02T12:00:00Z",
        sourceVersion: "v7"
      }
    ];
    setWindowWidth(932);
    await import("./ptk-app-shell");
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);

    await waitFor(() => readShellAttr(element, "page") === "resort");
    expect(readShellAttr(element, "viewport")).toBe("medium");
    expect(readShellAttr(element, "panel-open")).toBe("yes");

    clickResortPageButtonByLabel(element, "Open settings");

    await waitFor(() => Boolean(findSettingsPanel(element)));
    expect(readShellAttr(element, "panel-open")).toBe("yes");
  });

  it("opens settings from icon without toggling sidebar on large", async () => {
    repoState.activePackId = "CA_Fernie_Fernie";
    repoState.installedPacks = [
      {
        id: "CA_Fernie_Fernie",
        name: "Fernie",
        updatedAt: "2026-03-02T12:00:00Z",
        sourceVersion: "v7"
      }
    ];
    setWindowWidth(1280);
    await import("./ptk-app-shell");
    const element = document.createElement("ptk-app-shell") as HTMLElement;
    document.body.appendChild(element);

    await waitFor(() => readShellAttr(element, "page") === "resort");
    expect(readShellAttr(element, "viewport")).toBe("large");
    expect(readShellAttr(element, "panel-open")).toBe("yes");

    clickResortPageButtonByLabel(element, "Open settings");

    await waitFor(() => Boolean(findSettingsPanel(element)));
    expect(readShellAttr(element, "panel-open")).toBe("yes");
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
    await waitFor(() => readShellAttr(element, "page") === "resort");

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
    await waitFor(() => readShellAttr(element, "page") === "resort");
    await waitFor(() => readResortPageText(element).includes("last known location"));

    clickResortPageButtonByLabel(element, "Re generate");

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

function readShellAttr(
  element: HTMLElement,
  key:
    | "page"
    | "theme"
    | "viewport"
    | "panel-open"
    | "panel-presentation"
    | "fullscreen-supported"
    | "fullscreen-active"
): string {
  const root = element.shadowRoot?.querySelector(".root");
  return root?.getAttribute(`data-${key}`) ?? "";
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
    (node.textContent ?? "").includes(label) || ((node as HTMLElement).getAttribute("aria-label") ?? "").includes(label)
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
