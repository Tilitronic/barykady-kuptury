# T-037 — Local demo environment & mock services

**Session:** 8 · **Lane:** infrastructure/demo · **Owner:** @coder
**Reviewers:** @architector + @reviewer
**Depends on:** T-012, T-013, T-014, T-015, T-023 · **Blocks:** T-026…T-031 (design testing), T-032

## Outcome

From a clean checkout with Docker running, one command brings up a **fully populated
local site** — real local Supabase (migrations, RLS, Storage, Auth) filled with
deterministic demo content plus a Bun mock for the calendar adapter — so the whole
public design system and the admin design work can be exercised without hosting, cloud
accounts, Google credentials, or real data.

The demo dataset and its assets are **demo-only**: they are never referenced by the
production build, never migrated to a hosted project, and are clearly labelled as
fictional in the UI copy they contain.

## Scope

### In

- **`supabase/seed.demo.sql`** — demo-only dataset, invoked explicitly by the demo
  scripts (kept out of the default `db.seed` glob so `supabase db reset` and CI remain
  hermetic). Fixtures:
  - `site_pages`: `home` + `about`, translations in en/pl/uk (the missing `home` row is
    the reason the homepage currently shows its empty state);
  - 8 projects: 3 featured with explicit ranks (non-contiguous ranks to prove ordering),
    1 draft, 1 archived, 1 published with a missing pl/uk translation (fallback note),
    long PL/UK titles for layout stress;
  - 6 publications with file rows (3 languages), 5 team members, 3 organization
    documents, event→project links matching the calendar mock event ids;
  - imagery is neutral and clearly demo: generated geometric covers/avatars (PNG/WebP,
    no real people, no invented organizational facts). `public-media` accepts raster
    only; `public-documents` gets small generated PDFs.
- **Demo asset uploader** — a Bun script that uploads the generated assets through the
  local Storage API (service-role key read from local `supabase status`, never
  committed) and verifies each public URL resolves.
- **Demo users** — local Auth admin API: `admin@demo.local` with
  `app_metadata.role = "admin"`, and `viewer@demo.local` without the claim, so the T-026
  guard and the RLS boundary can be exercised. Documented credentials; local only.
- **Bun calendar mock** (`mock/calendar/server.ts`) — serves
  `/.netlify/functions/calendar-events` with the finalized T-023 wire contract
  (`{ calendarId, events, generatedAt }`), reusing the app's normalization code via
  relative imports (no `@/` alias). Deterministic clock; scenarios selectable with
  `?scenario=default|empty|unavailable|dense|long|dst` for design testing; CORS for the
  dev origin; no dependency on Google or any credential.
- **Dev proxy** — the Quasar/Vite dev server proxies
  `/.netlify/functions/calendar-events` to the Bun mock, so the SPA keeps using one
  same-origin path and production wiring is unchanged (no client-code change).
- **One-command workflow** (root `package.json`):
  - `pnpm demo` — ensure Supabase CLI, start the local stack, reset + migrate + apply
    the base seed and `seed.demo.sql`, upload assets, create demo users, write
    `.env.local` (`VITE_SUPABASE_URL`, publishable/anon key), start the Bun calendar mock
    and the Quasar dev server;
  - `pnpm demo:reset` — deterministic re-seed (drop + migrate + both seeds + assets);
  - `pnpm demo:stop` — stop the mock and the Supabase stack;
  - `pnpm demo:check` — smoke: DB reachable, adapter scenarios return the expected
    shapes, `/en`, `/pl`, `/uk` respond 200;
  - `pnpm demo:calendar` — run the mock standalone.
- **`docs/DEMO_ENVIRONMENT.md`** — prerequisites (Docker, WSL notes, ports 54321–54324
  and the mock port), credentials, scenario list, reset, troubleshooting, and the
  explicit "demo data is fictional; never deploy it" warning.
- **Carry-over fixes** (small, non-overlapping): consolidate the duplicated `.sr-only`
  utility; add the 16:9 cover block to the homepage project skeleton; add E2E coverage
  for the mission-empty state and the lede.

### Out

- Hosting, Netlify deploy, cloud Supabase, custom domain, TLS, analytics.
- Real Google Calendar credentials, real organization content, real users/emails.
- Production data migration and content authoring (that is the hosting phase).
- Admin feature tickets T-026…T-031 themselves (they consume this environment; T-026 is
  the first and is planned in the same session when time allows).

## Design constraints

- `docs/architecture.md` §3 (data boundary), §6 (secrets), §9 (deployment).
- `docs/TESTING.md` §6 (fixtures are clearly fictional; never real personal data).
- AGENTS.md rules 4, 6 (secrets at the boundary; never invent credentials/content/people).
- D-01 (single app, root repo), D-17 (admin claim: `app_metadata.role = "admin"`).

## Acceptance criteria

- [ ] With Docker running and a clean checkout, `pnpm demo` boots the site populated in
      en/pl/uk; `home` mission renders from `site_pages`, not the empty state.
- [ ] The homepage shows 3 nearest events from the mock (date order) and 3 featured
      projects in configured rank order; the project fallback is visible when featured
      ranks are removed by the demo data toggle.
- [ ] Publications, team, documents, and project details render with local storage
      assets; every referenced public URL resolves (no broken images/files).
- [ ] Calendar scenarios are switchable and `unavailable` renders the documented
      failure state while the rest of the page remains intact.
- [ ] Admin demo login succeeds; the viewer account cannot reach admin surfaces once
      T-026 lands, and RLS still denies anon writes.
- [ ] `pnpm demo:reset` reproduces byte-identical content and is safe to re-run.
- [ ] Demo seed/assets are not referenced by `pnpm build`; existing unit/E2E suites stay
      green; the base `seed.sql` idempotency check still passes.
- [ ] `docs/DEMO_ENVIRONMENT.md` lets a newcomer start the environment without asking
      questions.

## Verification

```
pnpm demo
pnpm demo:check
pnpm demo:reset && pnpm demo:check
pnpm test && pnpm typecheck && pnpm lint:check && pnpm build
pnpm test:e2e --workers=1
pnpm test:db:idempotency
```

## Review gate

- @architector: demo stack stays outside the production data path; no secret or
  service-role key can reach the client or the repo; no drift from the real Supabase
  contract.
- @reviewer: no invented real-world facts; fixtures clearly fictional; scripts
  idempotent; no test-suite regressions; docs match the actual commands.

## Log

- (author) start:
- (session 8) Implemented: `supabase/seed.demo.sql` + deterministic PNG/PDF
  assets + Storage upload + demo users; Bun calendar mock reusing the T-023
  handler; dev-only Quasar proxy; `pnpm demo` / `demo:reset` / `demo:stop` /
  `demo:check` / `demo:calendar`; `docs/DEMO_ENVIRONMENT.md`.
- (session 8, review) `@architector` (arc-1) APPROVE WITH FIXES → PID identity
  now requires the command marker **and** expected cwd and fails closed; CORS
  allow-methods aligned with GET/HEAD/OPTIONS; setup refuses a non-loopback
  API URL; `docs/architecture.md` §9 records the T-037 local-demo topology and
  the scoped Bun exception. `@reviewer` (rev-1) APPROVE WITH FIXES → removed
  the base-row delete that broke base-seed idempotency in the demo state (the
  gate now passes with demo data present); `.ignore` removed.
- (session 8, verification) `pnpm test` 776, `pnpm test:e2e --workers=1` 90,
  `pnpm typecheck`, `pnpm lint:check`, `pnpm build`, `supabase test db` 239,
  `pnpm demo:reset` + `demo:check` (pages en/pl/uk, six calendar scenarios,
  asset 200, viewer-denial/auth boundary), and `pnpm test:db:idempotency`
  with demo data. Workstation note: port 9000 is held by the `poetry-dev`
  container; use `DEMO_DEV_PORT=9200` (documented in STATUS.md).
- (session 8, post-close defect found by the user) The site returned 200 but the
  browser stayed in loading states and the console reported “Supabase is not
  configured”. Two causes, both fixed: (1) Quasar’s client env prefix defaults
  to `QCLI_`, so the `VITE_*` values written to `.env.local` were filtered out
  of the client bundle — `build.env.clientPrefix` now exposes `QCLI_` and
  `VITE_`; (2) the meta CSP only allowed same-origin connections, so REST and
  Storage calls to `http://127.0.0.1:54321` were blocked — dev now allows the
  local Supabase origin and production allows `https://*.supabase.co` for
  connect/img. Verified in a real browser: demo mission/events/projects render,
  `admin@demo.local` reaches `/en/admin`, `viewer@demo.local` reaches
  `/en/admin/access-denied`; 90 E2E and the build stay green. Use
  `127.0.0.1`, not `localhost`, for the demo origin.
