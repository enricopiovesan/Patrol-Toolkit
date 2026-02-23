import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { v4DesignTokens } from "./design-tokens";
import type { ViewportMode } from "./viewport";

@customElement("ptk-tool-panel")
export class PtkToolPanel extends LitElement {
  static styles = css`
    ${v4DesignTokens}

    :host {
      display: block;
      font-family: var(--ptk-font-family-base);
    }

    .panel {
      border: 1px solid var(--ptk-border-default);
      background: var(--ptk-surface-card);
      color: var(--ptk-text-primary);
      box-shadow: var(--ptk-shadow-md);
    }

    .panel.hidden {
      display: none;
    }

    .panel.small {
      border-radius: var(--ptk-radius-lg) var(--ptk-radius-lg) 0 0;
      min-height: 220px;
      padding: var(--ptk-space-3);
    }

    .panel.medium,
    .panel.large {
      border-radius: var(--ptk-radius-md);
      min-height: 320px;
      padding: var(--ptk-space-3);
      height: 100%;
    }

    .caption {
      margin: 0 0 var(--ptk-space-2);
      font-size: var(--ptk-font-body-s-size);
      color: var(--ptk-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .title {
      margin: 0;
      font-size: var(--ptk-font-heading-h3-size);
      font-weight: var(--ptk-font-weight-bold);
      font-family: var(--ptk-font-family-heading);
    }

    .body {
      margin-top: var(--ptk-space-3);
      font-size: var(--ptk-font-body-m-size);
      color: var(--ptk-text-secondary);
    }

    .hint {
      margin-top: var(--ptk-space-3);
      padding-top: var(--ptk-space-3);
      border-top: 1px solid var(--ptk-border-muted);
      font-size: var(--ptk-font-body-s-size);
      color: var(--ptk-text-muted);
    }
  `;

  @property({ type: String })
  accessor viewport: ViewportMode = "small";

  @property({ type: Boolean, reflect: true })
  accessor open = true;

  @property({ type: String })
  accessor title = "Tools";

  protected render() {
    const hidden = !this.open;
    const panelClasses = {
      panel: true,
      hidden,
      [this.viewport]: true
    };

    return html`
      <section class=${classMap(panelClasses)} aria-hidden=${hidden ? "true" : "false"}>
        <p class="caption">${this.viewport} tool panel</p>
        <h2 class="title">${this.title}</h2>
        <div class="body">
          <slot></slot>
        </div>
        ${hidden
          ? nothing
          : html`<div class="hint">Responsive primitive for /new UI path (Slice 2 foundation).</div>`}
      </section>
    `;
  }
}

function classMap(classes: Record<string, boolean>): string {
  return Object.entries(classes)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name)
    .join(" ");
}
