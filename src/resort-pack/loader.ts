import type { ResortPack, ResortPackValidationResult } from "./types";
import { validateResortPack } from "./validator";

export function loadResortPackFromObject(input: unknown): ResortPackValidationResult {
  return validateResortPack(input);
}

export function loadResortPackFromJson(json: string): ResortPackValidationResult {
  try {
    const parsed = JSON.parse(json) as unknown;
    return validateResortPack(parsed);
  } catch {
    return {
      ok: false,
      errors: [{ code: "invalid_json", path: "#", message: "Invalid JSON." }]
    };
  }
}

export function assertResortPack(input: unknown): ResortPack {
  const result = validateResortPack(input);
  if (result.ok) {
    return result.value;
  }

  const details = result.errors.map((error) => `${error.path} ${error.message}`).join("; ");
  throw new Error(`Invalid Resort Pack: ${details}`);
}
