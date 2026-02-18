export async function registerServiceWorker(
  serviceWorkerUrl = "/service-worker.js"
): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) {
    return null;
  }

  return navigator.serviceWorker.register(serviceWorkerUrl, { scope: "/" });
}
