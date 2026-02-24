export type RootShellTag = "ptk-app-shell";

export function selectRootShellTag(pathname: string, baseUrl: string): RootShellTag {
  void pathname;
  void baseUrl;
  return "ptk-app-shell";
}

export function mountRootShell(
  doc: Document,
  pathname: string,
  baseUrl: string
): RootShellTag {
  const tag = selectRootShellTag(pathname, baseUrl);
  const existingV4 = doc.querySelector("ptk-app-shell");
  const current = existingV4 ?? doc.body.firstElementChild;

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
