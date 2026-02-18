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
    const { AppShell } = await import("./app-shell");

    const element = new AppShell();
    document.body.appendChild(element);

    await element.updateComplete;

    const heading = element.shadowRoot?.querySelector("h1")?.textContent;
    expect(heading).toBe("Patrol Toolkit");
  });

  it("imports a resort pack and restores active pack on next app load", async () => {
    const { AppShell } = await import("./app-shell");

    const firstInstance = new AppShell();
    document.body.appendChild(firstInstance);
    await waitForCondition(
      () =>
        (firstInstance as unknown as { repository: unknown | null }).repository !== null
    );

    const file = {
      text: async () => JSON.stringify(validPack)
    };

    await (firstInstance as unknown as {
      importPack: (event: { currentTarget: { files: unknown[]; value: string } }) => Promise<void>;
    }).importPack({
      currentTarget: {
        files: [file],
        value: ""
      }
    });

    await waitForCondition(() =>
      /Pack imported: Demo Resort|Active pack: Demo Resort/iu.test(readStatusText(firstInstance))
    );

    firstInstance.remove();
    await waitForTick();

    const secondInstance = new AppShell();
    document.body.appendChild(secondInstance);

    await waitForCondition(() =>
      readStatusText(secondInstance).includes("Active pack: Demo Resort")
    );
  });

  it("generates and copies phrase from active pack and GPS event", async () => {
    const shell = await createReadyShell();

    await (shell as unknown as { generatePhrase: () => Promise<void> }).generatePhrase();
    expect(readPhrase(shell)).toBe("Easy Street, Mid, skier's left, below Summit Express tower 2");

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    await (shell as unknown as { copyPhrase: () => Promise<void> }).copyPhrase();

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith(
      "Easy Street, Mid, skier's left, below Summit Express tower 2"
    );
    expect(readPhraseHint(shell)).toBe("Phrase copied to clipboard.");
  });

  it("falls back to execCommand copy when Clipboard API fails", async () => {
    const shell = await createReadyShell();
    await (shell as unknown as { generatePhrase: () => Promise<void> }).generatePhrase();

    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    setExecCommandMock(true);

    await (shell as unknown as { copyPhrase: () => Promise<void> }).copyPhrase();

    expect(writeText).toHaveBeenCalledOnce();
    expect(readPhraseHint(shell)).toBe("Phrase copied to clipboard.");
  });

  it("reports clipboard unavailable when both APIs fail", async () => {
    const shell = await createReadyShell();
    await (shell as unknown as { generatePhrase: () => Promise<void> }).generatePhrase();

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined
    });
    setExecCommandMock(false);

    await (shell as unknown as { copyPhrase: () => Promise<void> }).copyPhrase();
    expect(readPhraseHint(shell)).toBe("Clipboard unavailable on this device/browser.");
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

async function createReadyShell(): Promise<HTMLElement> {
  const { AppShell } = await import("./app-shell");
  const shell = new AppShell();
  document.body.appendChild(shell);
  await waitForCondition(
    () => (shell as unknown as { repository: unknown | null }).repository !== null
  );

  const file = {
    text: async () => JSON.stringify(validPack)
  };

  await (shell as unknown as {
    importPack: (event: { currentTarget: { files: unknown[]; value: string } }) => Promise<void>;
  }).importPack({
    currentTarget: {
      files: [file],
      value: ""
    }
  });

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

function setExecCommandMock(result: boolean): void {
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue(result)
  });
}
