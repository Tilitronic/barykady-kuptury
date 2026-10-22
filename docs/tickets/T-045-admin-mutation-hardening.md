# T-045 — Admin mutation hardening (transactional save + lifecycle invariant)

**Session:** 15 · **Lane:** feature/admin · **Owner:** @coder · **Status:** done
**Reviewers:** @reviewer (rev-1: 0 hard violations; mock-rollback fidelity fixed) + @architector (APPROVE-WITH-FOLLOW-UPS)
**Depends on:** T-027 · **Blocks:** T-028, T-029 (same save-path pattern will copy it)

## Origin

Design gaps found during the T-027 gates (reviewer rev-1 + architector
mutation-path review, Session 15). T-027 shipped without them deliberately;
this ticket tracks the hardening.

## Outcome

Project (and later site/team/publication) saves are atomic, and the
`status` ↔ `published_at` invariant holds no matter which path writes.

## Scope

In:

- Transactional DB RPC for "save project + translations + lifecycle
  transition" (root write, translation upserts, per-locale deletes, and
  publish/unpublish/archive in one transaction). Today these are separate
  requests (`features/admin/projects/api.ts:285-350` + editor publish flow),
  so a mid-flight failure can leave partial state.
- Migration + pgTAP coverage for the RPC (success, partial-failure rollback,
  non-admin denied).
- Optional: check constraint tying `status = 'published'` to non-null
  `published_at` on `projects` (today enforced only in the client path,
  `api.ts:268-271,364-366,395-397`), preventing future alternate write paths
  from violating the lifecycle invariant.
- Apply the same pattern decision to T-028/T-029 before they ship (or split
  per-ticket follow-ups).

Out: revisions/history, optimistic UI (still forbidden).

## Design constraints

- `docs/architecture.md` §3 (module boundaries), §4 (lifecycle, data
  integrity), §6 (RLS — RPC must run with caller rights checked inside).
- `docs/PRODUCT_REQUIREMENTS.md` §6 (admin scope).
- AGENTS.md (schema changes are migrations; RLS at the data boundary).

## Acceptance criteria

- [ ] Killing a save mid-flight leaves no partial root/translation state
      (E2E or pgTAP fault-injection proof).
- [ ] `status = 'published'` with null `published_at` is rejected at the DB
      (if the constraint half is taken).
- [ ] Non-admin callers cannot execute the RPC to effect.
- [ ] T-027 acceptance criteria still green after the cutover.

## Log

- (author) start:
