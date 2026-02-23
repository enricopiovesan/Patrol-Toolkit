# Design System Spec v1

## Scope
- Defines the v4 design system for the new UI path (`/new`).
- Covers token system, themes, typography, layout primitives, and component conventions.
- This spec is a Slice 1 deliverable and must be approved before UI code starts.

## Source References
- `/Users/piovese/Documents/Patrol Toolkit/spec/UX/design system spec v1.png`
- `/Users/piovese/Documents/Patrol Toolkit/roadmaps/roadmap_v4.md`

## Viewport Breakpoints (Locked)
- `small`: `< 768px`
- `medium`: `>= 768px and < 1024px`
- `large`: `>= 1024px`

## Theme Model (Locked)
- Runtime-selectable themes:
  - `default`
  - `high-contrast`
- Themes are token-driven and must not require component markup changes.
- Theme switcher entry point is Settings/Help panel only.
- Font recommendation for v1:
  - `default`: Inter
  - `high-contrast`: Atkinson Hyperlegible (with Inter/system fallbacks)

## Token Categories (v1)
- Color
- Typography (including font family tokens)
- Spacing
- Sizing
- Radius
- Shadow
- Motion
- Breakpoints
- Z-index/layering (for map-first overlays and sheets/panels)

## Color Tokens (v1 Baseline)
Reference: `design system spec v1.png`

### Highlight / Primary
- `--ptk-color-highlight-900`: `#006FFD`
- `--ptk-color-highlight-700`: `#2897FF`
- `--ptk-color-highlight-500`: `#6FBAFF`
- `--ptk-color-highlight-300`: `#B4DBFF`
- `--ptk-color-highlight-100`: `#EAF2FF`

### Neutral (Light)
- `--ptk-color-neutral-light-900`: `#C5C6CC`
- `--ptk-color-neutral-light-700`: `#D4D6DD`
- `--ptk-color-neutral-light-500`: `#E8E9F1`
- `--ptk-color-neutral-light-300`: `#F8F9FE`
- `--ptk-color-neutral-light-100`: `#FFFFFF`

### Neutral (Dark)
- `--ptk-color-neutral-dark-900`: `#1F2024`
- `--ptk-color-neutral-dark-700`: `#2F3036`
- `--ptk-color-neutral-dark-500`: `#494A50`
- `--ptk-color-neutral-dark-300`: `#71727A`
- `--ptk-color-neutral-dark-100`: `#8F9098`

### Support / Semantic
- Success:
  - `--ptk-color-success-900`: `#298267`
  - `--ptk-color-success-500`: `#3AC0A0`
  - `--ptk-color-success-100`: `#E7F4E8`
- Warning:
  - `--ptk-color-warning-900`: `#E86339`
  - `--ptk-color-warning-500`: `#FFB37C`
  - `--ptk-color-warning-100`: `#FFF4E4`
- Error:
  - `--ptk-color-error-900`: `#ED3241`
  - `--ptk-color-error-500`: `#FF616D`
  - `--ptk-color-error-100`: `#FFE2E5`

### Theme Mapping Rules
- `default` theme maps semantic and surface tokens to the palette above.
- `high-contrast` theme may override values for stronger contrast, but must preserve token names and semantics.
- Components consume semantic/surface tokens, not raw palette values.

## Typography Tokens (v1 Baseline)
Reference: `design system spec v1.png`

### Font Family
- `--ptk-font-family-base`: `Inter, ui-sans-serif, system-ui, sans-serif`
- `--ptk-font-family-heading`: `var(--ptk-font-family-base)`
- Theme token mapping (v1):
  - `default`
    - `--ptk-font-family-base`: `Inter, ui-sans-serif, system-ui, sans-serif`
    - `--ptk-font-family-heading`: `Inter, ui-sans-serif, system-ui, sans-serif`
  - `high-contrast`
    - `--ptk-font-family-base`: `"Atkinson Hyperlegible", Inter, ui-sans-serif, system-ui, sans-serif`
    - `--ptk-font-family-heading`: `"Atkinson Hyperlegible", Inter, ui-sans-serif, system-ui, sans-serif`

### Heading Scale
- `H1`: Extra Bold / 24
- `H2`: Extra Bold / 18
- `H3`: Extra Bold / 16
- `H4`: Bold / 14
- `H5`: Bold / 12

### Body Scale
- `XL`: Regular / 18
- `L`: Regular / 16
- `M`: Regular / 14
- `S`: Regular / 12
- `XS`: Medium / 10

### Action Scale
- `L`: Semi Bold / 14
- `M`: Semi Bold / 12
- `S`: Semi Bold / 10

### Caption Scale
- `M`: Semi Bold / 10

### Typography Rules
- Typography scale is shared across themes.
- Font family is theme-token controlled and can differ by theme.
- Component specs reference semantic type tokens (for example `Heading/H3`, `Body/M`, `Action/M`) rather than raw sizes.
- Webfont fallback policy (v1):
  - UI must remain readable and layout-stable with fallback system fonts if webfonts fail to load.
  - Components must not depend on exact webfont metrics for functional layout/interaction.
  - Offline use must not assume network font fetch succeeds.
  - Font stacks must always include local/system fallbacks.

## Spacing Tokens (v1)
- Use a 4px base grid.
- Required tokens:
  - `--ptk-space-1`: `4px`
  - `--ptk-space-2`: `8px`
  - `--ptk-space-3`: `12px`
  - `--ptk-space-4`: `16px`
  - `--ptk-space-5`: `20px`
  - `--ptk-space-6`: `24px`
  - `--ptk-space-8`: `32px`
  - `--ptk-space-10`: `40px`
  - `--ptk-space-12`: `48px`

## Sizing Tokens (v1)
- Define tokenized control heights and common dimensions used across viewports:
  - control heights (`sm`, `md`, `lg`)
  - icon button sizes
  - panel handle sizes
  - max content widths for `medium`/`large`

## Radius Tokens (v1)
- `--ptk-radius-sm`
- `--ptk-radius-md`
- `--ptk-radius-lg`
- `--ptk-radius-xl`
- `--ptk-radius-pill`

## Shadow Tokens (v1)
- `--ptk-shadow-sm`
- `--ptk-shadow-md`
- `--ptk-shadow-lg`
- `--ptk-shadow-overlay`

## Motion Tokens (v1)
- Duration tokens:
  - `fast`
  - `normal`
  - `slow`
- Easing tokens:
  - standard
  - emphasize
  - exit
- Motion must be subtle and support map-first interaction; avoid decorative animation on critical controls.

## Layering / Z-Index Tokens (v1)
- Required semantic layers:
  - app chrome
  - map controls
  - bottom sheet / sidebar
  - modal / dialog
  - toast / transient status

## Layout Primitive: Responsive Tool Panel (Locked)
- Same component contract across viewports.
- `small`:
  - bottom sheet presentation
  - overlays map
  - supports collapsed/expanded states
  - page specs define default open state on initial load (v1 Resort Page = fully open)
  - page specs define fullscreen-map interaction (v1 Resort Page = close sheet fully on enter)
- `medium` and `large`:
  - left sidebar presentation
  - persistent or docked behavior per page spec
- Width behavior:
  - `large` Resort Page sidebar uses a fixed width token (`--ptk-size-panel-resort-lg`), not percentage width
  - token value finalized during implementation against approved UI spec visuals
- State model and content composition are shared across presentations.
- Interaction baseline:
  - if a page hides the tool panel for fullscreen map (`small` or `medium`), exiting fullscreen restores the previous panel state

## Component Conventions (Lit)
- Custom element prefix: `ptk-*`
- File names: kebab-case
- Component responsibilities:
  - presentation and local interaction only
  - no domain/business logic embedded in component rendering layer
- Component APIs must be documented in `ui_spec_v1.md`:
  - props
  - events
  - slots
  - state ownership

## Do / Do Not Rules (v1)
### Do
- Use semantic tokens in component styles.
- Use shared viewport primitives and responsive rules from this spec.
- Keep theme switching runtime-driven and centralized.

### Do Not
- Hardcode colors, fonts, spacing, radius, or shadows in `/new` UI components.
- Add viewport-specific duplicate components when one component can adapt by viewport.
- Put business logic in UI components.

## Approval Checklist
- [x] Breakpoint ranges approved (`small`, `medium`, `large`)
- [x] Color token palette and semantic mapping approved
- [x] Typography scale + font-family token strategy approved
- [x] Token categories complete for v4 implementation start
- [x] Responsive tool panel primitive behavior approved (`small` bottom sheet, `medium/large` sidebar)
- [x] Lit component conventions approved
- [x] No unresolved design-system decisions blocking `Slice 2`
