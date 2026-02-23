import "./styles.css";
import "./app-shell";
import "./v4/ptk-app-shell";
import { registerServiceWorker } from "./pwa/register-service-worker";
import { ensurePmtilesProtocolRegistered } from "./map/pmtiles-protocol";
import { mountRootShell } from "./v4/bootstrap";

ensurePmtilesProtocolRegistered();
mountRootShell(document, window.location.pathname, import.meta.env.BASE_URL);

if (import.meta.env.PROD) {
  void registerServiceWorker().catch((error: unknown) => {
    console.error("Service worker registration failed", error);
  });
}
