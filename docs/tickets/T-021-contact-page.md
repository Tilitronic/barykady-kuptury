# T-021 — Contact page

**Session:** 4 · **Lane:** feature/contact · **Owner:** @coder · **Status:** done
**Reviewers:** @reviewer
**Depends on:** T-011 · **Blocks:** T-032
**Blocked by:** D-04 (contact data) and D-09 (form provider). Default path: no form, `mailto:` only.

## Outcome
The Contact page shows only verified contact channels; until the NGO supplies them it explains that details are being configured and offers no fake form.

## Scope
In:
- `src/config/organization.ts`: typed contact config with empty defaults; a single place where D-04 data will land.
- Contact page rendering: email (`mailto:`), phone (`tel:`), postal address, and office hours — each optional, each omitted when empty.
- No form in V1 unless D-09 names a provider; if a provider is later configured, the form must call a server endpoint and never fake success (guard test exists to prevent a submit-without-endpoint).
- Accessible structure: headings, definition list or address element, copy-to-clipboard not required.
- Empty state: translated message that contact details are not published yet, plus a route to Support/About (no invented email).
- Tests: config matrix (all/partial/none), `mailto:` encoding, empty state, no `<form>` element when provider is unset.

Out: message delivery, spam protection, email provider integration.

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §4 (Contact: real channels, no fake form, mailto fallback).
- `docs/architecture.md` §7 (form optional, credentials server-side).
- `docs/DESIGN_SYSTEM.md` §6 (labels, focus).

## TDD plan
1. RED: `ContactPage.test.ts` — `renders nothing fabricated when config is empty`, `renders a mailto link for a configured email`, `does not render a form when no provider is configured`.
2. GREEN: implement config + page.
3. RED: `mailtoHref.test.ts` — encoding of subject/body special characters (if a prefilled subject is used).
4. REFACTOR: alias-aware `tel:`/`mailto:` builders in `src/shared/links`.

## Acceptance criteria
- [x] Empty config ⇒ no address/email/phone anywhere in the rendered HTML.
- [x] Configured values render as working `mailto:`/`tel:` links with accessible names.
- [x] No `<form>` rendered without a configured delivery endpoint.
- [x] Page passes axe with 0 critical/serious.
- [x] All strings translated; headings ordered.
- [x] No invented social or legal data.

## Verification
```
pnpm test --run src/features/contact src/pages/contact
pnpm test:e2e --grep "contact"
```

## Review gate
- @reviewer: truthfulness of rendered data, form guard actually fails when misused, link encoding.

## Log
- (author) start:
- (coder) impl 2026-10-18: config reshaped to a nested `organization.contact` (`ContactDetails`: email/phone/address/officeHours, empty defaults) — the single D-04 landing place; `src/features/contact/contactDetails.ts` (pure merge + `hasContactDetails`), `src/shared/links.ts` (`mailtoHref` + `telHref`), `src/components/contact/ContactChannels.vue` (`<address>` + `<dl>`, each channel omitted when empty). `contact.vue`: `h1`, channels when configured, otherwise the translated "not published yet" state with in-page routes to About/Support; **no form** (D-09 guard test asserts no `<form>`/submit control). i18n en/pl/uk: `notConfigured`, `guidance`, `emailSubject`, `fields.*`; `contact.placeholder` removed; `AppFooter` reads `organization.contact.*`. **E2E-only fixture seam**: `readContactOverride()` reads `window.__BK_CONTACT__` only when `VITE_CONTACT_FIXTURE === "enabled"` (set in `playwright.config.ts`); inert in production so `contact.spec.ts` can prove the configured-rendering branch. Tests: `shared/links`, `features/contact/contactDetails`, `components/contact/ContactChannels`, `pages/[locale]/contact`, `e2e/contact.spec.ts` (3, axe 0 critical/serious). RED→GREEN evidenced.
- (orchestrator) verification 2026-10-18: `pnpm test` **41 files / 425 tests**; `pnpm typecheck` clean; `pnpm lint:check` clean (161 files); `pnpm build` PASS; `pnpm test:e2e --workers=1` **51 passed** (default `fullyParallel` workers starve the single `serve-spa` — environmental, not ticket-specific).
- (coder) review-fix 2026-10-18 (commit `5def43d` follow-up): @reviewer [Major · Standards+Spec] — **the runtime E2E fixture seam was removed**. Deleted `readContactOverride()`, `CONTACT_FIXTURE_SEAM_ENABLED`, `window.__BK_CONTACT__` and the `VITE_CONTACT_FIXTURE` declaration/`playwright.config.ts` env (rule 7 needless complexity + scope creep). `contact.vue` now reads `organization.contact` directly; `contactDetails.ts` simplified to `CONTACT_FIELDS` + `hasContactDetails` (the unused `resolveContactDetails` merge dropped, no dead exports). The configured branch stays proven at component level in `ContactChannels.test.ts` (email→`mailto:` with encoded subject, phone→`tel:` normalized, address/office-hours as text, empty-channel omission incl. address-only); `e2e/contact.spec.ts` now covers only the shipped empty state + localization + axe (0 critical/serious) and self-closes once D-04 supplies real data. Also [Suggestion · Standards] `AppFooter` reuses `mailtoHref` so URI policy lives in one place. No `VITE_CONTACT_FIXTURE` / `__BK_CONTACT__` reference remains.
- (reviewer) rev-2 2026-10-18: **all 3 findings fixed; 0 new Standards findings; 0 new Spec findings.** Confirmed the seam is absent from runtime/config surfaces, the configured branch is covered meaningfully at component level, the E2E keeps only shipped-state + axe, and `AppFooter` uses `mailtoHref`.
- (orchestrator) verification 2026-10-18 (working tree with the fixes): `pnpm test` **41 files / 424 tests**; `pnpm typecheck` clean; `pnpm lint:check` clean (161 files); `pnpm build` PASS; `pnpm test:e2e --workers=1` **50 passed**. **Status: done.**
