import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./map/map-view";
import { APP_VERSION } from "./app-version";
import { requestPackAssetPrecache } from "./pwa/precache-pack-assets";
import { composeRadioPhrase } from "./radio/phrase";
import {
  isCatalogVersionCompatible,
  loadPackFromCatalogEntry,
  loadResortCatalog,
  selectLatestEligibleVersions,
  type SelectableResortPack
} from "./resort-pack/catalog";
import { ResortPackRepository } from "./resort-pack/repository";
import type { LngLat, ResortPack } from "./resort-pack/types";
import { resolveAppUrl } from "./runtime/base-url";

@customElement("app-shell")
export class AppShell extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      padding: 1rem;
    }

    .layout {
      width: min(980px, 100%);
      margin: 0 auto;
      display: grid;
      gap: 1rem;
      grid-template-rows: auto 1fr;
      min-height: calc(100vh - 2rem);
    }

    .header {
      position: relative;
      border-radius: 12px;
      padding: 1rem 1.25rem;
      background: #ffffff;
      border: 1px solid #dbe3ea;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
    }

    h1 {
      margin: 0 0 0.5rem;
      font-size: 1.75rem;
    }

    p {
      margin: 0;
      color: #334155;
    }

    .pack-panel {
      margin-top: 0.85rem;
      display: grid;
      gap: 0.75rem;
    }

    .settings-toggle {
      position: absolute;
      top: 0.85rem;
      right: 0.85rem;
      min-height: 38px;
      border-radius: 9px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #0f172a;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      padding: 0 0.75rem;
    }

    .settings-panel {
      margin-top: 0.75rem;
      border: 1px solid #dbe3ea;
      border-radius: 12px;
      background: #f8fafc;
      padding: 0.8rem;
      display: grid;
      gap: 0.65rem;
    }

    .settings-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
    }

    .settings-row button {
      min-height: 36px;
      border-radius: 8px;
      border: 1px solid #0f4c5c;
      background: #ffffff;
      color: #0f4c5c;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      padding: 0 0.65rem;
    }

    .settings-note {
      font-size: 0.85rem;
      color: #334155;
      line-height: 1.4;
    }

    .settings-result {
      font-size: 0.86rem;
      color: #0f172a;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      padding: 0.55rem 0.65rem;
      word-break: break-word;
    }

    .update-list {
      display: grid;
      gap: 0.35rem;
      border-radius: 8px;
      border: 1px solid #dbe3ea;
      background: #ffffff;
      padding: 0.55rem 0.65rem;
      max-height: 170px;
      overflow: auto;
    }

    .update-item {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.86rem;
      color: #0f172a;
    }

    .blocked-list {
      margin: 0;
      padding-left: 1rem;
      font-size: 0.82rem;
      color: #7c2d12;
    }

    .pack-row {
      display: block;
    }

    .pack-row select {
      width: 100%;
      min-height: 44px;
      border-radius: 10px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      font: inherit;
    }

    .pack-row select {
      padding: 0 0.75rem;
    }

    .status-line {
      font-size: 0.9rem;
      color: #334155;
    }

    .empty-state {
      min-height: 44px;
      border-radius: 10px;
      border: 1px dashed #cbd5e1;
      background: #f8fafc;
      padding: 0.65rem 0.75rem;
      display: grid;
      align-items: center;
      color: #475569;
      font-size: 0.95rem;
    }

    .status-line strong {
      color: #0f172a;
    }

    .warning-line {
      font-size: 0.9rem;
      color: #7c2d12;
      background: #ffedd5;
      border: 1px solid #fdba74;
      border-radius: 10px;
      padding: 0.55rem 0.7rem;
    }

    .warning-line strong {
      color: #9a3412;
    }

    .warning-details {
      margin-top: 0.45rem;
      font-size: 0.82rem;
      color: #7c2d12;
      word-break: break-word;
    }

    .radio-panel {
      margin-top: 0.25rem;
      border: 1px solid #dbe3ea;
      border-radius: 12px;
      padding: 0.9rem;
      display: grid;
      gap: 0.65rem;
      background: #f8fafc;
    }

    .radio-actions {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 0.6rem;
    }

    .radio-actions button {
      min-height: 48px;
      border-radius: 10px;
      border: 1px solid #0f4c5c;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }

    .radio-actions button.primary {
      background: #0f4c5c;
      color: #f8fafc;
    }

    .radio-actions button.secondary {
      background: #ffffff;
      color: #0f4c5c;
    }

    .phrase-card {
      min-height: 48px;
      border-radius: 10px;
      border: 1px dashed #94a3b8;
      background: #ffffff;
      padding: 0.65rem 0.75rem;
      display: grid;
      align-items: center;
      font-weight: 600;
      color: #0f172a;
    }

    .phrase-hint {
      font-size: 0.85rem;
      color: #475569;
    }
  `;

  private repository: ResortPackRepository | null = null;

  @state()
  private accessor resortOptions: SelectableResortPack[] = [];

  @state()
  private accessor selectedPackId: string | null = null;

  @state()
  private accessor activePackId: string | null = null;

  @state()
  private accessor statusMessage = "No Resort Pack loaded.";

  @state()
  private accessor hasStorage = true;

  @state()
  private accessor latestPosition: { coordinates: LngLat; accuracy: number } | null = null;

  @state()
  private accessor activePack: ResortPack | null = null;

  @state()
  private accessor generatedPhrase = "";

  @state()
  private accessor phraseStatus = "Waiting for GPS and active pack.";

  @state()
  private accessor basemapWarning = "";

  @state()
  private accessor basemapDiagnostics = "";

  @state()
  private accessor settingsOpen = false;

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
  private accessor packUpdateCandidates: Array<{
    resortId: string;
    resortName: string;
    version: string;
    createdAt?: string;
    selected: boolean;
  }> = [];

  @state()
  private accessor blockedPackUpdates: string[] = [];

  private isAutoActivating = false;
  private basemapProbeToken = 0;
  private deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
  private readonly onBeforeInstallPrompt = (event: Event) => {
    if (!isBeforeInstallPromptEvent(event)) {
      return;
    }
    event.preventDefault();
    this.deferredInstallPrompt = event;
    this.installHint = "Install available. Tap 'Install app'.";
  };
  private readonly onAppInstalled = () => {
    this.deferredInstallPrompt = null;
    this.installHint = "App installed. Open from home screen.";
  };

  protected override async firstUpdated(): Promise<void> {
    if (typeof window !== "undefined") {
      window.addEventListener("beforeinstallprompt", this.onBeforeInstallPrompt);
      window.addEventListener("appinstalled", this.onAppInstalled);
    }

    try {
      const repository = await ResortPackRepository.open();
      if (!this.isConnected) {
        repository.close();
        return;
      }

      this.repository = repository;
      await this.loadCatalogOptions();
      await this.refreshPackState();
      await this.ensureAutoActiveSelection();
    } catch {
      this.hasStorage = false;
      this.statusMessage = "IndexedDB unavailable: pack persistence disabled.";
    }
  }

  disconnectedCallback(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeinstallprompt", this.onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", this.onAppInstalled);
    }
    this.repository?.close();
    this.repository = null;
    super.disconnectedCallback();
  }

  private async refreshPackState(): Promise<void> {
    if (!this.repository) {
      return;
    }

    const [activePackId, activePack] = await Promise.all([
      this.repository.getActivePackId(),
      this.repository.getActivePack()
    ]);
    this.activePackId = activePackId;

    const fallbackSelection = this.resortOptions[0]?.resortId ?? null;
    const activeInOptions = this.resortOptions.some((entry) => entry.resortId === activePackId);
    this.selectedPackId = this.resortOptions.some((entry) => entry.resortId === this.selectedPackId)
      ? this.selectedPackId
      : activeInOptions
        ? activePackId
        : fallbackSelection;

    const activePackToUse = activeInOptions ? activePack : null;

    this.activePack = activePackToUse;
    requestPackAssetPrecache(activePackToUse);
    void this.refreshBasemapWarning(activePackToUse);
    this.statusMessage = activePackToUse
      ? `Active pack: ${activePackToUse.resort.name}`
      : this.resortOptions.length > 0
        ? "Select a resort pack."
        : "No eligible resort packs available.";
  }

  private async loadCatalogOptions(): Promise<void> {
    try {
      const catalog = await loadResortCatalog();
      this.resortOptions = selectLatestEligibleVersions(catalog);
    } catch {
      this.resortOptions = [];
      this.statusMessage = "Resort catalog unavailable.";
    }
  }

  private async ensureAutoActiveSelection(): Promise<void> {
    if (this.isAutoActivating || this.activePack || !this.selectedPackId) {
      return;
    }

    this.isAutoActivating = true;
    try {
      await this.activateSelectedResort(this.selectedPackId);
    } finally {
      this.isAutoActivating = false;
    }
  }

  private async updateSelection(event: Event): Promise<void> {
    const select = event.currentTarget as HTMLSelectElement;
    const selectedResortId = select.value || null;
    this.selectedPackId = selectedResortId;

    if (!selectedResortId) {
      return;
    }

    await this.activateSelectedResort(selectedResortId);
  }

  private async activateSelectedResort(resortId: string): Promise<void> {
    if (!this.repository) {
      this.statusMessage = "Resort selection unavailable: storage not ready.";
      return;
    }

    const selectedEntry = this.resortOptions.find((entry) => entry.resortId === resortId);
    if (!selectedEntry) {
      this.statusMessage = "Selected resort is not available.";
      return;
    }

    const previouslyActivePackId = this.activePackId;
    try {
      const pack = await loadPackFromCatalogEntry(selectedEntry);
      await this.repository.savePack(pack, {
        sourceVersion: selectedEntry.version,
        sourceCreatedAt: selectedEntry.createdAt
      });
      const activated = await this.repository.setActivePackId(pack.resort.id);
      if (!activated) {
        this.statusMessage = "Unable to activate selected resort pack.";
        return;
      }

      await this.refreshPackState();
      requestPackAssetPrecache(pack);
      void this.refreshBasemapWarning(pack);
      this.statusMessage = `Active pack: ${pack.resort.name} (${selectedEntry.version})`;
    } catch (error) {
      const canRestorePreviousSelection =
        typeof previouslyActivePackId === "string" &&
        this.resortOptions.some((entry) => entry.resortId === previouslyActivePackId);

      if (canRestorePreviousSelection) {
        this.selectedPackId = previouslyActivePackId;
      } else {
        this.activePackId = null;
        this.activePack = null;
        this.basemapWarning = "";
        this.basemapDiagnostics = "";
        this.generatedPhrase = "";
        this.phraseStatus = "Waiting for GPS and active pack.";
      }
      this.statusMessage = error instanceof Error ? error.message : "Failed to load selected resort.";
    }
  }

  private async refreshBasemapWarning(pack: ResortPack | null): Promise<void> {
    const token = ++this.basemapProbeToken;
    if (!pack) {
      this.basemapWarning = "";
      this.basemapDiagnostics = "";
      return;
    }

    const [styleOk, pmtilesOk] = await Promise.all([
      this.probeStyleAsset(pack.basemap.stylePath),
      this.probePmtilesAsset(pack.basemap.pmtilesPath)
    ]);
    if (token !== this.basemapProbeToken) {
      return;
    }

    if (styleOk && pmtilesOk) {
      this.basemapWarning = "";
      this.basemapDiagnostics = "";
      return;
    }

    const missing: string[] = [];
    if (!styleOk) {
      missing.push(resolveAppUrl(normalizeRelativePath(pack.basemap.stylePath)));
    }
    if (!pmtilesOk) {
      missing.push(resolveAppUrl(normalizeRelativePath(pack.basemap.pmtilesPath)));
    }

    this.basemapWarning = `Basemap assets missing for ${pack.resort.name}: ${missing.join(", ")}.`;
    this.basemapDiagnostics = this.describeBasemapDiagnostics(pack);
  }

  private async probeStyleAsset(path: string): Promise<boolean> {
    try {
      const response = await fetch(resolveAppUrl(normalizeRelativePath(path)), { method: "GET" });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async probePmtilesAsset(path: string): Promise<boolean> {
    const url = resolveAppUrl(normalizeRelativePath(path));

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" }
      });
      if (response.status === 206 || response.ok) {
        return true;
      }
    } catch {
      // Retry below with a HEAD probe for servers that reject range.
    }

    try {
      const headResponse = await fetch(url, { method: "HEAD" });
      return headResponse.ok;
    } catch {
      return false;
    }
  }

  private describeBasemapDiagnostics(pack: ResortPack): string {
    const online =
      typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" ? (navigator.onLine ? "yes" : "no") : "unknown";
    const swControl =
      typeof navigator !== "undefined" && "serviceWorker" in navigator && navigator.serviceWorker.controller ? "controlled" : "none";
    return [
      `online=${online}`,
      `sw=${swControl}`,
      `style=${resolveAppUrl(normalizeRelativePath(pack.basemap.stylePath))}`,
      `pmtiles=${resolveAppUrl(normalizeRelativePath(pack.basemap.pmtilesPath))}`
    ].join("; ");
  }

  private handlePositionUpdate(event: CustomEvent<{ coordinates: LngLat; accuracy: number }>): void {
    this.latestPosition = event.detail;
    this.phraseStatus = `GPS ready (±${Math.round(event.detail.accuracy)}m).`;
  }

  private async generatePhrase(): Promise<void> {
    if (!this.repository) {
      this.phraseStatus = "Phrase generation unavailable: storage not ready.";
      return;
    }

    const activePack = this.activePack ?? (await this.repository.getActivePack());
    if (!activePack) {
      this.phraseStatus = "Set an active Resort Pack before generating phrase.";
      return;
    }

    if (!this.latestPosition) {
      this.phraseStatus = "Waiting for GPS position.";
      return;
    }

    this.activePack = activePack;
    const outcome = composeRadioPhrase(this.latestPosition.coordinates, activePack);
    this.generatedPhrase = outcome.phrase;
    this.phraseStatus = "Phrase generated.";
  }

  private toggleSettingsPanel(): void {
    this.settingsOpen = !this.settingsOpen;
  }

  private async installApp(): Promise<void> {
    if (!this.deferredInstallPrompt) {
      this.installHint = "Install prompt unavailable. Use browser menu to install.";
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
            return true;
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

  private togglePackUpdateSelection(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const resortId = input.dataset["resortId"];
    if (!resortId) {
      return;
    }

    this.packUpdateCandidates = this.packUpdateCandidates.map((candidate) =>
      candidate.resortId === resortId ? { ...candidate, selected: input.checked } : candidate
    );
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

      await this.refreshPackState();
      this.packUpdateCandidates = this.packUpdateCandidates.map((candidate) => ({
        ...candidate,
        selected: false
      }));
      this.packUpdateResult = `Pack updates complete: ${successes.length} succeeded, ${failures.length} failed.${failures.length > 0 ? ` ${failures.join(" ")}` : ""}`;
    } catch (error) {
      this.packUpdateResult = error instanceof Error ? error.message : "Failed to apply pack updates.";
    }
  }

  render() {
    return html`
      <main class="layout">
        <section class="header">
          <button class="settings-toggle" @click=${this.toggleSettingsPanel}>Settings/Help</button>
          <h1>Patrol Toolkit</h1>
          <p>Map foundation with live GPS dot for on-mountain positioning.</p>
          ${this.settingsOpen
            ? html`<section class="settings-panel" aria-label="Settings and help">
                <div class="settings-row">
                  <button @click=${this.installApp}>Install app</button>
                  <button @click=${this.checkForAppUpdates}>Check for updates</button>
                  <button @click=${this.applyAppUpdate} ?disabled=${!this.appUpdateTargetVersion}>Apply app update</button>
                </div>
                <div class="settings-note">${this.installHint}</div>
                ${this.appUpdateResult
                  ? html`<div class="settings-result">
                      ${this.appUpdateResult}
                      ${this.appUpdateTargetVersion
                        ? html`<br /><strong>Target:</strong> ${this.appUpdateTargetVersion}<br /><strong>Summary:</strong>
                            ${this.appUpdateSummary}`
                        : null}
                    </div>`
                  : null}
                <div class="settings-row">
                  <button @click=${this.checkPackUpdates}>Check pack updates</button>
                  <button @click=${this.applySelectedPackUpdates}>Apply selected pack updates</button>
                </div>
                ${this.packUpdateCandidates.length > 0
                  ? html`<div class="update-list">
                      ${this.packUpdateCandidates.map(
                        (candidate) => html`<label class="update-item">
                          <input
                            type="checkbox"
                            data-resort-id=${candidate.resortId}
                            .checked=${candidate.selected}
                            @change=${this.togglePackUpdateSelection}
                          />
                          <span>${candidate.resortName} (${candidate.version})</span>
                        </label>`
                      )}
                    </div>`
                  : null}
                ${this.blockedPackUpdates.length > 0
                  ? html`<ul class="blocked-list">
                      ${this.blockedPackUpdates.map((line) => html`<li>${line}</li>`)}
                    </ul>`
                  : null}
                ${this.packUpdateResult ? html`<div class="settings-result">${this.packUpdateResult}</div>` : null}
              </section>`
            : null}
          <section class="pack-panel" aria-label="Resort pack management">
            <div class="pack-row">
              ${this.resortOptions.length > 0
                ? html`<select
                    @change=${this.updateSelection}
                    .value=${this.selectedPackId ?? this.resortOptions[0]?.resortId ?? ""}
                    ?disabled=${!this.hasStorage}
                  >
                    ${this.resortOptions.map(
                      (entry) =>
                        html`<option value=${entry.resortId}>
                          ${entry.resortName} (${entry.version})${entry.resortId === this.activePackId ? " (active)" : ""}
                        </option>`
                    )}
                  </select>`
                : html`<div class="empty-state">No resort packs available.</div>`}
            </div>
            <div class="status-line"><strong>Status:</strong> ${this.statusMessage}</div>
            ${this.basemapWarning
              ? html`<div class="warning-line">
                  <strong>Warning:</strong> ${this.basemapWarning}
                  ${this.basemapDiagnostics ? html`<div class="warning-details">${this.basemapDiagnostics}</div>` : null}
                </div>`
              : null}
          </section>
          <section class="radio-panel" aria-label="Radio phrase generator">
            <div class="radio-actions">
              <button class="primary" @click=${this.generatePhrase}>Generate Phrase</button>
            </div>
            <div class="phrase-card">${this.generatedPhrase || "No phrase generated yet."}</div>
            <div class="phrase-hint">${this.phraseStatus}</div>
          </section>
        </section>
        <map-view .pack=${this.activePack} @position-update=${this.handlePositionUpdate}></map-view>
      </main>
    `;
  }
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  const candidate = event as Partial<BeforeInstallPromptEvent>;
  return typeof candidate.prompt === "function" && candidate.userChoice instanceof Promise;
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

function normalizeRelativePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  return `/${trimmed.replace(/^\.\/+/, "")}`;
}
