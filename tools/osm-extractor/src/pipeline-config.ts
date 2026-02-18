import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import { readFile } from "node:fs/promises";

export type ExtractResortConfig = {
  schemaVersion: "0.4.0";
  resort: {
    id?: string;
    name?: string;
    timezone: string;
    boundaryRelationId?: number;
  };
  source: {
    osmInputPath: string;
    area?: {
      bbox: [number, number, number, number];
    };
  };
  output: {
    directory: string;
    normalizedFile?: string;
    packFile?: string;
    reportFile?: string;
    provenanceFile?: string;
  };
  basemap: {
    pmtilesPath: string;
    stylePath: string;
  };
  thresholds?: {
    liftProximityMeters?: number;
  };
  qa?: {
    allowOutsideBoundary?: boolean;
  };
  determinism?: {
    generatedAt?: string;
  };
};

const configSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "resort", "source", "output", "basemap"],
  properties: {
    schemaVersion: { const: "0.4.0" },
    resort: {
      type: "object",
      additionalProperties: false,
      required: ["timezone"],
      properties: {
        id: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        timezone: { type: "string", minLength: 1 },
        boundaryRelationId: { type: "integer" }
      }
    },
    source: {
      type: "object",
      additionalProperties: false,
      required: ["osmInputPath"],
      properties: {
        osmInputPath: { type: "string", minLength: 1 },
        area: {
          type: "object",
          additionalProperties: false,
          required: ["bbox"],
          properties: {
            bbox: {
              type: "array",
              minItems: 4,
              maxItems: 4,
              prefixItems: [{ type: "number" }, { type: "number" }, { type: "number" }, { type: "number" }],
              items: false
            }
          }
        }
      }
    },
    output: {
      type: "object",
      additionalProperties: false,
      required: ["directory"],
      properties: {
        directory: { type: "string", minLength: 1 },
        normalizedFile: { type: "string", minLength: 1 },
        packFile: { type: "string", minLength: 1 },
        reportFile: { type: "string", minLength: 1 },
        provenanceFile: { type: "string", minLength: 1 }
      }
    },
    basemap: {
      type: "object",
      additionalProperties: false,
      required: ["pmtilesPath", "stylePath"],
      properties: {
        pmtilesPath: { type: "string", minLength: 1 },
        stylePath: { type: "string", minLength: 1 }
      }
    },
    thresholds: {
      type: "object",
      additionalProperties: false,
      properties: {
        liftProximityMeters: { type: "number", exclusiveMinimum: 0 }
      }
    },
    qa: {
      type: "object",
      additionalProperties: false,
      properties: {
        allowOutsideBoundary: { type: "boolean" }
      }
    },
    determinism: {
      type: "object",
      additionalProperties: false,
      properties: {
        generatedAt: { type: "string", minLength: 1 }
      }
    }
  }
} as const;

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(configSchema);

export async function readExtractResortConfig(path: string): Promise<ExtractResortConfig> {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const valid = validate(parsed);
  if (!valid) {
    throw new Error(`Invalid extract config:\n${formatErrors(validate.errors)}`);
  }
  return parsed as ExtractResortConfig;
}

function formatErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) {
    return "Unknown schema validation error.";
  }
  return errors.map((error) => `${error.instancePath || "#"}: ${error.message ?? "invalid"}`).join("\n");
}
