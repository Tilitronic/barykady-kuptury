# T-021 — Contact page

**Session:** 4 · **Lane:** feature/contact · **Owner:** @coder · **Status:** todo
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
- [ ] Empty config ⇒ no address/email/phone anywhere in the rendered HTML.
- [ ] Configured values render as working `mailto:`/`tel:` links with accessible names.
- [ ] No `<form>` rendered without a configured delivery endpoint.
- [ ] Page passes axe with 0 critical/serious.
- [ ] All strings translated; headings ordered.
- [ ] No invented social or legal data.

## Verification
```
pnpm test --run src/features/contact src/pages/contact
pnpm test:e2e --grep "contact"
```

## Review gate
- @reviewer: truthfulness of rendered data, form guard actually fails when misused, link encoding.

## Log
- (author) start:
