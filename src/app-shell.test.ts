import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./map/map-view", () => ({}));

describe("AppShell", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the patrol toolkit heading", async () => {
    const { AppShell } = await import("./app-shell");

    const element = new AppShell();
    document.body.appendChild(element);

    await element.updateComplete;

    const heading = element.shadowRoot?.querySelector("h1")?.textContent;
    expect(heading).toBe("Patrol Toolkit");
  });
});
