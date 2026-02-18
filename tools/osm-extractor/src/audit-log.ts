import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type AuditLogLevel = "info" | "error";

export type AuditLogEntry = {
  timestamp: string;
  level: AuditLogLevel;
  event: string;
  context: Record<string, unknown>;
};

export type AuditLogger = {
  write(level: AuditLogLevel, event: string, context: Record<string, unknown>): Promise<void>;
};

export const noopAuditLogger: AuditLogger = {
  async write() {
    return;
  }
};

export async function createAuditLogger(logFilePath: string): Promise<AuditLogger> {
  const absolutePath = resolve(logFilePath);
  await mkdir(dirname(absolutePath), { recursive: true });

  return {
    async write(level: AuditLogLevel, event: string, context: Record<string, unknown>): Promise<void> {
      const entry: AuditLogEntry = {
        timestamp: new Date().toISOString(),
        level,
        event,
        context
      };
      await appendFile(absolutePath, `${JSON.stringify(entry)}\n`, "utf8");
    }
  };
}

