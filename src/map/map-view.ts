import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { LocationTracker, type GeoPosition } from "../location/location-tracker";
import "maplibre-gl/dist/maplibre-gl.css";

const LOCATION_SOURCE_ID = "current-location";
const LOCATION_ACCURACY_LAYER = "current-location-accuracy";
const LOCATION_DOT_LAYER = "current-location-dot";
const DEFAULT_CENTER: [number, number] = [7.2, 45.1];

export type PositionUpdateDetail = {
  coordinates: [number, number];
  accuracy: number;
};

const BASE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: "Patrol Toolkit Base",
  sources: {
    "osm-raster": {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors"
    }
  },
  layers: [
    {
      id: "osm-raster-layer",
      type: "raster",
      source: "osm-raster"
    }
  ]
};

@customElement("map-view")
export class MapView extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: 0;
    }

    .map-shell {
      height: 100%;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 0.75rem;
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

  @state()
  private accessor status = "Waiting for GPS lock...";

  @state()
  private accessor isTracking = false;

  @state()
  private accessor followGps = true;

  protected firstUpdated(): void {
    const container = this.renderRoot.querySelector<HTMLElement>("#map");
    if (!container) {
      this.status = "Map container unavailable.";
      return;
    }

    this.map = new maplibregl.Map({
      container,
      style: BASE_STYLE,
      center: DEFAULT_CENTER,
      zoom: 14,
      attributionControl: {
        compact: true
      }
    });

    this.map.addControl(new maplibregl.NavigationControl(), "bottom-right");

    this.map.on("load", () => {
      this.initializeLocationLayers();
      this.startTracking();
    });

    this.map.on("error", () => {
      this.status = "Map rendering error.";
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
      onError: (message) => {
        this.status = message;
      }
    });
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
    return html`
      <section class="map-shell">
        <header class="status-bar">
          <strong>Live position</strong>
          <span class="status">${this.status}</span>
        </header>
        <div id="map" class="map" role="application" aria-label="Patrol map"></div>
        <div class="controls">
          <button @click=${this.recenterOnLocation}>Recenter</button>
          <button class="secondary" @click=${this.toggleTracking}>
            ${this.isTracking ? "Pause GPS" : "Resume GPS"}
          </button>
        </div>
      </section>
    `;
  }
}
