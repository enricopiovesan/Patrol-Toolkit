import { LitElement, css, html } from "lit";
import { customElement } from "lit/decorators.js";
import "./map/map-view";

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
  `;

  render() {
    return html`
      <main class="layout">
        <section class="header">
          <h1>Patrol Toolkit</h1>
          <p>Map foundation with live GPS dot for on-mountain positioning.</p>
        </section>
        <map-view></map-view>
      </main>
    `;
  }
}
