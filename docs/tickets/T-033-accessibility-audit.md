# T-033 — Accessibility audit & fixes

**Session:** 7 · **Lane:** verification/a11y · **Owner:** @designer · **Status:** done
**Reviewers:** @reviewer (rev-1 FIX + pins verified)
**Depends on:** T-032 · **Blocks:** T-035

## Outcome
The public site and admin panel meet the WCAG 2.2 AA patterns in the design brief, with automated and manual evidence recorded.

## Scope
In:
- Automated: axe on home, About, project detail, publication detail, events, contact, support, sign-in, project form, mobile nav — light and dark.
- Manual evidence sheet (`docs/a11y-audit.md`): keyboard traversal of every main journey, focus visibility, focus order, no traps, skip link, landmark/heading order, form error association and announcement, drawer behaviour, language switching metadata.
- Contrast re-verification of all rendered text pairs in both themes (including borders, focus rings, disabled controls, form boundaries).
- Zoom/reflow: 200 % browser zoom, 320 px width, long PL/UK strings, 400 % text spacing.
- Reduced motion: no non-essential animation under `prefers-reduced-motion`.
- Fix loop: every critical/serious finding fixed or documented as a known limitation with rationale and owner.

Out: third-party screen-reader certification, VPAT, audit by an external agency.

## Design constraints
- `docs/DESIGN_SYSTEM.md` §6 (complete pattern list), §5 (dark-mode completeness).
- `docs/TESTING.md` §4 (automated ≠ sufficient; manual checks required).
- `docs/PRODUCT_REQUIREMENTS.md` §3, §8.

## TDD plan
1. RED: enable axe assertions in all listed journeys; record failures as a baseline table.
2. GREEN: fix findings; each fix gets a regression assertion where automatable.
3. Manual pass: complete the evidence sheet with pass/fail per pattern and screenshots where useful.

## Acceptance criteria
- [x] 0 critical and 0 serious axe violations across the listed pages, light and dark. *(10 surfaces × 2 themes = 20 scans, all 0 blocking — `e2e/axe-surfaces.spec.ts`.)*
- [x] Every interactive element reachable and operable by keyboard; focus always visible. *(full tab-order sweeps + journeys; **A-1** fixed invisible `QBtn` focus.)*
- [x] No focus traps; dialogs return focus to their trigger. *(search dialog + admin confirm dialog round-trips.)*
- [x] All form errors programmatically associated and announced. *(`aria-describedby`/`aria-invalid`/live regions verified as markup; **screen-reader output not verifiable** here — see `docs/a11y-audit.md` §9.)*
- [x] Reflow holds at 320 px and 200 % zoom with no horizontal scrolling of primary content. *(+ long PL/UK strings, 400 % text spacing.)*
- [x] Reduced-motion honoured; no flashing content. *(**M-1** fixed OS-dark 200 ms leak; skeleton wave < 3 Hz.)*
- [x] Evidence sheet committed with dates and known limitations. *(`docs/a11y-audit.md` authored 2026-10-26 with §9 limitations. NOT git-committed — lane instruction was "do not commit".)*
- [x] Contrast pairs re-verified, including the dark-theme accent variant. *(187 `src/shared/color` checks; **H-1** found dark rows were falsely passing on light values.)*

## Verification
```
pnpm test:e2e --grep "a11y"
pnpm test --run src/shared/color
```

## Review gate
- @reviewer: evidence is specific (page + check + result), no blanket "compliant" claim, limitations named.
- @designer: visual quality preserved after fixes.

## Log
- (author) start:
- 2026-10-26 (@designer) continued a prior lane's partial tree. Baseline of the
  four new specs: **10 of 58 `--grep a11y` checks RED**. Diagnosis split them
  into 5 genuine app defects vs 5 harness-integrity bugs (pre-hydration races,
  minifier `0ms→0s`, sr-only false flag, stale localized locators, wrong `<h1>`):
  - **A-1 (real):** Quasar `QBtn` had **no visible keyboard focus** — `no-outline
    {outline:0!important}` outranked `.focus-ring`/`:focus-visible`; fixed in
    `app.scss` with a `:focus-visible` `!important` ring (pointer render
    unchanged).
  - **A-2 (real):** dark-mode Quasar `--q-*` internals kept light values;
    `tokens.css` now republishes certified dark values (parity-gated).
  - **M-1 (real):** `prefers-reduced-motion` leaked 200 ms in OS-dark (specificity
    of `:root:not([data-theme=light])`); fixed in `tokens.css`.
  - **H-1 (audit integrity):** dark contrast rows were silently measuring light
    (parser matched `[data-theme="dark"]` inside CSS comments); fixed via
    `stripCssComments` + `parseTokensCss.test.ts`.
  - **F-1 (real):** light `--color-form-border` was 2.64:1 vs the page; one
    documented border step to `#8A8787`.
  - Harness fixes applied **without weakening** intent (added post-navigation
    waits, region scoping, zero-any-unit duration asserts).
  - Emphasis text on 6 components moved `--color-accent → --color-link` (dark AA),
    borders/strokes kept accent (non-text ≥3:1).
  - Added `e2e/axe-surfaces.spec.ts` (10×2 matrix + landmark/heading structure),
    `e2e/keyboard-journeys.spec.ts`, `e2e/a11y-motion.spec.ts`,
    `e2e/a11y-reflow.spec.ts`; `e2e/support/a11y.ts` gained
    `expectNoBlockingViolations` + `expectLandmarksAndHeadings`; contrast unit
    tests expanded to all rendered text pairs + `--q-*` parity.
- 2026-10-26 (@designer) **GREEN: 58/58 `--grep a11y`** (Playwright-owned build,
  correct `VITE_*` env) **and 187/187 `src/shared/color`**. Evidence sheet
  `docs/a11y-audit.md` authored. Status → review. Not committed (lane rule).
  Validation owner: orchestrator reconciles → @reviewer + visual check.
- 2026-10-26 (@designer) reviewer gate batch: (1) added the A-1 **pointer-path**
  regression pin (`keyboard-journeys` — hover + mouse-focus on `project-save`
  QBtn must show no `:focus-visible` ring) and referenced it in
  `docs/a11y-audit.md` §10; (2) `a11y.ts` `expectLandmarksAndHeadings` now
  asserts the contentinfo/footer landmark (`>= 1`, mirroring the banner gate)
  instead of collecting it unused. Still not committed (lane rule).
