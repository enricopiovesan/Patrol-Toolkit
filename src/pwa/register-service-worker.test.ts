import { afterEach, describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./register-service-worker";

describe("registerServiceWorker", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    Navigator.prototype,
    "serviceWorker"
  );

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalDescriptor) {
      Object.defineProperty(Navigator.prototype, "serviceWorker", originalDescriptor);
      return;
    }

    Reflect.deleteProperty(Navigator.prototype, "serviceWorker");
  });

  it("returns null when service workers are unavailable", async () => {
    Reflect.deleteProperty(Navigator.prototype, "serviceWorker");

    await expect(registerServiceWorker()).resolves.toBeNull();
  });

  it("registers the service worker with root scope", async () => {
    const register = vi.fn().mockResolvedValue({} as ServiceWorkerRegistration);

    Object.defineProperty(Navigator.prototype, "serviceWorker", {
      configurable: true,
      value: { register }
    });

    await registerServiceWorker("/custom-sw.js");

    expect(register).toHaveBeenCalledOnce();
    expect(register).toHaveBeenCalledWith("/custom-sw.js", { scope: "/" });
  });
});
