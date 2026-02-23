import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./ptk-select-resort-page";
import "./ptk-resort-page";
import { v4DesignTokens } from "./design-tokens";
import { createInitialToolPanelState } from "./tool-panel-state";
import { DEFAULT_V4_THEME } from "./theme";
import { readStoredV4Theme, writeStoredV4Theme } from "./theme-preferences";
import { classifyViewportWidth, type ViewportMode } from "./viewport";
import {
  loadResortCatalog,
  selectLatestEligibleVersions,
  type SelectableResortPack
} from "../resort-pack/catalog";
import { ResortPackRepository, type ResortPackListItem } from "../resort-pack/repository";
import { buildSelectResortPageViewModel } from "./select-resort-model";
import { buildResortPageViewModel } from "./resort-page-model";
import {
  createInitialResortPageUiState,
  selectResortPageTab,
  setResortPagePanelOpen,
  syncResortPageUiStateForViewport,
  toggleResortPageFullscreen,
  type ResortPageUiState
} from "./resort-page-state";
import type { ResortPack } from "../resort-pack/types";

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
      overflow-x: clip;
    }

    .root {
      box-sizing: border-box;
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

    .meta--tight {
      margin-top: 0;
    }

    .nav-button {
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

    .nav-button--primary {
      background: var(--ptk-control-selected-bg);
      border-color: var(--ptk-control-selected-border);
      color: var(--ptk-control-selected-fg);
    }

    .message-card {
      border: 1px dashed var(--ptk-border-default);
      border-radius: var(--ptk-radius-md);
      background: var(--ptk-surface-card);
      color: var(--ptk-text-secondary);
      padding: var(--ptk-space-3);
      font-size: var(--ptk-font-body-m-size);
    }

    .message-card--error {
      border-style: solid;
      border-color: var(--ptk-color-error-500);
      background: var(--ptk-color-error-100);
      color: var(--ptk-color-error-900);
    }

    .action-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ptk-space-2);
    }
  `;

  @state()
  private accessor viewport: ViewportMode = "large";

  @state()
  private accessor theme = DEFAULT_V4_THEME;

  @state()
  private accessor page: "select-resort" | "resort" | "install-blocking" = "select-resort";

  @state()
  private accessor selectedResortId: string | null = null;

  @state()
  private accessor selectedResortName = "";

  @state()
  private accessor selectedResortSourceVersion = "";

  @state()
  private accessor selectedResortPack: ResortPack | null = null;

  @state()
  private accessor resortPageUiState: ResortPageUiState = createInitialResortPageUiState("large");

  @state()
  private accessor installBlockingError = "";

  @state()
  private accessor searchQuery = "";

  @state()
  private accessor catalogEntries: SelectableResortPack[] = [];

  @state()
  private accessor installedPacks: ResortPackListItem[] = [];

  @state()
  private accessor selectPageLoading = true;

  @state()
  private accessor selectPageError = "";

  @state()
  private accessor selectPageMessage = "";

  private repository: ResortPackRepository | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.theme = readStoredV4Theme(safeStorage());
    this.syncViewport();
    window.addEventListener("resize", this.handleWindowResize);
    void this.initializeData();
  }

  disconnectedCallback(): void {
    window.removeEventListener("resize", this.handleWindowResize);
    this.repository?.close();
    this.repository = null;
    super.disconnectedCallback();
  }

  protected render() {
    const panelState = createInitialToolPanelState(this.viewport);
    const resortPanelOpen = this.resortPageUiState.panelOpen;
    const fullscreenSupported = panelState.fullscreenSupported;

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
            <span class="chip">panel-open=${this.page === "resort" ? (resortPanelOpen ? "yes" : "no") : "n/a"}</span>
            <span class="chip">fullscreen-supported=${fullscreenSupported ? "yes" : "no"}</span>
            <span class="chip">fullscreen-active=${this.page === "resort" ? (this.resortPageUiState.fullscreen ? "yes" : "no") : "n/a"}</span>
            <span class="chip">page=${this.page}</span>
          </div>
        </header>
        ${this.page === "select-resort"
          ? html`${this.renderSelectResortPage()}`
          : this.page === "install-blocking"
            ? html`${this.renderInstallBlockingState()}`
            : html`${this.renderResortPage(resortPanelOpen, fullscreenSupported)}`}
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

  private renderSelectResortPage() {
    const model = buildSelectResortPageViewModel(this.catalogEntries, this.installedPacks, this.searchQuery);
    return html`
      <ptk-select-resort-page
        .viewport=${this.viewport}
        .query=${this.searchQuery}
        .cards=${model.cards}
        .loading=${this.selectPageLoading}
        .errorMessage=${this.selectPageError}
        .nonBlockingMessage=${this.selectPageMessage}
        @ptk-search-change=${this.handleSearchChange}
        @ptk-resort-select=${this.handleResortSelect}
      ></ptk-select-resort-page>
    `;
  }

  private renderResortPage(panelOpen: boolean, fullscreenSupported: boolean) {
    if (!this.selectedResortPack) {
      return html`
        <section aria-label="Resort page unavailable" class="header">
          <h2 class="title">${this.selectedResortName || "Selected resort"}</h2>
          <p class="subtitle">This resort is selected, but local resort data is not available on this device.</p>
          <div class="action-row">
            <button class="nav-button" type="button" @click=${this.handleBackToSelect}>
              Back to Select Resort
            </button>
          </div>
        </section>
      `;
    }

    const vm = buildResortPageViewModel({
      viewport: this.viewport,
      resortName: this.selectedResortName,
      sourceVersion: this.selectedResortSourceVersion,
      pack: this.selectedResortPack,
      selectedTab: this.resortPageUiState.selectedTab,
      panelOpen,
      fullscreenSupported,
      fullscreenActive: this.resortPageUiState.fullscreen
    });

    return html`
      <ptk-resort-page
        .viewport=${vm.viewport}
        .header=${vm.header}
        .selectedTab=${vm.selectedTab}
        .panelOpen=${vm.panelOpen}
        .fullscreenSupported=${vm.fullscreenSupported}
        .fullscreenActive=${vm.fullscreenActive}
        .shellTheme=${this.theme}
        @ptk-resort-back=${this.handleBackToSelect}
        @ptk-resort-tab-select=${this.handleResortTabSelect}
        @ptk-resort-toggle-panel=${this.handleResortTogglePanel}
        @ptk-resort-toggle-fullscreen=${this.handleResortToggleFullscreen}
      ></ptk-resort-page>
    `;
  }

  private renderInstallBlockingState() {
    return html`
      <section aria-label="Resort install required" class="header">
        <h2 class="title">${this.selectedResortName || "Selected resort"}</h2>
        <p class="subtitle">
          This resort pack is not offline-ready on this device. A blocking install/download flow is required before
          opening the Resort Page.
        </p>
        <div class="meta meta--tight">
          <span class="chip">selected=${this.selectedResortId ?? "none"}</span>
          <span class="chip">state=install-blocking</span>
        </div>
        ${this.installBlockingError
          ? html`<div class="message-card message-card--error">${this.installBlockingError}</div>`
          : html``}
        <div class="action-row">
          <button class="nav-button nav-button--primary" type="button" @click=${this.handleInstallRetry}>
            Retry
          </button>
          ${this.installBlockingError
            ? html`
                <button class="nav-button" type="button" @click=${this.handleInstallCancel}>
                  Cancel
                </button>
              `
            : html``}
        </div>
      </section>
    `;
  }

  private syncViewport(): void {
    const nextViewport = classifyViewportWidth(window.innerWidth);
    if (nextViewport !== this.viewport) {
      this.viewport = nextViewport;
      this.resortPageUiState = syncResortPageUiStateForViewport(this.resortPageUiState, nextViewport);
    } else {
      this.resortPageUiState = syncResortPageUiStateForViewport(this.resortPageUiState, this.viewport);
    }
  }

  private async initializeData(): Promise<void> {
    this.selectPageLoading = true;
    this.selectPageError = "";
    this.selectPageMessage = "";
    try {
      this.repository = await ResortPackRepository.open();
      const [catalog, installedPacks, activePackId] = await Promise.all([
        loadResortCatalog(),
        this.repository.listPacks(),
        this.repository.getActivePackId()
      ]);

      this.catalogEntries = selectLatestEligibleVersions(catalog);
      this.installedPacks = installedPacks;

      if (activePackId) {
        const activeEntry = this.catalogEntries.find((entry) => entry.resortId === activePackId);
        if (activeEntry) {
          await this.openInstalledResort(activeEntry.resortId, activeEntry.resortName);
        } else {
          this.page = "select-resort";
          this.selectPageMessage =
            "Previous resort could not be restored. Select a resort to continue.";
        }
      } else {
        this.page = "select-resort";
      }
    } catch (error) {
      this.page = "select-resort";
      this.selectPageError = toMessage(error);
    } finally {
      this.selectPageLoading = false;
    }
  }

  private readonly handleSearchChange = (event: CustomEvent<{ value: string }>): void => {
    this.searchQuery = event.detail.value;
  };

  private readonly handleResortSelect = async (event: CustomEvent<{ resortId: string }>): Promise<void> => {
    const resortId = event.detail.resortId;
    const entry = this.catalogEntries.find((candidate) => candidate.resortId === resortId);
    this.selectedResortId = resortId;
    this.selectedResortName = entry?.resortName ?? resortId;
    this.selectedResortSourceVersion = entry?.version ?? "";
    this.selectedResortPack = null;
    this.installBlockingError = "";
    const isInstalled = this.installedPacks.some((pack) => pack.id === resortId);
    this.page = isInstalled ? "resort" : "install-blocking";
    if (this.repository) {
      const didPersist = await this.repository.setActivePackId(resortId);
      if (!didPersist) {
        // v4 Slice 4 supports selecting non-installed resorts before install flow integration.
      }
    }
    if (isInstalled) {
      await this.openInstalledResort(resortId, this.selectedResortName);
    }
  };

  private readonly handleBackToSelect = (): void => {
    this.page = "select-resort";
    this.searchQuery = "";
    this.installBlockingError = "";
    this.selectedResortPack = null;
    this.resortPageUiState = createInitialResortPageUiState(this.viewport);
  };

  private readonly handleInstallRetry = (): void => {
    this.installBlockingError =
      "Install/download flow is not wired in /new yet. This will be implemented after Select Resort UI completion.";
  };

  private readonly handleInstallCancel = (): void => {
    this.page = "select-resort";
    this.searchQuery = "";
    this.installBlockingError = "";
  };

  private readonly handleResortTabSelect = (event: CustomEvent<{ tabId: "my-location" | "runs-check" | "sweeps" }>) => {
    this.resortPageUiState = selectResortPageTab(this.resortPageUiState, event.detail.tabId);
  };

  private readonly handleResortTogglePanel = (): void => {
    this.resortPageUiState = setResortPagePanelOpen(this.resortPageUiState, !this.resortPageUiState.panelOpen);
  };

  private readonly handleResortToggleFullscreen = (): void => {
    const fullscreenSupported = createInitialToolPanelState(this.viewport).fullscreenSupported;
    this.resortPageUiState = toggleResortPageFullscreen(this.resortPageUiState, this.viewport, fullscreenSupported);
  };

  private async openInstalledResort(resortId: string, resortName: string): Promise<void> {
    this.selectedResortId = resortId;
    this.selectedResortName = resortName;
    this.installBlockingError = "";
    this.resortPageUiState = createInitialResortPageUiState(this.viewport);

    const installedMeta = this.installedPacks.find((pack) => pack.id === resortId);
    this.selectedResortSourceVersion = installedMeta?.sourceVersion ?? "";

    const pack = this.repository ? await this.repository.getPack(resortId) : null;
    this.selectedResortPack = pack;
    this.page = "resort";
  }
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function toMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Unable to load resorts.";
}
