import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import { readFile } from "node:fs/promises";

export type ExtractFleetConfig = {
  schemaVersion: "1.0.0";
  output: {
    manifestPath: string;
    provenancePath?: string;
  };
  options?: {
    continueOnError?: boolean;
    generatedAt?: string;
  };
  resorts: Array<{
    id: string;
    configPath: string;
  }>;
};

const fleetConfigSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "output", "resorts"],
  properties: {
    schemaVersion: { const: "1.0.0" },
    output: {
      type: "object",
      additionalProperties: false,
      required: ["manifestPath"],
      properties: {
        manifestPath: { type: "string", minLength: 1 },
        provenancePath: { type: "string", minLength: 1 }
      }
    },
    options: {
      type: "object",
      additionalProperties: false,
      properties: {
        continueOnError: { type: "boolean" },
        generatedAt: { type: "string", minLength: 1 }
      }
    },
    resorts: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "configPath"],
        properties: {
          id: { type: "string", minLength: 1 },
          configPath: { type: "string", minLength: 1 }
        }
      }
    }
  }
} as const;

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(fleetConfigSchema);

export async function readExtractFleetConfig(path: string): Promise<ExtractFleetConfig> {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const valid = validate(parsed);
  if (!valid) {
    throw new Error(`Invalid fleet config:\n${formatErrors(validate.errors)}`);
  }

  const config = parsed as ExtractFleetConfig;
  const seen = new Set<string>();
  for (const resort of config.resorts) {
    if (seen.has(resort.id)) {
      throw new Error(`Invalid fleet config:\nDuplicate resort id '${resort.id}'.`);
    }
    seen.add(resort.id);
  }

  return config;
}

function formatErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) {
    return "Unknown schema validation error.";
  }
  return errors.map((error) => `${error.instancePath || "#"}: ${error.message ?? "invalid"}`).join("\n");
}
