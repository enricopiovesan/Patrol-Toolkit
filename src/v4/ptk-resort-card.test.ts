import { afterEach, describe, expect, it } from "vitest";
import "./ptk-resort-card";
import type { PtkResortCard } from "./ptk-resort-card";

describe("ptk-resort-card", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders image thumbnail url and falls back on error", async () => {
    const element = document.createElement("ptk-resort-card") as PtkResortCard;
    element.card = {
      resortId: "CA_Golden_Kicking_Horse",
      resortName: "Kicking Horse",
      locationLabel: "Golden, CA",
      thumbnailImageUrl: "/assets/kicking_horse.png",
      thumbnailFallbackUrl: "/assets/resort_placeholder.png",
      versionLabel: "v4",
      lastUpdatedLabel: "2026-03-01",
      statusBadges: ["Offline ready", "Pack v4"],
      status: "installed",
      thumbnailStatusLabel: "Offline ready"
    };
    document.body.appendChild(element);
    await element.updateComplete;

    const img = element.shadowRoot?.querySelector("img") as HTMLImageElement | null;
    if (!img) {
      throw new Error("Thumbnail image not found.");
    }
    expect(img.getAttribute("src")).toBe("/assets/kicking_horse.png");

    img.dispatchEvent(new Event("error"));
    expect(img.getAttribute("src")).toBe("/assets/resort_placeholder.png");
  });
});

