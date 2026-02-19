import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./map/map-view";
import { composeRadioPhrase } from "./radio/phrase";
import {
  loadPackFromCatalogEntry,
  loadResortCatalog,
  selectLatestEligibleVersions,
  type SelectableResortPack
} from "./resort-pack/catalog";
import { ResortPackRepository } from "./resort-pack/repository";
import type { LngLat, ResortPack } from "./resort-pack/types";

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

  protected override async firstUpdated(): Promise<void> {
    try {
      const repository = await ResortPackRepository.open();
      if (!this.isConnected) {
        repository.close();
        return;
      }

      this.repository = repository;
      await this.loadCatalogOptions();
      await this.refreshPackState();
    } catch {
      this.hasStorage = false;
      this.statusMessage = "IndexedDB unavailable: pack persistence disabled.";
    }
  }

  disconnectedCallback(): void {
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

    this.activePack = activePack;
    this.statusMessage = activePack
      ? `Active pack: ${activePack.resort.name}`
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

    try {
      const pack = await loadPackFromCatalogEntry(selectedEntry);
      await this.repository.savePack(pack);
      const activated = await this.repository.setActivePackId(pack.resort.id);
      if (!activated) {
        this.statusMessage = "Unable to activate selected resort pack.";
        return;
      }

      await this.refreshPackState();
      this.statusMessage = `Active pack: ${pack.resort.name} (${selectedEntry.version})`;
    } catch (error) {
      this.statusMessage = error instanceof Error ? error.message : "Failed to load selected resort.";
    }
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

  render() {
    return html`
      <main class="layout">
        <section class="header">
          <h1>Patrol Toolkit</h1>
          <p>Map foundation with live GPS dot for on-mountain positioning.</p>
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
