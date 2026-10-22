# T-046 — Capability-scoped admin roles

**Session:** — · **Lane:** feature/admin · **Owner:** unassigned · **Status:** todo
**Reviewers:** @reviewer + @architector (security-critical: policies + grant flow)
**Depends on:** T-027, T-045 · **Blocks:** T-028, T-029 (must not copy the
single-claim mutation pattern)

## Origin

Owner decision D-42 following analysis `knowledge/ana002-admin-access-model/`
(ADRs, 8-scope vocabulary, recommended flow). A root admin grants partial
rights (e.g. publications-only editor); admins are added by email, possibly
before first login.

## Outcome

A root admin can pre-provision editors by email with a subset of
capabilities; scoped editors see and can use only their areas; every write
remains RLS-enforced.

## Scope

In:

- `app_metadata.scopes: text[]` vocabulary (see ana002 report §B; rename now
  while cheap — T-028/T-029 will bake it in). `role = 'admin'` stays the root;
  `is_admin()` untouched.
- New `public.has_capability(scope)` helper; write policies on content tables
  (+ storage where relevant) become `is_admin() OR has_capability(...)`
  (~30 mechanical edits, one concern per migration).
- Client mirror: extend the admin guard so UI **hides** (not merely disables)
  gated nav/routes per scope; contributors see no affordance for denied areas.
- Grant runbook: root provisions via Supabase Admin API (invite with
  app_metadata incl. scopes); document the exact commands; self-grant stays
  unrepresentable (no client path can widen its own scopes — test this).
- Token-vault + capability vocabulary design entries written into
  `docs/architecture.md` BEFORE the code lands (analyzer-flagged gap).
- Tests: pgTAP per-scope matrix (root allow, scoped allow-in-scope,
  deny-out-of-scope, anon deny, self-escalation attempt fails), guard unit
  tests, E2E (scoped editor journey: publications-only admin can publish a
  publication but never reaches project routes), i18n en/pl/uk for new strings.

Out: per-admin Google OAuth wiring (T-042 lane consumes the roster, does not
build it); grant UI in-app (runbook only until proven need); RBAC tables.

## Design constraints

- `docs/architecture.md` §3/§4/§6; D-17, D-42; AGENTS.md (RLS-first,
  least privilege, migrations, TDD + Playwright + i18n).

## Acceptance criteria

- [ ] Scoped editor (e.g. publications-only) completes their journeys; every
      out-of-scope write is denied at the DB with tests proving it.
- [ ] Pre-provisioning by email works before first login; first login lands
      with the granted scopes, no wider.
- [ ] No client action (console, crafted request, guard bypass) widens scopes.
- [ ] T-027 + T-045 suites still green after policy edits.
- [ ] Architecture doc entries for vault + vocabulary merged first.

## Log

- (author) start:
