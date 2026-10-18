# T-008 — BrandLogo component

**Session:** 2 · **Lane:** design-system · **Owner:** @designer · **Status:** todo
**Reviewers:** @reviewer + @designer
**Depends on:** T-006, T-007 · **Blocks:** T-011, T-016

## Outcome
A single `BrandLogo` component renders the supplied brand assets with correct variant selection, clear space, and accessible behaviour.

## Scope
In:
- Copy approved assets from `NGOinfoSources/logo/SVG-*/SVG/` into `src/assets/brand/` with stable names: `logo_red.svg`, `logo_black.svg`, `logotype_red.svg`, `logotype_black.svg` (+ the `_small` white-padding variants if used on coloured surfaces).
- `src/components/brand/BrandLogo.vue` props: `kind: 'logo' | 'logotype'`, `tone: 'red' | 'black' | 'auto'`, `size` (token-based, not arbitrary px), optional `alt`.
- Rule enforcement: `kind` default comes from a documented usage rule (logo for compact/header contexts, logotype for wide/footer contexts) rather than free choice at call sites.
- Clear space: wrapper applies the brandbook's equal-space rule as padding derived from a single spacing token.
- Accessibility: decorative when the organization name is adjacent in text (`aria-hidden`), otherwise `role="img"` + `aria-label` from i18n; never an empty `alt` on a linked logo.
- Component tests: variant→src mapping, aria behaviour, no raw `#C60001` in template.

Out: favicon/manifest/OG images (T-034), social share cards.

## Design constraints
- Brandbook p. 8–9, 12 (logo vs logotype usage, equal clear space, solid backgrounds, three-color order).
- `docs/DESIGN_SYSTEM.md` §1, §4 (header), §6 (accessible names).

## TDD plan
1. RED: `BrandLogo.test.ts` — `renders the red logotype for wide contexts` and `is aria-hidden when the name is adjacent` fail (component missing).
2. GREEN: implement component + asset copying.
3. RED/GREEN: test that a linked logo has a non-empty accessible name.
4. REFACTOR: extract usage rule into `resolveLogoVariant(context)` pure fn with its own unit test.

## Acceptance criteria
- [x] All four primary variants render from local assets; no remote asset URL.
- [x] `resolveLogoVariant` unit-tested for header/footer/compact/wide contexts.
- [x] Clear space applied via token, not ad-hoc margin.
- [x] Accessible name present on linked logos; decorative usage hidden from AT.
- [x] No component hard-codes a brand hex; tone maps to asset choice.
- [x] Works on dark background without a white box (use the correct variant or documented surface).

## Verification
```
pnpm test --run src/components/brand
pnpm typecheck && pnpm lint:check
```

## Review gate
- @reviewer: asset provenance matches the brandbook files, no stretched/distorted rendering, aria correctness.
- @designer: proportions, clear space, and dark-surface behaviour look correct at header and footer sizes.

## Log
- (author) start:
- (designer) implementation complete — summary below.

### RED evidence
`pnpm test --run src/components/brand` with `BrandLogo.test.ts` present before `BrandLogo.vue` existed:
```
FAIL  src/components/brand/__tests__/BrandLogo.test.ts
Error: Failed to resolve import "@/components/brand/BrandLogo.vue"
  Does the file exist?
Test Files  1 failed (1) · Tests  no tests
```

### Subset-loading + preload approach
Not applicable (no fonts). SVGs are self-hosted in `src/assets/brand/` and imported as Vite static asset URLs (`import src from '@/assets/brand/logo_red.svg'`). The `env.d.ts` SVG module declaration enables TypeScript to resolve these imports.

### Clear-space token derivation
The brandbook mandates "equal clear space on all sides" with no numeric value. Derived as `--logo-clear-space: 0.5rem` (8 px at 16 px base):
- Equals the body-text x-height approximation at the design scale
- Matches `gap: 0.5rem` used in other layout components (LanguageSwitcher)
- Consistent with the spacing baseline of the type system
Recorded in `docs/DESIGN_SYSTEM.md` §1 per D-19 (that file owns verified design values).

### Dependency justification
No new dependencies. SVGs copied from supplied source assets (`NGOinfoSources/logo/SVG-*/SVG/`).

### Files created / changed
- `src/assets/brand/` — 6 SVG files copied from NGOinfoSources
- `src/components/brand/resolveLogoVariant.ts` — pure usage-rule function
- `src/components/brand/BrandLogo.vue` — component
- `src/components/brand/__tests__/BrandLogo.test.ts` — 24 unit tests
- `src/i18n/en/index.ts`, `pl/index.ts`, `uk/index.ts` — added `brand.logoLabel`
- `env.d.ts` — added `declare module '*.svg'`
- `docs/DESIGN_SYSTEM.md` §1 — clear-space token documented

### Verification results
```
pnpm test --run src/components/brand:
  Test Files  1 passed (1)
  Tests       24 passed (24)

pnpm test (full suite):
  Test Files  19 passed (19)   [was 18]
  Tests       232 passed (232) [was 208, +24 new tests]

pnpm typecheck:
  Clean — pre-existing vue-router rootDir advisory only

pnpm lint:check:
  All matched files use the correct format. 92 files.
```

### Review findings applied (des-2 + rev-2)

#### des-2 [Critical] — Logotype proportions

**Measurement method**: Playwright headless Chromium script run outside the repo at `/tmp/opencode/measure-svg-bbox.cjs`. Used `page.setContent(svgMarkup)` then `element.getBBox()` across all leaf path/shape elements to determine the precise content bounding box.

**Measured content bboxes** (Chromium getBBox, exact):

| Asset | x | y | w | h | canvas | content h% |
|---|---|---|---|---|---|---|
| logotype_red / logotype_black | 115.27 | 324.70 | 590.58 | 171.65 | 821.11 × 821.11 | **20.9 %** |
| logo_red / logo_black | 159.10 | 108.91 | 518.92 | 603.27 | 821.11 × 821.11 | **73.5 %** |
| logo_red_small / logo_black_small | 205.53 | 162.91 | 426.09 | 495.31 | 821.11 × 821.11 | **60.3 %** |

**Logotype fix chosen**: tight-viewBox derivative SVGs (`logotype_red_web.svg`, `logotype_black_web.svg`).

- Identical path data to the originals; only the `viewBox` attribute is changed.
- viewBox set to `"113.27 322.70 594.58 175.65"` (content bbox minus a 2-unit margin on each side to prevent hairline clipping of path edges).
- Rendered aspect ratio: 594.58 / 175.65 = **3.39:1**.
- `data-provenance` attribute embedded in the SVG element documents the derivation.
- At `md` (48 px height): wordmark renders at **48 px** tall (correct; was 13.4 px before).
- At `lg` (64 px height): wordmark renders at **64 px** tall (correct; was 17.9 px before).
- BrandLogo.vue updated: logotype kind now imports `logotype_*_web.svg` with `width: auto` so the browser uses the correct 3.39:1 aspect ratio.

**Logo mark justification** (logo_red, logo_black): content occupies 73.5% of canvas height. At `md` (48 px): effective mark = 35 px — readable and appropriate for header use. The ~7 px empty margin per side is within `--logo-clear-space` range. No tight-viewBox derivative needed.

**Regression test added** (`BrandLogo.test.ts` §3):
- Asserts both `logotype_*_web.svg` viewBoxes are NOT square.
- Asserts viewBox aspect ratio is between 3.3 and 3.6 (matches content bbox ≈ 3.44).
- Asserts the component uses `_web` suffix for logotype kind (not the square originals).
- Asserts red and black web derivatives have identical viewBoxes.

#### rev-2 [Major] — Usage rule structurally enforced

**API change**: `context: LogoContext` is now a **required** prop. `kind` remains an optional explicit override that defaults to `resolveLogoVariant(context)`.

```vue
<!-- Before — kind was a free-choice prop -->
<BrandLogo kind="logotype" tone="red" size="xl" />

<!-- After — context drives kind; override only when justified -->
<BrandLogo context="footer" tone="red" size="xl" />
<!-- Or with explicit override -->
<BrandLogo context="footer" kind="logo" tone="red" size="xl" />
```

**Test coverage added** (`BrandLogo.test.ts` §1 "context prop structurally enforces the usage rule"):
- All 4 contexts (`header`, `compact`, `footer`, `wide`) tested without kind override → assert class + src match expected kind.
- Two override tests prove `kind` prop still works when explicitly provided.

### Verification results (after review findings)
```
pnpm test --run src/components/brand:
  Test Files  1 passed (1)
  Tests       36 passed (36)  [was 24, +12 new tests]

pnpm test (full suite):
  Test Files  19 passed (19)
  Tests       244 passed (244)  [was 232, +12 new tests]

pnpm typecheck:
  Clean — pre-existing vue-router rootDir advisory only

pnpm lint:check:
  All matched files use the correct format. 92 files.
```

---

### Review verdicts and close-out (2026-10-18)

Two independent reviews on the uncommitted tree (fixed point `28c7502`).

**@reviewer (rev-2) — two-axis:**
- Standards: **0 findings**.
- Spec **[Major]** (usage rule not structurally enforced) → **resolved** by the
  required `context` prop with `kind` defaulting to `resolveLogoVariant(context)`;
  tests prove the default path for all four contexts.
- Concerns 1–6 re-checked: **all PASS** (verbatim asset provenance; `env.d.ts`
  `*.svg` → `string` not `any`; i18n parity; no raw brand hex in component logic;
  aria correctness; clear-space derivation documented).
- Re-run: `pnpm test` 19/244; `typecheck`/`lint:check` clean.

**@designer (des-2) — design review: Fail → Pass.**
- **[Critical]** logotype proportions (square `viewBox` → ~13 px wordmark at `lg`)
  → resolved by the tight-`viewBox` `logotype_*_web.svg` derivatives, measured
  precisely via headless Chromium `getBBox()`; the wordmark now renders at the
  full size-token height (≈47 px at `md`, ≈63 px at `lg`). Regression test added.
- Clear space, `tone='auto'` dark mapping (WCAG logotype exemption), and
  `resolveLogoVariant` — all accepted.
- Re-check verdict: **Pass**.

**Orchestrator independent verification:** `pnpm test` 19/244 · `typecheck`
clean · `lint:check` clean.

**Known, documented non-blockers carried forward:**
- `logotype_black.svg` (and its `_web` derivative) has no `fill` → renders
  `#000000` instead of NERO `#262424`. The supplied asset is kept verbatim
  (provenance); **flag to the asset author for re-export**. Visually negligible
  on GRAY93.
- `--logo-clear-space: 0.5rem` is fixed, not proportional; callers may override.
- `sm` logotype is tight (two-line wordmark ≈10–11 px/line) — footer should use
  `md`+.
- The `data-provenance` margin comment was corrected to "2-unit margin".

**Close-out:** acceptance criteria all satisfied; ticket moved to `done`.
