export type UiAppRoute = "v4";

export function resolveUiAppRoute(
  pathname: string,
  baseUrl: string
): UiAppRoute {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedPath = ensureLeadingSlash(pathname);

  if (!normalizedPath.startsWith(normalizedBase)) {
    return "v4";
  }
  return "v4";
}

function normalizeBaseUrl(baseUrl: string): string {
  const withLeadingSlash = ensureLeadingSlash(baseUrl);
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function ensureLeadingSlash(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}
