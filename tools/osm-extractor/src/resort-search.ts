export type ResortSearchCandidate = {
  osmType: "relation" | "way" | "node";
  osmId: number;
  displayName: string;
  countryCode: string | null;
  country: string | null;
  region: string | null;
  center: [number, number];
  importance: number | null;
  source: "nominatim";
};

export type ResortSearchResult = {
  query: {
    name: string;
    country: string;
    limit: number;
  };
  candidates: ResortSearchCandidate[];
};

type NominatimRecord = {
  osm_type?: string;
  osm_id?: number;
  display_name?: string;
  lat?: string;
  lon?: string;
  importance?: number;
  address?: {
    country_code?: string;
    country?: string;
    state?: string;
    region?: string;
  };
};

export function buildResortSearchUrl(args: { name: string; country: string; limit: number }): string {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${args.name}, ${args.country}`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(args.limit));

  // Prefer server-side country filter when input is an ISO alpha-2 code.
  const maybeCountryCode = args.country.trim();
  if (/^[a-z]{2}$/i.test(maybeCountryCode)) {
    url.searchParams.set("countrycodes", maybeCountryCode.toLowerCase());
  }

  return url.toString();
}

export async function searchResortCandidates(
  args: { name: string; country: string; limit: number },
  deps?: {
    fetchFn?: typeof fetch;
    userAgent?: string;
  }
): Promise<ResortSearchResult> {
  const fetchFn = deps?.fetchFn ?? fetch;
  const userAgent = deps?.userAgent ?? "patrol-toolkit-osm-extractor/0.1";

  const response = await fetchFn(buildResortSearchUrl(args), {
    headers: {
      accept: "application/json",
      "user-agent": userAgent
    }
  });

  if (!response.ok) {
    throw new Error(`Resort search failed: upstream returned HTTP ${response.status}.`);
  }

  const raw = (await response.json()) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error("Resort search failed: upstream response is not a JSON array.");
  }

  const candidates = raw
    .map((entry) => toCandidate(entry as NominatimRecord))
    .filter((entry): entry is ResortSearchCandidate => entry !== null)
    .sort((left, right) => {
      const leftImportance = left.importance ?? -1;
      const rightImportance = right.importance ?? -1;
      if (leftImportance !== rightImportance) {
        return rightImportance - leftImportance;
      }
      return left.displayName.localeCompare(right.displayName);
    });

  return {
    query: {
      name: args.name,
      country: args.country,
      limit: args.limit
    },
    candidates
  };
}

function toCandidate(record: NominatimRecord): ResortSearchCandidate | null {
  const osmType = record.osm_type;
  if (osmType !== "relation" && osmType !== "way" && osmType !== "node") {
    return null;
  }

  const osmId = record.osm_id;
  const displayName = record.display_name?.trim();
  const lat = Number(record.lat);
  const lon = Number(record.lon);
  if (!Number.isInteger(osmId) || !displayName || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  const resolvedOsmId = Number(osmId);

  return {
    osmType,
    osmId: resolvedOsmId,
    displayName,
    countryCode: record.address?.country_code ?? null,
    country: record.address?.country ?? null,
    region: record.address?.state ?? record.address?.region ?? null,
    center: [lon, lat],
    importance: Number.isFinite(record.importance) ? (record.importance as number) : null,
    source: "nominatim"
  };
}
