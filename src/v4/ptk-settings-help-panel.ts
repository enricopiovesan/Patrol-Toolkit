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
      background: rgb(31 32 36 / 0.35);
    }

    .surface {
      position: absolute;
      display: grid;
      gap: var(--ptk-space-3);
      border: 1px solid var(--ptk-border-default);
      background: var(--ptk-surface-card);
      box-shadow: var(--ptk-shadow-md);
      color: var(--ptk-text-primary);
      overflow: auto;
    }

    .surface.small {
      left: var(--ptk-space-3);
      right: var(--ptk-space-3);
      bottom: var(--ptk-space-3);
      top: auto;
      max-height: min(78vh, 640px);
      border-radius: var(--ptk-radius-lg);
      padding: var(--ptk-space-3);
    }

    .surface.medium {
      top: var(--ptk-space-3);
      bottom: var(--ptk-space-3);
      left: var(--ptk-space-3);
      width: min(420px, calc(100vw - (var(--ptk-space-3) * 2)));
      border-radius: var(--ptk-radius-md);
      padding: var(--ptk-space-3);
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

    .section {
      border: 1px solid var(--ptk-border-default);
      border-radius: var(--ptk-radius-md);
      background: var(--ptk-surface-card);
      padding: var(--ptk-space-3);
      display: grid;
      gap: var(--ptk-space-2);
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

    .segmented {
      display: inline-grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--ptk-space-1);
      padding: var(--ptk-space-1);
      border-radius: var(--ptk-radius-pill);
      border: 1px solid var(--ptk-border-default);
      background: var(--ptk-surface-subtle);
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

    .offline-list {
      display: grid;
      gap: var(--ptk-space-2);
    }

    .offline-item {
      border: 1px solid var(--ptk-border-default);
      border-radius: var(--ptk-radius-sm);
      background: var(--ptk-surface-card);
      padding: var(--ptk-space-2);
      display: grid;
      gap: 4px;
    }

    .offline-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ptk-space-2);
    }

    .offline-label {
      margin: 0;
      font-size: var(--ptk-font-body-s-size);
      color: var(--ptk-text-primary);
    }

    .badge {
      border-radius: var(--ptk-radius-pill);
      border: 1px solid var(--ptk-border-default);
      padding: 2px 8px;
      font-size: 10px;
      font-weight: var(--ptk-font-weight-semibold);
      line-height: 1.2;
      white-space: nowrap;
    }

    .badge.success {
      background: var(--ptk-color-success-100);
      color: var(--ptk-color-success-900);
      border-color: color-mix(in srgb, var(--ptk-color-success-500) 55%, white);
    }

    .badge.warning {
      background: var(--ptk-color-warning-100);
      color: var(--ptk-color-warning-900);
      border-color: color-mix(in srgb, var(--ptk-color-warning-500) 55%, white);
    }

    .checklist {
      display: grid;
      gap: var(--ptk-space-1);
    }

    .check-item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: var(--ptk-space-2);
      align-items: center;
      font-size: var(--ptk-font-body-s-size);
      color: var(--ptk-text-primary);
    }

    .check-item input {
      margin: 0;
    }

    .blocked {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 4px;
      color: var(--ptk-text-secondary);
      font-size: var(--ptk-font-body-s-size);
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
            <p class="subtitle">v ${this.appVersion}</p>
          </div>
          <button class="close" type="button" @click=${this.handleClose} aria-label="Close settings">
            Close
          </button>
        </header>

        <section class="section" aria-label="Theme settings">
          <h3 class="section-title">Theme</h3>
          <div class="segmented" role="tablist" aria-label="Theme switcher">
            ${this.renderThemeButton("default", "Default")}
            ${this.renderThemeButton("high-contrast", "High contrast")}
          </div>
        </section>

        <section class="section" aria-label="App updates and installation">
          <h3 class="section-title">App</h3>
          <div class="row">
            ${this.isInstalled
              ? nothing
              : html`<button class="button primary" type="button" @click=${this.handleInstallApp}>Install App</button>`}
            <button class="button" type="button" @click=${this.handleCheckAppUpdates}>Check for updates</button>
            ${this.appUpdateTargetVersion
              ? html`<button class="button primary" type="button" @click=${this.handleApplyAppUpdate}>Update the App</button>`
              : nothing}
          </div>
          ${this.installHint ? html`<p class="muted">${this.installHint}</p>` : nothing}
          ${this.appUpdateResult
            ? html`
                <div class="result">
                  ${this.appUpdateResult}
                  ${this.appUpdateTargetVersion
                    ? html`
                        <div><strong>Target:</strong> ${this.appUpdateTargetVersion}</div>
                        ${this.appUpdateSummary
                          ? html`<div><strong>Summary:</strong> ${this.appUpdateSummary}</div>`
                          : nothing}
                      `
                    : nothing}
                </div>
              `
            : nothing}
        </section>

        <section class="section" aria-label="Offline resorts">
          <h3 class="section-title">Offline resorts</h3>
          <div class="offline-list">
            ${this.offlineRows.length > 0
              ? this.offlineRows.map(
                  (row) => html`
                    <div class="offline-item" aria-label=${`Offline resort ${row.label}`}>
                      <div class="offline-top">
                        <p class="offline-label">${row.label}</p>
                        <span class=${`badge ${row.badgeTone}`}>${row.badge}</span>
                      </div>
                    </div>
                  `
                )
              : html`<p class="muted">No offline resorts on this device.</p>`}
          </div>
          <div class="row">
            <button class="button" type="button" @click=${this.handleCheckPackUpdates}>Check pack updates</button>
            <button class="button primary" type="button" @click=${this.handleApplySelectedPackUpdates}>
              Update all selected resorts data
            </button>
          </div>
          ${this.packUpdateCandidates.length > 0
            ? html`
                <div class="checklist" aria-label="Selectable pack updates">
                  ${this.packUpdateCandidates.map(
                    (candidate) => html`
                      <label class="check-item">
                        <input
                          type="checkbox"
                          data-resort-id=${candidate.resortId}
                          .checked=${candidate.selected}
                          @change=${this.handleCandidateToggle}
                        />
                        <span>${candidate.resortName} · ${candidate.version}</span>
                      </label>
                    `
                  )}
                </div>
              `
            : nothing}
          ${this.blockedPackUpdates.length > 0
            ? html`<ul class="blocked">${this.blockedPackUpdates.map((item) => html`<li>${item}</li>`)}</ul>`
            : nothing}
          ${this.packUpdateResult ? html`<div class="result">${this.packUpdateResult}</div>` : nothing}
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

  private readonly handleCheckPackUpdates = (): void => {
    this.dispatchEvent(new CustomEvent("ptk-settings-check-pack-updates", { bubbles: true, composed: true }));
  };

  private readonly handleApplySelectedPackUpdates = (): void => {
    this.dispatchEvent(new CustomEvent("ptk-settings-apply-pack-updates", { bubbles: true, composed: true }));
  };

  private readonly handleCandidateToggle = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement;
    const resortId = input.dataset["resortId"];
    if (!resortId) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent("ptk-settings-toggle-pack-candidate", {
        detail: { resortId, selected: input.checked },
        bubbles: true,
        composed: true
      })
    );
  };
}
