import "./styles.css";
import "./app-shell";
import { registerServiceWorker } from "./pwa/register-service-worker";

if (import.meta.env.PROD) {
  void registerServiceWorker().catch((error: unknown) => {
    console.error("Service worker registration failed", error);
  });
}
