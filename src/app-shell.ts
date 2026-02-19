import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./map/map-view";
import { composeRadioPhrase } from "./radio/phrase";
import { loadResortPackFromJson } from "./resort-pack/loader";
import { ResortPackRepository, type ResortPackListItem } from "./resort-pack/repository";
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
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 0.6rem;
      align-items: center;
    }

    .pack-row input[type="file"],
    .pack-row select,
    .pack-row button {
      min-height: 44px;
      border-radius: 10px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      font: inherit;
    }

    .pack-row select {
      padding: 0 0.75rem;
    }

    .pack-row button {
      padding: 0 0.9rem;
      font-weight: 600;
      cursor: pointer;
    }

    .pack-row button.primary {
      background: #0f4c5c;
      color: #f8fafc;
      border-color: #0f4c5c;
    }

    .status-line {
      font-size: 0.9rem;
      color: #334155;
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
  private accessor packs: ResortPackListItem[] = [];

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

    const [packs, activePackId] = await Promise.all([
      this.repository.listPacks(),
      this.repository.getActivePackId()
    ]);

    this.packs = packs;
    this.activePackId = activePackId;

    const fallbackSelection = packs[0]?.id ?? null;
    this.selectedPackId = packs.some((pack) => pack.id === this.selectedPackId)
      ? this.selectedPackId
      : activePackId ?? fallbackSelection;

    const activePack = packs.find((pack) => pack.id === activePackId);
    this.activePack = await this.repository.getActivePack();
    this.statusMessage = activePack
      ? `Active pack: ${activePack.name}`
      : "No active pack selected.";
  }

  private async importPack(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const json = await file.text();
    const result = loadResortPackFromJson(json);
    if (!result.ok) {
      const firstError = result.errors[0];
      this.statusMessage = firstError
        ? `Import failed (${firstError.code}): ${firstError.path} ${firstError.message}`
        : "Import failed: invalid Resort Pack.";
      input.value = "";
      return;
    }

    if (!this.repository) {
      this.statusMessage = "Pack import unavailable: IndexedDB not ready.";
      input.value = "";
      return;
    }

    await this.repository.savePack(result.value);
    const activated = await this.repository.setActivePackId(result.value.resort.id);
    if (!activated) {
      this.statusMessage = "Pack import failed: unable to set active pack.";
      input.value = "";
      return;
    }
    await this.refreshPackState();
    this.selectedPackId = result.value.resort.id;
    this.statusMessage = `Pack imported: ${result.value.resort.name}`;
    input.value = "";
  }

  private async applySelection(): Promise<void> {
    if (!this.repository || !this.selectedPackId) {
      return;
    }

    const activated = await this.repository.setActivePackId(this.selectedPackId);
    if (!activated) {
      this.statusMessage = "Unable to set active pack: selection is missing.";
      await this.refreshPackState();
      return;
    }
    await this.refreshPackState();
  }

  private async removeSelection(): Promise<void> {
    if (!this.repository || !this.selectedPackId) {
      return;
    }

    await this.repository.deletePack(this.selectedPackId);
    await this.refreshPackState();
  }

  private updateSelection(event: Event): void {
    const select = event.currentTarget as HTMLSelectElement;
    this.selectedPackId = select.value || null;
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
              <input
                type="file"
                accept="application/json,.json"
                @change=${this.importPack}
                ?disabled=${!this.hasStorage}
              />
              <button class="primary" @click=${this.applySelection} ?disabled=${!this.selectedPackId}>
                Set Active
              </button>
              <button @click=${this.removeSelection} ?disabled=${!this.selectedPackId}>
                Remove
              </button>
            </div>
            <div class="pack-row">
              <select @change=${this.updateSelection} .value=${this.selectedPackId ?? ""}>
                <option value="">Select Resort Pack</option>
                ${this.packs.map(
                  (pack) =>
                    html`<option value=${pack.id}>
                      ${pack.name}${pack.id === this.activePackId ? " (active)" : ""}
                    </option>`
                )}
              </select>
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
        <map-view @position-update=${this.handlePositionUpdate}></map-view>
      </main>
    `;
  }
}
