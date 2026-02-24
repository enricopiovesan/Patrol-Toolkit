import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { v4DesignTokens } from "./design-tokens";
import type { ViewportMode } from "./viewport";
import type { V4OfflineResortRow, V4PackUpdateCandidate } from "./settings-help-model";

@customElement("ptk-settings-help-panel")
export class PtkSettingsHelpPanel extends LitElement {
  static styles = css`
    ${v4DesignTokens}

    :host {
      position: fixed;
      inset: 0;
      display: block;
      z-index: 40;
      font-family: var(--ptk-font-family-base);
    }

    .backdrop {
      position: absolute;
      inset: 0;
      background: rgb(31 32 36 / 0.22);
    }

    .surface {
      position: absolute;
      display: grid;
      gap: var(--ptk-space-3);
      align-content: start;
      grid-auto-rows: max-content;
      background: var(--ptk-surface-card);
      box-shadow: var(--ptk-shadow-md);
      color: var(--ptk-text-primary);
      overflow: auto;
      border: none;
    }

    .surface.small {
      top: 0;
      bottom: 0;
      right: 0;
      left: auto;
      width: min(88vw, 380px);
      border-radius: 0;
      padding: 18px;
      box-shadow: -10px 0 26px rgb(15 23 42 / 0.14);
    }

    .surface.medium {
      top: 0;
      bottom: 0;
      right: 0;
      left: auto;
      width: min(420px, 54vw);
      border-radius: 0;
      padding: 18px;
      box-shadow: -8px 0 24px rgb(15 23 42 / 0.14);
    }

    .surface.large {
      top: var(--ptk-space-3);
      bottom: var(--ptk-space-3);
      right: var(--ptk-space-3);
      width: min(440px, calc(100vw - (var(--ptk-space-3) * 2)));
      border-radius: var(--ptk-radius-md);
      padding: var(--ptk-space-3);
    }

    .header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--ptk-space-2);
      align-items: start;
    }

    .surface.small .header,
    .surface.medium .header {
      padding-right: 2px;
      gap: 8px;
    }

    .title {
      margin: 0;
      font-family: var(--ptk-font-family-heading);
      font-size: var(--ptk-font-heading-h3-size);
      font-weight: var(--ptk-font-weight-extrabold);
    }

    .subtitle {
      margin: 2px 0 0;
      color: var(--ptk-text-secondary);
      font-size: var(--ptk-font-body-s-size);
    }

    .version-line {
      margin: 2px 0 0;
      color: var(--ptk-text-secondary);
      font-size: var(--ptk-font-body-s-size);
      line-height: 1.3;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: baseline;
    }

    .version-line .ok {
      color: var(--ptk-text-secondary);
    }

    .version-line .update {
      color: var(--ptk-color-success-900);
    }

    .close {
      min-height: var(--ptk-size-control-sm);
      min-width: var(--ptk-size-control-sm);
      border-radius: var(--ptk-radius-pill);
      border: 1px solid var(--ptk-control-border);
      background: var(--ptk-control-bg);
      color: var(--ptk-control-fg);
      font: inherit;
      font-size: var(--ptk-font-action-m-size);
      font-weight: var(--ptk-font-weight-semibold);
      cursor: pointer;
      padding: 0 10px;
    }

    .close.icon {
      min-width: 34px;
      min-height: 34px;
      width: 34px;
      height: 34px;
      border-radius: 999px;
      padding: 0;
      font-size: 22px;
      line-height: 1;
      border: none;
      background: transparent;
    }

    .section {
      border: none;
      border-radius: 0;
      background: transparent;
      padding: 0;
      display: grid;
      gap: var(--ptk-space-2);
    }

    .surface.small .section {
      border-radius: 0;
      padding: 0;
      gap: 10px;
    }

    .surface.medium .section {
      border-radius: 0;
      padding: 0;
      gap: 10px;
    }

    .section-title {
      margin: 0;
      font-family: var(--ptk-font-family-heading);
      font-size: var(--ptk-font-heading-h4-size);
      font-weight: var(--ptk-font-weight-bold);
    }

    .muted {
      margin: 0;
      color: var(--ptk-text-secondary);
      font-size: var(--ptk-font-body-s-size);
      line-height: 1.4;
    }

    .result {
      border: 1px solid var(--ptk-border-default);
      border-radius: var(--ptk-radius-sm);
      background: var(--ptk-surface-subtle);
      padding: var(--ptk-space-2);
      font-size: var(--ptk-font-body-s-size);
      color: var(--ptk-text-primary);
      line-height: 1.4;
      word-break: break-word;
    }

    .row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ptk-space-2);
      align-items: center;
    }

    .stack {
      display: grid;
      gap: 10px;
    }

    .divider {
      height: 1px;
      background: var(--ptk-border-default);
      margin: 2px 0;
    }

    .segmented {
      display: inline-grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--ptk-space-1);
      padding: var(--ptk-space-1);
      border-radius: var(--ptk-radius-pill);
      border: 1px solid var(--ptk-border-default);
      background: var(--ptk-surface-subtle);
    }

    .surface.small .segmented {
      width: 100%;
      display: grid;
    }

    .surface.small .segmented button {
      min-height: 44px;
      font-size: 14px;
    }

    .theme-section {
      gap: 4px;
      grid-template-columns: auto 1fr;
      align-items: center;
    }

    .theme-section .section-title {
      font-size: 12px;
      font-weight: var(--ptk-font-weight-bold);
      color: var(--ptk-text-secondary);
      margin-right: 6px;
    }

    .theme-section .segmented {
      width: auto;
      max-width: none;
      justify-self: end;
      padding: 2px;
      gap: 2px;
      border-radius: 9px;
    }

    .theme-section .segmented button {
      min-height: 24px;
      font-size: 10px;
      border-radius: 7px;
      font-weight: var(--ptk-font-weight-semibold);
      padding: 0 7px;
      white-space: nowrap;
    }

    .surface.small .theme-section .segmented,
    .surface.medium .theme-section .segmented {
      max-width: none;
    }

    .surface.small .theme-section .segmented button,
    .surface.medium .theme-section .segmented button {
      min-width: 84px;
    }

    .surface.small .theme-section,
    .surface.medium .theme-section {
      grid-template-columns: auto auto;
      justify-content: space-between;
      align-items: center;
    }

    .segmented button,
    .button {
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

    .segmented button {
      border-color: transparent;
      background: transparent;
    }

    .segmented button[selected] {
      background: var(--ptk-control-selected-bg);
      color: var(--ptk-control-selected-fg);
      border-color: var(--ptk-control-selected-border);
    }

    .button.primary {
      background: var(--ptk-control-selected-bg);
      border-color: var(--ptk-control-selected-border);
      color: var(--ptk-control-selected-fg);
    }

    .button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .button.full {
      width: 100%;
      justify-content: center;
    }

    .offline-list {
      display: grid;
      gap: var(--ptk-space-2);
    }

    .surface.small .offline-list {
      gap: 10px;
    }

    .offline-item {
      border: 1px solid var(--ptk-border-default);
      border-radius: var(--ptk-radius-sm);
      background: #ffffff;
      padding: 12px 14px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
    }

    .surface.small .offline-item {
      border-radius: 14px;
      padding: 12px 14px;
    }

    .offline-label {
      margin: 0;
      font-size: var(--ptk-font-body-m-size);
      color: var(--ptk-text-primary);
    }

    .offline-item.selected {
      background: var(--ptk-color-success-100);
      border-color: color-mix(in srgb, var(--ptk-color-success-500) 35%, white);
    }

    .offline-item.update-available {
      background: #e9eefb;
      border-color: #d8e2fb;
    }

    .offline-item.status-ready {
      background: #ffffff;
    }

    .offline-meta {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      justify-content: flex-end;
      min-width: 0;
    }

    .status-chip {
      border-radius: var(--ptk-radius-pill);
      border: 1px solid var(--ptk-border-default);
      padding: 2px 8px;
      font-size: 10px;
      font-weight: var(--ptk-font-weight-semibold);
      line-height: 1.2;
      white-space: nowrap;
      color: var(--ptk-text-secondary);
      background: #ffffff;
    }

    .status-chip.success {
      color: var(--ptk-color-success-900);
      border-color: color-mix(in srgb, var(--ptk-color-success-500) 55%, white);
      background: var(--ptk-color-success-100);
    }

    .status-chip.warning {
      color: #bf5b17;
      border-color: #f8c8a7;
      background: #fff3ea;
    }

    .checkmark {
      color: var(--ptk-control-selected-bg);
      font-weight: var(--ptk-font-weight-bold);
      font-size: 16px;
      line-height: 1;
    }

  `;

  @property({ type: String })
  accessor viewport: ViewportMode = "small";

  @property({ type: String })
  accessor appVersion = "";

  @property({ type: String })
  accessor theme: "default" | "high-contrast" = "default";

  @property({ type: Boolean })
  accessor isInstalled = false;

  @property({ type: String })
  accessor installHint = "";

  @property({ type: String })
  accessor appUpdateResult = "";

  @property({ type: String })
  accessor appUpdateSummary = "";

  @property({ type: String })
  accessor appUpdateTargetVersion = "";

  @property({ type: String })
  accessor packUpdateResult = "";

  @property({ attribute: false })
  accessor packUpdateCandidates: V4PackUpdateCandidate[] = [];

  @property({ attribute: false })
  accessor offlineRows: V4OfflineResortRow[] = [];

  @property({ attribute: false })
  accessor blockedPackUpdates: string[] = [];

  protected render() {
    return html`
      <div class="backdrop" @click=${this.handleClose} aria-hidden="true"></div>
      <section class=${`surface ${this.viewport}`} aria-label="Settings and Help">
        <header class="header">
          <div>
            <h2 class="title">Patrol Toolkit</h2>
            <p class="version-line">
              <span class="ok">v ${this.appVersion}</span>
              ${this.appUpdateTargetVersion || this.appUpdateSummary
                ? html`<span>·</span><span class="update">${this.appUpdateSummary || "new version available"}</span>`
                : nothing}
            </p>
          </div>
          ${this.viewport === "small"
            ? html`
                <button class="close icon" type="button" @click=${this.handleClose} aria-label="Close settings">
                  ×
                </button>
              `
            : html`
                <button class="close" type="button" @click=${this.handleClose} aria-label="Close settings">
                  Close
                </button>
              `}
        </header>

        <section class="section" aria-label="App updates and installation">
          <div class="stack">
            ${this.appUpdateTargetVersion
              ? html`<button class="button full" type="button" @click=${this.handleApplyAppUpdate}>Update the App</button>`
              : nothing}
            ${this.isInstalled
              ? nothing
              : html`<button class="button primary full" type="button" @click=${this.handleInstallApp}>Install App</button>`}
            <button class="button full" type="button" @click=${this.handleCheckAppUpdates}>Check for updates</button>
          </div>
          ${this.installHint ? html`<p class="muted">${this.installHint}</p>` : nothing}
          ${this.appUpdateResult ? html`<div class="result">${this.appUpdateResult}</div>` : nothing}
        </section>

        <div class="divider" aria-hidden="true"></div>

        <section class="section" aria-label="Offline resorts">
          <h3 class="section-title">Offline resorts</h3>
          <div class="offline-list">
            ${this.offlineRows.length > 0
              ? this.offlineRows.map(
                  (row) => {
                    const candidate = this.packUpdateCandidates.find((item) => item.resortId === row.resortId);
                    const selected = Boolean(candidate?.selected);
                    const isUpdate = row.badgeTone === "warning";
                    const itemClass = classMap({
                      "offline-item": true,
                      selected,
                      "update-available": !selected && isUpdate,
                      "status-ready": !selected && !isUpdate
                    });
                    return html`
                      <div class=${itemClass} aria-label=${`Offline resort ${row.label}`}>
                        <p class="offline-label">${row.label}</p>
                        <div class="offline-meta">
                          ${selected
                            ? html`<span class="checkmark" aria-hidden="true">✓</span>`
                            : html`<span class=${`status-chip ${row.badgeTone}`}>${row.badge}</span>`}
                        </div>
                      </div>
                    `;
                  }
                )
              : html`<p class="muted">No offline resorts on this device.</p>`}
          </div>
        </section>

        <div class="divider" aria-hidden="true"></div>

        <section class="section theme-section" aria-label="Theme settings">
          <h3 class="section-title">Theme</h3>
          <div class="segmented" role="tablist" aria-label="Theme switcher">
            ${this.renderThemeButton("default", "Default")}
            ${this.renderThemeButton("high-contrast", "High contrast")}
          </div>
        </section>
      </section>
    `;
  }

  private renderThemeButton(themeId: "default" | "high-contrast", label: string) {
    const selected = this.theme === themeId;
    return html`
      <button
        type="button"
        role="tab"
        aria-selected=${selected ? "true" : "false"}
        ?selected=${selected}
        @click=${() => this.dispatchThemeSelect(themeId)}
      >
        ${label}
      </button>
    `;
  }

  private dispatchThemeSelect(theme: "default" | "high-contrast"): void {
    this.dispatchEvent(new CustomEvent("ptk-settings-theme-select", { detail: { theme }, bubbles: true, composed: true }));
  }

  private readonly handleClose = (): void => {
    this.dispatchEvent(new CustomEvent("ptk-settings-close", { bubbles: true, composed: true }));
  };

  private readonly handleInstallApp = (): void => {
    this.dispatchEvent(new CustomEvent("ptk-settings-install-app", { bubbles: true, composed: true }));
  };

  private readonly handleCheckAppUpdates = (): void => {
    this.dispatchEvent(new CustomEvent("ptk-settings-check-app-updates", { bubbles: true, composed: true }));
  };

  private readonly handleApplyAppUpdate = (): void => {
    this.dispatchEvent(new CustomEvent("ptk-settings-apply-app-update", { bubbles: true, composed: true }));
  };

}

function classMap(classes: Record<string, boolean>): string {
  return Object.entries(classes)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name)
    .join(" ");
}
