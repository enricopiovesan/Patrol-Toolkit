import { setResortBoundary, type ResortBoundarySetResult } from "./resort-boundary-set.js";
import { syncResortLifts, type ResortSyncLiftsResult } from "./resort-sync-lifts.js";
import { syncResortRuns, type ResortSyncRunsResult } from "./resort-sync-runs.js";
import { readResortWorkspace, type ResortWorkspaceLayerState } from "./resort-workspace.js";

export type ResortUpdateLayer = "boundary" | "lifts" | "runs";

export type ResortUpdateLayerSnapshot = {
  status: ResortWorkspaceLayerState["status"];
  artifactPath: string | null;
  featureCount: number | null;
  checksumSha256: string | null;
  updatedAt: string | null;
  error: string | null;
};

export type ResortUpdateResult = {
  workspacePath: string;
  layer: ResortUpdateLayer;
  dryRun: boolean;
  before: ResortUpdateLayerSnapshot;
  after: ResortUpdateLayerSnapshot;
  changed: boolean;
  changedFields: Array<keyof ResortUpdateLayerSnapshot>;
  operation:
    | {
        kind: "dry-run";
      }
    | {
        kind: "boundary";
        result: ResortBoundarySetResult;
      }
    | {
        kind: "lifts";
        result: ResortSyncLiftsResult;
      }
    | {
        kind: "runs";
        result: ResortSyncRunsResult;
      };
};

export async function updateResortLayer(
  args: {
    workspacePath: string;
    layer: ResortUpdateLayer;
    index?: number;
    outputPath?: string;
    searchLimit?: number;
    bufferMeters?: number;
    timeoutSeconds?: number;
    updatedAt?: string;
    dryRun?: boolean;
  },
  deps?: {
    readWorkspaceFn?: typeof readResortWorkspace;
    setBoundaryFn?: typeof setResortBoundary;
    syncLiftsFn?: typeof syncResortLifts;
    syncRunsFn?: typeof syncResortRuns;
  }
): Promise<ResortUpdateResult> {
  const readWorkspaceFn = deps?.readWorkspaceFn ?? readResortWorkspace;
  const setBoundaryFn = deps?.setBoundaryFn ?? setResortBoundary;
  const syncLiftsFn = deps?.syncLiftsFn ?? syncResortLifts;
  const syncRunsFn = deps?.syncRunsFn ?? syncResortRuns;

  const beforeWorkspace = await readWorkspaceFn(args.workspacePath);
  const before = toSnapshot(beforeWorkspace.layers[args.layer]);
  const dryRun = args.dryRun ?? false;

  if (dryRun) {
    return {
      workspacePath: args.workspacePath,
      layer: args.layer,
      dryRun: true,
      before,
      after: before,
      changed: false,
      changedFields: [],
      operation: {
        kind: "dry-run"
      }
    };
  }

  let operation: ResortUpdateResult["operation"];
  if (args.layer === "boundary") {
    if (!Number.isInteger(args.index) || args.index === undefined || args.index < 1) {
      throw new Error("Boundary layer update requires --index with an integer >= 1.");
    }
    const result = await setBoundaryFn({
      workspacePath: args.workspacePath,
      index: args.index,
      outputFile: args.outputPath,
      selectedAt: args.updatedAt,
      searchLimit: args.searchLimit
    });
    operation = { kind: "boundary", result };
  } else if (args.layer === "lifts") {
    const result = await syncLiftsFn({
      workspacePath: args.workspacePath,
      outputPath: args.outputPath,
      bufferMeters: args.bufferMeters,
      timeoutSeconds: args.timeoutSeconds,
      updatedAt: args.updatedAt
    });
    operation = { kind: "lifts", result };
  } else {
    const result = await syncRunsFn({
      workspacePath: args.workspacePath,
      outputPath: args.outputPath,
      bufferMeters: args.bufferMeters,
      timeoutSeconds: args.timeoutSeconds,
      updatedAt: args.updatedAt
    });
    operation = { kind: "runs", result };
  }

  const afterWorkspace = await readWorkspaceFn(args.workspacePath);
  const after = toSnapshot(afterWorkspace.layers[args.layer]);
  const changedFields = diffSnapshotFields(before, after);

  return {
    workspacePath: args.workspacePath,
    layer: args.layer,
    dryRun: false,
    before,
    after,
    changed: changedFields.length > 0,
    changedFields,
    operation
  };
}

function toSnapshot(layer: ResortWorkspaceLayerState): ResortUpdateLayerSnapshot {
  return {
    status: layer.status,
    artifactPath: layer.artifactPath ?? null,
    featureCount: layer.featureCount ?? null,
    checksumSha256: layer.checksumSha256 ?? null,
    updatedAt: layer.updatedAt ?? null,
    error: layer.error ?? null
  };
}

function diffSnapshotFields(
  before: ResortUpdateLayerSnapshot,
  after: ResortUpdateLayerSnapshot
): Array<keyof ResortUpdateLayerSnapshot> {
  const fields: Array<keyof ResortUpdateLayerSnapshot> = [
    "status",
    "artifactPath",
    "featureCount",
    "checksumSha256",
    "updatedAt",
    "error"
  ];

  return fields.filter((field) => before[field] !== after[field]);
}
