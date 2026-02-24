import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  LocationTracker,
  type GeoPosition,
  type LocationTrackerErrorKind
} from "../location/location-tracker";
import type { ResortPack } from "../resort-pack/types";
import { buildAreaLayers } from "./area-layers";
import { buildResortOverlayData } from "./overlays";
import { buildLiftLayers } from "./lift-layers";
import { ensurePackPmtilesArchiveLoaded, ensurePmtilesProtocolRegistered } from "./pmtiles-protocol";
import { buildRunLayers } from "./run-layers";
import { OFFLINE_FALLBACK_STYLE, resolveStyleForPack } from "./style-loader";
import "maplibre-gl/dist/maplibre-gl.css";

const LOCATION_SOURCE_ID = "current-location";
const LOCATION_ACCURACY_LAYER = "current-location-accuracy";
const LOCATION_DOT_LAYER = "current-location-dot";
const RESORT_BOUNDARY_SOURCE_ID = "resort-boundary";
const RESORT_AREAS_SOURCE_ID = "resort-areas";
const RESORT_RUNS_SOURCE_ID = "resort-runs";
const RESORT_LIFTS_SOURCE_ID = "resort-lifts";
const RESORT_LIFT_TOWERS_SOURCE_ID = "resort-lift-towers";
const RESORT_BOUNDARY_FILL_LAYER = "resort-boundary-fill";
const RESORT_BOUNDARY_LINE_LAYER = "resort-boundary-line";
const DEFAULT_CENTER: [number, number] = [7.2, 45.1];

export type PositionUpdateDetail = {
  coordinates: [number, number];
  accuracy: number;
};

export type GpsErrorDetail = {
  kind: LocationTrackerErrorKind;
  message: string;
};

export type MapRenderErrorDetail = {
  message: string;
};

@customElement("map-view")
export class MapView extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: 0;
      height: 100%;
    }

    .map-shell {
      height: 100%;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 0.75rem;
    }

    .map-shell.compact {
      grid-template-rows: minmax(0, 1fr);
      gap: 0;
      min-height: 0;
    }

    .status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.95rem;
      color: #1e293b;
    }

    .status {
      font-weight: 600;
    }

    .map {
      height: clamp(360px, 58vh, 760px);
      border-radius: 12px;
      border: 1px solid #cbd5e1;
      overflow: hidden;
    }

    .map-shell.compact .map {
      height: 100%;
      min-height: 0;
      border: none;
      border-radius: 0;
    }

    .controls {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .controls button {
      min-height: 52px;
      border-radius: 12px;
      border: 1px solid #0f4c5c;
      font-size: 1rem;
      font-weight: 600;
      background: #0f4c5c;
      color: #f8fafc;
      cursor: pointer;
      touch-action: manipulation;
    }

    .controls button.secondary {
      background: #ffffff;
      color: #0f4c5c;
    }
  `;

  private map: maplibregl.Map | null = null;
  private locationTracker: LocationTracker | null = null;
  private lastPosition: GeoPosition | null = null;
  private currentStyleKey = "";
  private styleApplyToken = 0;
  private runtimeFallbackApplied = false;

  @property({ attribute: false })
  accessor pack: ResortPack | null = null;

  @property({ type: Boolean })
  accessor showStatusBar = true;

  @property({ type: Boolean })
  accessor showBuiltInControls = true;

  @state()
  private accessor status = "Waiting for GPS lock...";

  @state()
  private accessor isTracking = false;

  @state()
  private accessor followGps = true;

  protected firstUpdated(): void {
    ensurePmtilesProtocolRegistered();
    ensurePackPmtilesArchiveLoaded(this.pack);

    const container = this.renderRoot.querySelector<HTMLElement>("#map");
    if (!container) {
      this.status = "Map container unavailable.";
      return;
    }

    this.map = new maplibregl.Map({
      container,
      style: {
        version: 8,
        name: "Patrol Toolkit Offline Bootstrap",
        sources: {},
        layers: [{ id: "bootstrap-background", type: "background", paint: { "background-color": "#e2e8f0" } }]
      },
      center: DEFAULT_CENTER,
      zoom: 14,
      attributionControl: {
        compact: true
      }
    });

    this.map.addControl(new maplibregl.NavigationControl(), "bottom-right");

    this.map.on("load", () => {
      this.dispatchMapReady();
      this.initializeLocationLayers();
      this.initializeResortLayers();
      this.syncResortLayers();
      void this.applyStyleForActivePack();
      this.startTracking();
    });

    this.map.on("error", (event) => {
      const message = this.extractMapErrorMessage(event);
      if (this.shouldApplyRuntimeOfflineFallback(message)) {
        this.applyRuntimeOfflineFallback(message);
        return;
      }

      this.status = "Map rendering error.";
      this.dispatchMapRenderError({ message });
    });

    this.map.on("dragstart", () => {
      this.followGps = false;
    });

    this.locationTracker = new LocationTracker({
      onPosition: (position) => {
        this.status = `GPS lock ±${Math.round(position.accuracy)}m`;
        this.lastPosition = position;
        this.dispatchPositionUpdate(position);
        this.updateLocationSource(position);

        if (this.followGps && this.map) {
          this.map.easeTo({
            center: [position.longitude, position.latitude],
            duration: 500,
            zoom: Math.max(this.map.getZoom(), 15)
          });
        }
      },
      onError: (message, kind) => {
        this.dispatchGpsError({ kind, message });
        this.status = message;
      }
    });
  }

  protected override updated(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has("pack")) {
      ensurePackPmtilesArchiveLoaded(this.pack);
      void this.applyStyleForActivePack();
      this.syncResortLayers();
    }
  }

  disconnectedCallback(): void {
    this.locationTracker?.stop();
    this.map?.remove();
    this.locationTracker = null;
    this.map = null;
    super.disconnectedCallback();
  }

  private startTracking(): void {
    if (!this.locationTracker) {
      return;
    }

    this.isTracking = this.locationTracker.start();
  }

  private toggleTracking(): void {
    if (!this.locationTracker) {
      return;
    }

    if (this.isTracking) {
      this.locationTracker.stop();
      this.isTracking = false;
      this.status = "GPS tracking paused.";
      return;
    }

    this.startTracking();
  }

  private recenterOnLocation(): void {
    if (!this.map || !this.lastPosition) {
      return;
    }

    this.followGps = true;
    this.map.easeTo({
      center: [this.lastPosition.longitude, this.lastPosition.latitude],
      zoom: Math.max(this.map.getZoom(), 15),
      duration: 350
    });
  }

  public recenterToUserPosition(): void {
    this.recenterOnLocation();
  }

  public restartGpsTracking(): void {
    this.followGps = true;
    this.locationTracker?.stop();
    this.isTracking = false;
    this.startTracking();
  }

  private initializeLocationLayers(): void {
    if (!this.map || this.map.getSource(LOCATION_SOURCE_ID)) {
      return;
    }

    this.map.addSource(LOCATION_SOURCE_ID, {
      type: "geojson",
      data: this.buildLocationFeature({
        latitude: DEFAULT_CENTER[1],
        longitude: DEFAULT_CENTER[0],
        accuracy: 0
      })
    });

    this.map.addLayer({
      id: LOCATION_ACCURACY_LAYER,
      type: "circle",
      source: LOCATION_SOURCE_ID,
      paint: {
        "circle-color": "#2b6cb0",
        "circle-opacity": 0.12,
        "circle-stroke-color": "#2b6cb0",
        "circle-stroke-width": 1,
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          ["*", ["get", "accuracy"], 0.18],
          16,
          ["*", ["get", "accuracy"], 1.1]
        ]
      }
    });

    this.map.addLayer({
      id: LOCATION_DOT_LAYER,
      type: "circle",
      source: LOCATION_SOURCE_ID,
      paint: {
        "circle-color": "#0f4c5c",
        "circle-stroke-color": "#f8fafc",
        "circle-stroke-width": 2,
        "circle-radius": 8
      }
    });
  }

  private updateLocationSource(position: GeoPosition): void {
    if (!this.map) {
      return;
    }

    const source = this.map.getSource(LOCATION_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    source.setData(this.buildLocationFeature(position));
  }

  private initializeResortLayers(): void {
    if (!this.map || this.map.getSource(RESORT_BOUNDARY_SOURCE_ID)) {
      return;
    }

    const empty = buildResortOverlayData(null);
    this.map.addSource(RESORT_BOUNDARY_SOURCE_ID, { type: "geojson", data: empty.boundary });
    this.map.addSource(RESORT_AREAS_SOURCE_ID, { type: "geojson", data: empty.areas });
    this.map.addSource(RESORT_RUNS_SOURCE_ID, { type: "geojson", data: empty.runs });
    this.map.addSource(RESORT_LIFTS_SOURCE_ID, { type: "geojson", data: empty.lifts });
    this.map.addSource(RESORT_LIFT_TOWERS_SOURCE_ID, { type: "geojson", data: empty.liftTowers });

    this.map.addLayer({
      id: RESORT_BOUNDARY_FILL_LAYER,
      type: "fill",
      source: RESORT_BOUNDARY_SOURCE_ID,
      paint: {
        "fill-color": "#0ea5a5",
        "fill-opacity": 0.08
      }
    });

    this.map.addLayer({
      id: RESORT_BOUNDARY_LINE_LAYER,
      type: "line",
      source: RESORT_BOUNDARY_SOURCE_ID,
      paint: {
        "line-color": "#0f4c5c",
        "line-width": 2,
        "line-dasharray": [2, 2]
      }
    });

    const areaLayers = buildAreaLayers(RESORT_AREAS_SOURCE_ID);
    this.map.addLayer(areaLayers.fillLayer as never);
    this.map.addLayer(areaLayers.lineLayer as never);
    this.map.addLayer(areaLayers.labelLayer as never);

    const runLayers = buildRunLayers(RESORT_RUNS_SOURCE_ID);
    this.map.addLayer(runLayers.lineLayer as never);
    this.map.addLayer(runLayers.arrowLayer as never);
    this.map.addLayer(runLayers.labelLayer as never);

    const liftLayers = buildLiftLayers(RESORT_LIFTS_SOURCE_ID, RESORT_LIFT_TOWERS_SOURCE_ID);
    this.map.addLayer(liftLayers.casingLayer as never);
    this.map.addLayer(liftLayers.lineLayer as never);
    this.map.addLayer(liftLayers.labelLayer as never);
    this.map.addLayer(liftLayers.towerCircleLayer as never);
    this.map.addLayer(liftLayers.towerLabelLayer as never);
  }

  private syncResortLayers(): void {
    if (!this.map) {
      return;
    }

    const boundarySource = this.map.getSource(RESORT_BOUNDARY_SOURCE_ID) as GeoJSONSource | undefined;
    const areasSource = this.map.getSource(RESORT_AREAS_SOURCE_ID) as GeoJSONSource | undefined;
    const runsSource = this.map.getSource(RESORT_RUNS_SOURCE_ID) as GeoJSONSource | undefined;
    const liftsSource = this.map.getSource(RESORT_LIFTS_SOURCE_ID) as GeoJSONSource | undefined;
    const towersSource = this.map.getSource(RESORT_LIFT_TOWERS_SOURCE_ID) as GeoJSONSource | undefined;
    if (!boundarySource || !areasSource || !runsSource || !liftsSource || !towersSource) {
      return;
    }

    const overlays = buildResortOverlayData(this.pack);
    boundarySource.setData(overlays.boundary);
    areasSource.setData(overlays.areas);
    runsSource.setData(overlays.runs);
    liftsSource.setData(overlays.lifts);
    towersSource.setData(overlays.liftTowers);
  }

  private async applyStyleForActivePack(remainingAttempts = 60): Promise<void> {
    if (!this.map) {
      return;
    }

    if ((!this.map.loaded() || !this.map.isStyleLoaded()) && remainingAttempts > 0) {
      window.setTimeout(() => {
        void this.applyStyleForActivePack(remainingAttempts - 1);
      }, 50);
      return;
    }

    const token = ++this.styleApplyToken;
    const { key, style } = await resolveStyleForPack(this.pack);
    if (!this.map || token !== this.styleApplyToken || this.currentStyleKey === key) {
      return;
    }

    this.currentStyleKey = key;
    this.runtimeFallbackApplied = false;
    this.map.setStyle(style, { diff: false });
    this.rebindLayersWhenStyleReady(token);
  }

  private extractMapErrorMessage(event: unknown): string {
    const candidate = event as { error?: unknown } | undefined;
    const rawError = candidate?.error;
    if (rawError instanceof Error) {
      return rawError.message;
    }

    if (typeof rawError === "string") {
      return rawError;
    }

    return "";
  }

  private shouldApplyRuntimeOfflineFallback(message: string): boolean {
    if (!this.map || this.runtimeFallbackApplied) {
      return false;
    }

    if (!this.currentStyleKey.startsWith("pack:")) {
      return false;
    }

    const normalized = message.toLowerCase();
    if (!normalized) {
      return false;
    }

    // OSM raster tiles can be partially cached offline; do not replace the whole style
    // when individual remote tile requests fail.
    if (normalized.includes("tile.openstreetmap.org")) {
      return false;
    }

    return /asset unavailable offline|failed to fetch|gateway timeout|pmtiles|504/iu.test(normalized);
  }

  private applyRuntimeOfflineFallback(reason: string): void {
    if (!this.map || this.runtimeFallbackApplied) {
      return;
    }

    this.runtimeFallbackApplied = true;
    const token = ++this.styleApplyToken;
    this.currentStyleKey = "runtime-offline-fallback";
    this.map.setStyle(OFFLINE_FALLBACK_STYLE, { diff: false });
    this.rebindLayersWhenStyleReady(token);
    const normalizedReason = reason.trim().replace(/\s+/gu, " ");
    const suffix = normalizedReason.length > 0 ? ` Reason: ${normalizedReason.slice(0, 140)}.` : "";
    this.status = `Offline basemap unavailable. Showing local overlay view.${suffix}`;
  }

  private rebindLayersWhenStyleReady(token: number, remainingAttempts = 60): void {
    if (!this.map || token !== this.styleApplyToken) {
      return;
    }

    if (!this.map.isStyleLoaded()) {
      if (remainingAttempts <= 0) {
        this.status = "Map style failed to load.";
        return;
      }

      window.setTimeout(() => this.rebindLayersWhenStyleReady(token, remainingAttempts - 1), 50);
      return;
    }

    this.initializeLocationLayers();
    this.initializeResortLayers();
    this.syncResortLayers();
    if (this.lastPosition) {
      this.updateLocationSource(this.lastPosition);
    }
  }

  private dispatchPositionUpdate(position: GeoPosition): void {
    this.dispatchEvent(
      new CustomEvent<PositionUpdateDetail>("position-update", {
        detail: {
          coordinates: [position.longitude, position.latitude],
          accuracy: position.accuracy
        },
        bubbles: true,
        composed: true
      })
    );
  }

  private dispatchGpsError(detail: GpsErrorDetail): void {
    this.dispatchEvent(
      new CustomEvent<GpsErrorDetail>("gps-error", {
        detail,
        bubbles: true,
        composed: true
      })
    );
  }

  private dispatchMapReady(): void {
    this.dispatchEvent(new CustomEvent("map-ready", { bubbles: true, composed: true }));
  }

  private dispatchMapRenderError(detail: MapRenderErrorDetail): void {
    this.dispatchEvent(
      new CustomEvent<MapRenderErrorDetail>("map-render-error", {
        detail,
        bubbles: true,
        composed: true
      })
    );
  }

  private buildLocationFeature(position: GeoPosition): GeoJSON.Feature<GeoJSON.Point> {
    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [position.longitude, position.latitude]
      },
      properties: {
        accuracy: position.accuracy
      }
    };
  }

  render() {
    const compact = !this.showStatusBar && !this.showBuiltInControls;
    return html`
      <section class=${compact ? "map-shell compact" : "map-shell"}>
        ${this.showStatusBar
          ? html`
              <header class="status-bar">
                <strong>Live position</strong>
                <span class="status">${this.status}</span>
              </header>
            `
          : null}
        <div id="map" class="map" role="application" aria-label="Patrol map"></div>
        ${this.showBuiltInControls
          ? html`
              <div class="controls">
                <button @click=${this.recenterOnLocation}>Recenter</button>
                <button class="secondary" @click=${this.toggleTracking}>
                  ${this.isTracking ? "Pause GPS" : "Resume GPS"}
                </button>
              </div>
            `
          : null}
      </section>
    `;
  }
}
