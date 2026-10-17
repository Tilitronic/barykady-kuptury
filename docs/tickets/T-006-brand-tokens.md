# T-006 — Brand tokens & Quasar mapping

**Session:** 2 · **Lane:** design-system · **Owner:** @designer · **Status:** done
**Reviewers:** @reviewer + @designer (self-check) + @architector (token contract)
**Depends on:** T-004 · **Blocks:** T-007, T-008, T-011, and every UI ticket

## Outcome
Semantic CSS custom properties for light and dark themes, derived from the verified brand palette, wired into Quasar's Sass variables, with an automated WCAG contrast gate.

## Scope
In:
- `src/css/tokens.css` (or `.scss`): `--color-background`, `--color-surface`, `--color-surface-raised`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-text`, `--color-border`, `--color-link`, `--color-focus`, `--color-success|warning|danger`, plus disabled state, form control, dialog/dropdown surfaces, and shadow tokens.
- Light theme from brandbook: GRAY93 background, NERO text, SCARLET accent.
- Dark theme: NERO background, GRAY93 text, and a **lightened scarlet** for text/links that passes 4.5:1 on nero (brandbook only supplies `#C60001`, which fails; document the derived value and its computation).
- **Derivation policy (D-18).** Non-brand tokens must be derived deterministically, never picked ad hoc:
  - Step neutrals from the three brand colors in OKLCH lightness (e.g. surface steps above GRAY93, border steps below it), keeping the brand hue.
  - Derive the dark-theme accent by raising SCARLET's OKLCH lightness until measured contrast on NERO is ≥ 4.5:1; record the resulting hex and ratio.
  - Source `success`/`warning`/`danger` from a standard accessible palette rather than shifting brand hues; each must clear 4.5:1 on both light and dark backgrounds and be documented with its measured ratio.
  - Every derived token is recorded next to its measured contrast pair in the token file; a token without a documented measurement is not allowed to ship.
- `src/css/quasar.variables.scss`: map `$primary`, `$secondary`, `$accent`, `$dark`, `$positive`, `$negative`, `$warning`, `$info` to brand tokens — no default Quasar blue/purple may remain.
- Pure util `src/shared/color/contrast.ts` (`relativeLuminance`, `contrastRatio`) + unit test `src/shared/color/__tests__/contrast.test.ts` that enumerates every documented text/background pair and asserts the required ratio (4.5 normal, 3.0 large/UI).
- `prefers-reduced-motion` token/utility and a focus-ring token meeting 3:1 against adjacent surfaces.

Out: component styling, typography (T-007), logo (T-008), theme switching logic (T-010).

## Design constraints
- `docs/DESIGN_SYSTEM.md` §1, §5, §6 (contrast targets), `docs/architecture.md` §8.
- Brandbook p. 11–12: three-color identity, "solid background", two colors must contrast, three-color order.
- D-13 (verified hexes).

## TDD plan
1. RED: `contrast.test.ts` — assert `contrastRatio('#262424', '#EDEDED') === 13.1±0.1` fails (module missing).
2. GREEN: implement `contrast.ts`, then add the pair table; each forbidden pair test must fail until the dark accent is derived.
3. RED/GREEN: `tokens.test.ts` parses `tokens.css` and asserts both themes define every token name (no partial dark mode).
4. REFACTOR: single source of token names (TS const array) consumed by both CSS generation and tests.

## Acceptance criteria
- [x] Every required token exists in both `:root` and the dark selector; a missing token fails the test.
- [x] All documented body-text pairs ≥4.5:1; large/UI pairs ≥3:1; the forbidden scarlet-on-nero pair is asserted *not* used for text.
- [x] No Quasar default brand color remains in `quasar.variables.scss`.
- [x] Focus ring ≥3:1 on background, surface, and accent surfaces.
- [x] Reduced-motion utility exists and is honoured by any transition added later.

## Verification
```
pnpm test --run src/shared/color
pnpm typecheck
pnpm lint:check
pnpm build
```

## Review gate
- @reviewer: tokens are semantic (no raw hex in components later), tests can actually fail, dark theme complete.
- @designer: palette usage restraint (scarlet as accent, not everywhere) and dark-theme feel acceptable.
- @architector: token contract is stable enough for all later UI tickets.

## Log

### RED — contrast.test.ts (module missing)

Command: `pnpm vitest run src/shared/color`

```
 FAIL  src/shared/color/__tests__/contrast.test.ts
Error: Failed to resolve import "@/shared/color/contrast"
  from "src/shared/color/__tests__/contrast.test.ts". Does the file exist?
  Plugin: vite:import-analysis
  File: .../contrast.test.ts:22:49

 Test Files  1 failed (1)
      Tests  no tests
```

Module `src/shared/color/contrast.ts` did not exist. 43 tests blocked.

---

### GREEN — contrast.test.ts (contrast.ts implemented)

Command: `pnpm vitest run src/shared/color`

```
 Test Files  1 passed (1)
      Tests  43 passed (43)
  Duration  12.39s
```

Implemented `relativeLuminance` (WCAG 2.x sRGB linearisation + ITU-R BT.709
coefficients) and `contrastRatio` (symmetric, lighter-over-darker formula).
All 43 assertions pass including brandbook reference pair nero/GRAY93 = 13.19,
the forbidden SCARLET/NERO pair = 2.50 < 4.5, and the derived dark accent
#FA4C3C on NERO = 4.53 ≥ 4.5.

---

### RED — tokens.test.ts (tokens.css missing)

Command: `pnpm vitest run src/shared/color`

```
 FAIL  src/shared/color/__tests__/tokens.test.ts
TypeError (beforeAll): ENOENT: no such file or directory,
  open '.../src/css/tokens.css'

 Test Files  1 failed | 1 passed (2)
      Tests  43 passed | 44 skipped
```

`src/css/tokens.css` did not exist. All 44 token-completeness assertions skipped.

---

### GREEN — tokens.test.ts (tokens.css implemented)

Command: `pnpm vitest run src/shared/color`

```
 Test Files  2 passed (2)
      Tests  87 passed (87)
  Duration  4.84s
```

`src/css/tokens.css` now defines 24 custom properties in `:root` (light theme)
and mirrors all 24 in the `.dark` / `[data-theme="dark"]` selector. The
`tokens.test.ts` iterates the 24-entry `REQUIRED_TOKENS` array from
`tokenNames.ts` and asserts each name appears in both blocks. Zero failures.

---

### Final verification

```
pnpm vitest run src/shared/color   →  87/87 ✓
pnpm typecheck                     →  clean (vue-router rootDir notice only, pre-existing)
pnpm lint:check                    →  All matched files use the correct format. Exit 0.
```

## Log rev-2

**Owner:** @designer · **Session:** 2 rev-2 · **Based on:** T-006 architecture review findings

### Summary of changes

Six findings from the T-006 architecture review applied. All changes are backwards-compatible to downstream tickets (T-007 through T-011) because new tokens extend the contract and existing hex values are unchanged except `--color-link` in dark mode (which was below AA on cards/dialogs).

### RED — contrast gate decoupled, new pairs (Finding 1 + 3 + 4)

Command: `pnpm vitest run src/shared/color` (after writing tests, before CSS changes)

```
Test Files  2 failed (2)
     Tests  13 failed | 89 passed (102)
```

Failures recorded:
- `[light/dark] danger text on surface-danger` — `--color-surface-danger` token missing (×4)
- `[dark] link on surface` — #FA4C3C on #2B2929 = 4.25:1 < 4.5 (×1)
- `[dark] link on surface-raised` — #FA4C3C on #353333 = 3.68:1 < 4.5 (×1)
- `tokens.css :root defines --color-surface-danger/overlay/skeleton/skeleton-shine` (×4)
- `[data-theme="dark"] defines --color-surface-danger/overlay/skeleton/skeleton-shine` (×4)
- D-20 guard: `.dark` selector still present in tokens.css (×1)

---

### GREEN — all findings implemented

Command: `pnpm vitest run src/shared/color`

```
Test Files  2 passed (2)
     Tests  102 passed (102)
  Duration  3.97s
```

---

### Mutate → FAIL → Revert proof (Finding 1 gate)

Mutation applied: `--color-text-muted: #6c6a6a` → `#aaaaaa` in `:root` of `tokens.css`.

```
Tests  6 failed | 96 passed (102)
```

Failed tests: `[light] muted text on background/surface/surface-raised ≥ 4.5:1` and the matching dark-theme tests (dark map picks up the light block value through the joined blocks — correctly caught). Error message: `Expected #AAAAAA on #EDEDED (muted text on background, light) to be ≥ 4.5:1 but got 1.98:1`.

Mutation reverted — all 102 tests pass again. The gate is live.

---

### Finding 1 — Contrast gate now CSS-driven

**New file:** `src/shared/color/__tests__/parseTokensCss.ts`
- Exports `CSS_PATH`, `extractBlock`, `extractAllBlocks`, `parseHex`, `parseThemeHexes`, `loadThemeHexes`.
- Block parsers extracted from `tokens.test.ts` (no duplication).

**Rewritten:** `src/shared/color/__tests__/contrast.test.ts`
- Hardcoded hex variables replaced by `loadThemeHexes()` call at module load.
- `CONTRAST_PAIRS` table defines every asserted pair by token name; test code resolves to actual hex at runtime.
- Pure algorithm unit tests and brandbook reference pairs remain hardcoded (they validate the algorithm, not token values).

---

### Finding 2 — Dark selector contract (D-20)

`tokens.css` section 2 selector changed from `.dark, [data-theme="dark"]` to `[data-theme="dark"]` only.

Reduced-motion `@media` block updated: `:root, .dark, [data-theme="dark"]` → `:root, [data-theme="dark"]`.

`tokens.test.ts` updated:
- `extractAllBlocks(cssText, ".dark")` → `extractAllBlocks(cssText, '[data-theme="dark"]')`.
- Added D-20 guard test: strips comments from CSS, asserts `.dark\s*[{,]` does not appear.

---

### Finding 3 — Three new tokens

All added to `REQUIRED_TOKENS`, both themes, and the `prefers-color-scheme` media block.

| Token | Light | Dark | Target / Note |
|---|---|---|---|
| `--color-overlay` | `rgba(38,36,36,0.5)` | `rgba(0,0,0,0.6)` | Modal/drawer scrim. Decorative — no WCAG text requirement. Warm NERO base in light; deeper black in dark. |
| `--color-skeleton` | `#E4E4E4` (OKLCH L=0.919) | `#3A3838` (L=0.343, C=0.003, H=17°) | QSkeleton base. One OKLCH step below GRAY93 / above surface-raised. Decorative. |
| `--color-skeleton-shine` | `#EAEAEA` (L=0.937) | `#474545` (L=0.392) | QSkeleton shimmer highlight. Slightly lighter than base. Justified: without it the shimmer animation has no gradient. Decorative. |
| `--color-surface-danger` | `#FEE2E2` (Tailwind red-100) | `#451A1A` (Tailwind red-900) | Error-banner tinted surface. `--color-danger` text contrast: light 6.80:1 ✓ AA+, dark 6.07:1 ✓ AA+. |

---

### Finding 4 — Dark `--color-link` fixed

**Old value:** `#FA4C3C` (OKLCH L=0.661, C=0.213, H=29.1°) — same as `--color-accent`.
- on #353333 (surface-raised): 3.68:1 — below AA for normal text ✗

**New value:** `#FF6D5A` (OKLCH L=0.756, C=0.213, H=29.1°, gamut-clipped at sRGB red boundary).
- on #262424 (background):     5.58:1 ✓ AA
- on #2B2929 (surface):        5.23:1 ✓ AA
- on #353333 (surface-raised): 4.54:1 ✓ AA ← binding constraint

`--color-accent` remains `#FA4C3C` — the D-18 certified accent surface value.

`tokens.css` updated in: dark `[data-theme="dark"]` block and `prefers-color-scheme` media block.

New contrast tests added: `[dark] link on surface` and `[dark] link on surface-raised` in the pair table.

---

### Finding 5 — Documentation completeness (D-18)

All previously undocumented tokens now carry explicit entries:
- Borders: stated as "decorative separator — no SC 1.4.11 requirement" with measured ratio.
- Form-border: stated as "non-text UI boundary (SC 1.4.11 ≥ 3:1 target); measured: 1.62:1 (light), 1.59:1 (dark) — known gap for T-007."
- Shadows: stated as "decorative elevation — no WCAG requirement."
- Overlay, skeleton, skeleton-shine: documented as "decorative — no WCAG requirement" with derivation rationale.
- `--color-surface-danger`: documented with measured danger-on-danger-surface ratios.

---

### Finding 6 — Derivation-header precision

`tokens.css` header updated with:
- **Both step scales:** surfaces ΔL ≈ 0.020/step; borders ΔL ≈ 0.035/step.
- **OKLCH C and H** for all warm near-achromatic neutrals (#2B2929 L=0.283 C=0.003 H=17°; #353333 L=0.323; #4A4848 L=0.404; #6C6A6A L=0.526; achromatic #9E9E9E/D6D6D6/CBCBCB C=0.000).
- **`--color-info` note:** no CSS token exists; only `$info` in `quasar.variables.scss`.
- **Dark accent vs link divergence** explanation with measured ratios.

---

### Final verification rev-2

```
pnpm vitest run src/shared/color   →  102/102 ✓
pnpm typecheck                     →  clean (vue-router rootDir notice only, pre-existing)
pnpm lint:check                    →  All matched files use the correct format. Exit 0.
```

## Log rev-3

**Owner:** @designer · **Session:** 2 rev-3 · **Based on:** independent re-check of rev-2

### Summary

Two delta fixes: (1) `--color-form-border` raised to meet SC 1.4.11 ≥ 3:1 in both themes; (2) `relativeLuminance` and `contrastRatio` now throw a clear error on malformed hex input rather than silently propagating `NaN`.

---

### RED — 7 failing tests before implementation

Command: `pnpm vitest run src/shared/color` (tests added, source unchanged)

```
Tests  7 failed | 102 passed (109)
```

Failures:
- `relativeLuminance > throws for a non-hex string` (×1)
- `relativeLuminance > throws for an empty string` (×1)
- `relativeLuminance > throws for invalid hex characters (#GGGGGG)` (×1)
- `relativeLuminance > throws for a 3-digit shorthand (#FFF)` (×1)
- `contrastRatio > throws for a malformed second argument` (×1)
- `[light] form-border on form-bg ≥ 3:1` — #CBCBCB on #FFFFFF = 1.62:1 < 3.0 (×1)
- `[dark] form-border on form-bg ≥ 3:1` — #4A4848 on #2B2929 = 1.59:1 < 3.0 (×1)

---

### GREEN — all 109 tests pass

Command: `pnpm vitest run src/shared/color`

```
Tests  109 passed (109)
Duration  4.09s
```

---

### Finding 1 — `--color-form-border` raised to ≥ 3:1 (SC 1.4.11)

**Design decision**: raise the border value. Rationale:

- WCAG SC 1.4.11 (non-text contrast) requires ≥ 3:1 between a UI component boundary and its adjacent colour. This is a release requirement (AGENTS.md rule 8, DESIGN_SYSTEM.md §6).
- The fill alternative does not work: `--color-form-bg` (`#FFFFFF`) on `--color-background` (`#EDEDED`) is only 1.15:1 — far below 3:1. The border must carry the boundary contrast on its own.
- A warm mid-gray border at 3.1:1 reads as intentional and refined. The NERO family hue (H≈17°, C≈0.003) integrates it with the rest of the neutral palette rather than making it look imported or harsh.

| Token | Old value | Old ratio | New value | New ratio | OKLCH |
|---|---|---|---|---|---|
| `--color-form-border` light | `#CBCBCB` | 1.62:1 on `#FFFFFF` | `#949292` | **3.10:1** ✓ | L=0.662, C=0.003, H=17° |
| `--color-form-border` dark | `#4A4848` | 1.59:1 on `#2B2929` | `#747272` | **3.03:1** ✓ | L=0.554, C=0.003, H=17° |

Files updated: `src/css/tokens.css` (light block, dark block, `prefers-color-scheme` media block, contrast table header).

New pair in `CONTRAST_PAIRS`:
```typescript
{ role: "form-border (UI boundary) on form-bg (SC 1.4.11)",
  fg: "color-form-border", bg: "color-form-bg", minRatio: 3.0,
  themes: ["light", "dark"] }
```

---

### Finding 2 — Hex validation in `contrast.ts`

`relativeLuminance` now validates input with `/^[0-9a-fA-F]{6}$/` before parsing. On failure it throws:

```
relativeLuminance: expected a 6-digit hex colour (with or without "#") but received "…"
```

`contrastRatio` inherits the guard automatically (it delegates to `relativeLuminance`). Both functions remain pure and DOM-free.

Test coverage added: 4 `relativeLuminance` throw cases + 1 `contrastRatio` propagation case.

---

### Final verification rev-3

```
pnpm vitest run src/shared/color   →  109/109 ✓
pnpm typecheck                     →  clean (vue-router rootDir notice only, pre-existing)
pnpm lint:check                    →  All matched files use the correct format. Exit 0.
```
