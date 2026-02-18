import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import { normalizedResortSourceSchema } from "./osm-normalized-schema.js";
import type { NormalizedResortSource } from "./osm-normalized-types.js";

const ajv = new Ajv2020({
  allErrors: true,
  strict: false
});

const validateNormalizedSourceSchema = ajv.compile(normalizedResortSourceSchema);

export function assertNormalizedResortSource(value: unknown): asserts value is NormalizedResortSource {
  const valid = validateNormalizedSourceSchema(value);
  if (valid) {
    return;
  }

  throw new Error(`Invalid normalized OSM output:\n${formatErrors(validateNormalizedSourceSchema.errors)}`);
}

function formatErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) {
    return "Unknown schema validation error.";
  }
  return errors.map((error) => `${error.instancePath || "/"} ${error.message ?? "schema violation"}`).join("\n");
}

