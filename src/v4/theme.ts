export type V4ThemeId = "default" | "high-contrast";

export const DEFAULT_V4_THEME: V4ThemeId = "default";

export function normalizeV4Theme(candidate: string | null | undefined): V4ThemeId {
  const value = (candidate ?? "").trim().toLowerCase();
  return value === "high-contrast" ? "high-contrast" : "default";
}

