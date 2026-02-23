import { DEFAULT_V4_THEME, normalizeV4Theme, type V4ThemeId } from "./theme";

export const V4_THEME_STORAGE_KEY = "ptk.v4.theme";

export function readStoredV4Theme(
  storage: Pick<Storage, "getItem"> | null | undefined
): V4ThemeId {
  if (!storage) {
    return DEFAULT_V4_THEME;
  }
  try {
    return normalizeV4Theme(storage.getItem(V4_THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_V4_THEME;
  }
}

export function writeStoredV4Theme(
  storage: Pick<Storage, "setItem"> | null | undefined,
  theme: V4ThemeId
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(V4_THEME_STORAGE_KEY, theme);
  } catch {
    // Best-effort persistence only.
  }
}

