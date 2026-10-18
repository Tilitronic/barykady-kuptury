# T-007 — Typography: self-hosted Inter + scale

**Session:** 2 · **Lane:** design-system · **Owner:** @designer · **Status:** todo
**Reviewers:** @reviewer + @designer
**Depends on:** T-006 · **Blocks:** T-008, T-011, T-016

## Outcome
Inter is self-hosted with Latin, Latin Extended and Cyrillic coverage; the type scale reflects the brandbook hierarchy and scales fluidly without breaking at 200 % zoom.

## Scope
In:
- Add `@fontsource-variable/inter` (or pinned static weights if variable subsetting is problematic) and import `latin`, `latin-ext`, `cyrillic` subsets — no third-party font CDN.
- Remove Quasar `roboto-font` extra from `quasar.config.ts`.
- `src/css/typography.css`: scale tokens `--font-size-display`, `--font-size-h1…h4`, `--font-size-body`, `--font-size-small`, line-heights, measure (`max-width: ~68ch`), weights per brandbook (Block: 64 px display, 34 px section, 16 px body as the desktop anchors).
- Fluid scaling with `clamp()` between mobile and the brandbook desktop anchors.
- Unit test asserting the scale is monotonic and every anchor maps to the brandbook value at its design width (`scale.test.ts` over an exported scale object).
- `font-display: swap` and preload for the primary weight.

Out: component typography (applied per feature), icon font choice, logo (T-008).

## Design constraints
- `docs/DESIGN_SYSTEM.md` §2 (Inter provisional, subsets, no CDN, glyph coverage), §6 (200 % zoom, longer translations).
- Brandbook p. 13–14 (Inter; 64 / 34 / 16 px).

## TDD plan
1. RED: `scale.test.ts` asserts `scale.display.desktop === '64px'` and `scale.body.desktop === '16px'` — fails, module missing.
2. GREEN: implement the scale module and CSS tokens from it.
3. RED/GREEN: assert `latin-ext` and `cyrillic` font files are referenced (string assertion over the generated CSS or the imported package paths).
4. REFACTOR: generate CSS custom properties from the single scale object.

## Acceptance criteria
- [x] No request to `fonts.googleapis.com`/`fonts.gstatic.com` in build output.
- [x] Inter resolves for Polish diacritics (`ą ć ę ł ń ó ś ź ż`) and Ukrainian Cyrillic (`і ї є ґ`) — verified with a rendered-check page or Playwright font-load assertion.
- [x] Brandbook anchors present at desktop width; scale monotonic and non-overlapping.
- [x] Body measure keeps lines readable at wide viewports.
- [x] Text remains usable at 200 % zoom and with `$font-size` user settings.
- [x] Quasar Roboto extra removed and no layout depends on it.

## Verification
```
pnpm test --run src/css
pnpm build && rg -i "fonts\\.(googleapis|gstatic)" dist || true
pnpm test:e2e --grep typography
```

## Review gate
- @reviewer: self-hosting verified in build output, subset coverage proven (not assumed), scale tests can fail.
- @designer: hierarchy reads as intentional; display size does not overwhelm mobile.

## Log
- (author) start:
- (designer) implementation complete — summary below.

### RED evidence
`pnpm test --run src/shared/typography` with `scale.test.ts` present but `scale.ts` absent:
```
FAIL  src/shared/typography/__tests__/scale.test.ts
Error: Failed to resolve import "@/shared/typography/scale" from "src/shared/typography/__tests__/scale.test.ts".
  Does the file exist?
Test Files  1 failed (1) · Tests  no tests
```
Font-file coverage tests also ran RED (ENOENT on typography.css missing) before that file existed.

### Preload decision and trade-off
**Chosen: self-host woff2 under `public/fonts/` with hand-written `@font-face` + stable `<link rel="preload">` in `index.html`.**

Considered alternative — import `@fontsource-variable/inter/wght.css` directly:
  - Vite emits woff2 files with content hashes (e.g. `inter-latin-wght-normal-XXXXXXXX.woff2`).
  - A `<link rel="preload">` in `index.html` must reference the same URL as the CSS `font-src`.
  - Content hashes are only known after the build, so the preload href cannot be hard-coded in source HTML.
  - A Vite `transformIndexHtml` plugin could scan the manifest and inject the correct hash at build time, but this is brittle across Vite version changes.

Chosen approach gives **one URL per font file, zero mismatch risk**:
  - CSS `url("/fonts/inter-latin-wght-normal.woff2")` and preload `href="/fonts/inter-latin-wght-normal.woff2"` are identical strings in both source and built artifact.
  - `default-src 'self'` in the existing CSP covers same-origin font requests without any CSP change.
  - The preload is directly testable (exact path is predictable).

**Trade-off**: Four woff2 files are checked into `public/fonts/`. When `@fontsource-variable/inter` is upgraded, they must be re-copied from `node_modules/@fontsource-variable/inter/files/`. A `postinstall` hook could automate this; deferred to a future ticket.

### Dependency justification
`@fontsource-variable/inter@5.3.0` — Inter Variable woff2 font files with unicode-range subsets; provides the woff2 source for self-hosting under `public/fonts/`. Required by DESIGN_SYSTEM.md §2 and brandbook p. 13–14 (Inter confirmed).

### Files created / changed
- `src/shared/typography/scale.ts` — TypeScript scale module (single source of truth for fluid values)
- `src/shared/typography/__tests__/scale.test.ts` — 14 unit tests (brandbook anchors, monotonicity, font-file coverage, CSS custom properties)
- `src/css/typography.css` — self-hosted @font-face declarations + CSS custom properties
- `src/css/app.scss` — added `@import "./typography.css"`
- `quasar.config.ts` — removed `"roboto-font"` from extras
- `index.html` — added `<link rel="preload" as="font" ...>` for latin subset
- `public/fonts/` — 4 woff2 files (latin, latin-ext, cyrillic, cyrillic-ext)
- `e2e/typography.spec.ts` — 3 E2E tests

### Verification results (initial implementation)
```
pnpm test (full suite):
  Test Files  18 passed (18)   [was 17]
  Tests       186 passed (186) [was 172, +14 new]

pnpm typecheck:
  Clean — pre-existing vue-router rootDir advisory only (not a T-007 concern)

pnpm lint:check:
  All matched files use the correct format. Finished in 657ms on 89 files.

pnpm build && grep fonts.googleapis/gstatic dist/:
  Build succeeded. grep → No files found (zero CDN references).

pnpm test:e2e --grep typography:
  3 passed (3 new tests: Latin/Polish, Ukrainian Cyrillic, no Google CDN)

pnpm test:e2e (full suite):
  19 passed (all existing tests + 3 new typography tests)
```

---

### Review findings applied (des-2 + rev-2)

**A1 — Base element layer added** (`typography.css` §4):
  h1–h4, p, small now receive font-size + line-height + weight tokens from the
  element layer. Heading margins reset to 0 (UA margins vary; layout spacing
  belongs in feature components). `--prose-measure` applied only via `.prose`
  utility class, never on bare `<p>`, to avoid constraining card/utility
  paragraphs. `.text-display` utility added for hero usage.

**A2 — h4 weight: 600** added to `scale.ts weights.h4`, `--font-weight-h4: 600`
  in `:root`, h4 element rule sets `font-weight: var(--font-weight-h4)` explicitly
  (also satisfies A4 — explicit weight cannot be inherited away).

**A3 — Display weight: 500 (Medium) chosen** over 700.
  Brandbook p. 13 sanctions both "Medium" and "Bold". At 40–64 px, 500 reads as
  a more refined editorial register for a cultural NGO and creates stronger
  contrast with 700 headings below it. Display dominates through sheer size;
  500 keeps it from competing in visual density with h1/h2.

**B — Single source of truth made machine-gated**:
  - `scale.ts` doc comment corrected: "hand-mirrored and machine-gated", not
    "generated".
  - `fluidClamp` fixed to strip trailing zeros (parseFloat+toString) so module
    output matches what the CSS formatter writes; all 7 font-size string
    comparisons are now reliable.
  - `lineHeights`, `weights`, `measure` exported from `scale.ts`.
  - `scale.test.ts` gate extended: all 7 `--font-size-*` tokens, all 4
    line-heights, all 5 weights, prose-measure, and the element-layer structural
    checks (h1–h4, p, small, `.text-display`, `.prose`).

### Verification results (after review findings)
```
pnpm test (full suite):
  Test Files  18 passed (18)
  Tests       208 passed (208)  [was 186, +22 new tests from extended gate]

pnpm typecheck:
  Clean — pre-existing vue-router rootDir advisory only

pnpm lint:check:
  All matched files use the correct format. Finished in 687ms on 89 files.

pnpm build:
  Build succeeded.

grep for fonts.googleapis/gstatic in dist/:
  No files found (zero CDN references).

pnpm test:e2e --grep typography:
  3 passed
```

---

### Review verdicts and close-out (2026-10-18)

Two independent reviews on the uncommitted tree (fixed point `bb38531`).

**@reviewer (rev-2) — two-axis:**
- Standards **[Major]** (hand-mirrored `scale.ts` ↔ `typography.css`, only 2/7 size
  tokens gated) → **resolved** by the extended machine gate (all 7 sizes, 4
  line-heights, 5 weights, measure + element-layer structure).
- Spec **[Critical]** (redistributed Inter binaries lacked the OFL license) →
  **resolved**: `public/fonts/OFL.txt` (OFL 1.1) + a LICENSE note in the
  `typography.css` header.
- Concerns 1–6 re-checked: **all PASS** (dependency justification present with a
  documented manual-copy risk; preload URL byte-identical to the CSS `url()` and
  present in the built `index.html`; anchors + monotonicity fail-capable; Roboto
  removed; no CDN reference in `dist/`).
- Re-run: `pnpm test` 18/208 passed; `typecheck`/`lint:check`/`build` clean;
  `pnpm test:e2e` 19 passed.

**@designer (des-2) — design review: Pass.**
- ❶ **[Critical]** no element-level rules → resolved (base layer §4: `h1–h4`,
  `p`, `small`; `.text-display`/`.prose` utilities; `margin: 0` documented).
- ❷ **[Required]** h3/h4 mobile indistinct → resolved (h4 weight 600; explicit
  element weight cannot be inherited away).
- ❸ **[Recommended]** display register → resolved (weight 500; size-dominant).
- ❹ **[Advisory]** h4↔body mobile gap → confirmed acceptable (now two cues).

**Orchestrator independent verification (committed-tree-equivalent):**
`pnpm test` 18/208 · `typecheck` clean · `lint:check` clean · `build` succeeded ·
no `fonts.googleapis/gstatic` in `dist/` · `pnpm test:e2e` 19 passed.

**Non-blocking notes carried forward to T-011:**
- `h5`/`h6` have no base rules (T-011 must not rely on them, or add them there).
- `.text-display` is opt-in — the T-011 hero headline must apply it explicitly.
- `body` has no explicit `font-weight` (inherits UA 400 = `--font-weight-body`).
- The four woff2 files in `public/fonts/` must be re-copied if
  `@fontsource-variable/inter` is upgraded (a `postinstall` hook was deferred).

**Close-out:** acceptance criteria all satisfied; ticket moved to `done`.
