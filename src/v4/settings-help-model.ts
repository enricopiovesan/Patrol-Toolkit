export type V4PackUpdateCandidate = {
  resortId: string;
  resortName: string;
  version: string;
  createdAt?: string;
  selected: boolean;
};

export type V4OfflineResortRow = {
  resortId: string;
  label: string;
  badge: string;
  badgeTone: "neutral" | "success" | "warning";
};

export function togglePackCandidateSelection(
  candidates: V4PackUpdateCandidate[],
  resortId: string,
  selected: boolean
): V4PackUpdateCandidate[] {
  return candidates.map((candidate) =>
    candidate.resortId === resortId ? { ...candidate, selected } : candidate
  );
}

export function clearPackCandidateSelections(candidates: V4PackUpdateCandidate[]): V4PackUpdateCandidate[] {
  return candidates.map((candidate) => ({ ...candidate, selected: false }));
}

export function buildOfflineResortRows(params: {
  installedPacks: Array<{ id: string; name: string; sourceVersion?: string; updatedAt: string }>;
  updateCandidates: V4PackUpdateCandidate[];
}): V4OfflineResortRow[] {
  const updateIds = new Set(params.updateCandidates.map((candidate) => candidate.resortId));
  return [...params.installedPacks]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((pack) => ({
      resortId: pack.id,
      label: `${pack.name} · ${pack.sourceVersion ?? "version unknown"}`,
      badge: updateIds.has(pack.id) ? "Update available" : "Offline ready",
      badgeTone: updateIds.has(pack.id) ? "warning" : "success"
    }));
}
