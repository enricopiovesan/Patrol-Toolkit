import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { V4Toast } from "./toast-state";

describe("ptk-toast-host", () => {
  beforeEach(async () => {
    await import("./ptk-toast-host");
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders top-center toast stack", async () => {
    const element = document.createElement("ptk-toast-host") as HTMLElement & { toasts: V4Toast[]; updateComplete: Promise<unknown> };
    element.toasts = [
      { id: "a", message: "First", tone: "info" },
      { id: "b", message: "Second", tone: "success" }
    ];
    document.body.appendChild(element);
    await element.updateComplete;

    const text = (element.shadowRoot?.textContent ?? "").replace(/\s+/gu, " ").trim();
    expect(text).toContain("First");
    expect(text).toContain("Second");
    expect(element.shadowRoot?.querySelectorAll(".toast")).toHaveLength(2);
  });

  it("emits dismiss event", async () => {
    const element = document.createElement("ptk-toast-host") as HTMLElement & { toasts: V4Toast[]; updateComplete: Promise<unknown> };
    element.toasts = [{ id: "a", message: "Dismiss me", tone: "warning" }];
    const handler = vi.fn();
    element.addEventListener("ptk-toast-dismiss", handler);
    document.body.appendChild(element);
    await element.updateComplete;

    const button = element.shadowRoot?.querySelector("button") as HTMLButtonElement | null;
    button?.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0].detail.id).toBe("a");
  });
});

