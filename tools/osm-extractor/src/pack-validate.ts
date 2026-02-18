import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import { readFile } from "node:fs/promises";
import { packSchema } from "./pack-schema.js";
import type { ResortPack } from "./pack-types.js";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(packSchema);

export async function readPack(path: string): Promise<unknown> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as unknown;
}

export function validatePack(input: unknown): { ok: true; value: ResortPack } | { ok: false; errors: string[] } {
  const valid = validate(input);
  if (valid) {
    return { ok: true, value: input as ResortPack };
  }

  const errors = (validate.errors ?? []).map((error: ErrorObject) => {
    const path = error.instancePath || "#";
    return `${path}: ${error.message ?? "invalid"}`;
  });

  return { ok: false, errors };
}

export function summarizePack(pack: ResortPack): string {
  const towerCount = pack.lifts.reduce((total, lift) => total + lift.towers.length, 0);
  return [
    `resort=${pack.resort.name}`,
    `runs=${pack.runs.length}`,
    `lifts=${pack.lifts.length}`,
    `towers=${towerCount}`,
    `schema=${pack.schemaVersion}`
  ].join(" ");
}
