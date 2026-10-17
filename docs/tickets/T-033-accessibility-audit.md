# T-033 — Accessibility audit & fixes

**Session:** 7 · **Lane:** verification/a11y · **Owner:** @designer · **Status:** todo
**Reviewers:** @reviewer + @designer
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
- [ ] 0 critical and 0 serious axe violations across the listed pages, light and dark.
- [ ] Every interactive element reachable and operable by keyboard; focus always visible.
- [ ] No focus traps; dialogs return focus to their trigger.
- [ ] All form errors programmatically associated and announced.
- [ ] Reflow holds at 320 px and 200 % zoom with no horizontal scrolling of primary content.
- [ ] Reduced-motion honoured; no flashing content.
- [ ] Evidence sheet committed with dates and known limitations.
- [ ] Contrast pairs re-verified, including the dark-theme accent variant.

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
