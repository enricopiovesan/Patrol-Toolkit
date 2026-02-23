import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./ptk-tool-panel";
import { v4DesignTokens } from "./design-tokens";
import { createInitialToolPanelState } from "./tool-panel-state";
import { DEFAULT_V4_THEME } from "./theme";
import { readStoredV4Theme, writeStoredV4Theme } from "./theme-preferences";
import { classifyViewportWidth, type ViewportMode } from "./viewport";

@customElement("ptk-app-shell")
export class PtkAppShell extends LitElement {
  static styles = css`
    ${v4DesignTokens}

    :host {
      display: block;
      min-height: 100vh;
      background: var(--ptk-surface-app);
      color: var(--ptk-text-primary);
      font-family: var(--ptk-font-family-base);
    }

    .root {
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr;
      gap: var(--ptk-space-3);
      padding: var(--ptk-space-3);
      width: min(100%, var(--ptk-size-shell-max-width));
      margin: 0 auto;
    }

    .header {
      border: 1px solid var(--ptk-border-default);
      border-radius: var(--ptk-radius-md);
      background: var(--ptk-surface-card);
      padding: var(--ptk-space-3);
      display: grid;
      gap: var(--ptk-space-2);
      box-shadow: var(--ptk-shadow-sm);
    }

    .title {
      margin: 0;
      font-size: var(--ptk-font-heading-h3-size);
      font-weight: var(--ptk-font-weight-extrabold);
      font-family: var(--ptk-font-family-heading);
    }

    .subtitle {
      margin: 0;
      color: var(--ptk-text-secondary);
      font-size: var(--ptk-font-body-m-size);
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ptk-space-2);
      margin-top: var(--ptk-space-1);
      font-size: var(--ptk-font-body-s-size);
      color: var(--ptk-text-muted);
    }

    .chip {
      border-radius: var(--ptk-radius-pill);
      border: 1px solid var(--ptk-border-default);
      background: var(--ptk-surface-subtle);
      padding: 2px var(--ptk-space-2);
      line-height: 1.3;
    }

    .theme-row {
      display: flex;
      align-items: center;
      gap: var(--ptk-space-2);
      flex-wrap: wrap;
    }

    .theme-label {
      margin: 0;
      color: var(--ptk-text-secondary);
      font-size: var(--ptk-font-body-s-size);
      font-weight: var(--ptk-font-weight-semibold);
    }

    .theme-segmented {
      display: inline-flex;
      gap: var(--ptk-space-1);
      padding: var(--ptk-space-1);
      border-radius: var(--ptk-radius-pill);
      border: 1px solid var(--ptk-border-default);
      background: var(--ptk-surface-subtle);
    }

    .theme-segmented button {
      min-height: var(--ptk-size-control-sm);
      border-radius: var(--ptk-radius-pill);
      border: 1px solid transparent;
      background: transparent;
      color: var(--ptk-control-fg);
      font: inherit;
      font-size: var(--ptk-font-action-m-size);
      font-weight: var(--ptk-font-weight-semibold);
      padding: 0 10px;
      cursor: pointer;
      transition:
        background-color var(--ptk-motion-duration-fast) var(--ptk-motion-ease-standard),
        color var(--ptk-motion-duration-fast) var(--ptk-motion-ease-standard),
        border-color var(--ptk-motion-duration-fast) var(--ptk-motion-ease-standard);
    }

    .theme-segmented button[selected] {
      background: var(--ptk-control-selected-bg);
      color: var(--ptk-control-selected-fg);
      border-color: var(--ptk-control-selected-border);
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

    .workspace.medium ptk-tool-panel[open="false"] {
      grid-template-columns: 0 minmax(0, 1fr);
    }

    .map-frame {
      border: 1px solid var(--ptk-border-default);
      border-radius: var(--ptk-radius-md);
      background: var(--ptk-surface-map);
      min-height: 320px;
      padding: var(--ptk-space-3);
      display: grid;
      align-content: start;
      gap: var(--ptk-space-2);
      position: relative;
      box-shadow: var(--ptk-shadow-sm);
    }

    .map-title {
      margin: 0;
      font-size: var(--ptk-font-heading-h4-size);
      font-weight: var(--ptk-font-weight-bold);
      font-family: var(--ptk-font-family-heading);
    }

    .map-note {
      margin: 0;
      font-size: var(--ptk-font-body-m-size);
      color: var(--ptk-text-secondary);
    }

    .map-controls {
      position: absolute;
      top: var(--ptk-space-3);
      right: var(--ptk-space-3);
      display: grid;
      gap: var(--ptk-space-2);
      justify-items: end;
    }

    .map-controls button {
      min-height: var(--ptk-size-control-sm);
      border-radius: var(--ptk-radius-pill);
      border: 1px solid var(--ptk-control-border);
      background: var(--ptk-control-bg);
      color: var(--ptk-control-fg);
      font: inherit;
      font-size: var(--ptk-font-action-m-size);
      font-weight: var(--ptk-font-weight-semibold);
      padding: 0 10px;
      cursor: default;
    }
  `;

  @state()
  private accessor viewport: ViewportMode = "large";

  @state()
  private accessor theme = DEFAULT_V4_THEME;

  @state()
  private accessor toolPanelOpen = true;

  connectedCallback(): void {
    super.connectedCallback();
    this.theme = readStoredV4Theme(safeStorage());
    this.syncViewport();
    window.addEventListener("resize", this.handleWindowResize);
  }

  disconnectedCallback(): void {
    window.removeEventListener("resize", this.handleWindowResize);
    super.disconnectedCallback();
  }

  protected render() {
    const panelState = createInitialToolPanelState(this.viewport);
    const panelOpen = this.toolPanelOpen && panelState.visibility === "visible";

    return html`
      <div class="root" data-theme=${this.theme}>
        <header class="header">
          <h1 class="title">Patrol Toolkit /new</h1>
          <p class="subtitle">v4 shell foundation: routing, viewport mapping, and responsive panel primitives.</p>
          <div class="theme-row">
            <p class="theme-label">Theme</p>
            <div class="theme-segmented" role="tablist" aria-label="Theme switcher">
              ${this.renderThemeButton("default", "Default")}
              ${this.renderThemeButton("high-contrast", "High contrast")}
            </div>
          </div>
          <div class="meta">
            <span class="chip">viewport=${this.viewport}</span>
            <span class="chip">theme=${this.theme}</span>
            <span class="chip">panel=${panelState.presentation}</span>
            <span class="chip">fullscreen=${panelState.fullscreenSupported ? "yes" : "no"}</span>
          </div>
        </header>
        <section class=${`workspace ${this.viewport}`}>
          <ptk-tool-panel
            .viewport=${this.viewport}
            .open=${panelOpen}
            title=${this.viewport === "small" ? "Bottom Sheet Primitive" : "Sidebar Primitive"}
          >
            <div>Slice 2 foundation for shared tool panel behavior.</div>
          </ptk-tool-panel>
          <div class="map-frame" role="region" aria-label="V4 map surface shell">
            <div class="map-controls">
              <button type="button">Center to user</button>
              ${panelState.fullscreenSupported ? html`<button type="button">Full screen</button>` : null}
            </div>
            <h2 class="map-title">Map-first layout surface</h2>
            <p class="map-note">
              This route intentionally validates layout structure only. Feature UI arrives in later slices.
            </p>
          </div>
        </section>
      </div>
    `;
  }

  private readonly handleWindowResize = (): void => {
    this.syncViewport();
  };

  private renderThemeButton(themeId: "default" | "high-contrast", label: string) {
    const selected = this.theme === themeId;
    return html`
      <button
        type="button"
        role="tab"
        aria-selected=${selected ? "true" : "false"}
        ?selected=${selected}
        @click=${() => this.setTheme(themeId)}
      >
        ${label}
      </button>
    `;
  }

  private setTheme(themeId: "default" | "high-contrast"): void {
    if (this.theme === themeId) {
      return;
    }
    this.theme = themeId;
    writeStoredV4Theme(safeStorage(), themeId);
  }

  private syncViewport(): void {
    const nextViewport = classifyViewportWidth(window.innerWidth);
    if (nextViewport !== this.viewport) {
      this.viewport = nextViewport;
      const initialPanel = createInitialToolPanelState(nextViewport);
      this.toolPanelOpen = initialPanel.visibility === "visible";
    } else if (this.viewport === "large" || this.viewport === "small") {
      this.toolPanelOpen = true;
    } else if (this.viewport === "medium") {
      this.toolPanelOpen = false;
    }
  }
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
