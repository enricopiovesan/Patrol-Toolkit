export async function registerServiceWorker(
  serviceWorkerUrl = buildServiceWorkerUrl(import.meta.env.BASE_URL)
): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) {
    return null;
  }

  const scope = import.meta.env.BASE_URL;
  const registration = await navigator.serviceWorker.register(serviceWorkerUrl, { scope });

  if (registration.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) {
      return;
    }

    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        worker.postMessage({ type: "SKIP_WAITING" });
      }
    });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });

  return registration;
}

function buildServiceWorkerUrl(baseUrl: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const withLeadingSlash = normalizedBase.startsWith("/") ? normalizedBase : `/${normalizedBase}`;
  return `${withLeadingSlash}service-worker.js`;
}
