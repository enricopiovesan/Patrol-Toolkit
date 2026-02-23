import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./ptk-tool-panel";
import { createInitialToolPanelState } from "./tool-panel-state";
import { DEFAULT_V4_THEME } from "./theme";
import { classifyViewportWidth, type ViewportMode } from "./viewport";

@customElement("ptk-app-shell")
export class PtkAppShell extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--ptk-surface-app, #f8f9fe);
      color: var(--ptk-text-primary, #1f2024);
    }

    .root {
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 12px;
      padding: 12px;
    }

    .header {
      border: 1px solid #d4d6dd;
      border-radius: 12px;
      background: #fff;
      padding: 12px;
      display: grid;
      gap: 6px;
    }

    .title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 800;
    }

    .subtitle {
      margin: 0;
      color: #494a50;
      font-size: 0.9rem;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;
      font-size: 0.78rem;
      color: #71727a;
    }

    .chip {
      border-radius: 999px;
      border: 1px solid #d4d6dd;
      background: #f8f9fe;
      padding: 2px 8px;
      line-height: 1.3;
    }

    .workspace {
      min-height: 0;
      display: grid;
      gap: 12px;
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
      border: 1px solid #d4d6dd;
      border-radius: 12px;
      background: linear-gradient(180deg, #f8f9fe 0%, #eaf2ff 100%);
      min-height: 320px;
      padding: 12px;
      display: grid;
      align-content: start;
      gap: 8px;
      position: relative;
    }

    .map-title {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 700;
    }

    .map-note {
      margin: 0;
      font-size: 0.85rem;
      color: #494a50;
    }

    .map-controls {
      position: absolute;
      top: 12px;
      right: 12px;
      display: grid;
      gap: 6px;
      justify-items: end;
    }

    .map-controls button {
      min-height: 34px;
      border-radius: 999px;
      border: 1px solid #d4d6dd;
      background: #ffffff;
      color: #1f2024;
      font: inherit;
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

