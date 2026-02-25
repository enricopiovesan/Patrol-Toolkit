import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { v4DesignTokens } from "./design-tokens";

@customElement("ptk-page-header")
export class PtkPageHeader extends LitElement {
  static styles = css`
    ${v4DesignTokens}

    :host {
      display: block;
      font-family: var(--ptk-font-family-base);
    }

    .header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--ptk-space-2);
      align-items: center;
    }

    .main {
      min-width: 0;
      display: grid;
      gap: 2px;
    }

    .title {
      margin: 0;
      font-size: var(--ptk-font-heading-h3-size);
      font-weight: var(--ptk-font-weight-extrabold);
      font-family: var(--ptk-font-family-heading);
      color: var(--ptk-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .subtitle {
      margin: 0;
      color: var(--ptk-text-muted);
      font-size: var(--ptk-font-body-s-size);
    }

    .meta {
      display: grid;
      justify-items: end;
      gap: 2px;
      color: var(--ptk-text-secondary);
      font-size: var(--ptk-font-body-s-size);
      text-align: right;
    }

    :host([compact]) .header {
      gap: var(--ptk-space-2);
      align-items: start;
    }

    :host([compact]) .main {
      gap: 0;
    }

    :host([compact]) .title {
      font-size: 18px;
      line-height: 1.15;
      font-weight: var(--ptk-font-weight-extrabold);
    }

    :host([compact]) .subtitle {
      font-size: 12px;
      line-height: 1.2;
    }

    :host([compact]) .meta {
      font-size: 12px;
      line-height: 1.15;
      gap: 2px;
      padding-top: 1px;
    }
  `;

  @property({ type: String })
  accessor title = "";

  @property({ type: String })
  accessor subtitle = "";

  @property({ type: String })
  accessor metaLine1 = "";

  @property({ type: String })
  accessor metaLine2 = "";

  @property({ type: Boolean, reflect: true })
  accessor compact = false;

  protected render() {
    return html`
      <header class="header">
        <div class="main">
          <h1 class="title">${this.title}</h1>
          ${this.subtitle ? html`<p class="subtitle">${this.subtitle}</p>` : nothing}
        </div>
        ${(this.metaLine1 || this.metaLine2)
          ? html`
              <div class="meta">
                ${this.metaLine1 ? html`<div>${this.metaLine1}</div>` : nothing}
                ${this.metaLine2 ? html`<div>${this.metaLine2}</div>` : nothing}
              </div>
            `
          : nothing}
      </header>
    `;
  }
}
