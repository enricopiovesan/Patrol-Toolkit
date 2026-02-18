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
    lifts: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "towers"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          towers: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["number", "coordinates"],
              properties: {
                number: { type: "integer", minimum: 1 },
                coordinates: {
                  type: "array",
                  minItems: 2,
                  maxItems: 2,
                  prefixItems: [
                    { type: "number", minimum: -180, maximum: 180 },
                    { type: "number", minimum: -90, maximum: 90 }
                  ],
                  items: false
                }
              }
            }
          }
        }
      }
    },
    runs: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "difficulty", "polygon", "centerline"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          difficulty: { enum: ["green", "blue", "black", "double-black"] },
          polygon: {
            type: "object",
            additionalProperties: false,
            required: ["type", "coordinates"],
            properties: {
              type: { const: "Polygon" },
              coordinates: {
                type: "array",
                minItems: 1,
                items: {
                  type: "array",
                  minItems: 4,
                  items: {
                    type: "array",
                    minItems: 2,
                    maxItems: 2,
                    prefixItems: [
                      { type: "number", minimum: -180, maximum: 180 },
                      { type: "number", minimum: -90, maximum: 90 }
                    ],
                    items: false
                  }
                }
              }
            }
          },
          centerline: {
            type: "object",
            additionalProperties: false,
            required: ["type", "coordinates"],
            properties: {
              type: { const: "LineString" },
              coordinates: {
                type: "array",
                minItems: 2,
                items: {
                  type: "array",
                  minItems: 2,
                  maxItems: 2,
                  prefixItems: [
                    { type: "number", minimum: -180, maximum: 180 },
                    { type: "number", minimum: -90, maximum: 90 }
                  ],
                  items: false
                }
              }
            }
          }
        }
      }
    }
  }
} as const;
