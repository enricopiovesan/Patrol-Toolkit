import { LitElement, css, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("app-shell")
export class AppShell extends LitElement {
  static styles = css`
    :host {
      display: grid;
      place-items: center;
      min-height: 100vh;
      padding: 1rem;
    }

    .card {
      width: min(640px, 100%);
      border-radius: 12px;
      padding: 1.5rem;
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
    // v0.0.1 bootstrap keeps UI intentionally minimal while we validate the offline/location pipeline.
    return html`
      <main class="card">
        <h1>Patrol Toolkit</h1>
        <p>Offline-first patrol location intelligence starts here.</p>
      </main>
    `;
  }
}
