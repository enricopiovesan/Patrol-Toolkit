import { describe, expect, it } from "vitest";
import type { SelectableResortPack } from "../resort-pack/catalog";
import type { ResortPackListItem } from "../resort-pack/repository";
import {
  buildSelectResortPageViewModel,
  buildResortThumbnailUrl,
  formatResortLocation,
  formatUpdatedLabel
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
});
