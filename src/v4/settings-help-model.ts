export type V4PackUpdateCandidate = {
  resortId: string;
  resortName: string;
  version: string;
  createdAt?: string;
  bundleSizeBytes?: number;
  selected: boolean;
};

export type V4OfflineResortRow = {
  resortId: string;
  label: string;
  badge: string;
  badgeTone: "neutral" | "success" | "warning";
  action: "none" | "install-update";
  subtitle?: string;
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
  installedSizeBytesByResortId?: Record<string, number | undefined>;
}): V4OfflineResortRow[] {
  const candidateById = new Map(params.updateCandidates.map((candidate) => [candidate.resortId, candidate]));
  return [...params.installedPacks]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((pack) => {
      const candidate = candidateById.get(pack.id);
      const updateAvailable = Boolean(candidate);
      const installedBytes = params.installedSizeBytesByResortId?.[pack.id];
      const updateBytes = candidate?.bundleSizeBytes;
      return {
        resortId: pack.id,
        label: `${pack.name} · ${pack.sourceVersion ?? "version unknown"}`,
        badge: updateAvailable ? "Update available" : "Offline ready",
        badgeTone: updateAvailable ? "warning" : "success",
        action: updateAvailable ? "install-update" : "none",
        subtitle: updateAvailable
          ? formatBundleSizeLabel("Download", updateBytes)
          : formatBundleSizeLabel("Installed", installedBytes)
      };
    });
}

function formatBundleSizeLabel(prefix: string, bytes?: number): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) {
    return `${prefix}: size unavailable`;
  }

  const kib = bytes / 1024;
  if (kib < 1024) {
    return `${prefix}: ${kib.toFixed(1)} KiB`;
  }

  const mib = kib / 1024;
  return `${prefix}: ${mib.toFixed(1)} MiB`;
}
