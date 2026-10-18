# T-036 — Support: "what your support does" content slot

**Session:** — · **Lane:** feature/support · **Owner:** — · **Status:** todo
**Depends on:** T-022 · **Blocked by:** D-06 (support destinations) + an approved support-content source.
**Origin:** T-022 review (rev-1, 2026-10-18) — Spec finding: T-022 scope line 14
required a *"clear 'what your support does' slot fed from content (no invented
claims)"*, which was **deferred** out of T-022 because no content source exists
(`site_pages` seeds only `about`) and authoring impact claims would violate the
no-invented-content rule (`AGENTS.md` rule 6).

## Outcome
The Support page shows a clear, content-fed statement of what a supporter's
contribution enables — grounded in NGO-approved content, never invented.

## Scope
In:
- A content source for the support-impact copy (e.g. a `support` `site_pages`
  entry rendered through the existing `useSitePage` seam, or an approved
  equivalent). Decide the source with the owner; add the seed/content only from
  verified NGO material.
- Render the statement on `support.vue` between the intro and the action list
  when the content exists; omit it (as today) when it does not.
- i18n en/pl/uk; tests for present/absent content; keep the no-payment guard.

Out: support destinations themselves (D-06 / T-022), copywriting the impact
claims (owner-supplied).

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §4 (Support) — approved ways only, no invented
  claims.
- `docs/architecture.md` §4 (localized content via `site_pages`).
- `docs/DESIGN_SYSTEM.md` §3, §6.

## Acceptance criteria
- [ ] Impact copy renders only when an approved content source provides it.
- [ ] No invented claims or fabricated figures.
- [ ] i18n complete (en/pl/uk); statement omitted cleanly when absent.
- [ ] Page still passes axe with 0 critical/serious; no payment collection.

## Log
- (author) created 2026-10-18 (orchestrator) from the T-022 review deferral.
