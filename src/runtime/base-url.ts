export function resolveAppUrl(path: string): string {
  const trimmed = path.trim();
  if (trimmed.length === 0) {
    return normalizeBaseUrl(readBaseUrl());
  }

  if (isNetworkUrl(trimmed)) {
    return trimmed;
  }

  const baseUrl = normalizeBaseUrl(readBaseUrl());
  if (trimmed.startsWith(baseUrl)) {
    return trimmed;
  }
  const relativePath = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed.replace(/^\.\/+/u, "");
  return `${baseUrl}${relativePath}`;
}

function readBaseUrl(): string {
  const candidate = import.meta.env.BASE_URL;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : "/";
}

function normalizeBaseUrl(baseUrl: string): string {
  const withLeadingSlash = baseUrl.startsWith("/") ? baseUrl : `/${baseUrl}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function isNetworkUrl(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//iu.test(value) || value.startsWith("//");
}
