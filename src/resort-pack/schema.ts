export const resortPackSchema = {
  $id: "https://patroltoolkit.app/schema/resort-pack-1.0.0.json",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "resort", "basemap", "thresholds", "lifts", "runs"],
  properties: {
    schemaVersion: {
      type: "string",
      const: "1.0.0"
    },
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
    boundary: {
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
              items: [
                { type: "number", minimum: -180, maximum: 180 },
                { type: "number", minimum: -90, maximum: 90 }
              ],
              additionalItems: false
            }
          }
        }
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
    areas: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "kind", "perimeter"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          kind: { enum: ["ridge", "bowl", "zone", "section", "area"] },
          perimeter: {
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
                    items: [
                      { type: "number", minimum: -180, maximum: 180 },
                      { type: "number", minimum: -90, maximum: 90 }
                    ],
                    additionalItems: false
                  }
                }
              }
            }
          }
        }
      }
    },
    terrainBands: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "polygon"],
        properties: {
          id: { type: "string", minLength: 1 },
          elevationMinMeters: { type: "number" },
          elevationMaxMeters: { type: "number" },
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
                    items: [
                      { type: "number", minimum: -180, maximum: 180 },
                      { type: "number", minimum: -90, maximum: 90 }
                    ],
                    additionalItems: false
                  }
                }
              }
            }
          }
        }
      }
    },
    contours: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "line"],
        properties: {
          id: { type: "string", minLength: 1 },
          elevationMeters: { type: "number" },
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
                  items: [
                    { type: "number", minimum: -180, maximum: 180 },
                    { type: "number", minimum: -90, maximum: 90 }
                  ],
                  additionalItems: false
                }
              }
            }
          }
        }
      }
    },
    peaks: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "coordinates"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          elevationMeters: { type: "number" },
          coordinates: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            items: [
              { type: "number", minimum: -180, maximum: 180 },
              { type: "number", minimum: -90, maximum: 90 }
            ],
            additionalItems: false
          }
        }
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
                  items: [
                    { type: "number", minimum: -180, maximum: 180 },
                    { type: "number", minimum: -90, maximum: 90 }
                  ],
                  additionalItems: false
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
                    items: [
                      { type: "number", minimum: -180, maximum: 180 },
                      { type: "number", minimum: -90, maximum: 90 }
                    ],
                    additionalItems: false
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
                  items: [
                    { type: "number", minimum: -180, maximum: 180 },
                    { type: "number", minimum: -90, maximum: 90 }
                  ],
                  additionalItems: false
                }
              }
            }
          }
        }
      }
    }
  }
} as const;
