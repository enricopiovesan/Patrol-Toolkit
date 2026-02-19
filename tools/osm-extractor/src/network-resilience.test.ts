import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resilientFetchJson } from "./network-resilience.js";

describe("network resilience", () => {
  it("retries retryable statuses and returns JSON payload", async () => {
    let calls = 0;
    const payload = await resilientFetchJson({
      url: "https://example.test/retry",
      fetchFn: (async () => {
        calls += 1;
        if (calls === 1) {
          return {
            ok: false,
            status: 429,
            json: async () => ({})
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true })
        } as Response;
      }) as typeof fetch,
      throttleMs: 0,
      retry: {
        maxAttempts: 2,
        baseDelayMs: 1,
        retryOnStatuses: [429]
      }
    });

    expect(calls).toBe(2);
    expect(payload).toEqual({ ok: true });
  });

  it("serves cached payload without calling upstream again", async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), "network-cache-"));
    let calls = 0;
    try {
      const args = {
        url: "https://example.test/cache",
        fetchFn: (async () => {
          calls += 1;
          return {
            ok: true,
            status: 200,
            json: async () => ({ value: 1 })
          } as Response;
        }) as typeof fetch,
        throttleMs: 0,
        cache: {
          dir: cacheDir,
          ttlMs: 60_000,
          key: "cache-key"
        }
      };

      const first = await resilientFetchJson(args);
      const second = await resilientFetchJson(args);
      expect(first).toEqual({ value: 1 });
      expect(second).toEqual({ value: 1 });
      expect(calls).toBe(1);
    } finally {
      await rm(cacheDir, { recursive: true, force: true });
    }
  });
});
