# Design System and Accessibility Requirements

## 1. Brand alignment

The brandbook is supplied: `NGOinfoSources/brand_book_barykady_kultury_red_scarlet copy.pdf` (19 pages, 2026, Danylo Shulha). The values below are transcribed from it and cross-checked against the supplied logo SVGs; they are authoritative.

Verified palette:

| Token | Hex | RGB | Role |
|---|---|---|---|
| `scarlet` | `#C60001` | 198, 0, 1 | Accent, logo color, primary-action emphasis |
| `nero` | `#262424` | 38, 36, 36 | Primary text, dark surfaces |
| `GRAY93` | `#EDEDED` | 237, 237, 237 | Primary background |

`GRAY93` is 93 % white — **not** `#939393`. Never derive a value from the token name; quote the hex from this table or the brandbook.

### Contrast constraints (measured)

| Pair | Ratio | Verdict |
|---|---|---|
| nero on GRAY93 | 13.19:1 | AAA body text |
| white on scarlet | 6.17:1 | AA body text |
| scarlet on GRAY93 | 5.27:1 | AA body text; use sparingly |
| scarlet on nero | 2.50:1 | **Forbidden for text.** Dark theme needs a lightened accent variant for text/links that clears 4.5:1; pure brand scarlet stays for surfaces carrying white text. |

Ratios are computed with the WCAG 2.x relative-luminance formula and rounded to two decimals.

The brandbook supplies exactly three colors. Any additional token (borders, muted text, links, focus, success/warning/error) must be derived and documented with its own measured contrast — not guessed and not borrowed from an unrelated palette.

Represent colors with semantic design tokens rather than scattering raw values across components. Provide light and dark values for every token, including form controls, dialogs, dropdowns, borders and disabled states. Where a brand value fails contrast in a particular use, keep the brand identity and add an accessible variant for that role instead of using the low-contrast color unchanged.

### Logo and logotype rules (brandbook p. 8–9, 12)

- **Logo** (mark + type) for shorter, compact formats; **logotype** for longer formats. Leave equal space between the mark and the type and between lines of type.
- Use the red or black variant on a solid background; when two colors are used they must contrast; when all three brand colors appear, keep the brandbook order.
- Provide a light-surface and a dark-surface variant. Never place the black logo on nero, or the red logo on scarlet.
- Exact minimum sizes and numeric clear-space values are **not** specified in the brandbook. Derive one clear-space spacing token and record it here rather than inventing a measurement.

**Logo clear space token (T-008, D-19):** `--logo-clear-space: 0.5rem` (8 px at the 16 px root scale). Applied as equal padding on all four sides of the `.brand-logo` wrapper in `BrandLogo.vue`. Derived as the body-text x-height approximation (≈ 0.5 rem at 16 px base, consistent with the `gap: 0.5rem` used in other layout components). The brandbook mandates "equal clear space on all sides" without a numeric value; this token is the minimum — callers may increase it via the CSS custom property but must not reduce below it.

**Dark-surface variant (T-008, updated by brand-fixes v3):** use `logo_red_small` (SCARLET ring + white interior) for the logo mark on dark backgrounds. For the **logotype** a derived-inverse now exists: `logotype_gray93_web.svg` — identical path data and tight viewBox to `logotype_red_web.svg`, with only the fill recoloured SCARLET → GRAY93 (measured 12.35:1 on the dark `--color-surface`, AAA). `BrandLogo` with `tone="auto"` selects it in dark mode; recolouring the asset (not a CSS filter) keeps the SVG self-contained and mirrors the derivation precedent of the `_web` tight-viewBox files. This change was required because the header now shows the full logotype as a prominent readable wordmark (user decision, brand-fixes series), where the old SCARLET-on-NERO 2.5:1 could no longer be tolerated as "decorative".

**Favicon mark (T-034, v3):** the tab icon is a dedicated asset, `src/assets/brand/favicon_mark.svg` — a plain, bold, filled letter "B" (hand-drawn geometric path outlines with `fill-rule="evenodd"` counters, no `<text>` element and therefore no font dependency) in GRAY93 on a solid SCARLET block (5.27:1 glyph-on-surface; the red block reads on light and dark browser chrome). It deliberately departs from the brandbook emblem shape at icon sizes: the abstract barricade does not read at 16 px, a bold "B" does — recorded here as an approved derived use, palette unchanged (D-13). `scripts/generate-favicons.mjs` copies the mark **verbatim** to `public/favicon.svg` and rasterises the PNG/ICO fallbacks from it; the favicon test suite enforces the verbatim-copy contract.

## 2. Typography

Inter is confirmed by the brandbook (p. 13–14) with Black, Bold, Medium, Regular and Light weights. Self-host it from a pinned package with Latin, Latin Extended and Cyrillic subsets for Polish, Ukrainian and English. Verify glyph coverage, loading, fallback and license; do not depend on a third-party font CDN.

Printed hierarchy anchors: **display 64 px** (Medium/Bold), **section heading 34 px** (Bold), **body 16 px** (Regular). Scale fluidly below the desktop anchor rather than shrinking the scale ad hoc.

- Use comfortable body line-height, readable line lengths and a visible heading hierarchy.
- Do not use font size, weight or color as the only indicator of state.
- Confirm real glyph coverage for Polish diacritics and Ukrainian Cyrillic before declaring the type system final.

## 3. Visual direction

The result should look deliberate, contemporary, credible, and welcoming—not like an unmodified admin template. Use the reference websites for content hierarchy ideas only. Do not copy their logos, text, photographs, or exact page composition.

Design priorities:

- Clear hierarchy between mission, primary actions, projects, events, and publications.
- Restrained use of scarlet as an accent rather than coloring every button or surface.
- Consistent spacing, border radii, container widths, iconography, and content card behavior.
- Strong and purposeful typography, legible line lengths, and sufficient whitespace.
- Real organizational imagery only when supplied and approved. Use tasteful neutral placeholders in development, never invented pictures presented as genuine staff/projects.
- Avoid gratuitous animation, parallax, decorative motion, giant marketing gradients, and visual effects that make the NGO content harder to scan.

## 4. Header and navigation

- Desktop: top navigation for Contact, About us, Support us, Projects, Events, Publications; language/theme controls and configured social links in a clear, consistent header area.
- Social controls display only configured destinations and have accessible names; icon-only links need an accessible label.
- About subsections (organization information, team, documents) must be discoverable with clear sub-navigation or a well-structured About landing page.
- Mobile: use a compact, keyboard- and screen-reader-operable navigation pattern with obvious open/close state. Avoid requiring hover. The navigation must not overflow or cover the page in an unusable way.
- Keep a visible route to Support us without making it visually dominate every other action.

## 5. Theme tokens and preference handling

Define semantic CSS variables (or an equivalent design-token mechanism), for example:

- `--color-background`
- `--color-surface`, `--color-surface-raised`, `--color-surface-danger`
- `--color-text`, `--color-text-muted`
- `--color-accent`, `--color-accent-text`
- `--color-border`, `--color-form-border`, `--color-form-bg`, `--color-dialog-bg`
- `--color-link`, `--color-focus`
- `--color-success`, `--color-warning`, `--color-danger`
- `--color-overlay` — modal/drawer scrim
- `--color-skeleton`, `--color-skeleton-shine` — QSkeleton placeholder
- `--shadow-sm/md/lg`, `--motion-duration`

Provide light and dark values for all tokens, including form controls, dialogs, dropdowns, borders, charts if any, and disabled states. Avoid a partial dark mode in which only the page background changes.

### Dark-mode selector contract (D-20)

The CSS token dark mode is triggered exclusively by `[data-theme="dark"]` on `<html>`. The `.dark` class must not be used. The T-010 boot file coordinates both `[data-theme="dark"]` (CSS custom properties) and `Quasar.Dark.set()` (Quasar component internals) as a single action. System preference falls back to `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }`.

### Step scales for derived tokens

Surface tokens use OKLCH lightness increments of **ΔL ≈ 0.020/step**:
- Light: GRAY93 (L=0.946) → surface +1 (L≈0.967) → surface-raised +2 (L≈0.985)
- Dark: NERO (L=0.263) → surface +1 (L≈0.283) → surface-raised +3 (L≈0.323)

Border tokens use a coarser **ΔL ≈ 0.035/step** for greater visual separation:
- Light: GRAY93 → border −2 steps (L≈0.876 = `#D6D6D6`) → form-border −3 steps (L≈0.842 = `#CBCBCB`)
- Dark: NERO → border +7 steps (L≈0.404 = `#4A4848`)

### Dark-mode accent vs link divergence

In dark mode `--color-accent` (`#FA4C3C`) and `--color-link` (`#FF6D5A`) are intentionally different values. A single colour cannot serve both as an accent *surface* carrying NERO text (needs low enough lightness to keep NERO ≥ 4.5:1 on it) and as inline *link text* on the lightest dark surfaces (needs high enough lightness to exceed 4.5:1 on `--color-surface-raised`). The link value is raised to OKLCH L=0.756 so it passes on all three dark surfaces; the accent value stays at L=0.661 to remain viable for surface use.

### `$info` Quasar variable (no CSS token)

`$info` is set in `src/css/quasar.variables.scss` (accessible blue `#1A56DB`) for Quasar component internals only. There is no `--color-info` CSS custom property in `tokens.css`. No site-authored component should reference a raw Quasar `$info` variable; if a semantic info token is needed a future ticket should add `--color-info` to `tokens.css` with a documented contrast pair.

### Token completeness requirement

A partial dark mode is explicitly forbidden (DESIGN_SYSTEM.md §5, `tokens.test.ts`). Every token in `src/shared/color/tokenNames.ts → REQUIRED_TOKENS` must appear in both `:root` and `[data-theme="dark"]`. The test enforces this mechanically.

Initial theme follows `prefers-color-scheme`. A user's explicit toggle overrides system preference and persists. If no override is saved, continue to respond to changes in the operating system preference. Use accessible visible labels or a clear pressed state for the theme control.

## 6. Accessibility target

Target **WCAG 2.2 Level AA** for public and administrative interfaces. Automated scans help but do not by themselves prove conformance.

Required patterns:

- Semantic landmarks and heading hierarchy; one clear main landmark and a skip-to-content link.
- Complete keyboard operation for navigation, dropdowns, forms, dialogs, tabs, tables, and admin actions.
- Visible, high-contrast keyboard focus; no keyboard traps.
- Correct accessible names, roles, states, and relationships. Icon-only buttons/links must have meaningful names.
- Form controls have persistent labels, instructions where needed, and errors associated programmatically with the relevant field. Announce submission status appropriately.
- Color contrast meets WCAG AA (generally 4.5:1 for normal text and 3:1 for large text and meaningful UI graphics/boundaries).
- Never use color alone to communicate status or errors.
- Images have meaningful alternative text when informative and empty alternative text when decorative.
- Tables and document links have understandable headings/labels and predictable reading order.
- Motion respects `prefers-reduced-motion`; avoid flashing and unnecessary animation.
- Layout works at narrow mobile widths, 200% browser zoom, text enlargement, and longer translated strings.
- Language changes update document language metadata. Content excerpts that fall back to a different language should be identified appropriately when practical.
- Embedded third-party content must have a title and usable fallback. The events list must remain usable without an iframe.

Add automated accessibility checks to component/E2E testing and perform keyboard/manual checks for the major journeys before release.
