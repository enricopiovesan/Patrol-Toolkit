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
    const register = vi.fn().mockResolvedValue({
      waiting: null,
      installing: null,
      addEventListener: vi.fn()
    } as unknown as ServiceWorkerRegistration);

    Object.defineProperty(Navigator.prototype, "serviceWorker", {
      configurable: true,
      value: { register, addEventListener: vi.fn(), controller: null }
    });

    await registerServiceWorker("/custom-sw.js");

    expect(register).toHaveBeenCalledOnce();
    expect(register).toHaveBeenCalledWith("/custom-sw.js", { scope: "/" });
  });

  it("prompts waiting service worker to skip waiting", async () => {
    const postMessage = vi.fn();
    const registration = {
      waiting: { postMessage },
      installing: null,
      addEventListener: vi.fn()
    } as unknown as ServiceWorkerRegistration;

    const addEventListener = vi.fn();
    const register = vi.fn().mockResolvedValue(registration);

    Object.defineProperty(Navigator.prototype, "serviceWorker", {
      configurable: true,
      value: { register, addEventListener, controller: {} }
    });

    await registerServiceWorker();

    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(addEventListener).toHaveBeenCalledWith("controllerchange", expect.any(Function));
  });

  it("signals skip-waiting on updatefound for installed worker", async () => {
    const workerListeners = new Map<string, () => void>();
    const worker = {
      state: "installing",
      postMessage: vi.fn(),
      addEventListener: vi.fn((event: string, callback: () => void) => {
        workerListeners.set(event, callback);
      })
    };

    const registrationListeners = new Map<string, () => void>();
    const registration = {
      waiting: null,
      installing: worker,
      addEventListener: vi.fn((event: string, callback: () => void) => {
        registrationListeners.set(event, callback);
      })
    } as unknown as ServiceWorkerRegistration;

    const addEventListener = vi.fn();
    const register = vi.fn().mockResolvedValue(registration);

    Object.defineProperty(Navigator.prototype, "serviceWorker", {
      configurable: true,
      value: { register, addEventListener, controller: {} }
    });

    await registerServiceWorker();
    registrationListeners.get("updatefound")?.();
    worker.state = "installed";
    workerListeners.get("statechange")?.();

    expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });
});
