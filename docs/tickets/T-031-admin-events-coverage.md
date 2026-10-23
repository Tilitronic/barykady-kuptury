# T-031 — Admin event mapping & translation coverage

**Session:** 6 · **Lane:** feature/admin · **Owner:** @coder · **Status:** done
**Reviewers:** @reviewer (rev-1 FIX + pins verified) + @architector (approve-with-follow-ups)
**Depends on:** T-024, T-026, T-028, T-027 · **Blocks:** T-032

## Outcome
An administrator can view calendar events and assign or remove an optional project; a translation-coverage view reports which locales are missing published content.

## Scope
In:
- Events admin view: read-only list from the calendar adapter (title, start, status), current mapping, project selector (published and drafts allowed to be assigned — drafts must not link publicly).
- Assign/unassign writes to `calendar_event_links` (`ON DELETE SET NULL` respected); idempotent upsert on `(calendar_id, google_event_id)`.
- Error handling: calendar unavailable ⇒ mapping list still loads from Supabase with a clear notice; cannot assign to a removed project.
- Translation coverage dashboard: counts/matrix per entity (pages, projects, team, publications, documents) × locale, listing missing/complete and `needsReview` flags.
- Tests: assign/unassign idempotency; assigning a draft is allowed in admin but produces no public link; mapping survives project deletion (NULL) and the event still renders; coverage calculation correctness.
- E2E: assign a project to an event → public Events page links to it (published case); assign a draft → no public link; unassign → link disappears; coverage page lists a missing locale.

Out: creating/editing calendar events from the admin (explicit V1 non-goal), per-event translations.

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §4 (Events: association managed in admin, zero-or-one), §6 (event mapping, translation visibility), §6 V1 non-goal.
- `docs/architecture.md` §4 ("event link can point to a draft in admin; public output only when published").
- D-14.

## TDD plan
1. RED: `eventMapping.test.ts` — `assigning twice is idempotent`, `unassign sets project_id null but keeps the row`, `deleted project leaves the event renderable`.
2. RED: `publicLinkPolicy.test.ts` — draft assignment yields no public link; published yields a link.
3. RED: `coverage.test.ts` — matrix counts published vs missing vs needsReview per locale.
4. GREEN: implement service + views.
5. RED E2E: mapping changes reflected publicly; coverage matrix shows a missing translation.

## Acceptance criteria
- [ ] Assign/unassign is idempotent and never creates duplicate mapping rows.
- [ ] Draft assignment never produces a public project link (proven at data + UI).
- [ ] Deleting a project unlinks the event without removing the event.
- [ ] Calendar failure degrades to a notice while mappings remain viewable.
- [ ] Coverage view is accurate for all entities × three locales and flags `needsReview`.
- [ ] No Google Calendar write capability exists anywhere in the codebase.
- [ ] Admin strings translated; selectors keyboard operable.

## Verification
```
pnpm test --run src/features/admin/events src/features/admin/coverage
pnpm test:e2e --grep "admin events|coverage"
supabase test db
```

## Review gate
- @reviewer: public-link policy, idempotency, read-only calendar guarantee.
- @architector: confirms no write-scope creep.

## Log
- (author) start:
- (gate fix · FU1 · architector) Clarified the project-selector scope to match
  the implemented least-privilege reality: root administrators and
  `projects:write` editors see **published and draft** projects in the selector
  (drafts are assignable and never produce a public link); an `events:write`-only
  editor sees **published projects only**, because §6.1 grants that scope
  `calendar_event_links` and does not widen `projects` SELECT to drafts. This
  narrows the original "published and drafts allowed to be assigned" line to the
  roles that may read drafts; no RLS was weakened. Proof:
  `supabase/tests/scoped_admin_matrix_test.sql` (events:write reads a published
  project, not the draft fixture).
