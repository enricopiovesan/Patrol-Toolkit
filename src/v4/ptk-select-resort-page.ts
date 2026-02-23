import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { v4DesignTokens } from "./design-tokens";
import "./ptk-page-header";
import "./ptk-search-input";
import "./ptk-resort-card";
import type { SelectResortCardViewModel } from "./select-resort-model";
import type { ViewportMode } from "./viewport";

@customElement("ptk-select-resort-page")
export class PtkSelectResortPage extends LitElement {
  static styles = css`
    ${v4DesignTokens}

    :host {
      display: block;
      min-height: 0;
      font-family: var(--ptk-font-family-base);
    }

    .page {
      display: grid;
      gap: var(--ptk-space-3);
      min-height: 0;
    }

    .header-card {
      border: 1px solid var(--ptk-border-default);
      background: var(--ptk-surface-card);
      border-radius: var(--ptk-radius-md);
      box-shadow: var(--ptk-shadow-sm);
      padding: var(--ptk-space-3);
      display: grid;
      gap: var(--ptk-space-3);
    }

    .content {
      min-height: 0;
    }

    .content.small,
    .content.medium {
      width: 100%;
    }

    .content.large {
      width: min(100%, 760px);
      margin: 0 auto;
    }

    .grid {
      display: grid;
      gap: var(--ptk-space-3);
      grid-template-columns: 1fr;
    }

    .grid.medium {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .grid.large {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .message {
      border: 1px dashed var(--ptk-border-default);
      border-radius: var(--ptk-radius-md);
      background: var(--ptk-surface-card);
      color: var(--ptk-text-secondary);
      padding: var(--ptk-space-3);
      font-size: var(--ptk-font-body-m-size);
    }

    .message.error {
      border-style: solid;
      border-color: var(--ptk-color-error-500);
      background: var(--ptk-color-error-100);
      color: var(--ptk-color-error-900);
    }
  `;

  @property({ type: String })
  accessor viewport: ViewportMode = "small";

  @property({ type: String })
  accessor query = "";

  @property({ attribute: false })
  accessor cards: SelectResortCardViewModel[] = [];

  @property({ type: Boolean })
  accessor loading = false;

  @property({ type: String })
  accessor nonBlockingMessage = "";

  @property({ type: String })
  accessor errorMessage = "";

  protected render() {
    const countMeta = `${this.cards.length} resorts`;
    return html`
      <section class="page" aria-label="Select Resort page">
        <div class="header-card">
          <ptk-page-header title="Select resort" .metaLine1=${countMeta}></ptk-page-header>
          <ptk-search-input .value=${this.query} placeholder="Search by name or location"></ptk-search-input>
          ${this.nonBlockingMessage
            ? html`<div class="message">${this.nonBlockingMessage}</div>`
            : html``}
          ${this.errorMessage ? html`<div class="message error">${this.errorMessage}</div>` : html``}
        </div>
        <div class=${`content ${this.viewport}`}>
          ${this.renderBody()}
        </div>
      </section>
    `;
  }

  private renderBody() {
    if (this.loading) {
      return html`<div class="message">Loading resorts...</div>`;
    }
    if (this.cards.length === 0) {
      return html`<div class="message">No resorts found.</div>`;
    }
    return html`
      <div class=${`grid ${this.viewport}`}>
        ${this.cards.map((card) => html`<ptk-resort-card .card=${card}></ptk-resort-card>`)}
      </div>
    `;
  }
}

