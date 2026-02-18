export const packSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "resort", "basemap", "thresholds", "lifts", "runs"],
  properties: {
    schemaVersion: { const: "1.0.0" },
    resort: {
      type: "object",
      additionalProperties: false,
      required: ["id", "name", "timezone"],
      properties: {
        id: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        timezone: { type: "string", minLength: 1 }
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
      required: ["liftProximityMeters"],
      properties: {
        liftProximityMeters: { type: "number", exclusiveMinimum: 0 }
      }
    },
    lifts: { type: "array", minItems: 1 },
    runs: { type: "array", minItems: 1 }
  }
} as const;
