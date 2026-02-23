import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ViewportMode } from "./viewport";

@customElement("ptk-tool-panel")
export class PtkToolPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .panel {
      border: 1px solid #d4d6dd;
      background: #ffffff;
      color: #1f2024;
      box-shadow: 0 8px 20px rgba(31, 32, 36, 0.08);
    }

    .panel.hidden {
      display: none;
    }

    .panel.small {
      border-radius: 16px 16px 0 0;
      min-height: 220px;
      padding: 12px;
    }

    .panel.medium,
    .panel.large {
      border-radius: 12px;
      min-height: 320px;
      padding: 12px;
      height: 100%;
    }

    .caption {
      margin: 0 0 0.5rem;
      font-size: 0.75rem;
      color: #71727a;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .title {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
    }

    .body {
      margin-top: 0.75rem;
      font-size: 0.9rem;
      color: #494a50;
    }

    .hint {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid #e8e9f1;
      font-size: 0.8rem;
      color: #71727a;
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
