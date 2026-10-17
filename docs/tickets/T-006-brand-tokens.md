# T-006 — Brand tokens & Quasar mapping

**Session:** 2 · **Lane:** design-system · **Owner:** @designer · **Status:** todo
**Reviewers:** @reviewer + @designer (self-check) + @architector (token contract)
**Depends on:** T-004 · **Blocks:** T-007, T-008, T-011, and every UI ticket

## Outcome
Semantic CSS custom properties for light and dark themes, derived from the verified brand palette, wired into Quasar's Sass variables, with an automated WCAG contrast gate.

## Scope
In:
- `src/css/tokens.css` (or `.scss`): `--color-background`, `--color-surface`, `--color-surface-raised`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-text`, `--color-border`, `--color-link`, `--color-focus`, `--color-success|warning|danger`, plus disabled state, form control, dialog/dropdown surfaces, and shadow tokens.
- Light theme from brandbook: GRAY93 background, NERO text, SCARLET accent.
- Dark theme: NERO background, GRAY93 text, and a **lightened scarlet** for text/links that passes 4.5:1 on nero (brandbook only supplies `#C60001`, which fails; document the derived value and its computation).
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
- [ ] Every required token exists in both `:root` and the dark selector; a missing token fails the test.
- [ ] All documented body-text pairs ≥4.5:1; large/UI pairs ≥3:1; the forbidden scarlet-on-nero pair is asserted *not* used for text.
- [ ] No Quasar default brand color remains in `quasar.variables.scss`.
- [ ] Focus ring ≥3:1 on background, surface, and accent surfaces.
- [ ] Reduced-motion utility exists and is honoured by any transition added later.

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
- (author) start:
