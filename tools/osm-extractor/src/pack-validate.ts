import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import { readFile } from "node:fs/promises";
import { packSchema } from "./pack-schema.js";
import type { ResortPack } from "./pack-types.js";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(packSchema);

export type PackValidationIssue = {
  path: string;
  message: string;
  keyword: string;
  entityRef?: string;
};

export async function readPack(path: string): Promise<unknown> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as unknown;
}

export function validatePack(
  input: unknown
): { ok: true; value: ResortPack } | { ok: false; errors: string[]; issues: PackValidationIssue[] } {
  const valid = validate(input);
  if (valid) {
    return { ok: true, value: input as ResortPack };
  }

  const issues = (validate.errors ?? []).map((error: ErrorObject) => toIssue(error, input));
  const errors = issues.map((issue) => `${issue.path}: ${issue.message}`);

  return { ok: false, errors, issues };
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

function toIssue(error: ErrorObject, input: unknown): PackValidationIssue {
  const path = error.instancePath || "#";
  return {
    path,
    message: error.message ?? "invalid",
    keyword: error.keyword,
    entityRef: buildEntityRef(path, input)
  };
}

function buildEntityRef(path: string, input: unknown): string | undefined {
  if (!path.startsWith("/") || !input || typeof input !== "object") {
    return undefined;
  }

  const parts = path.slice(1).split("/");
  const root = input as Partial<ResortPack>;
  if (parts[0] === "runs") {
    const index = Number(parts[1]);
    if (Number.isInteger(index) && Array.isArray(root.runs)) {
      const run = root.runs[index];
      if (run?.id) {
        return `run:${run.id}`;
      }
    }
  }

  if (parts[0] === "lifts") {
    const index = Number(parts[1]);
    if (Number.isInteger(index) && Array.isArray(root.lifts)) {
      const lift = root.lifts[index];
      if (lift?.id) {
        return `lift:${lift.id}`;
      }
    }
  }

  if (parts[0] === "resort" && typeof root.resort?.id === "string") {
    return `resort:${root.resort.id}`;
  }

  return undefined;
}
