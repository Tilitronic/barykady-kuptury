# T-047 — `published_at` table CHECKs for publications/documents

**Session:** — · **Lane:** feature/admin · **Owner:** unassigned · **Status:** todo
**Reviewers:** @reviewer + @architector
**Depends on:** T-029, T-042 · **Blocks:** none

## Origin

Architector gate on T-029 (approve-with-follow-ups, high priority):
`projects` / site pages / team enforce `status='published' ⇒ published_at
IS NOT NULL` at the DB; `publications` / `organization_documents` do not,
because importer RPCs and pgTAP fixtures create published rows directly
without timestamps. Admin RPC paths already stamp the invariant.

## Outcome

The lifecycle invariant holds at the DB for every content table, and
importer writes stamp `published_at` like admin writes do.

## Scope

In:

- Normalize importer RPCs (`persist_reader_import_v1` and any sibling) to
  stamp `published_at` on publish transitions.
- Backfill/normalize existing `status='published' AND published_at IS NULL`
  rows (report the count; default to the row's updated/created timestamp
  with the rule documented in the migration).
- Add `CHECK` constraints analogous to the project/site/team ones.
- Update fixtures/tests that insert published rows without timestamps.
- pgTAP: constraint proven on direct insert/update/RPC paths (mirror the
  `admin_project_mutations` constraint proofs).

Out: revisions/history, unrelated importer changes.

## Design constraints

- `docs/architecture.md` §4 (lifecycle consistency); AGENTS.md (migrations,
  TDD, pgTAP for schema invariants).

## Acceptance criteria

- [ ] No `published`-without-timestamp row can be written to either table
      by any path (test-proven, incl. importer RPCs).
- [ ] Existing rows normalized with a documented rule; migration is
      re-runnable-safe.
- [ ] All existing suites still green (importer E2E incl.).

## Log

- (author) start:
