# T-026 — Admin auth & layout

**Session:** 6 · **Lane:** feature/admin · **Owner:** @coder · **Status:** todo
**Reviewers:** @reviewer + @architector (security boundary)
**Depends on:** T-013, T-015, T-011 · **Blocks:** T-027…T-031, T-032
**Blocked by:** D-08 (Supabase project + admin provisioning).

## Outcome
Invited administrators can sign in and out, see an admin layout, and are denied access when their trusted claim is absent — with the database still enforcing authorization independently.

## Scope
In:
- `AdminLayout.vue` + routes under `/:locale/admin/*`; sign-in page (`email + password` via Supabase Auth, no registration link).
- Session handling: restore on load, refresh, sign-out clears session and navigates to public home.
- Guard: checks authenticated session **and** `app_metadata` admin claim (client-side convenience only); non-admin authenticated users get an explicit "not authorized" page, not a redirect loop.
- RLS-backed proof: a signed-in non-admin calling an admin API returns 0 rows/denied (SQL test + E2E).
- Accessible sign-in: labels, field errors, submission state, success/error announcement, password manager friendly (`autocomplete`).
- No public registration route; no password reset flow in V1 unless explicitly requested (record the omission).
- Tests: guard matrix (anon, authenticated non-admin, admin), sign-out clears state, form validation and error announcement.

Out: role management UI, invitations, MFA, password reset (document as deliberate omission).

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §6 (invited administrators only, no registration, guards are not authorization), §8.
- `docs/architecture.md` §6 (RLS is the enforcement, admin claim source).
- `docs/DESIGN_SYSTEM.md` §6 (forms, errors, admin usability at narrow widths).

## TDD plan
1. RED: `authGuard.test.ts` — anon → redirect to sign-in; non-admin → not-authorized; admin → allowed (all fail).
2. GREEN: implement guard + session store.
3. RED E2E: anonymous `/en/admin` redirects; non-admin fixture sees 403 page; admin sees dashboard.
4. RED: SQL -- non-admin JWT cannot update `projects`.
5. REFACTOR: single `useAuth` composable; no duplicated claim parsing.

## Acceptance criteria
- [ ] Anonymous admin route access redirects to sign-in, preserving intended destination.
- [ ] Authenticated non-admin gets an explicit denial page and cannot mutate data (proven by SQL).
- [ ] Sign-out clears the session and private UI.
- [ ] No registration or self-service privilege escalation path exists.
- [ ] Form errors are programmatically associated and announced.
- [ ] Admin layout usable at 320 px and with keyboard only.
- [ ] No hard-coded English in admin UI.

## Verification
```
pnpm test --run src/features/auth
pnpm test:e2e --grep "admin auth"
supabase test db
```

## Review gate
- @reviewer: no security-by-UI, session handling edge cases, no secret exposure in client.
- @architector: claim source remains server-controlled; guard does not duplicate policy logic.

## Log
- (author) start:
- (session 8) Implemented against the local demo users instead of a hosted
  project: single `app_metadata.role === "admin"` parser, session store, guard
  matrix (anon → sign-in with destination preserved, non-admin → terminal
  denial, admin → allowed), `AdminLayout`, accessible sign-in, denied and
  dashboard pages, en/pl/uk catalogue, 320 px and keyboard coverage.
- (session 8, review) `@designer` (des-2) APPROVE WITH FIXES → nav gated to
  admin sessions, ticket IDs removed from user copy, admin LanguageSwitcher,
  neutral sign-in announcement, focus moved to `#admin-main`, heading token,
  `aria-busy` parity, 320 px E2E, email field hygiene.
- (session 8, review) `@reviewer` (rev-1) BLOCK on the missing RLS mutation
  proof. Resolved without duplicating T-013: the SQL proof already exists in
  `supabase/tests/rls_content_matrix_test.sql` (“non-admin insert denied on
  projects”, “non-admin update affects no projects rows”; 239 pgTAP tests
  pass), and `pnpm demo:check` now proves the same boundary with the real
  demo users: viewer insert → 401/403, viewer update → 0 rows, row unchanged,
  admin reads the draft row. The guard remains UX-only.
- (session 8, verification) focused admin/auth suite 204 tests; 11 admin
  E2E journeys (including both 320 px cases); full unit 776 / E2E 90 /
  typecheck / lint / build green. Deliberate omission unchanged: no
  registration, no password reset (needs an email-provider decision).
