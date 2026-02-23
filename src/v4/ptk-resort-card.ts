import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { v4DesignTokens } from "./design-tokens";
import type { SelectResortCardViewModel } from "./select-resort-model";

@customElement("ptk-resort-card")
export class PtkResortCard extends LitElement {
  static styles = css`
    ${v4DesignTokens}

    :host {
      display: block;
    }

    button {
      width: 100%;
      border: 1px solid var(--ptk-border-default);
      border-radius: var(--ptk-radius-md);
      background: var(--ptk-surface-card);
      box-shadow: var(--ptk-shadow-sm);
      padding: 0;
      text-align: left;
      cursor: pointer;
      display: grid;
      grid-template-rows: minmax(140px, auto) auto;
      color: var(--ptk-text-primary);
      font: inherit;
      min-width: 0;
      overflow: hidden;
    }

    .thumb {
      min-height: 140px;
      background: linear-gradient(180deg, var(--ptk-surface-subtle) 0%, var(--ptk-color-highlight-100) 100%);
      overflow: hidden;
      position: relative;
      border-bottom: 1px solid var(--ptk-border-muted);
    }

    .thumb img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .content {
      display: grid;
      gap: 8px;
      padding: 12px 12px 14px;
      min-width: 0;
    }

    .header-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .name {
      margin: 0;
      font-size: var(--ptk-font-heading-h4-size);
      font-weight: var(--ptk-font-weight-bold);
      font-family: var(--ptk-font-family-heading);
      color: var(--ptk-text-primary);
      text-transform: capitalize;
      line-height: 1.15;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .location {
      margin: 0;
      color: var(--ptk-text-secondary);
      font-size: 11px;
      line-height: 1.2;
      white-space: nowrap;
    }

    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    .badge {
      border-radius: var(--ptk-radius-pill);
      border: 1px solid var(--ptk-border-default);
      background: var(--ptk-surface-subtle);
      color: var(--ptk-text-secondary);
      padding: 1px 7px;
      font-size: 9px;
      font-weight: var(--ptk-font-weight-semibold);
      line-height: 1.3;
      white-space: nowrap;
    }

    .badge.primary {
      background: var(--ptk-control-selected-bg);
      border-color: var(--ptk-control-selected-border);
      color: var(--ptk-control-selected-fg);
    }

    .badge.success {
      background: var(--ptk-color-success-100);
      border-color: var(--ptk-color-success-500);
      color: var(--ptk-color-success-900);
    }

    .meta {
      display: block;
      color: var(--ptk-text-muted);
      font-size: 10px;
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;

  @property({ attribute: false })
  accessor card: SelectResortCardViewModel | null = null;

  protected render() {
    const card = this.card;
    if (!card) {
      return html``;
    }

    return html`
      <button type="button" @click=${this.handleSelect}>
        <div class="thumb">
          <img
            src=${card.thumbnailImageUrl}
            alt=${`${card.resortName} resort thumbnail`}
            data-fallback=${card.thumbnailFallbackUrl}
            @error=${this.handleThumbnailError}
          />
        </div>
        <div class="content">
          <div class="header-row">
            <p class="name">${card.resortName}</p>
            <p class="location">${card.locationLabel}</p>
          </div>
          <div class="badges">
            ${card.statusBadges.map((badge) => {
              const classes = ["badge"];
              if (badge === "Update available") classes.push("primary");
              if (badge === "Offline ready" && card.status !== "update-available") classes.push("success");
              return html`<span class=${classes.join(" ")}>${badge}</span>`;
            })}
          </div>
          <div class="meta">
            ${card.versionLabel}${card.lastUpdatedLabel ? `  Updated ${card.lastUpdatedLabel}` : ""}
          </div>
        </div>
      </button>
    `;
  }

  private readonly handleSelect = (): void => {
    if (!this.card) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent<{ resortId: string }>("ptk-resort-select", {
        detail: { resortId: this.card.resortId },
        bubbles: true,
        composed: true
      })
    );
  };

  private readonly handleThumbnailError = (event: Event): void => {
    const target = event.target as HTMLImageElement;
    const fallback = target.dataset.fallback;
    if (!fallback || target.src.endsWith("/resort_placeholder.png")) {
      return;
    }
    target.src = fallback;
  };
}
