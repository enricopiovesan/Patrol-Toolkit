import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { v4DesignTokens } from "./design-tokens";
import type { ViewportMode } from "./viewport";

@customElement("ptk-tool-panel")
export class PtkToolPanel extends LitElement {
  private static readonly SMALL_SHEET_MIN_HEIGHT = 56;
  private static readonly SMALL_SHEET_DEFAULT_HEIGHT = 232;
  private static readonly SMALL_SHEET_MAX_HEIGHT_FALLBACK = 520;

  static styles = css`
    ${v4DesignTokens}

    :host {
      display: block;
      font-family: var(--ptk-font-family-base);
    }

    .panel {
      border: 1px solid var(--ptk-border-default);
      background: var(--ptk-surface-card);
      color: var(--ptk-text-primary);
      box-shadow: var(--ptk-shadow-md);
    }

    .panel.hidden {
      display: none;
    }

    .panel.small {
      border-radius: var(--ptk-radius-lg) var(--ptk-radius-lg) 0 0;
      min-height: 56px;
      max-height: min(52dvh, 400px);
      padding: var(--ptk-space-3);
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      touch-action: pan-y;
      scrollbar-width: none;
    }

    .panel.small::-webkit-scrollbar {
      display: none;
    }

    .panel.medium,
    .panel.large {
      border-radius: var(--ptk-radius-md);
      min-height: 320px;
      padding: var(--ptk-space-3);
      height: 100%;
    }

    .handle {
      width: 42px;
      height: 4px;
      border-radius: var(--ptk-radius-pill);
      background: var(--ptk-border-default);
      margin: 0 auto 10px;
      cursor: ns-resize;
      touch-action: none;
    }

  `;

  @property({ type: String })
  accessor viewport: ViewportMode = "small";

  @property({ type: Boolean, reflect: true })
  accessor open = true;

  @property({ type: String })
  accessor title = "Tools";

  @state()
  private accessor smallSheetHeightPx: number | null = null;

  private dragPointerId: number | null = null;
  private dragStartY = 0;
  private dragStartHeight = 0;
  private dragMoved = false;

  protected updated(changed: Map<string, unknown>): void {
    if ((changed.has("viewport") || changed.has("open")) && this.viewport === "small" && this.open) {
      this.ensureSmallSheetHeight();
    }
    if (changed.has("smallSheetHeightPx") && this.viewport === "small" && this.open && this.smallSheetHeightPx !== null) {
      this.dispatchSmallSheetHeightChange(this.smallSheetHeightPx);
    }
  }

  protected render() {
    const hidden = !this.open;
    const panelClasses = {
      panel: true,
      hidden,
      [this.viewport]: true
    };

    const smallPanelStyle =
      this.viewport === "small" && this.smallSheetHeightPx !== null
        ? `height:${this.smallSheetHeightPx}px`
        : "";

    return html`
      <section class=${classMap(panelClasses)} style=${smallPanelStyle} aria-hidden=${hidden ? "true" : "false"}>
        ${this.viewport === "small"
          ? html`
              <div
                class="handle"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize tool panel"
                @pointerdown=${this.handleSmallHandlePointerDown}
                @click=${this.handleSmallHandleClick}
              ></div>
            `
          : html``}
        <slot></slot>
      </section>
    `;
  }

  private ensureSmallSheetHeight(): void {
    if (this.smallSheetHeightPx !== null) {
      return;
    }
    const max = this.computeSmallSheetMaxHeight();
    this.smallSheetHeightPx = clamp(
      PtkToolPanel.SMALL_SHEET_DEFAULT_HEIGHT,
      PtkToolPanel.SMALL_SHEET_MIN_HEIGHT,
      max
    );
  }

  private computeSmallSheetMaxHeight(): number {
    if (typeof window === "undefined") {
      return PtkToolPanel.SMALL_SHEET_MAX_HEIGHT_FALLBACK;
    }
    return Math.max(
      PtkToolPanel.SMALL_SHEET_MIN_HEIGHT,
      Math.min(Math.round(window.innerHeight * 0.48), 360)
    );
  }

  private readonly handleSmallHandlePointerDown = (event: PointerEvent): void => {
    if (this.viewport !== "small" || !this.open) {
      return;
    }
    this.ensureSmallSheetHeight();
    const target = event.currentTarget as HTMLElement | null;
    if (!target) {
      return;
    }
    this.dragPointerId = event.pointerId;
    this.dragStartY = event.clientY;
    this.dragStartHeight = this.smallSheetHeightPx ?? PtkToolPanel.SMALL_SHEET_DEFAULT_HEIGHT;
    this.dragMoved = false;
    target.setPointerCapture?.(event.pointerId);
    target.addEventListener("pointermove", this.handleSmallHandlePointerMove);
    target.addEventListener("pointerup", this.handleSmallHandlePointerUp);
    target.addEventListener("pointercancel", this.handleSmallHandlePointerUp);
    event.preventDefault();
  };

  private readonly handleSmallHandlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.dragPointerId) {
      return;
    }
    const deltaY = this.dragStartY - event.clientY;
    if (Math.abs(deltaY) > 2) {
      this.dragMoved = true;
    }
    const next = clamp(
      Math.round(this.dragStartHeight + deltaY),
      PtkToolPanel.SMALL_SHEET_MIN_HEIGHT,
      this.computeSmallSheetMaxHeight()
    );
    this.smallSheetHeightPx = next;
    event.preventDefault();
  };

  private readonly handleSmallHandlePointerUp = (event: PointerEvent): void => {
    const target = event.currentTarget as HTMLElement | null;
    if (target) {
      target.removeEventListener("pointermove", this.handleSmallHandlePointerMove);
      target.removeEventListener("pointerup", this.handleSmallHandlePointerUp);
      target.removeEventListener("pointercancel", this.handleSmallHandlePointerUp);
      if (this.dragPointerId !== null) {
        try {
          target.releasePointerCapture?.(this.dragPointerId);
        } catch {
          // ignore
        }
      }
    }
    this.dragPointerId = null;
  };

  private readonly handleSmallHandleClick = (event: Event): void => {
    if (this.viewport !== "small" || this.dragMoved) {
      this.dragMoved = false;
      return;
    }
    this.ensureSmallSheetHeight();
    const max = this.computeSmallSheetMaxHeight();
    const current = this.smallSheetHeightPx ?? PtkToolPanel.SMALL_SHEET_DEFAULT_HEIGHT;
    const collapsed = PtkToolPanel.SMALL_SHEET_MIN_HEIGHT;
    const expanded = clamp(PtkToolPanel.SMALL_SHEET_DEFAULT_HEIGHT + 16, collapsed, max);
    this.smallSheetHeightPx = current > (collapsed + expanded) / 2 ? collapsed : expanded;
    event.preventDefault();
  };

  private dispatchSmallSheetHeightChange(height: number): void {
    this.dispatchEvent(
      new CustomEvent("ptk-tool-panel-height-change", {
        detail: { height },
        bubbles: true,
        composed: true
      })
    );
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function classMap(classes: Record<string, boolean>): string {
  return Object.entries(classes)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name)
    .join(" ");
}
