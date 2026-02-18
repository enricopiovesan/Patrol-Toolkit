import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAuditLogger } from "./audit-log.js";

describe("createAuditLogger", () => {
  it("writes JSONL entries with timestamp, level, event, and context", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "audit-log-"));
    const logPath = join(workspace, "logs", "audit.jsonl");

    try {
      const logger = await createAuditLogger(logPath);
      await logger.write("info", "test_event", { key: "value" });

      const lines = (await readFile(logPath, "utf8")).trim().split("\n");
      expect(lines).toHaveLength(1);
      const entry = JSON.parse(lines[0] ?? "{}") as {
        timestamp: string;
        level: string;
        event: string;
        context: { key?: string };
      };

      expect(entry.level).toBe("info");
      expect(entry.event).toBe("test_event");
      expect(entry.context.key).toBe("value");
      expect(Number.isNaN(Date.parse(entry.timestamp))).toBe(false);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});

