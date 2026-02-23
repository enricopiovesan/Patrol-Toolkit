import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { v4DesignTokens } from "./design-tokens";
import type { ResortPageHeaderViewModel } from "./resort-page-model";
import type { ResortPageTabId } from "./resort-page-state";
import type { ViewportMode } from "./viewport";
import "./ptk-page-header";
import "./ptk-tool-panel";

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
      background:
        radial-gradient(circle at 20% 20%, rgb(255 255 255 / 0.18), transparent 42%),
        radial-gradient(circle at 80% 18%, rgb(255 255 255 / 0.12), transparent 38%),
        linear-gradient(180deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.02)),
        var(--ptk-surface-map);
      min-height: 260px;
      position: relative;
      overflow: hidden;
    }

    .map-grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgb(255 255 255 / 0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgb(255 255 255 / 0.05) 1px, transparent 1px);
      background-size: 32px 32px;
      opacity: 0.5;
    }

    .map-overlay-label {
      position: absolute;
      left: var(--ptk-space-3);
      bottom: var(--ptk-space-3);
      border-radius: var(--ptk-radius-pill);
      border: 1px solid var(--ptk-border-default);
      background: rgb(255 255 255 / 0.85);
      color: var(--ptk-text-primary);
      padding: 4px 10px;
      font-size: var(--ptk-font-body-s-size);
      font-weight: var(--ptk-font-weight-semibold);
    }

    .back-row {
      display: flex;
      justify-content: flex-start;
    }

    .hidden-panel-tools {
      display: flex;
      gap: var(--ptk-space-2);
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

  protected render() {
    return html`
      <section class=${`workspace ${this.viewport}`} aria-label="Resort Page">
        <div class=${`panel-shell ${this.viewport}`}>
          <ptk-tool-panel .viewport=${this.viewport} .open=${this.panelOpen} title="Resort tools">
            ${this.renderPanelContent()}
          </ptk-tool-panel>
        </div>
        <section class="map-frame" aria-label="Resort map surface">
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
          </div>
          <div class="map-canvas" aria-label="Map canvas placeholder">
            <div class="map-grid"></div>
            <div class="map-overlay-label">Map-first layout surface</div>
          </div>
          <div class="back-row">
            <button class="ghost-button" type="button" @click=${this.handleBack}>
              Back to Select Resort
            </button>
          </div>
        </section>
      </section>
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
            <button class="ghost-button" type="button">Generate Phrase</button>
            <div class="phrase-output">No phrase generated yet.</div>
            <p class="panel-note">GPS ready (±150m).</p>
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
    this.dispatchEvent(new CustomEvent("ptk-resort-center-user", { bubbles: true, composed: true }));
  };

  private readonly handleOpenSettings = (): void => {
    this.dispatchEvent(new CustomEvent("ptk-resort-open-settings", { bubbles: true, composed: true }));
  };

  private readonly handleBack = (): void => {
    this.dispatchEvent(new CustomEvent("ptk-resort-back", { bubbles: true, composed: true }));
  };
}
