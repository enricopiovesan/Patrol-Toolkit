import { resolveUiAppRoute } from "./route";
import { classifyViewportWidth } from "./viewport";

const DEFAULT_VIEWPORT_CONTENT = "width=device-width, initial-scale=1.0";
const V4_TOUCH_VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";

export function computeViewportMetaContent(
  pathname: string,
  baseUrl: string,
  widthPx: number
): string {
  const route = resolveUiAppRoute(pathname, baseUrl);
  if (route !== "v4") {
    return DEFAULT_VIEWPORT_CONTENT;
  }

  const viewport = classifyViewportWidth(widthPx);
  return viewport === "large" ? DEFAULT_VIEWPORT_CONTENT : V4_TOUCH_VIEWPORT_CONTENT;
}

export function syncViewportMeta(
  doc: Document,
  pathname: string,
  baseUrl: string,
  widthPx: number
): string {
  const meta = doc.querySelector("meta[name='viewport']");
  if (!meta) {
    return DEFAULT_VIEWPORT_CONTENT;
  }
  const content = computeViewportMetaContent(pathname, baseUrl, widthPx);
  meta.setAttribute("content", content);
  return content;
}

