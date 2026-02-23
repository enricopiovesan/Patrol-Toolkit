import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { v4DesignTokens } from "./design-tokens";

@customElement("ptk-search-input")
export class PtkSearchInput extends LitElement {
  static styles = css`
    ${v4DesignTokens}

    :host {
      display: block;
    }

    label {
      display: block;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    input {
      width: 100%;
      min-height: var(--ptk-size-control-md);
      border-radius: var(--ptk-radius-pill);
      border: 1px solid var(--ptk-control-border);
      background: var(--ptk-control-bg);
      color: var(--ptk-control-fg);
      font: inherit;
      font-size: var(--ptk-font-body-m-size);
      padding: 0 12px;
      outline: none;
    }

    input:focus {
      border-color: var(--ptk-color-highlight-900);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--ptk-color-highlight-300) 70%, transparent);
    }
  `;

  @property({ type: String })
  accessor value = "";

  @property({ type: String })
  accessor placeholder = "Search resorts";

  protected render() {
    return html`
      <label>
        <span class="sr-only">Search resorts</span>
        <input
          type="search"
          .value=${this.value}
          placeholder=${this.placeholder}
          @input=${this.handleInput}
        />
      </label>
    `;
  }

  private readonly handleInput = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    this.dispatchEvent(
      new CustomEvent<{ value: string }>("ptk-search-change", {
        detail: { value: target.value },
        bubbles: true,
        composed: true
      })
    );
  };
}
