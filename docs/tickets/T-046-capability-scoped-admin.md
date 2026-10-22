# T-046 — Capability-scoped admin roles

**Session:** 15 · **Lane:** feature/admin · **Owner:** @coder · **Status:** done
**Reviewers:** @reviewer (rev-1 security: 0 hard violations; 2 Majors fixed) + @architector (APPROVE-WITH-FOLLOW-UPS)
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
- (implementer) architecture entries landed first (§6.1 vocabulary + §6.2 vault),
  then helper → content policies → import policies → storage policies → RPC
  re-checks; pgTAP matrix RED → GREEN; client mirror + guard/nav hiding;
  invitation runbook below.
- (implementer) evidence: pgTAP RED before migrations (`has_capability` missing;
  scoped insert "violates row-level security policy") → GREEN
  `capability_helpers_test.sql` 23/23, `scoped_admin_matrix_test.sql` 58/58;
  T-013/T-014/T-045/schema suites still green; unit 1350/1350 (129 files);
  `typecheck` 0; E2E `admin-scopes.spec.ts` 2/2 + `admin-auth`/`admin-projects`
  17/17. Migration filenames: 20261022130000/131000/132000/133000/134000.
  Vocabulary shipped: pages/projects/publications/documents/team/events/media
  `:write` + `importer` (action-scope, per recommended-flow.mmd).
- (implementer) cross-lane note: `verifyAdminToken` in
  `src/features/import/serverSupabase.ts` still checks `role === "admin"` only,
  so a scoped `importer` can reach the import UI and pass RLS but the T-042
  background function rejects them until that lane adds the scope check
  (netlify/functions and src/features/import are out of T-046 scope).
- (gate fix batch) E2E now proves a **real mutation**, not route reachability:
  `e2e/admin-scopes.spec.ts` signs in as the publications-scoped fixture, reads
  the session token, posts `persist_reader_import_v1` (the exact RPC
  `persistConvertedTranslation` uses) with the feature-API arg shape, asserts
  the row is persisted and then visible on `/en/publications`; the same session's
  `save_project_v1` is refused with `42501`, and `/en/admin/projects` renders the
  scope-denial page. T-029 owns the clickable publications UI; when it lands it
  should replace the wire-level step with its UI action and keep the visibility
  assertion. Evidence: RED without the scoped RPC contract (`typeof body` was
  `object`, not the uuid string) → GREEN 2/2.
- (gate fix batch) Scope-registry drift guardrail added:
  `src/features/auth/__tests__/scopeRegistry.test.ts` parses SQL
  `has_capability('<scope>')` call sites (comments stripped), client
  `ADMIN_SCOPES`, route `requiresCapability`, and the §6.1 vocabulary table, and
  fails if any differ. Proved non-vacuous with a temporary `drift-probe:write`
  client entry → RED, then restored → GREEN.
- (gate fix batch) `verifyAdminToken` cross-lane item is **fixed in-tree** by the
  sibling lane: it now accepts `isAdminUser(claim) || hasCapability(claim,
  "importer")` and still reads only `app_metadata`. No import/netlify files were
  touched here.
- **Deferred follow-up (ops): JWT-lifetime hardening.** A revoked/changed scope
  remains effective until the access token refreshes (the documented runbook
  window); immediate lockout currently requires banning the account. Follow-up:
  decide access-token TTL / refresh policy, and whether a custom-claims refresh
  or session revocation path is warranted for the NGO's risk profile. Explicitly
  out of this ticket per the gate-fix instruction.
- **Deferred follow-up (design): storage-prefix redesign.** `media:write` is
  bucket-wide on the shared `public-media` bucket (project covers, portraits and
  imported reader images). Follow-up: define per-feature folder prefixes and
  split the storage policy by prefix so `media:write` can mean "only my feature's
  files". Explicitly out of this ticket per the gate-fix instruction.

## Appendix — grant runbook (Supabase Admin API)

**Invariant:** scopes are writable only with the service-role key through the
Admin API. The key never enters the browser, `VITE_*`, this repo, or logs.
There is no in-app grant UI (deliberate, D-42). Never edit `app_metadata` from
a user session, SQL executed as `authenticated`, or the Supabase dashboard's
user-editable metadata form.

Vocabulary (exact strings; delete = write; unknown strings are inert):
`pages:write`, `projects:write`, `publications:write`, `documents:write`,
`team:write`, `events:write`, `media:write`, `importer`.

Set these once in a trusted shell (never commit the values):

```bash
export SUPABASE_URL="https://<project-ref>.supabase.co"   # local: http://127.0.0.1:54321
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"     # server-side only
AUTH=(-H "apikey: $SUPABASE_SERVICE_ROLE_KEY"       -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"       -H "Content-Type: application/json")
```

### A. Pre-provision before first login (recommended)

Create the account with `app_metadata` already populated. No password is set,
so the account cannot authenticate until the invitation/recovery link is used;
therefore the first JWT already carries exactly the granted scopes.

```bash
# 1. Create the passwordless user with the root-assigned role + scopes.
curl -sS -X POST "$SUPABASE_URL/auth/v1/admin/users" "${AUTH[@]}" -d '{
  "email": "editor@example.org",
  "email_confirm": true,
  "app_metadata": { "role": "editor", "scopes": ["publications:write"] }
}'
# → response includes "id"; export USER_ID="<that id>"
export USER_ID="<id-from-response>"

# 2. Generate a set-password link and deliver it out-of-band (no email sent).
curl -sS -X POST "$SUPABASE_URL/auth/v1/admin/generate_link" "${AUTH[@]}" -d '{
  "type": "recovery",
  "email": "editor@example.org"
}'
# → send "action_link" to the editor through the organisation's trusted channel.

# 3. Verify the grant before the editor signs in.
curl -sS "$SUPABASE_URL/auth/v1/admin/users/$USER_ID" "${AUTH[@]}" | jq '.app_metadata'
# expected: {"role":"editor","scopes":["publications:write"], ...}
```

The editor's first sign-in lands with `publications:write` only: the dashboard
shows Publications/Content import (if granted), hides Projects, and direct
project URLs render the scope-denial page. RLS/RPC checks are the authority.

### B. Grant or change scopes on an existing account

Prefer revoking and re-granting the full intended array rather than appending
in a dashboard form. Read the current metadata first, then PUT the complete
intended `app_metadata` (verify whether your GoTrue version merges or replaces;
if it replaces, include provider fields from the GET response).

```bash
curl -sS "$SUPABASE_URL/auth/v1/admin/users/$USER_ID" "${AUTH[@]}" | jq '.app_metadata'

curl -sS -X PUT "$SUPABASE_URL/auth/v1/admin/users/$USER_ID" "${AUTH[@]}" -d '{
  "app_metadata": {
    "role": "editor",
    "scopes": ["publications:write", "documents:write", "media:write"]
  }
}'
```

The user must sign out and back in (or refresh the access token) before the
new claims reach RLS; the old JWT keeps its old scopes until expiry. Revocation
has the same refresh window. For immediate lockout, ban the account
(`PUT .../admin/users/$USER_ID` with `"ban_duration": "24h"` or `"none"` to
unban) rather than waiting for token expiry.

### C. Revoke

```bash
# Remove all content scopes; keep the account as a non-admin signer-in.
curl -sS -X PUT "$SUPABASE_URL/auth/v1/admin/users/$USER_ID" "${AUTH[@]}" -d '{
  "app_metadata": { "role": "editor", "scopes": [] }
}'

# Demote a root (keep any scoped grants if desired).
curl -sS -X PUT "$SUPABASE_URL/auth/v1/admin/users/$USER_ID" "${AUTH[@]}" -d '{
  "app_metadata": { "role": "editor", "scopes": [] }
}'
```

### D. Operational rules

- Provision a **second root** (`role: "admin"`) before launch; a single root is
  a release-readiness risk (T-035). Root is not representable via scopes.
- A zero-scope account is a normal authenticated user: no admin area, no writes.
- Never grant `importer` to an account that should not see private source
  originals; the private `content-sources` bucket is in that scope.
- `media:write` is bucket-wide for `public-media` in V1 (project covers and
  imported images share it). Grant it only with the feature scope that needs it.
- Verify after every change with `GET /auth/v1/admin/users/$USER_ID` and by
  signing in once as that account; do not trust the PUT response alone.
