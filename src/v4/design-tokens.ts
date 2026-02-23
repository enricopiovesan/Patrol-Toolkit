import { css } from "lit";

export const v4DesignTokens = css`
  :host {
    /* Palette tokens (v1 baseline) */
    --ptk-color-highlight-900: #006ffd;
    --ptk-color-highlight-700: #2897ff;
    --ptk-color-highlight-500: #6fbaff;
    --ptk-color-highlight-300: #b4dbff;
    --ptk-color-highlight-100: #eaf2ff;

    --ptk-color-neutral-light-900: #c5c6cc;
    --ptk-color-neutral-light-700: #d4d6dd;
    --ptk-color-neutral-light-500: #e8e9f1;
    --ptk-color-neutral-light-300: #f8f9fe;
    --ptk-color-neutral-light-100: #ffffff;

    --ptk-color-neutral-dark-900: #1f2024;
    --ptk-color-neutral-dark-700: #2f3036;
    --ptk-color-neutral-dark-500: #494a50;
    --ptk-color-neutral-dark-300: #71727a;
    --ptk-color-neutral-dark-100: #8f9098;

    --ptk-color-success-900: #298267;
    --ptk-color-success-500: #3ac0a0;
    --ptk-color-success-100: #e7f4e8;

    --ptk-color-warning-900: #e86339;
    --ptk-color-warning-500: #ffb37c;
    --ptk-color-warning-100: #fff4e4;

    --ptk-color-error-900: #ed3241;
    --ptk-color-error-500: #ff616d;
    --ptk-color-error-100: #ffe2e5;

    /* Typography tokens */
    --ptk-font-family-base: Inter, ui-sans-serif, system-ui, sans-serif;
    --ptk-font-family-heading: var(--ptk-font-family-base);
    --ptk-font-body-m-size: 14px;
    --ptk-font-body-s-size: 12px;
    --ptk-font-action-m-size: 12px;
    --ptk-font-action-l-size: 14px;
    --ptk-font-heading-h4-size: 14px;
    --ptk-font-heading-h3-size: 16px;
    --ptk-font-weight-regular: 400;
    --ptk-font-weight-semibold: 600;
    --ptk-font-weight-bold: 700;
    --ptk-font-weight-extrabold: 800;

    /* Spacing */
    --ptk-space-1: 4px;
    --ptk-space-2: 8px;
    --ptk-space-3: 12px;
    --ptk-space-4: 16px;
    --ptk-space-6: 24px;

    /* Sizing */
    --ptk-size-control-sm: 34px;
    --ptk-size-control-md: 40px;
    --ptk-size-panel-resort-lg: 320px;
    --ptk-size-shell-max-width: 1200px;

    /* Radius */
    --ptk-radius-sm: 8px;
    --ptk-radius-md: 12px;
    --ptk-radius-lg: 16px;
    --ptk-radius-pill: 999px;

    /* Shadow */
    --ptk-shadow-sm: 0 4px 12px rgba(31, 32, 36, 0.06);
    --ptk-shadow-md: 0 8px 20px rgba(31, 32, 36, 0.08);

    /* Motion */
    --ptk-motion-duration-fast: 120ms;
    --ptk-motion-duration-normal: 180ms;
    --ptk-motion-ease-standard: ease;

    /* Semantic tokens (default theme) */
    --ptk-surface-app: var(--ptk-color-neutral-light-300);
    --ptk-surface-card: var(--ptk-color-neutral-light-100);
    --ptk-surface-subtle: var(--ptk-color-neutral-light-500);
    --ptk-surface-map: linear-gradient(
      180deg,
      var(--ptk-color-neutral-light-300) 0%,
      var(--ptk-color-highlight-100) 100%
    );
    --ptk-border-default: var(--ptk-color-neutral-light-700);
    --ptk-border-muted: var(--ptk-color-neutral-light-500);
    --ptk-text-primary: var(--ptk-color-neutral-dark-900);
    --ptk-text-secondary: var(--ptk-color-neutral-dark-500);
    --ptk-text-muted: var(--ptk-color-neutral-dark-300);
    --ptk-control-bg: var(--ptk-color-neutral-light-100);
    --ptk-control-fg: var(--ptk-color-neutral-dark-900);
    --ptk-control-border: var(--ptk-color-neutral-light-700);
    --ptk-control-selected-bg: var(--ptk-color-highlight-900);
    --ptk-control-selected-fg: var(--ptk-color-neutral-light-100);
    --ptk-control-selected-border: var(--ptk-color-highlight-900);
  }

  :host([data-theme='high-contrast']) {
    --ptk-font-family-base: 'Atkinson Hyperlegible', Inter, ui-sans-serif, system-ui, sans-serif;
    --ptk-font-family-heading: var(--ptk-font-family-base);

    --ptk-surface-app: #eef2ff;
    --ptk-surface-card: #ffffff;
    --ptk-surface-subtle: #e8e9f1;
    --ptk-surface-map: linear-gradient(180deg, #f8f9fe 0%, #dbeafe 100%);
    --ptk-border-default: #71727a;
    --ptk-border-muted: #8f9098;
    --ptk-text-primary: #000000;
    --ptk-text-secondary: #1f2024;
    --ptk-text-muted: #2f3036;
    --ptk-control-bg: #ffffff;
    --ptk-control-fg: #000000;
    --ptk-control-border: #1f2024;
    --ptk-control-selected-bg: #006ffd;
    --ptk-control-selected-fg: #ffffff;
    --ptk-control-selected-border: #003a99;
  }
`;

