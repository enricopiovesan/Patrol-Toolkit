import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

type RetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  retryOnStatuses: number[];
};

type CachePolicy = {
  dir: string;
  ttlMs: number;
  key: string;
};

type ResilientFetchJsonArgs = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  fetchFn?: typeof fetch;
  throttleMs?: number;
  retry?: RetryPolicy;
  cache?: CachePolicy;
};

type CacheEnvelope = {
  savedAt: string;
  data: unknown;
};

let lastRequestAt = 0;

export function defaultCacheDir(): string {
  return join(tmpdir(), "ptk-extractor-cache");
}

export async function resilientFetchJson(args: ResilientFetchJsonArgs): Promise<unknown> {
  const fetchFn = args.fetchFn ?? fetch;
  const retry = args.retry ?? {
    maxAttempts: 4,
    baseDelayMs: 500,
    retryOnStatuses: [408, 429, 500, 502, 503, 504]
  };
  const throttleMs = args.throttleMs ?? 1100;

  const cachePath = args.cache ? cacheFilePath(args.cache.dir, args.cache.key) : null;
  if (cachePath && args.cache) {
    const cached = await readCache(cachePath, args.cache.ttlMs);
    if (cached.hit) {
      return cached.data;
    }
  }

  let lastError: string | null = null;
  for (let attempt = 1; attempt <= retry.maxAttempts; attempt += 1) {
    await throttle(throttleMs);
    try {
      const response = await fetchFn(args.url, {
        method: args.method ?? "GET",
        headers: args.headers,
        body: args.body
      });

      if (!response.ok) {
        const retryable = retry.retryOnStatuses.includes(response.status);
        lastError = `HTTP ${response.status}`;
        if (!retryable || attempt === retry.maxAttempts) {
          throw new Error(`Upstream returned HTTP ${response.status}.`);
        }
        await sleep(retry.baseDelayMs * 2 ** (attempt - 1));
        continue;
      }

      const data = (await response.json()) as unknown;
      if (cachePath) {
        await writeCache(cachePath, data);
      }
      return data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = message;
      if (attempt === retry.maxAttempts) {
        throw new Error(`Network request failed after ${retry.maxAttempts} attempts: ${message}`);
      }
      await sleep(retry.baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw new Error(`Network request failed: ${lastError ?? "unknown error"}`);
}

function cacheFilePath(dir: string, key: string): string {
  const hash = createHash("sha256").update(key).digest("hex");
  return join(dir, `${hash}.json`);
}

async function readCache(path: string, ttlMs: number): Promise<{ hit: true; data: unknown } | { hit: false }> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as CacheEnvelope;
    const age = Date.now() - Date.parse(parsed.savedAt);
    if (!Number.isFinite(age) || age < 0 || age > ttlMs) {
      return { hit: false };
    }
    return { hit: true, data: parsed.data };
  } catch {
    return { hit: false };
  }
}

async function writeCache(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const payload: CacheEnvelope = {
    savedAt: new Date().toISOString(),
    data
  };
  await writeFile(path, `${JSON.stringify(payload)}\n`, "utf8");
}

function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  if (index < 0) {
    return ".";
  }
  if (index === 0) {
    return "/";
  }
  return path.slice(0, index);
}

async function throttle(minIntervalMs: number): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < minIntervalMs) {
    await sleep(minIntervalMs - elapsed);
  }
  lastRequestAt = Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
