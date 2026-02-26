export type AerialProvider = "maptiler";

export type AerialConfig =
  | {
      enabled: false;
      provider: null;
      reason: "missing-provider" | "unsupported-provider" | "missing-key";
    }
  | {
      enabled: true;
      provider: AerialProvider;
      tileUrlTemplate: string;
      attribution: string;
    };

export function readAerialConfigFromEnv(
  env: Record<string, string | boolean | undefined> = import.meta.env
): AerialConfig {
  const providerRaw = typeof env.VITE_AERIAL_PROVIDER === "string" ? env.VITE_AERIAL_PROVIDER.trim() : "";
  if (!providerRaw) {
    return { enabled: false, provider: null, reason: "missing-provider" };
  }

  if (providerRaw.toLowerCase() !== "maptiler") {
    return { enabled: false, provider: null, reason: "unsupported-provider" };
  }

  const key = typeof env.VITE_MAPTILER_KEY === "string" ? env.VITE_MAPTILER_KEY.trim() : "";
  if (!key) {
    return { enabled: false, provider: null, reason: "missing-key" };
  }

  return {
    enabled: true,
    provider: "maptiler",
    tileUrlTemplate: `https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${encodeURIComponent(key)}`,
    attribution:
      "© MapTiler © OpenStreetMap contributors"
  };
}

