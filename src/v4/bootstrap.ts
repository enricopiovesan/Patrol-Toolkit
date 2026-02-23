import { resolveUiAppRoute } from "./route";

export type RootShellTag = "app-shell" | "ptk-app-shell";

export function selectRootShellTag(pathname: string, baseUrl: string): RootShellTag {
  return resolveUiAppRoute(pathname, baseUrl) === "v4" ? "ptk-app-shell" : "app-shell";
}

export function mountRootShell(
  doc: Document,
  pathname: string,
  baseUrl: string
): RootShellTag {
  const tag = selectRootShellTag(pathname, baseUrl);
  const existingLegacy = doc.querySelector("app-shell");
  const existingV4 = doc.querySelector("ptk-app-shell");
  const current = existingV4 ?? existingLegacy;

  if (current && current.tagName.toLowerCase() === tag) {
    return tag;
  }

  const next = doc.createElement(tag);
  if (current && current.parentNode) {
    current.parentNode.replaceChild(next, current);
    return tag;
  }

  doc.body.appendChild(next);
  return tag;
}

