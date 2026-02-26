import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";

export type ResortWorkspaceLayerStatus = "pending" | "running" | "complete" | "failed";

export type ResortWorkspace = {
  schemaVersion: "2.0.0" | "2.1.0";
  resort: {
    query: {
      name: string;
      country: string;
    };
    selection?: {
      osmType: "relation" | "way" | "node";
      osmId: number;
      displayName: string;
      center: [number, number];
      selectedAt: string;
    };
  };
  layers: {
    areas?: ResortWorkspaceLayerState;
    boundary: ResortWorkspaceLayerState;
    contours?: ResortWorkspaceLayerState;
    lifts: ResortWorkspaceLayerState;
    peaks?: ResortWorkspaceLayerState;
    runs: ResortWorkspaceLayerState;
  };
};

export type ResortWorkspaceLayerState = {
  status: ResortWorkspaceLayerStatus;
  artifactPath?: string;
  queryHash?: string;
  featureCount?: number;
  checksumSha256?: string;
  updatedAt?: string;
  error?: string;
};

const layerStateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status"],
  properties: {
    status: { enum: ["pending", "running", "complete", "failed"] },
    artifactPath: { type: "string", minLength: 1 },
    queryHash: { type: "string", minLength: 1 },
    featureCount: { type: "integer", minimum: 0 },
    checksumSha256: { type: "string", minLength: 1 },
    updatedAt: { type: "string", minLength: 1 },
    error: { type: "string", minLength: 1 }
  }
} as const;

const resortWorkspaceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "resort", "layers"],
  properties: {
    schemaVersion: { enum: ["2.0.0", "2.1.0"] },
    resort: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: {
          type: "object",
          additionalProperties: false,
          required: ["name", "country"],
          properties: {
            name: { type: "string", minLength: 1 },
            country: { type: "string", minLength: 1 }
          }
        },
        selection: {
          type: "object",
          additionalProperties: false,
          required: ["osmType", "osmId", "displayName", "center", "selectedAt"],
          properties: {
            osmType: { enum: ["relation", "way", "node"] },
            osmId: { type: "integer" },
            displayName: { type: "string", minLength: 1 },
            center: {
              type: "array",
              minItems: 2,
              maxItems: 2,
              prefixItems: [{ type: "number" }, { type: "number" }],
              items: false
            },
            selectedAt: { type: "string", minLength: 1 }
          }
        }
      }
    },
    layers: {
      type: "object",
      additionalProperties: false,
      required: ["boundary", "lifts", "runs"],
      properties: {
        areas: layerStateSchema,
        boundary: layerStateSchema,
        contours: layerStateSchema,
        lifts: layerStateSchema,
        peaks: layerStateSchema,
        runs: layerStateSchema
      }
    }
  }
} as const;

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(resortWorkspaceSchema);

export async function readResortWorkspace(path: string): Promise<ResortWorkspace> {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  assertResortWorkspace(parsed);
  return parsed;
}

export async function writeResortWorkspace(path: string, workspace: ResortWorkspace): Promise<void> {
  assertResortWorkspace(workspace);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(workspace, null, 2)}\n`, "utf8");
}

export function assertResortWorkspace(value: unknown): asserts value is ResortWorkspace {
  const valid = validate(value);
  if (!valid) {
    throw new Error(`Invalid resort workspace:\n${formatErrors(validate.errors)}`);
  }
}

function formatErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) {
    return "Unknown schema validation error.";
  }
  return errors.map((error) => `${error.instancePath || "#"}: ${error.message ?? "invalid"}`).join("\n");
}
