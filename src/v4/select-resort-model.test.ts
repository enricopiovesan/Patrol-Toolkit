import { describe, expect, it } from "vitest";
import type { SelectableResortPack } from "../resort-pack/catalog";
import type { ResortPackListItem } from "../resort-pack/repository";
import {
  buildSelectResortPageViewModel,
  buildResortThumbnailUrl,
  deriveResortCenterFromBoundary,
  formatResortLocation,
  formatUpdatedLabel,
  sortSelectResortCardsByDistance
} from "./select-resort-model";

describe("select resort model", () => {
  it("builds cards with installed and update badges", () => {
    const catalog: SelectableResortPack[] = [
      {
        resortId: "CA_Golden_Kicking_Horse",
        resortName: "Kicking Horse",
        version: "v4",
        packUrl: "/packs/kh.json",
        createdAt: "2026-03-01T10:00:00Z"
      },
      {
        resortId: "CA_Fernie_Fernie",
        resortName: "Fernie",
        version: "v7",
        packUrl: "/packs/fernie.json",
        createdAt: "2026-03-01T10:00:00Z"
      }
    ];
    const installed: ResortPackListItem[] = [
      {
        id: "CA_Golden_Kicking_Horse",
        name: "Kicking Horse",
        updatedAt: "2026-03-01T11:00:00Z",
        sourceVersion: "v3"
      },
      {
        id: "CA_Fernie_Fernie",
        name: "Fernie",
        updatedAt: "2026-03-01T11:00:00Z",
        sourceVersion: "v7"
      }
    ];

    const model = buildSelectResortPageViewModel(catalog, installed, "");
    expect(model.cards).toHaveLength(2);

    const fernie = model.cards.find((card) => card.resortId === "CA_Fernie_Fernie");
    const kh = model.cards.find((card) => card.resortId === "CA_Golden_Kicking_Horse");
    expect(fernie?.status).toBe("installed");
    expect(fernie?.statusBadges).toEqual(["Offline ready", "Pack v7"]);
    expect(kh?.status).toBe("update-available");
    expect(kh?.statusBadges).toEqual(["Update available", "Offline ready", "Pack v4"]);
  });

  it("filters by resort name and location", () => {
    const catalog: SelectableResortPack[] = [
      {
        resortId: "CA_Golden_Kicking_Horse",
        resortName: "Kicking Horse",
        version: "v4",
        packUrl: "/packs/kh.json"
      },
      {
        resortId: "CA_Fernie_Fernie",
        resortName: "Fernie",
        version: "v7",
        packUrl: "/packs/fernie.json"
      }
    ];

    expect(buildSelectResortPageViewModel(catalog, [], "golden").cards).toHaveLength(1);
    expect(buildSelectResortPageViewModel(catalog, [], "fernie").cards).toHaveLength(1);
    expect(buildSelectResortPageViewModel(catalog, [], "ca").cards).toHaveLength(2);
  });

  it("formats location from resort id", () => {
    expect(formatResortLocation("CA_Golden_Kicking_Horse", "Kicking Horse")).toBe("Golden, CA");
    expect(formatResortLocation("US_big-sky", "Big Sky")).toBe("Big Sky, US");
  });

  it("formats updated labels as date-only ISO", () => {
    expect(formatUpdatedLabel("2026-03-01T11:00:00Z")).toBe("2026-03-01");
    expect(formatUpdatedLabel("bad-date")).toBeNull();
    expect(formatUpdatedLabel(undefined)).toBeNull();
  });

  it("builds resort thumbnail URL from resort name", () => {
    expect(buildResortThumbnailUrl("Kicking Horse")).toBe("/assets/kicking_horse.png");
    expect(buildResortThumbnailUrl("Mont Sainte-Anne")).toBe("/assets/mont_sainte_anne.png");
  });

  it("sorts resorts nearest-first when gps position and centers are available", () => {
    const catalog: SelectableResortPack[] = [
      { resortId: "CA_Kimberley_Kimberley_Resort", resortName: "Kimberley", version: "v1", packUrl: "/a" },
      { resortId: "CA_Golden_Kicking_Horse", resortName: "Kicking Horse", version: "v1", packUrl: "/b" },
      { resortId: "CA_Fernie_Fernie", resortName: "Fernie", version: "v1", packUrl: "/c" }
    ];

    const model = buildSelectResortPageViewModel(catalog, [], "", {
      userPosition: [-116.95, 51.30],
      resortCentersById: {
        CA_Kimberley_Kimberley_Resort: [-115.98, 49.68],
        CA_Golden_Kicking_Horse: [-117.03, 51.30],
        CA_Fernie_Fernie: [-115.06, 49.50]
      }
    });

    expect(model.cards.map((card) => card.resortName)).toEqual(["Kicking Horse", "Kimberley", "Fernie"]);
  });

  it("orders Kimberley before Red Mountain for a Kicking Horse-area position", () => {
    const cards = [
      makeCard("CA_Rossland_Red_Mountain_Resort", "Red Mountain"),
      makeCard("CA_Kimberley_Kimberley_Resort", "Kimberley")
    ];

    const sorted = sortSelectResortCardsByDistance(cards, {
      userPosition: [-117.068, 51.285],
      resortCentersById: {
        CA_Kimberley_Kimberley_Resort: [-116.0293452, 49.6881314],
        CA_Rossland_Red_Mountain_Resort: [-117.84154405, 49.10567585]
      }
    });

    expect(sorted.map((card) => card.resortId)).toEqual([
      "CA_Kimberley_Kimberley_Resort",
      "CA_Rossland_Red_Mountain_Resort"
    ]);
  });

  it("keeps unsortable resorts after sortable resorts preserving relative order", () => {
    const cards = [
      makeCard("A", "Alpha"),
      makeCard("B", "Beta"),
      makeCard("C", "Gamma"),
      makeCard("D", "Delta")
    ];

    const sorted = sortSelectResortCardsByDistance(cards, {
      userPosition: [0, 0],
      resortCentersById: {
        B: [0.01, 0],
        D: [0.02, 0]
      }
    });

    expect(sorted.map((card) => card.resortId)).toEqual(["B", "D", "A", "C"]);
  });

  it("falls back to original order when gps position is unavailable", () => {
    const cards = [makeCard("A", "Alpha"), makeCard("B", "Beta")];
    const sorted = sortSelectResortCardsByDistance(cards, {
      userPosition: null,
      resortCentersById: { A: [0, 0], B: [1, 1] }
    });
    expect(sorted).toBe(cards);
  });

  it("derives resort center from boundary bbox", () => {
    const center = deriveResortCenterFromBoundary({
      type: "Polygon",
      coordinates: [
        [
          [-117.1, 51.2],
          [-117.0, 51.2],
          [-117.0, 51.4],
          [-117.1, 51.4],
          [-117.1, 51.2]
        ]
      ]
    });
    expect(center).toEqual([-117.05, 51.3]);
  });
});

function makeCard(resortId: string, resortName: string) {
  return {
    resortId,
    resortName,
    locationLabel: `${resortName}, CA`,
    thumbnailImageUrl: "/assets/x.png",
    thumbnailFallbackUrl: "/assets/resort_placeholder.png",
    versionLabel: "v1",
    lastUpdatedLabel: null,
    statusBadges: ["Not installed"],
    status: "catalog-only" as const,
    thumbnailStatusLabel: "Not installed"
  };
}
