import { afterEach, describe, expect, it } from "vitest";
import type { AppShell } from "./app-shell";
import "./app-shell";

describe("AppShell", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the patrol toolkit heading", async () => {
    const element = document.createElement("app-shell") as AppShell;
    document.body.appendChild(element);

    await element.updateComplete;

    const heading = element.shadowRoot?.querySelector("h1")?.textContent;
    expect(heading).toBe("Patrol Toolkit");
  });
});
