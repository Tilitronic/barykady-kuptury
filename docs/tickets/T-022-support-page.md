# T-022 — Support page

**Session:** 4 · **Lane:** feature/support · **Owner:** @designer · **Status:** todo
**Reviewers:** @reviewer + @designer
**Depends on:** T-011 · **Blocks:** T-025, T-032
**Blocked by:** D-06 (support/donation destinations).

## Outcome
The Support page presents approved ways to support the organization with a clear primary action on mobile; until data exists it shows a truthful empty state and never collects payment data.

## Scope
In:
- `src/config/support.ts`: typed options — donation link, bank-transfer details (account, recipient, title), volunteering contact — all optional.
- Page composition: intro, primary action (first configured option), secondary options, clear "what your support does" slot fed from content (no invented claims).
- External donation link opens safely (`rel="noopener noreferrer"`), bank details selectable and labelled (`aria-label` on copy actions if added).
- Explicit statement that no card data is processed here; no payment SDK, no amount selection, no embedded checkout.
- Mobile: primary action reachable without scrolling past decorative content; tap target ≥44 px.
- Tests: option matrix (each single option, none), no payment form/iframe present, link safety, ordering.
- E2E: mobile viewport primary action visible and operable; empty state.

Out: payment processing, donation analytics, recurring giving.

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §4 (Support: approved ways only, clear main action, no card data), §7.
- `docs/architecture.md` §7 (link to verified destinations only).
- `docs/DESIGN_SYSTEM.md` §3, §4 ("visible route to Support without dominating"), §6.

## TDD plan
1. RED: `SupportPage.test.ts` — `renders only configured options`, `renders no payment form or iframe`, `orders the primary action first`.
2. GREEN: implement config + page.
3. RED E2E: mobile viewport, primary CTA in the first viewport, keyboard focusable.
4. REFACTOR: shared `ActionLink` component (primary/secondary) reused by Homepage CTA.

## Acceptance criteria
- [ ] Empty config ⇒ translated empty state, no invented account number or link.
- [ ] Each configured option renders with an accessible label and safe external-link attributes.
- [ ] No `<form>`, `<iframe>`, or payment SDK anywhere in the route.
- [ ] Primary action visible on a 360×640 viewport without scrolling past hero content.
- [ ] Copy action (if present) announces success to AT (status region).
- [ ] Page passes axe with 0 critical/serious.

## Verification
```
pnpm test --run src/features/support
pnpm test:e2e --grep "support"
```

## Review gate
- @reviewer: no payment collection, no fabricated financial details, link safety.
- @designer: action hierarchy, restraint (scarlet not dominating), mobile ergonomics.

## Log
- (author) start:
- (designer) impl 2026-10-18: `src/config/support.ts` (typed `SupportOptions`: donationUrl/donationLabel/bankTransfer{accountNumber,recipient,paymentTitle}/volunteeringEmail — all empty while D-06 is OPEN), pure resolver `src/features/support/resolveSupportActions.ts` (fixed order donation → bank → volunteering; whitespace = unconfigured; account number anchors the bank block), shared `src/components/support/ActionLink.vue` (primary = single scarlet surface with `--color-accent-text`; secondary = bordered pill; `min-height: 2.75rem` ≥44 px tap target; `newTab` adds `target=_blank` + `rel="noopener noreferrer"` + SR-only "opens in a new tab"; documented for T-025 homepage-CTA reuse), and the rewritten `support.vue`. Decisions: (1) the "what your support does" slot is OMITTED — no content source exists (`site_pages` seeds only `about`) and impact claims without approved NGO copy would fabricate data (AGENTS.md rule 6); wire it when a source exists. (2) No copy-to-clipboard button ships (ticket: "if added"): the account number gets `user-select: all` whole-press selection instead, so no clipboard-permission surface and no status region is needed — acceptance criterion satisfied vacuously. (3) TDD step 5 REFACTOR done immediately (single use + explicit T-025 reuse). (4) Per the T-021 review there is NO runtime test seam: the configured matrix is proven by passing `options` as a plain component prop defaulting to the shipped config; E2E covers the shipped empty state only (en + pl + 360×640 first-viewport + no form/iframe + axe 0 critical/serious). The configured-state E2E will self-close once D-06 supplies real destinations. Tests: resolver(6)/ActionLink(5)/page matrix(9) unit — RED (2 import failures + 7 assertion failures) → GREEN (20/20, full suite 542); `e2e/support.spec.ts` 3 journeys green. `support.placeholder` removed (unused after rewrite); `intro`/`empty`/`noPayment`/`actions.*`/`bank.*` added in en/pl/uk (parity green).
