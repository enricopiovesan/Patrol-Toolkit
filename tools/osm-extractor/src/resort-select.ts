import type { ResortSearchCandidate, ResortSearchResult } from "./resort-search.js";
import { searchResortCandidates } from "./resort-search.js";
import type { ResortWorkspace } from "./resort-workspace.js";
import { writeResortWorkspace } from "./resort-workspace.js";

export type ResortSelectionResult = {
  workspacePath: string;
  workspace: ResortWorkspace;
  selected: ResortSearchCandidate;
  candidateCount: number;
  selectedIndex: number;
};

export function selectCandidateByIndex(candidates: ResortSearchCandidate[], index: number): ResortSearchCandidate {
  if (!Number.isInteger(index) || index < 1) {
    throw new Error("Selection index must be an integer >= 1.");
  }
  const selected = candidates[index - 1];
  if (!selected) {
    throw new Error(`Selection index ${index} is out of range for ${candidates.length} candidate(s).`);
  }
  return selected;
}

export async function selectResortToWorkspace(
  args: {
    workspacePath: string;
    name: string;
    country: string;
    index: number;
    limit: number;
    selectedAt?: string;
  },
  deps?: {
    searchFn?: (query: { name: string; country: string; limit: number }) => Promise<ResortSearchResult>;
    nowIso?: () => string;
  }
): Promise<ResortSelectionResult> {
  const searchFn = deps?.searchFn ?? searchResortCandidates;
  const searchResult = await searchFn({
    name: args.name,
    country: args.country,
    limit: args.limit
  });

  const selected = selectCandidateByIndex(searchResult.candidates, args.index);
  const selectedAt = args.selectedAt ?? deps?.nowIso?.() ?? new Date().toISOString();
  const workspace: ResortWorkspace = {
    schemaVersion: "2.0.0",
    resort: {
      query: {
        name: args.name,
        country: args.country
      },
      selection: {
        osmType: selected.osmType,
        osmId: selected.osmId,
        displayName: selected.displayName,
        center: selected.center,
        selectedAt
      }
    },
    layers: {
      boundary: { status: "pending" },
      lifts: { status: "pending" },
      runs: { status: "pending" }
    }
  };

  await writeResortWorkspace(args.workspacePath, workspace);
  return {
    workspacePath: args.workspacePath,
    workspace,
    selected,
    candidateCount: searchResult.candidates.length,
    selectedIndex: args.index
  };
}
