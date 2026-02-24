import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { v4DesignTokens } from "./design-tokens";
import type { ResortPageHeaderViewModel } from "./resort-page-model";
import type { ResortPageTabId } from "./resort-page-state";
import type { ViewportMode } from "./viewport";
import type { ResortPack } from "../resort-pack/types";
import type { GpsErrorKind } from "./gps-ui-state";
import "./ptk-page-header";
import "./ptk-tool-panel";
import "../map/map-view";
import type { MapView } from "../map/map-view";

@customElement("ptk-resort-page")
export class PtkResortPage extends LitElement {
  static styles = css`
    ${v4DesignTokens}

    :host {
      display: block;
      min-height: 0;
      font-family: var(--ptk-font-family-base);
    }

    .workspace {
      min-height: 0;
      display: grid;
      gap: var(--ptk-space-3);
    }

    .workspace.fullscreen {
      position: fixed;
      inset: 0;
      z-index: 30;
      padding: var(--ptk-space-3);
      background: var(--ptk-surface-app);
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr);
    }

    .workspace.fullscreen .panel-shell {
      display: none;
    }

    .workspace.small {
      grid-template-rows: minmax(0, 1fr) auto;
    }

    .workspace.medium,
    .workspace.large {
      grid-template-columns: auto minmax(0, 1fr);
      align-items: stretch;
    }

    .workspace.large {
      grid-template-columns: var(--ptk-size-panel-resort-lg) minmax(0, 1fr);
    }

    .panel-shell {
      min-height: 0;
    }

    .panel-shell.small {
      align-self: end;
    }

    .panel-content {
      display: grid;
      gap: var(--ptk-space-3);
      color: var(--ptk-text-primary);
    }

    .panel-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ptk-space-2);
    }

    .panel-toolbar h3 {
      margin: 0;
      font-size: var(--ptk-font-heading-h4-size);
      font-weight: var(--ptk-font-weight-bold);
      font-family: var(--ptk-font-family-heading);
    }

    .ghost-button {
      min-height: var(--ptk-size-control-sm);
      border-radius: var(--ptk-radius-pill);
      border: 1px solid var(--ptk-control-border);
      background: var(--ptk-control-bg);
      color: var(--ptk-control-fg);
      font: inherit;
      font-size: var(--ptk-font-action-m-size);
      font-weight: var(--ptk-font-weight-semibold);
      padding: 0 10px;
      cursor: pointer;
    }

    .tabs {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--ptk-space-1);
      padding: var(--ptk-space-1);
      border-radius: var(--ptk-radius-pill);
      border: 1px solid var(--ptk-border-default);
      background: var(--ptk-surface-subtle);
    }

    .tabs button {
      min-height: var(--ptk-size-control-sm);
      border-radius: var(--ptk-radius-pill);
      border: 1px solid transparent;
      background: transparent;
      color: var(--ptk-control-fg);
      font: inherit;
      font-size: var(--ptk-font-action-m-size);
      font-weight: var(--ptk-font-weight-semibold);
      padding: 0 8px;
      cursor: pointer;
    }

    .tabs button[selected] {
      background: var(--ptk-control-selected-bg);
      color: var(--ptk-control-selected-fg);
      border-color: var(--ptk-control-selected-border);
    }

    .panel-card {
      border: 1px solid var(--ptk-border-default);
      border-radius: var(--ptk-radius-md);
      background: var(--ptk-surface-card);
      padding: var(--ptk-space-3);
      display: grid;
      gap: var(--ptk-space-2);
    }

    .panel-card h4 {
      margin: 0;
      font-size: var(--ptk-font-heading-h4-size);
      font-weight: var(--ptk-font-weight-bold);
      font-family: var(--ptk-font-family-heading);
    }

    .phrase-output {
      border: 1px dashed var(--ptk-border-default);
      border-radius: var(--ptk-radius-md);
      padding: var(--ptk-space-3);
      background: var(--ptk-surface-card);
      color: var(--ptk-text-primary);
      min-height: 56px;
      display: grid;
      align-items: center;
      font-size: var(--ptk-font-body-l-size);
      font-weight: var(--ptk-font-weight-semibold);
    }

    .panel-note {
      margin: 0;
      color: var(--ptk-text-secondary);
      font-size: var(--ptk-font-body-s-size);
    }

    .sweeps-note {
      margin: 0;
      color: var(--ptk-text-secondary);
      font-size: var(--ptk-font-body-m-size);
      line-height: 1.4;
    }

    .gps-disabled-card {
      border: 1px solid var(--ptk-color-warning-500);
      border-radius: var(--ptk-radius-md);
      background: var(--ptk-color-warning-100);
      padding: var(--ptk-space-3);
      display: grid;
      gap: var(--ptk-space-2);
    }

    .gps-disabled-card p {
      margin: 0;
      color: var(--ptk-text-primary);
      font-size: var(--ptk-font-body-s-size);
      line-height: 1.4;
    }

    .map-frame {
      border: 1px solid var(--ptk-border-default);
      border-radius: var(--ptk-radius-md);
      background: var(--ptk-surface-map);
      min-height: 360px;
      padding: var(--ptk-space-3);
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      gap: var(--ptk-space-3);
      box-shadow: var(--ptk-shadow-sm);
    }

    .map-frame.fullscreen {
      min-height: 0;
      height: 100%;
      grid-template-rows: auto minmax(0, 1fr);
    }

    .workspace.fullscreen .map-frame {
      height: 100%;
    }

    .map-header {
      display: grid;
      gap: var(--ptk-space-2);
    }

    .map-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ptk-space-2);
      flex-wrap: wrap;
    }

    .map-controls {
      display: flex;
      gap: var(--ptk-space-2);
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .map-canvas {
      border-radius: var(--ptk-radius-md);
      border: 1px solid var(--ptk-border-muted);
      min-height: 260px;
      position: relative;
      overflow: hidden;
      background: var(--ptk-surface-map);
    }

    .workspace.fullscreen .map-canvas {
      min-height: 0;
      height: 100%;
    }

    .map-test-surface {
      width: 100%;
      height: 100%;
      min-height: inherit;
      background: transparent;
    }

    .back-row {
      display: flex;
      justify-content: flex-start;
    }

    .workspace.fullscreen .back-row {
      display: none;
    }

    .hidden-panel-tools {
      display: flex;
      gap: var(--ptk-space-2);
    }

    .modal-layer {
      position: fixed;
      inset: 0;
      z-index: 50;
      display: grid;
      place-items: center;
      padding: var(--ptk-space-3);
    }

    .modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgb(31 32 36 / 0.42);
    }

    .modal {
      position: relative;
      width: min(100%, 520px);
      border-radius: var(--ptk-radius-lg);
      border: 1px solid var(--ptk-border-default);
      background: var(--ptk-surface-card);
      box-shadow: var(--ptk-shadow-md);
      padding: var(--ptk-space-3);
      display: grid;
      gap: var(--ptk-space-2);
    }

    .modal h3 {
      margin: 0;
      font-family: var(--ptk-font-family-heading);
      font-size: var(--ptk-font-heading-h3-size);
      font-weight: var(--ptk-font-weight-bold);
    }

    .modal p {
      margin: 0;
      color: var(--ptk-text-secondary);
      font-size: var(--ptk-font-body-m-size);
      line-height: 1.45;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--ptk-space-2);
      margin-top: var(--ptk-space-1);
    }
  `;

  @property({ type: String })
  accessor viewport: ViewportMode = "small";

  @property({ attribute: false })
  accessor header: ResortPageHeaderViewModel = {
    resortName: "Resort",
    versionText: "v?",
    runsCountText: "0 runs",
    liftsCountText: "0 lifts"
  };

  @property({ type: String })
  accessor selectedTab: ResortPageTabId = "my-location";

  @property({ type: Boolean })
  accessor panelOpen = true;

  @property({ type: Boolean })
  accessor fullscreenSupported = true;

  @property({ type: Boolean })
  accessor fullscreenActive = false;

  @property({ type: String })
  accessor shellTheme: "default" | "high-contrast" = "default";

  @property({ attribute: false })
  accessor pack: ResortPack | null = null;

  @property({ type: Boolean })
  accessor renderLiveMap = true;

  @property({ type: String })
  accessor gpsStatusText = "Requesting GPS permission and location…";

  @property({ type: Boolean })
  accessor gpsDisabled = false;

  @property({ type: Boolean })
  accessor gpsGuidanceModalOpen = false;

  @property({ type: String })
  accessor gpsGuidanceTitle = "Turn On Location";

  @property({ type: String })
  accessor gpsGuidanceBody = "";

  @property({ type: String })
  accessor phraseOutputText = "No phrase generated yet.";

  @property({ type: String })
  accessor phraseStatusText = "Waiting for GPS position.";

  @property({ type: Boolean })
  accessor phraseGenerating = false;

  @property({ type: String })
  accessor mapState: "loading" | "ready" | "error" = "loading";

  @property({ type: String })
  accessor mapStateMessage = "Loading map…";

  protected render() {
    const workspaceClasses = {
      workspace: true,
      [this.viewport]: true,
      fullscreen: this.fullscreenActive
    };
    return html`
      <section class=${classMap(workspaceClasses)} aria-label="Resort Page">
        <div class=${`panel-shell ${this.viewport}`}>
          <ptk-tool-panel .viewport=${this.viewport} .open=${this.panelOpen} title="Resort tools">
            ${this.renderPanelContent()}
          </ptk-tool-panel>
        </div>
        <section class=${`map-frame ${this.fullscreenActive ? "fullscreen" : ""}`} aria-label="Resort map surface">
          <div class="map-header">
            <div class="map-header-row">
              <ptk-page-header
                .title=${this.header.resortName}
                .subtitle=${this.header.versionText}
                .metaLine1=${this.header.runsCountText}
                .metaLine2=${this.header.liftsCountText}
              ></ptk-page-header>
              <div class="hidden-panel-tools">
                ${this.renderPanelToggleButton()}
                ${this.renderSettingsButton()}
              </div>
            </div>
            <div class="map-controls">
              <button class="ghost-button" type="button" @click=${this.handleCenterToUser}>
                Center to user position
              </button>
              ${this.fullscreenSupported
                ? html`
                    <button class="ghost-button" type="button" @click=${this.handleToggleFullscreen}>
                      ${this.fullscreenActive ? "Exit full screen" : "Full screen"}
                    </button>
                  `
                : nothing}
            </div>
            <p class="panel-note" aria-label="Map state">${this.mapStateMessage}</p>
          </div>
          <div class="map-canvas" aria-label="Resort map canvas">
            ${this.renderLiveMap
              ? html`
                  <map-view
                    .pack=${this.pack}
                    .showStatusBar=${false}
                    .showBuiltInControls=${false}
                    @position-update=${this.handleMapPositionUpdate}
                    @gps-error=${this.handleMapGpsError}
                    @map-ready=${this.handleMapReady}
                    @map-render-error=${this.handleMapRenderError}
                  ></map-view>
                `
              : html`<div class="map-test-surface" aria-hidden="true"></div>`}
          </div>
          <div class="back-row">
            <button class="ghost-button" type="button" @click=${this.handleBack}>
              Back to Select Resort
            </button>
          </div>
        </section>
      </section>
      ${this.gpsGuidanceModalOpen ? this.renderGpsGuidanceModal() : nothing}
    `;
  }

  private renderPanelToggleButton() {
    const label = this.panelOpen ? "Hide tools" : "Show tools";
    return html`
      <button class="ghost-button" type="button" @click=${this.handleTogglePanel}>${label}</button>
    `;
  }

  private renderSettingsButton() {
    return html`
      <button class="ghost-button" type="button" @click=${this.handleOpenSettings}>Settings / Help</button>
    `;
  }

  private renderPanelContent() {
    return html`
      <div class="panel-content">
        <div class="panel-toolbar">
          <h3>Tools</h3>
          ${this.viewport === "large" ? this.renderSettingsButton() : nothing}
        </div>
        <div class="tabs" role="tablist" aria-label="Resort tools navigation">
          ${this.renderTabButton("my-location", "My location")}
          ${this.renderTabButton("runs-check", "Runs Check")}
          ${this.renderTabButton("sweeps", "Sweeps")}
        </div>
        ${this.renderActiveTabPanel()}
      </div>
    `;
  }

  private renderTabButton(tabId: ResortPageTabId, label: string) {
    const selected = this.selectedTab === tabId;
    return html`
      <button
        type="button"
        role="tab"
        aria-selected=${selected ? "true" : "false"}
        ?selected=${selected}
        @click=${() => this.dispatchSelectTab(tabId)}
      >
        ${label}
      </button>
    `;
  }

  private renderActiveTabPanel() {
    switch (this.selectedTab) {
      case "my-location":
        return html`
          <section class="panel-card" role="tabpanel" aria-label="My location tools">
            <h4>Generate Phrase</h4>
            <button class="ghost-button" type="button" ?disabled=${this.phraseGenerating} @click=${this.handleGeneratePhrase}>
              ${this.phraseGenerating ? "Generating..." : "Generate Phrase"}
            </button>
            <div class="phrase-output">${this.phraseOutputText}</div>
            <p class="panel-note">${this.phraseStatusText}</p>
            <p class="panel-note">${this.gpsStatusText}</p>
            ${this.gpsDisabled
              ? html`
                  <div class="gps-disabled-card" aria-label="GPS disabled state">
                    <p>Location access is required for live positioning and phrase generation.</p>
                    <button class="ghost-button" type="button" @click=${this.handleRetryGps}>
                      Turn On Location
                    </button>
                  </div>
                `
              : nothing}
          </section>
        `;
      case "runs-check":
        return html`
          <section class="panel-card" role="tabpanel" aria-label="Runs Check tools">
            <h4>Runs Check</h4>
            <p class="panel-note">Run verification workflows live here in the v4 Resort Page layout.</p>
          </section>
        `;
      case "sweeps":
        return html`
          <section class="panel-card" role="tabpanel" aria-label="Sweeps tools">
            <h4>Sweeps</h4>
            <p class="sweeps-note">
              Not defined yet. This area is part of the roadmap and will be developed after feedback and data
              improvements.
            </p>
          </section>
        `;
    }
  }

  private renderGpsGuidanceModal() {
    return html`
      <div class="modal-layer" aria-label="GPS guidance modal" role="dialog" aria-modal="true">
        <div class="modal-backdrop" @click=${this.handleDismissGpsGuidance}></div>
        <section class="modal">
          <h3>${this.gpsGuidanceTitle}</h3>
          <p>${this.gpsGuidanceBody}</p>
          <div class="modal-actions">
            <button class="ghost-button" type="button" @click=${this.handleDismissGpsGuidance}>Close</button>
          </div>
        </section>
      </div>
    `;
  }

  private dispatchSelectTab(tabId: ResortPageTabId): void {
    this.dispatchEvent(
      new CustomEvent("ptk-resort-tab-select", {
        detail: { tabId },
        bubbles: true,
        composed: true
      })
    );
  }

  private readonly handleTogglePanel = (): void => {
    this.dispatchEvent(new CustomEvent("ptk-resort-toggle-panel", { bubbles: true, composed: true }));
  };

  private readonly handleToggleFullscreen = (): void => {
    this.dispatchEvent(new CustomEvent("ptk-resort-toggle-fullscreen", { bubbles: true, composed: true }));
  };

  private readonly handleCenterToUser = (): void => {
    const mapView = this.shadowRoot?.querySelector("map-view") as MapView | null;
    mapView?.recenterToUserPosition();
    this.dispatchEvent(new CustomEvent("ptk-resort-center-user", { bubbles: true, composed: true }));
  };

  private readonly handleRetryGps = (): void => {
    const mapView = this.shadowRoot?.querySelector("map-view") as MapView | null;
    mapView?.restartGpsTracking();
    this.dispatchEvent(new CustomEvent("ptk-resort-gps-retry", { bubbles: true, composed: true }));
  };

  private readonly handleDismissGpsGuidance = (): void => {
    this.dispatchEvent(new CustomEvent("ptk-resort-gps-guidance-dismiss", { bubbles: true, composed: true }));
  };

  private readonly handleMapPositionUpdate = (event: Event): void => {
    this.dispatchEvent(
      new CustomEvent("ptk-resort-position-update", {
        detail: (event as CustomEvent).detail,
        bubbles: true,
        composed: true
      })
    );
  };

  private readonly handleMapGpsError = (event: Event): void => {
    this.dispatchEvent(
      new CustomEvent<{ kind: GpsErrorKind; message: string }>("ptk-resort-gps-error", {
        detail: (event as CustomEvent).detail,
        bubbles: true,
        composed: true
      })
    );
  };

  private readonly handleMapReady = (): void => {
    this.dispatchEvent(new CustomEvent("ptk-resort-map-ready", { bubbles: true, composed: true }));
  };

  private readonly handleMapRenderError = (event: Event): void => {
    this.dispatchEvent(
      new CustomEvent("ptk-resort-map-render-error", {
        detail: (event as CustomEvent).detail,
        bubbles: true,
        composed: true
      })
    );
  };

  private readonly handleGeneratePhrase = (): void => {
    this.dispatchEvent(new CustomEvent("ptk-resort-generate-phrase", { bubbles: true, composed: true }));
  };

  private readonly handleOpenSettings = (): void => {
    this.dispatchEvent(new CustomEvent("ptk-resort-open-settings", { bubbles: true, composed: true }));
  };

  private readonly handleBack = (): void => {
    this.dispatchEvent(new CustomEvent("ptk-resort-back", { bubbles: true, composed: true }));
  };
}

function classMap(classes: Record<string, boolean>): string {
  return Object.entries(classes)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name)
    .join(" ");
}
