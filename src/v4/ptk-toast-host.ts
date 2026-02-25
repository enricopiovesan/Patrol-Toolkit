import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { v4DesignTokens } from "./design-tokens";
import type { V4Toast } from "./toast-state";

@customElement("ptk-toast-host")
export class PtkToastHost extends LitElement {
  static styles = css`
    ${v4DesignTokens}

    :host {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 60;
      display: block;
      font-family: var(--ptk-font-family-base);
    }

    .stack {
      position: absolute;
      top: calc(env(safe-area-inset-top, 0px) + 12px);
      left: 50%;
      transform: translateX(-50%);
      width: min(calc(100vw - 24px), 360px);
      display: grid;
      gap: 10px;
    }

    .toast {
      pointer-events: auto;
      border-radius: 12px;
      border: none;
      background: #eef4ff;
      box-shadow: 0 6px 14px rgb(31 32 36 / 0.08);
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 10px 12px;
      color: var(--ptk-text-primary);
    }

    .toast.info {
      background: #eaf2ff;
    }

    .toast.success {
      background: #e7f4e8;
    }

    .toast.warning {
      background: #fff4e4;
    }

    .toast.error {
      background: #ffe2e5;
    }

    .icon {
      width: 18px;
      height: 18px;
      min-width: 18px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      color: white;
      background: var(--ptk-color-highlight-900);
    }

    .toast.success .icon {
      background: var(--ptk-color-success-900);
    }

    .toast.warning .icon {
      background: var(--ptk-color-warning-900);
    }

    .toast.error .icon {
      background: var(--ptk-color-error-900);
    }

    .body {
      min-width: 0;
      display: grid;
      gap: 2px;
      align-items: start;
    }

    .title {
      margin: 0;
      font-size: 11px;
      font-weight: var(--ptk-font-weight-bold);
      line-height: 1.2;
      color: var(--ptk-text-primary);
    }

    .message {
      margin: 0;
      font-size: 11px;
      line-height: 1.25;
      color: var(--ptk-text-secondary);
      word-break: break-word;
    }

    .dismiss {
      width: 22px;
      height: 22px;
      min-height: 22px;
      border-radius: 999px;
      border: none;
      background: transparent;
      color: var(--ptk-text-muted);
      font: inherit;
      font-size: 15px;
      line-height: 1;
      padding: 0;
      display: grid;
      place-items: center;
      cursor: pointer;
    }
  `;

  @property({ attribute: false })
  accessor toasts: V4Toast[] = [];

  protected render() {
    if (this.toasts.length === 0) {
      return nothing;
    }

    return html`
      <div class="stack" aria-label="Toast notifications">
        ${this.toasts.map(
          (toast) => html`
            <section class=${`toast ${toast.tone}`} role="status" aria-live="polite" aria-label="Toast">
              <span class="icon" aria-hidden="true">${this.iconSymbolForTone(toast.tone)}</span>
              <div class="body">
                <p class="title">${this.titleForTone(toast.tone)}</p>
                <p class="message">${toast.message}</p>
              </div>
              <button
                class="dismiss"
                type="button"
                aria-label="Dismiss toast"
                @click=${() => this.handleDismiss(toast.id)}
              >
                ×
              </button>
            </section>
          `
        )}
      </div>
    `;
  }

  private handleDismiss(id: string): void {
    this.dispatchEvent(
      new CustomEvent("ptk-toast-dismiss", {
        detail: { id },
        bubbles: true,
        composed: true
      })
    );
  }

  private titleForTone(tone: V4Toast["tone"]): string {
    switch (tone) {
      case "success":
        return "Success";
      case "warning":
        return "Warning";
      case "error":
        return "Error";
      case "info":
      default:
        return "Info";
    }
  }

  private iconSymbolForTone(tone: V4Toast["tone"]): string {
    switch (tone) {
      case "success":
        return "✓";
      case "warning":
        return "!";
      case "error":
        return "!";
      case "info":
      default:
        return "i";
    }
  }
}
