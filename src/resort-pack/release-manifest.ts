export type ReleaseManifestArtifact = {
  kind: "app" | "catalog" | "pack" | "pmtiles" | "style";
  resortId?: string;
  version?: string;
  url: string;
  sha256: string;
  bytes: number;
};

export type ReleaseManifest = {
  schemaVersion: "1.0.0";
  release: {
    channel: "stable";
    appVersion: string;
    createdAt: string;
  };
  artifacts: ReleaseManifestArtifact[];
};

export async function loadReleaseManifest(url: string): Promise<ReleaseManifest> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load release manifest (${response.status}).`);
  }

  const payload = (await response.json()) as unknown;
  return assertReleaseManifest(payload);
}

export function assertReleaseManifest(input: unknown): ReleaseManifest {
  if (!isObjectRecord(input)) {
    throw new Error("Invalid release manifest: expected object.");
  }

  if (input.schemaVersion !== "1.0.0") {
    throw new Error("Invalid release manifest: unsupported schemaVersion.");
  }

  const release = assertReleaseMetadata(input.release);
  if (!Array.isArray(input.artifacts) || input.artifacts.length === 0) {
    throw new Error("Invalid release manifest: artifacts must be a non-empty array.");
  }

  const artifacts = input.artifacts.map(assertReleaseArtifact);
  return {
    schemaVersion: "1.0.0",
    release,
    artifacts
  };
}

function assertReleaseMetadata(input: unknown): ReleaseManifest["release"] {
  if (!isObjectRecord(input)) {
    throw new Error("Invalid release manifest: release must be object.");
  }

  if (input.channel !== "stable") {
    throw new Error("Invalid release manifest: release.channel must be 'stable'.");
  }

  if (!isValidSemver(input.appVersion)) {
    throw new Error("Invalid release manifest: release.appVersion must be semver.");
  }

  if (!isNonEmptyString(input.createdAt)) {
    throw new Error("Invalid release manifest: release.createdAt is required.");
  }

  return {
    channel: "stable",
    appVersion: input.appVersion,
    createdAt: input.createdAt
  };
}

function assertReleaseArtifact(input: unknown): ReleaseManifestArtifact {
  if (!isObjectRecord(input)) {
    throw new Error("Invalid release manifest: artifact must be object.");
  }

  if (!isArtifactKind(input.kind)) {
    throw new Error("Invalid release manifest: artifact kind is invalid.");
  }

  if (!isNonEmptyString(input.url)) {
    throw new Error("Invalid release manifest: artifact url is required.");
  }

  if (!isValidSha256(input.sha256)) {
    throw new Error("Invalid release manifest: artifact sha256 must be 64-char hex.");
  }

  if (!isPositiveInteger(input.bytes)) {
    throw new Error("Invalid release manifest: artifact bytes must be a positive integer.");
  }

  if (input.resortId !== undefined && !isNonEmptyString(input.resortId)) {
    throw new Error("Invalid release manifest: artifact resortId must be string when present.");
  }

  if (input.version !== undefined && !isNonEmptyString(input.version)) {
    throw new Error("Invalid release manifest: artifact version must be string when present.");
  }

  return {
    kind: input.kind,
    resortId: input.resortId,
    version: input.version,
    url: input.url,
    sha256: input.sha256,
    bytes: input.bytes
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidSemver(value: unknown): value is string {
  return typeof value === "string" && /^(\d+)\.(\d+)\.(\d+)$/u.test(value.trim());
}

function isValidSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/iu.test(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isArtifactKind(value: unknown): value is ReleaseManifestArtifact["kind"] {
  return value === "app" || value === "catalog" || value === "pack" || value === "pmtiles" || value === "style";
}
