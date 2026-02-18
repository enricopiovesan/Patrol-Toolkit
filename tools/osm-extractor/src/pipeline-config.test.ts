import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readExtractResortConfig } from "./pipeline-config.js";

describe("readExtractResortConfig", () => {
  it("loads a valid config file", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "extract-config-"));
    const configPath = join(workspace, "extract-config.json");

    try {
      await writeFile(
        configPath,
        JSON.stringify({
          schemaVersion: "0.4.0",
          resort: { timezone: "Europe/Rome", id: "demo-resort" },
          source: { osmInputPath: "./demo.osm.json" },
          output: { directory: "./out" },
          basemap: { pmtilesPath: "packs/demo/base.pmtiles", stylePath: "packs/demo/style.json" }
        }),
        "utf8"
      );

      const config = await readExtractResortConfig(configPath);
      expect(config.schemaVersion).toBe("0.4.0");
      expect(config.resort.id).toBe("demo-resort");
      expect(config.output.directory).toBe("./out");
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("throws for invalid config data", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "extract-config-invalid-"));
    const configPath = join(workspace, "extract-config.json");

    try {
      await writeFile(
        configPath,
        JSON.stringify({
          schemaVersion: "0.4.0",
          resort: { timezone: "" },
          source: {},
          output: { directory: "./out" },
          basemap: { pmtilesPath: "packs/demo/base.pmtiles", stylePath: "packs/demo/style.json" }
        }),
        "utf8"
      );

      await expect(readExtractResortConfig(configPath)).rejects.toThrow(/Invalid extract config/);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});

