import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./ptk-select-resort-page";
import "./ptk-resort-page";
import "./ptk-settings-help-panel";
import { v4DesignTokens } from "./design-tokens";
import { createInitialToolPanelState } from "./tool-panel-state";
import { DEFAULT_V4_THEME } from "./theme";
import { readStoredV4Theme, writeStoredV4Theme } from "./theme-preferences";
import { readStoredLastKnownPosition, writeStoredLastKnownPosition } from "./position-cache";
import { classifyViewportWidth, type ViewportMode } from "./viewport";
import { APP_VERSION } from "../app-version";
import { requestPackAssetPrecache } from "../pwa/precache-pack-assets";
import { composeRadioPhrase } from "../radio/phrase";
import {
  isCatalogVersionCompatible,
  loadPackFromCatalogEntry,
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
import type { LngLat } from "../resort-pack/types";
import {
  applyGpsError,
  applyGpsPosition,
  createInitialGpsUiState,
  dismissGpsGuidanceModal,
  requestGpsRetry,
  type GpsErrorKind,
  type V4GpsUiState
} from "./gps-ui-state";
import {
  buildOfflineResortRows,
  clearPackCandidateSelections,
  togglePackCandidateSelection,
  type V4PackUpdateCandidate
} from "./settings-help-model";

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
  private accessor settingsPanelOpen = false;

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

  @state()
  private accessor installHint = "Install from browser menu (iOS: Share > Add to Home Screen).";

  @state()
  private accessor appUpdateResult = "";

  @state()
  private accessor appUpdateTargetVersion: string | null = null;

  @state()
  private accessor appUpdateSummary = "";

  @state()
  private accessor packUpdateResult = "";

  @state()
  private accessor packUpdateCandidates: V4PackUpdateCandidate[] = [];

  @state()
  private accessor blockedPackUpdates: string[] = [];

  @state()
  private accessor gpsUiState: V4GpsUiState = createInitialGpsUiState();

  @state()
  private accessor phraseOutputText = "No phrase generated yet.";

  @state()
  private accessor phraseStatusText = "Waiting for GPS position.";

  @state()
  private accessor phraseGenerating = false;

  @state()
  private accessor mapUiState: "loading" | "ready" | "error" = "loading";

  @state()
  private accessor mapStateMessage = "Loading map…";

  private latestResortPosition: { coordinates: LngLat; accuracy: number } | null = null;

  private repository: ResortPackRepository | null = null;
  private deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
  private readonly onBeforeInstallPrompt = (event: Event) => {
    if (!isBeforeInstallPromptEvent(event)) {
      return;
    }
    event.preventDefault();
    this.deferredInstallPrompt = event;
    this.installHint = "Install available. Tap 'Install App'.";
  };
  private readonly onAppInstalled = () => {
    this.deferredInstallPrompt = null;
    this.installHint = "App installed. Open from home screen.";
  };

  connectedCallback(): void {
    super.connectedCallback();
    this.theme = readStoredV4Theme(safeStorage());
    this.syncViewport();
    window.addEventListener("resize", this.handleWindowResize);
    window.addEventListener("beforeinstallprompt", this.onBeforeInstallPrompt);
    window.addEventListener("appinstalled", this.onAppInstalled);
    void this.initializeData();
  }

  disconnectedCallback(): void {
    window.removeEventListener("resize", this.handleWindowResize);
    window.removeEventListener("beforeinstallprompt", this.onBeforeInstallPrompt);
    window.removeEventListener("appinstalled", this.onAppInstalled);
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
          <p class="subtitle">v4 UI path in progress. Settings/Help owns theme, install, and update actions.</p>
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
        ${this.settingsPanelOpen && this.page === "resort" ? html`${this.renderSettingsHelpPanel()}` : html``}
      </div>
    `;
  }

  private readonly handleWindowResize = (): void => {
    this.syncViewport();
  };

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
        .pack=${this.selectedResortPack}
        .renderLiveMap=${shouldRenderLiveMap()}
        .gpsStatusText=${this.gpsUiState.statusText}
        .gpsDisabled=${this.gpsUiState.status === "disabled"}
        .gpsGuidanceModalOpen=${this.gpsUiState.guidanceModalOpen}
        .gpsGuidanceTitle=${this.gpsUiState.guidanceTitle}
        .gpsGuidanceBody=${this.gpsUiState.guidanceBody}
        .phraseOutputText=${this.phraseOutputText}
        .phraseStatusText=${this.phraseStatusText}
        .phraseGenerating=${this.phraseGenerating}
        .mapState=${this.mapUiState}
        .mapStateMessage=${this.mapStateMessage}
        .selectedTab=${vm.selectedTab}
        .panelOpen=${vm.panelOpen}
        .fullscreenSupported=${vm.fullscreenSupported}
        .fullscreenActive=${vm.fullscreenActive}
        .shellTheme=${this.theme}
        @ptk-resort-back=${this.handleBackToSelect}
        @ptk-resort-tab-select=${this.handleResortTabSelect}
        @ptk-resort-toggle-panel=${this.handleResortTogglePanel}
        @ptk-resort-toggle-fullscreen=${this.handleResortToggleFullscreen}
        @ptk-resort-open-settings=${this.handleOpenSettingsPanel}
        @ptk-resort-position-update=${this.handleResortPositionUpdate}
        @ptk-resort-gps-error=${this.handleResortGpsError}
        @ptk-resort-gps-retry=${this.handleResortGpsRetry}
        @ptk-resort-gps-guidance-dismiss=${this.handleResortGpsGuidanceDismiss}
        @ptk-resort-generate-phrase=${this.handleResortGeneratePhrase}
        @ptk-resort-map-ready=${this.handleResortMapReady}
        @ptk-resort-map-render-error=${this.handleResortMapRenderError}
      ></ptk-resort-page>
    `;
  }

  private renderSettingsHelpPanel() {
    return html`
      <ptk-settings-help-panel
        .viewport=${this.viewport}
        .appVersion=${APP_VERSION}
        .theme=${this.theme}
        .isInstalled=${isStandaloneInstalled()}
        .installHint=${this.installHint}
        .appUpdateResult=${this.appUpdateResult}
        .appUpdateTargetVersion=${this.appUpdateTargetVersion ?? ""}
        .appUpdateSummary=${this.appUpdateSummary}
        .packUpdateResult=${this.packUpdateResult}
        .packUpdateCandidates=${this.packUpdateCandidates}
        .offlineRows=${buildOfflineResortRows({
          installedPacks: this.installedPacks,
          updateCandidates: this.packUpdateCandidates
        })}
        .blockedPackUpdates=${this.blockedPackUpdates}
        @ptk-settings-close=${this.handleCloseSettingsPanel}
        @ptk-settings-theme-select=${this.handleSettingsThemeSelect}
        @ptk-settings-install-app=${this.handleInstallAppFromSettings}
        @ptk-settings-check-app-updates=${this.handleCheckAppUpdatesFromSettings}
        @ptk-settings-apply-app-update=${this.handleApplyAppUpdateFromSettings}
        @ptk-settings-check-pack-updates=${this.handleCheckPackUpdatesFromSettings}
        @ptk-settings-toggle-pack-candidate=${this.handleTogglePackCandidateFromSettings}
        @ptk-settings-apply-pack-updates=${this.handleApplyPackUpdatesFromSettings}
      ></ptk-settings-help-panel>
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
    this.settingsPanelOpen = false;
    this.searchQuery = "";
    this.installBlockingError = "";
    this.selectedResortPack = null;
    this.resortPageUiState = createInitialResortPageUiState(this.viewport);
    this.gpsUiState = createInitialGpsUiState();
    this.resetResortPageDerivedState();
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

  private readonly handleResortPositionUpdate = (event: CustomEvent<{ coordinates: LngLat; accuracy: number }>): void => {
    this.latestResortPosition = event.detail;
    writeStoredLastKnownPosition(safeStorage(), event.detail);
    this.gpsUiState = applyGpsPosition(this.gpsUiState, event.detail.accuracy);
    if (
      this.phraseStatusText.startsWith("Waiting for GPS") ||
      this.phraseStatusText.startsWith("Retrying location") ||
      this.phraseStatusText.startsWith("Ready to generate phrase (last known")
    ) {
      this.phraseStatusText = "Ready to generate phrase.";
    }
  };

  private readonly handleResortGpsError = (event: CustomEvent<{ kind: GpsErrorKind; message: string }>): void => {
    const next = applyGpsError(this.gpsUiState, {
      kind: event.detail.kind,
      message: event.detail.message
    });
    this.gpsUiState = next;
    if (this.phraseGenerating) {
      this.phraseGenerating = false;
    }
    this.phraseStatusText = "Location unavailable. Resolve GPS access to generate a phrase.";
  };

  private readonly handleResortGpsRetry = (): void => {
    this.gpsUiState = requestGpsRetry(this.gpsUiState);
    this.phraseStatusText = "Retrying location access…";
  };

  private readonly handleResortGpsGuidanceDismiss = (): void => {
    this.gpsUiState = dismissGpsGuidanceModal(this.gpsUiState);
  };

  private readonly handleResortGeneratePhrase = (): void => {
    if (!this.selectedResortPack) {
      this.phraseStatusText = "Resort pack is not loaded.";
      return;
    }

    const fallbackPosition = readStoredLastKnownPosition(safeStorage());
    const position = this.latestResortPosition ??
      (fallbackPosition
        ? {
            coordinates: fallbackPosition.coordinates,
            accuracy: fallbackPosition.accuracy
          }
        : null);

    if (!position) {
      this.phraseStatusText = "Waiting for GPS position.";
      return;
    }

    this.phraseGenerating = true;
    try {
      const outcome = composeRadioPhrase(position.coordinates, this.selectedResortPack);
      this.phraseOutputText = outcome.phrase;
      this.phraseStatusText = this.latestResortPosition
        ? "Phrase generated."
        : "Phrase generated from last known location (offline fallback).";
    } catch {
      this.phraseStatusText = "Unable to generate phrase.";
    } finally {
      this.phraseGenerating = false;
    }
  };

  private readonly handleResortMapReady = (): void => {
    this.mapUiState = "ready";
    this.mapStateMessage = "Map ready.";
  };

  private readonly handleResortMapRenderError = (event: CustomEvent<{ message?: string }>): void => {
    this.mapUiState = "error";
    this.mapStateMessage = event.detail?.message?.trim() ? `Map rendering error: ${event.detail.message}` : "Map rendering error.";
  };

  private readonly handleOpenSettingsPanel = (): void => {
    this.settingsPanelOpen = true;
  };

  private readonly handleCloseSettingsPanel = (): void => {
    this.settingsPanelOpen = false;
  };

  private readonly handleSettingsThemeSelect = (event: CustomEvent<{ theme: "default" | "high-contrast" }>): void => {
    this.setTheme(event.detail.theme);
  };

  private readonly handleInstallAppFromSettings = async (): Promise<void> => {
    await this.installApp();
  };

  private readonly handleCheckAppUpdatesFromSettings = async (): Promise<void> => {
    await this.checkForAppUpdates();
  };

  private readonly handleApplyAppUpdateFromSettings = async (): Promise<void> => {
    await this.applyAppUpdate();
  };

  private readonly handleCheckPackUpdatesFromSettings = async (): Promise<void> => {
    await this.checkPackUpdates();
  };

  private readonly handleTogglePackCandidateFromSettings = (
    event: CustomEvent<{ resortId: string; selected: boolean }>
  ): void => {
    this.packUpdateCandidates = togglePackCandidateSelection(
      this.packUpdateCandidates,
      event.detail.resortId,
      event.detail.selected
    );
  };

  private readonly handleApplyPackUpdatesFromSettings = async (): Promise<void> => {
    await this.applySelectedPackUpdates();
  };

  private async openInstalledResort(resortId: string, resortName: string): Promise<void> {
    this.selectedResortId = resortId;
    this.selectedResortName = resortName;
    this.installBlockingError = "";
    this.resortPageUiState = createInitialResortPageUiState(this.viewport);
    this.gpsUiState = createInitialGpsUiState();
    this.resetResortPageDerivedState();

    const installedMeta = this.installedPacks.find((pack) => pack.id === resortId);
    this.selectedResortSourceVersion = installedMeta?.sourceVersion ?? "";

    const pack = this.repository ? await this.repository.getPack(resortId) : null;
    this.selectedResortPack = pack;
    this.page = "resort";
  }

  private resetResortPageDerivedState(): void {
    this.latestResortPosition = null;
    this.phraseOutputText = "No phrase generated yet.";
    const cached = readStoredLastKnownPosition(safeStorage());
    this.phraseStatusText = cached
      ? "Ready to generate phrase (last known location until GPS updates)."
      : "Waiting for GPS position.";
    this.phraseGenerating = false;
    this.mapUiState = "loading";
    this.mapStateMessage = "Loading map…";
  }

  private async installApp(): Promise<void> {
    if (!this.deferredInstallPrompt) {
      if (isStandaloneInstalled()) {
        this.installHint = "Patrol Toolkit is already installed. Open it from your home screen.";
        return;
      }
      this.installHint =
        "Install prompt unavailable on this browser. iPhone/iPad: open in Safari, tap Share, then Add to Home Screen. Android/Desktop: browser menu > Install app/Add to Home Screen.";
      return;
    }

    await this.deferredInstallPrompt.prompt();
    const choice = await this.deferredInstallPrompt.userChoice;
    this.installHint =
      choice.outcome === "accepted"
        ? "Install accepted. Open Patrol Toolkit from home screen."
        : "Install dismissed. You can retry from Settings/Help.";
    this.deferredInstallPrompt = null;
  }

  private async checkForAppUpdates(): Promise<void> {
    try {
      const catalog = await loadResortCatalog();
      if (catalog.schemaVersion !== "2.0.0" || !catalog.release) {
        this.appUpdateResult = "No structured release metadata found.";
        this.appUpdateTargetVersion = null;
        this.appUpdateSummary = "";
        return;
      }

      const isNewer = compareSemver(catalog.release.appVersion, APP_VERSION) > 0;
      if (!isNewer) {
        this.appUpdateResult = `App is up to date (${APP_VERSION}).`;
        this.appUpdateTargetVersion = null;
        this.appUpdateSummary = "";
        return;
      }

      this.appUpdateTargetVersion = catalog.release.appVersion;
      this.appUpdateSummary = catalog.release.notesSummary ?? "Release notes summary unavailable.";
      this.appUpdateResult = `Update available: ${catalog.release.appVersion}`;
    } catch (error) {
      this.appUpdateResult = error instanceof Error ? error.message : "Failed to check app updates.";
      this.appUpdateTargetVersion = null;
      this.appUpdateSummary = "";
    }
  }

  private async applyAppUpdate(): Promise<void> {
    if (!this.appUpdateTargetVersion) {
      this.appUpdateResult = "No pending app update to apply.";
      return;
    }

    try {
      const registration = await navigator.serviceWorker?.getRegistration?.();
      await registration?.update();
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      this.appUpdateResult = `Applying update ${this.appUpdateTargetVersion}...`;
      window.location.reload();
    } catch {
      this.appUpdateResult = "Could not trigger update automatically. Close and reopen the app.";
    }
  }

  private async checkPackUpdates(): Promise<void> {
    if (!this.repository) {
      this.packUpdateResult = "Pack update check unavailable: storage not ready.";
      return;
    }

    try {
      const catalog = await loadResortCatalog();
      const latestEligible = selectLatestEligibleVersions(catalog);
      const localPacks = await this.repository.listPacks();
      const localById = new Map(localPacks.map((item) => [item.id, item]));

      this.packUpdateCandidates = latestEligible
        .filter((entry) => {
          const local = localById.get(entry.resortId);
          if (!local) {
            return false;
          }
          return local.sourceVersion !== entry.version || local.sourceCreatedAt !== entry.createdAt;
        })
        .map((entry) => ({
          resortId: entry.resortId,
          resortName: entry.resortName,
          version: entry.version,
          createdAt: entry.createdAt,
          selected: false
        }));

      const blocked: string[] = [];
      for (const resort of catalog.resorts) {
        const local = localById.get(resort.resortId);
        if (!local) {
          continue;
        }
        const latest = [...resort.versions].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0];
        if (!latest) {
          continue;
        }
        const compatible = isCatalogVersionCompatible(latest, {
          appVersion: APP_VERSION,
          supportedPackSchemaVersion: "1.0.0"
        });
        if (!compatible) {
          const minVersion = latest.compatibility?.minAppVersion ?? "unknown";
          blocked.push(`${resort.resortName}: blocked by app compatibility (requires >= ${minVersion}).`);
        }
      }

      this.blockedPackUpdates = blocked;
      if (this.packUpdateCandidates.length === 0 && blocked.length === 0) {
        this.packUpdateResult = "No pack updates available.";
      } else {
        this.packUpdateResult = `Pack update check complete: ${this.packUpdateCandidates.length} selectable, ${blocked.length} blocked.`;
      }
    } catch (error) {
      this.packUpdateCandidates = [];
      this.blockedPackUpdates = [];
      this.packUpdateResult = error instanceof Error ? error.message : "Failed to check pack updates.";
    }
  }

  private async applySelectedPackUpdates(): Promise<void> {
    if (!this.repository) {
      this.packUpdateResult = "Pack update apply unavailable: storage not ready.";
      return;
    }

    const selectedIds = this.packUpdateCandidates.filter((candidate) => candidate.selected).map((candidate) => candidate.resortId);
    if (selectedIds.length === 0) {
      this.packUpdateResult = "Select at least one resort to update.";
      return;
    }

    try {
      const catalog = await loadResortCatalog();
      const latestEligible = selectLatestEligibleVersions(catalog);
      const byId = new Map(latestEligible.map((entry) => [entry.resortId, entry]));
      const successes: string[] = [];
      const failures: string[] = [];

      for (const resortId of selectedIds) {
        const entry = byId.get(resortId);
        if (!entry) {
          failures.push(`${resortId}: no compatible catalog entry.`);
          continue;
        }
        try {
          const pack = await loadPackFromCatalogEntry(entry);
          await this.repository.savePack(pack, {
            sourceVersion: entry.version,
            sourceCreatedAt: entry.createdAt
          });
          requestPackAssetPrecache(pack);
          successes.push(entry.resortName);
        } catch (error) {
          failures.push(`${entry.resortName}: ${error instanceof Error ? error.message : "update failed"}`);
        }
      }

      this.installedPacks = await this.repository.listPacks();
      this.packUpdateCandidates = clearPackCandidateSelections(this.packUpdateCandidates);
      this.packUpdateResult = `Pack updates complete: ${successes.length} succeeded, ${failures.length} failed.${failures.length > 0 ? ` ${failures.join(" ")}` : ""}`;

      if (this.selectedResortId && this.installedPacks.some((pack) => pack.id === this.selectedResortId) && this.page === "resort") {
        await this.openInstalledResort(this.selectedResortId, this.selectedResortName);
      }
    } catch (error) {
      this.packUpdateResult = error instanceof Error ? error.message : "Failed to apply pack updates.";
    }
  }
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function shouldRenderLiveMap(): boolean {
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
    return false;
  }
  return true;
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  const candidate = event as Partial<BeforeInstallPromptEvent>;
  return typeof candidate.prompt === "function" && candidate.userChoice instanceof Promise;
}

function isStandaloneInstalled(): boolean {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    try {
      if (window.matchMedia("(display-mode: standalone)").matches) {
        return true;
      }
    } catch {
      // ignore
    }
  }

  if (typeof navigator !== "undefined") {
    const nav = navigator as Navigator & { standalone?: boolean };
    if (typeof nav.standalone === "boolean") {
      return nav.standalone;
    }
  }

  return false;
}

function compareSemver(left: string, right: string): number {
  const leftMatch = /^(\d+)\.(\d+)\.(\d+)$/u.exec(left.trim());
  const rightMatch = /^(\d+)\.(\d+)\.(\d+)$/u.exec(right.trim());
  if (!leftMatch || !rightMatch) {
    return left.localeCompare(right);
  }

  for (let index = 1; index <= 3; index += 1) {
    const leftPart = Number.parseInt(leftMatch[index] ?? "0", 10);
    const rightPart = Number.parseInt(rightMatch[index] ?? "0", 10);
    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }

  return 0;
}

function toMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Unable to load resorts.";
}
