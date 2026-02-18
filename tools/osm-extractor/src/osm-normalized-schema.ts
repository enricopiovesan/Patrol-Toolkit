export const normalizedResortSourceSchema = {
  $id: "https://patroltoolkit.app/schema/osm-normalized-resort-source-0.2.0.json",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "resort", "source", "boundary", "lifts", "runs", "warnings"],
  properties: {
    schemaVersion: { const: "0.2.0" },
    resort: {
      type: "object",
      additionalProperties: false,
      required: ["id", "name"],
      properties: {
        id: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 }
      }
    },
    source: {
      type: "object",
      additionalProperties: false,
      required: ["format", "sha256", "inputPath", "osmBaseTimestamp"],
      properties: {
        format: { const: "osm-overpass-json" },
        sha256: { type: "string", minLength: 1 },
        inputPath: { type: ["string", "null"] },
        osmBaseTimestamp: { type: ["string", "null"] }
      }
    },
    boundary: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["source", "sourceId", "polygon"],
          properties: {
            source: { enum: ["relation", "way"] },
            sourceId: { type: "integer" },
            polygon: {
              type: "object",
              additionalProperties: false,
              required: ["type", "coordinates"],
              properties: {
                type: { const: "Polygon" },
                coordinates: {
                  type: "array",
                  minItems: 1,
                  maxItems: 1,
                  items: {
                    type: "array",
                    minItems: 4,
                    items: {
                      type: "array",
                      minItems: 2,
                      maxItems: 2,
                      prefixItems: [{ type: "number" }, { type: "number" }],
                      items: false
                    }
                  }
                }
              }
            }
          }
        }
      ]
    },
    lifts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "kind", "sourceWayId", "line", "towers"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          kind: { type: "string", minLength: 1 },
          sourceWayId: { type: "integer" },
          line: {
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
                  prefixItems: [{ type: "number" }, { type: "number" }],
                  items: false
                }
              }
            }
          },
          towers: {
            type: "array",
            minItems: 2,
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
                  prefixItems: [{ type: "number" }, { type: "number" }],
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
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "difficulty", "sourceWayId", "centerline"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          difficulty: { type: ["string", "null"] },
          sourceWayId: { type: "integer" },
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
                  prefixItems: [{ type: "number" }, { type: "number" }],
                  items: false
                }
              }
            }
          }
        }
      }
    },
    warnings: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;
