import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readExtractFleetConfig } from "./fleet-config.js";

describe("readExtractFleetConfig", () => {
  it("loads a valid fleet config", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "fleet-config-"));
    const configPath = join(workspace, "fleet-config.json");

    try {
      await writeFile(
        configPath,
        JSON.stringify({
          schemaVersion: "1.0.0",
          output: { manifestPath: "./out/manifest.json" },
          resorts: [{ id: "demo", configPath: "./resorts/demo.json" }]
        }),
        "utf8"
      );

      const config = await readExtractFleetConfig(configPath);
      expect(config.schemaVersion).toBe("1.0.0");
      expect(config.resorts[0]?.id).toBe("demo");
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("rejects invalid fleet config", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "fleet-config-invalid-"));
    const configPath = join(workspace, "fleet-config.json");

    try {
      await writeFile(
        configPath,
        JSON.stringify({
          schemaVersion: "1.0.0",
          output: {},
          resorts: []
        }),
        "utf8"
      );

      await expect(readExtractFleetConfig(configPath)).rejects.toThrow(/Invalid fleet config/);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("rejects duplicate resort ids", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "fleet-config-duplicates-"));
    const configPath = join(workspace, "fleet-config.json");

    try {
      await writeFile(
        configPath,
        JSON.stringify({
          schemaVersion: "1.0.0",
          output: { manifestPath: "./out/manifest.json" },
          resorts: [
            { id: "demo", configPath: "./resorts/a.json" },
            { id: "demo", configPath: "./resorts/b.json" }
          ]
        }),
        "utf8"
      );

      await expect(readExtractFleetConfig(configPath)).rejects.toThrow(/Duplicate resort id/);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
