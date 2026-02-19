import { readResortWorkspace, type ResortWorkspaceLayerState } from "./resort-workspace.js";

export type ResortLayerStatusSummary = {
  status: "pending" | "running" | "complete" | "failed";
  artifactPath: string | null;
  featureCount: number | null;
  checksumSha256: string | null;
  updatedAt: string | null;
  error: string | null;
  ready: boolean;
  issues: string[];
};

export type ResortSyncStatusResult = {
  workspacePath: string;
  overall: "ready" | "incomplete";
  issues: string[];
  layers: {
    boundary: ResortLayerStatusSummary;
    lifts: ResortLayerStatusSummary;
    runs: ResortLayerStatusSummary;
  };
};

export async function readResortSyncStatus(workspacePath: string): Promise<ResortSyncStatusResult> {
  const workspace = await readResortWorkspace(workspacePath);
  const boundary = summarizeLayer("boundary", workspace.layers.boundary, true);
  const lifts = summarizeLayer("lifts", workspace.layers.lifts, true);
  const runs = summarizeLayer("runs", workspace.layers.runs, true);

  const issues = [
    ...boundary.issues.map((issue) => `boundary: ${issue}`),
    ...lifts.issues.map((issue) => `lifts: ${issue}`),
    ...runs.issues.map((issue) => `runs: ${issue}`)
  ];

  return {
    workspacePath,
    overall: issues.length === 0 ? "ready" : "incomplete",
    issues,
    layers: {
      boundary,
      lifts,
      runs
    }
  };
}

function summarizeLayer(
  layerName: "boundary" | "lifts" | "runs",
  layer: ResortWorkspaceLayerState,
  requireFeatures: boolean
): ResortLayerStatusSummary {
  const issues: string[] = [];
  if (layer.status !== "complete") {
    issues.push(`status is '${layer.status}', expected 'complete'`);
  }
  if (!layer.artifactPath) {
    issues.push("artifactPath is missing");
  }
  if (!layer.checksumSha256) {
    issues.push("checksumSha256 is missing");
  }
  if (layer.featureCount === undefined || layer.featureCount === null) {
    issues.push("featureCount is missing");
  } else if (requireFeatures && layer.featureCount < 1) {
    issues.push("featureCount must be >= 1");
  }
  if (!layer.updatedAt) {
    issues.push("updatedAt is missing");
  }
  if (layer.error) {
    issues.push(`error is set: ${layer.error}`);
  }

  if (layerName === "boundary" && layer.featureCount !== undefined && layer.featureCount !== null && layer.featureCount !== 1) {
    issues.push("boundary featureCount must be exactly 1");
  }

  return {
    status: layer.status,
    artifactPath: layer.artifactPath ?? null,
    featureCount: layer.featureCount ?? null,
    checksumSha256: layer.checksumSha256 ?? null,
    updatedAt: layer.updatedAt ?? null,
    error: layer.error ?? null,
    ready: issues.length === 0,
    issues
  };
}
