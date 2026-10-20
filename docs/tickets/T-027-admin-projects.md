# T-027 — Admin projects CRUD

**Session:** 6 · **Lane:** feature/admin · **Owner:** @coder · **Status:** todo
**Reviewers:** @reviewer + @architector (data mutations)
**Depends on:** T-026, T-019 · **Blocks:** T-030, T-032

## Outcome
An administrator can create, edit, preview, publish/unpublish, archive, and delete a project, with per-locale translation completeness visible.

## Scope
In:
- Routes: `/admin/projects` list (status filter), `/admin/projects/new`, `/admin/projects/:id` edit, preview (renders the public detail component with a draft banner).
- Form fields: status, featured flag (order handled in T-030), dates, cover upload (via T-014 validator), ONE canonical project slug (D-24), per-locale title/summary/body tabs for en/pl/uk.
- Validation: required fields for publish (title+summary in the fallback locale; complete translation to publish a locale), globally unique root slug surfaced as a field error, slug format `^[a-z0-9]+(?:-[a-z0-9]+)*$`, dates ordered. The slug is editorial and stable: never auto-rename it when the title changes (D-24/T-038).
- Actions: save draft, publish, unpublish, archive, delete (with confirmation dialog, focus-managed and keyboard operable).
- Optimistic-free pattern: await mutation, then refresh state; explicit success/error announcements.
- Translation completeness indicator per locale (missing/complete) — data reused by T-031.
- Tests: form validation matrix, publish requires complete fallback translation, globally unique canonical slug conflict message, archive hides from public listing, delete confirmation focus handling.
- E2E: create → publish → appears publicly; unpublish → disappears; draft remains invisible anonymously.

Out: rich-text WYSIWYG (use sanitised markdown or plain textarea), media library, revisions, bulk actions.

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §6 (admin scope, preview, publish/unpublish/archive), §4 (Projects).
- `docs/architecture.md` §4 (lifecycle, translations), §6 (RLS).
- `docs/DESIGN_SYSTEM.md` §6 (forms, dialogs, keyboard, narrow widths).
- `AGENTS.md` (validate at trust boundaries, sanitise rich text).

## TDD plan
1. RED: `projectForm.test.ts` — `requires a title in the fallback locale to publish`, `rejects a duplicate canonical slug`, `allows saving an incomplete draft`.
2. GREEN: implement form + validation schema.
3. RED: `publishFlow.test.ts` — publish sets status + published_at; unpublish removes from public query.
4. RED E2E: full create→publish→public visibility; draft invisibility.
5. REFACTOR: shared form-field wrapper for consistent label/error/description wiring.

## Acceptance criteria
- [ ] Draft save works with incomplete translations; publish blocked with a specific, localized reason.
- [ ] Canonical root slug uniqueness enforced globally (D-24), surfaced as a field-level error; the slug is stable and never auto-renamed from the title.
- [ ] Preview renders draft content with a visible banner and is not publicly reachable.
- [ ] Publish/unpublish/archive immediately reflected in the public listing (E2E).
- [ ] Delete requires confirmation, restores focus, and RLS permits only admins.
- [ ] Every mutation has an explicit loading/error state; failures are recoverable.
- [ ] All labels/messages translated in en/pl/uk.
- [ ] No optimistic UI that can desync from the database.

## Verification
```
pnpm test --run src/features/admin/projects
pnpm test:e2e --grep "admin projects"
supabase test db
pnpm typecheck && pnpm lint:check
```

## Review gate
- @reviewer: spec axis §6, validation at the boundary, no client-only authorization assumptions, destructive-action safety.
- @architector: mutation paths go through feature modules, not components.

## Log
- (author) start:
