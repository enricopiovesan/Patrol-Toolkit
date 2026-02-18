const DETERMINISTIC_FALLBACK = "1970-01-01T00:00:00.000Z";

export function resolveGeneratedAt(options: {
  override?: string;
  sourceTimestamp?: string | null;
}): string {
  const candidate = options.override ?? options.sourceTimestamp ?? DETERMINISTIC_FALLBACK;
  const parsed = Date.parse(candidate);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid generatedAt timestamp '${candidate}'. Expected ISO-8601 compatible value.`);
  }
  return new Date(parsed).toISOString();
}

