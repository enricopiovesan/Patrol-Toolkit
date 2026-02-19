import { dirname, join } from "node:path";
import { detectResortBoundaryCandidates } from "./resort-boundary-detect.js";
import { sha256File, writeJsonFile } from "./provenance.js";
import { readResortWorkspace, writeResortWorkspace, type ResortWorkspace } from "./resort-workspace.js";

type BoundaryGeoJsonFeature = {
  type: "Feature";
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  properties: {
    osmType: "relation" | "way" | "node";
    osmId: number;
    displayName: string;
    selectedAt: string;
    score: number;
    source: "selection" | "search";
    areaKm2: number | null;
    containsSelectionCenter: boolean;
    ringClosed: boolean;
    issues: string[];
  };
};

export type ResortBoundarySetResult = {
  workspacePath: string;
  boundaryPath: string;
  selectedIndex: number;
  candidateCount: number;
  selectedOsm: {
    osmType: "relation" | "way" | "node";
    osmId: number;
    displayName: string;
  };
  checksumSha256: string;
};

export async function setResortBoundary(args: {
  workspacePath: string;
  index: number;
  outputFile?: string;
  selectedAt?: string;
  searchLimit?: number;
}, deps?: {
  detectFn?: typeof detectResortBoundaryCandidates;
}): Promise<ResortBoundarySetResult> {
  if (!Number.isInteger(args.index) || args.index < 1) {
    throw new Error("Boundary selection index must be an integer >= 1.");
  }

  const detectFn = deps?.detectFn ?? detectResortBoundaryCandidates;
  const detection = await detectFn({
    workspacePath: args.workspacePath,
    searchLimit: args.searchLimit ?? 5
  });

  const selected = detection.candidates[args.index - 1];
  if (!selected) {
    throw new Error(`Boundary selection index ${args.index} is out of range for ${detection.candidates.length} candidate(s).`);
  }
  if (!selected.ring) {
    throw new Error("Selected boundary candidate has no polygon geometry.");
  }

  const boundaryPath = resolveBoundaryPath(args.workspacePath, args.outputFile);
  const selectedAt = args.selectedAt ?? new Date().toISOString();
  const feature: BoundaryGeoJsonFeature = {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [selected.ring]
    },
    properties: {
      osmType: selected.osmType,
      osmId: selected.osmId,
      displayName: selected.displayName,
      selectedAt,
      score: selected.validation.score,
      source: selected.source,
      areaKm2: selected.validation.areaKm2,
      containsSelectionCenter: selected.validation.containsSelectionCenter,
      ringClosed: selected.validation.ringClosed,
      issues: selected.validation.issues
    }
  };

  await writeJsonFile(boundaryPath, feature);
  const checksumSha256 = await sha256File(boundaryPath);

  const workspace = await readResortWorkspace(args.workspacePath);
  const updatedWorkspace = updateWorkspaceBoundary(workspace, {
    boundaryPath,
    checksumSha256,
    selectedAt
  });
  await writeResortWorkspace(args.workspacePath, updatedWorkspace);

  return {
    workspacePath: args.workspacePath,
    boundaryPath,
    selectedIndex: args.index,
    candidateCount: detection.candidates.length,
    selectedOsm: {
      osmType: selected.osmType,
      osmId: selected.osmId,
      displayName: selected.displayName
    },
    checksumSha256
  };
}

function resolveBoundaryPath(workspacePath: string, outputFile?: string): string {
  if (outputFile) {
    return outputFile;
  }
  return join(dirname(workspacePath), "boundary.geojson");
}

function updateWorkspaceBoundary(
  workspace: ResortWorkspace,
  args: { boundaryPath: string; checksumSha256: string; selectedAt: string }
): ResortWorkspace {
  return {
    ...workspace,
    layers: {
      ...workspace.layers,
      boundary: {
        ...workspace.layers.boundary,
        status: "complete",
        artifactPath: args.boundaryPath,
        checksumSha256: args.checksumSha256,
        featureCount: 1,
        updatedAt: args.selectedAt,
        error: undefined
      }
    }
  };
}
