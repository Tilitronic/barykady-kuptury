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
- [ ] No request to `fonts.googleapis.com`/`fonts.gstatic.com` in build output.
- [ ] Inter resolves for Polish diacritics (`ą ć ę ł ń ó ś ź ż`) and Ukrainian Cyrillic (`і ї є ґ`) — verified with a rendered-check page or Playwright font-load assertion.
- [ ] Brandbook anchors present at desktop width; scale monotonic and non-overlapping.
- [ ] Body measure keeps lines readable at wide viewports.
- [ ] Text remains usable at 200 % zoom and with `$font-size` user settings.
- [ ] Quasar Roboto extra removed and no layout depends on it.

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
