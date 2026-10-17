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
- [ ] All four primary variants render from local assets; no remote asset URL.
- [ ] `resolveLogoVariant` unit-tested for header/footer/compact/wide contexts.
- [ ] Clear space applied via token, not ad-hoc margin.
- [ ] Accessible name present on linked logos; decorative usage hidden from AT.
- [ ] No component hard-codes a brand hex; tone maps to asset choice.
- [ ] Works on dark background without a white box (use the correct variant or documented surface).

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
