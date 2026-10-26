# T-035 — Release readiness & handoff

**Session:** 7 · **Lane:** release · **Owner:** @boss · **Status:** done
**Reviewers:** @reviewer (rev-1 FIX + evidence refreshed) + @architector (approve-with-follow-ups, applied)
**Depends on:** T-033, T-034 · **Blocks:** none (release gate)

## Outcome
The full quality gate passes from a clean checkout, open decisions are explicitly resolved or documented as launch blockers, and the project is handed over with a launch checklist.

## Scope
In:
- Run every gate from `docs/TESTING.md` §5 from a clean install (`pnpm install --frozen-lockfile`).
- Confirm acceptance criteria from `docs/PRODUCT_REQUIREMENTS.md` §8 item by item, with evidence links.
- Decision audit: `DECISIONS.md` has no `open` row that blocks a shipped feature; unresolved items become explicit launch blockers in the handoff, not silent gaps.
- Security pass: RLS test suite green, storage policies green, no secret in the client bundle (`rg` on `dist`), dependency audit reviewed.
- Content audit: no fabricated contact/social/team/donation data; all published PL/UK content either approved or marked `needsReview`.
- Backup/export note for Supabase (docs §9) and a rollback path for the Netlify deploy.
- `docs/RELEASE_HANDOFF.md`: what shipped, what is deliberately deferred, how to operate content, known limitations, next steps.

Out: marketing launch, DNS cutover execution, ongoing maintenance plan.

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §8.
- `docs/TESTING.md` §5.
- `docs/architecture.md` §9 (backup/export), §10 (deliberate deferrals).
- `AGENTS.md` definition of done.

## TDD plan
Release gate — evidence-first.
1. RED: build the acceptance matrix with every item marked "unproven" and run the gate; record failures.
2. GREEN: fix or explicitly defer each; re-run until the matrix has no unproven item.
3. Verify the clean-checkout run (no local cache, no stray env file).

## Acceptance criteria
- [ ] Clean-checkout gate: format, lint, typecheck, unit, DB/RLS, E2E, build all green.
- [ ] Acceptance matrix complete with evidence per item.
- [ ] No `open` decision silently blocking a shipped feature.
- [ ] No secret in `dist`; no service-role key anywhere in the client.
- [ ] Published content contains no invented organizational facts.
- [ ] Backup/export and rollback documented.
- [ ] `docs/RELEASE_HANDOFF.md` written and reviewed.

## Verification
```
rm -rf node_modules && pnpm install --frozen-lockfile
bash scripts/ci-local.sh
rg -i "service_role|SUPABASE_SERVICE" dist || true
```

## Review gate
- @reviewer: matrix evidence is real command output, not claims; no gate skipped silently.
- @architector: final check that shipped architecture matches documented architecture or that divergences are recorded.

## Log
- (author) start:
- **2026-10-26 — release gate executed (code_executor).** Clean worktree of
  `ae34406` at `/tmp/opencode/t035-gate` (the working tree's `node_modules` was
  preserved), fresh `pnpm --dir apps/web/barykadyKultury install
  --frozen-lockfile` → PASS (15.1 s). The first run correctly failed: see
  "Gate fixes" below. Final run `bash scripts/ci-local.sh` (no PATH help) → exit
  0, **8/8 gates PASS**: format, lint, typecheck, unit **170 files / 1682
  tests**, pgTAP **19 files / 827 tests (Result: PASS)**, E2E **294 passed**,
  production build PASS (`dist/spa`, 164 files).

### Gate fixes applied (release commit must include them)

| Finding | Fix | Evidence |
|---|---|---|
| A bare `coverage/` in `.gitignore` also ignored `apps/web/barykadyKultury/src/features/admin/coverage/`, so T-031's source was never committed. Clean checkout failed `vue-tsc`: `TS2307 Cannot find module '@/features/admin/coverage/api'`. | Anchored the ignore rules to generated dirs only: `/coverage/` and `/apps/web/barykadyKultury/coverage/`. | `git check-ignore` now exits 1 for the source; typecheck PASS. |
| Once recovered, the ignored file had never been linted: `no-unused-vars` for `DEFAULT_LOCALE`. | Removed the unused import in `src/features/admin/coverage/api.ts`. | `pnpm lint:check` PASS. |
| `scripts/ci-local.sh` Gate 6 checked only `command -v supabase`, so it silently skipped despite the app-local CLI (D-22) and shipped pgTAP tests. | Gate 6 resolves the global binary first, then `apps/web/barykadyKultury/node_modules/.bin/supabase`; a stopped stack is a failure, not a skip. | `bash scripts/ci-local.sh` Gate 6 PASS with no PATH augmentation. |

### Acceptance matrix — PRODUCT_REQUIREMENTS §8

All evidence is from the clean-worktree run above. "E2E 294" is the full suite
result, not a claim that every named spec is the only coverage.

| # | §8 criterion | Evidence | Status |
|---|---|---|---|
| 1 | Six nav destinations + About subsections work in all three locales | `e2e/shell.spec.ts` ("six nav destinations are present in every locale"); `e2e/about.spec.ts`; `e2e/about-rail.spec.ts`; `e2e/mobile-journeys.spec.ts` J1/J2. E2E 294 PASS. | proven |
| 2 | Locale detection, explicit URL locale, switching, saved preference | `e2e/locale.spec.ts` (root browser preference, saved choice, explicit URL authoritative, document language, switch persists); `e2e/mobile-journeys.spec.ts` J2; unit `src/features/i18n/__tests__/resolveLocale.test.ts`, `localeGuard.test.ts`, `localePath.test.ts`. | proven |
| 3 | Theme follows system, manual override persists | `e2e/theme.spec.ts` (dark system first paint, stored override before bundle/no flash, toggle persists, live system change); unit `src/features/theme/__tests__/theme*.test.ts`. | proven |
| 4 | Homepage events from Google Calendar, ordered, published-project-only links | `e2e/home.spec.ts`; `e2e/events.spec.ts` ("soonest-first with a published-only project join", "project link resolves to the published project detail"); unit `src/features/events/__tests__/calendarHandler.test.ts`, `normalize.test.ts`, `sortEvents.test.ts`, `projectLink.test.ts`. | proven with fixtures; live data requires D-07 |
| 5 | Featured selection + recent-project fallback | `e2e/home.spec.ts` ("falls back to recent published projects when none are featured"); `e2e/admin-featured.spec.ts`; unit `src/features/projects/__tests__/featuredProjects.test.ts`, `src/features/admin/featured/__tests__/featuredOrder.test.ts`. | proven |
| 6 | Anonymous cannot read drafts or write content | `e2e/projects.spec.ts` (draft slug → translated 404, no draft data); `e2e/admin-auth.spec.ts` ("anonymous project mutation is rejected and writes nothing"); pgTAP `supabase/tests/rls_content_matrix_test.sql` (827 PASS). | proven |
| 7 | Authorized admins manage content + event-project mappings | `e2e/admin-projects`, `admin-content`, `admin-publications`, `admin-documents`, `admin-events`, `admin-featured`, `admin-settings`, `admin-scopes`; pgTAP `admin_*`, `calendar_event_links_test.sql`, `scoped_admin_matrix_test.sql`. | proven |
| 8 | Admin CRUD tests incl. rejection of unauthorized operations | Same admin E2E set plus pgTAP `admin_project_mutations_test.sql`, `admin_publication_document_mutations_test.sql`, `admin_site_team_mutations_test.sql`, `organization_settings_test.sql`, `scoped_admin_matrix_test.sql` (all 827 PASS). | proven |
| 9 | Keyboard-only and mobile-width usable | `e2e/keyboard-journeys.spec.ts`, `keyboard-focus.spec.ts`, `mobile-journeys.spec.ts` (J1–J12 at 360×640), `mobile-bottom-nav.spec.ts`, `a11y-reflow.spec.ts` (320 px / 200 % zoom / 400 % text spacing). | proven |
| 10 | Playwright, typecheck, lint, unit/component, accessibility, build pass in CI | `scripts/ci-local.sh` 8/8 PASS; `.github/workflows/ci.yml` mirrors the labels; axe `e2e/axe-journeys.spec.ts` + `axe-surfaces.spec.ts` + shell/smoke axe; build PASS. | proven (Chromium-only axe; see limitations) |

### Decision audit (`DECISIONS.md` `open` rows + known ticket gaps)

The register itself is owner-owned; this is the release resolution. Rows still
marked `open` should be updated to the status below by the owner.

| Item | Resolution at release | Notes |
|---|---|---|
| D-04 public contact data | **launch blocker** | Owner must supply verified contact values via `/admin/settings?tab=contacts`. App renders the truthful empty state until then (T-021). |
| D-05 social URLs | **decided** | Owner-verified Facebook/Instagram/Telegram shipped (T-043); no placeholders. |
| D-06 support/donation destinations | **launch blocker** | Owner must supply at least one approved support path; Support page is a truthful empty state until then. T-036 remains deferred. |
| D-07 public calendar ID + credentials | **launch blocker** | Without it the homepage/events show the designed unavailable state; PRD §8 requires real calendar data. |
| D-08 Supabase URL/key + admin provisioning | **launch blocker** | Deployment and admin sign-in cannot work without them. |
| D-09 contact form provider | **decided** | V1 default is no form, `mailto:`/configured channels only (T-021). Reopening requires a provider decision + new ticket. |
| D-14 event description language | **decided** | Implemented default: calendar text as-is with one language note (`events.vue`; `events.test.ts` proves the note renders once). |
| D-16 admin locale workflow | **decided** | Implemented: one locale at a time + missing-translation flags (T-028) + `/admin/coverage` (T-031). |
| T-036 support impact slot | **deferred-post-launch with ticket** | `docs/tickets/T-036-support-impact-slot.md`; blocked by D-06 + approved copy. |
| T-041 MD/DOCX file import | **deferred-post-launch with ticket** | `docs/tickets/T-041-content-import.md`; Google Docs path (T-042) is shipped. `AdminImportPage.test.ts` asserts no file dropzone. |
| T-047 `published_at` CHECKs | **deferred-post-launch with ticket** | `docs/tickets/T-047-published-at-checks.md`; admin RPCs stamp the invariant, importer/fixture paths remain; blocks no shipped feature. |

### Security pass

- **RLS + Storage pgTAP:** `supabase test db` → `All tests successful. Files=19,
  Tests=827, Result: PASS` (includes `rls_content_matrix_test.sql`,
  `storage_policies_test.sql`, scoped-admin and mutation matrices).
- **Secret scan:** the documented command uses `rg`, which is not installed in
  this environment; the equivalent was
  `grep -riE "service_role|SUPABASE_SERVICE_ROLE|PRIVATE KEY|BEGIN.*PRIVATE"
  apps/web/barykadyKultury/dist` → exit 1, **0 matches**, on the final build.
  A broader scan found only `refresh_token` property names inside
  `@supabase/supabase-js`; no JWT/key literals.
- **Dependency audit:** `pnpm audit --prod` → **no known vulnerabilities**.
  `pnpm audit` (full tree) → 1 high (`happy-dom <21.0.4`, dev/test-only) and
  1 low (`serialize-javascript <7.1.3`, build-time via `@quasar/app-vite`).
  Fixes exist, but the T-035 instruction is to fix only critical-with-fix, so
  they are reported, not changed.

### Content audit (seeds + fixtures)

T-048 seed policy is in force and its guard
(`src/features/settings/__tests__/seedPolicy.test.ts`, 6 assertions) passes.

| Org-identifying string / block | Location | Verdict |
|---|---|---|
| "Barykady Kultury" (name, meta description, regulations headings) | `supabase/seed.sql` | **approved** — official name (brandbook/D-13; regulations D-12). |
| Mission "To expand Ukrainian culture beyond borders…", history "founded by Daria Yakovleva in Poznań", values | `supabase/seed.sql` (`site_pages`) | **approved** — brandbook pp. 4/10 via T-016; not invented. |
| Aims list + PL/EN/UK regulations bodies | `supabase/seed.sql` (`organization_documents`) | **approved** — `NGOinfoSources/regulamen/*_V4.docx` (D-12). |
| PL/UK About titles with `body = null`, `needs_review = true` | `supabase/seed.sql` | **needsReview (as designed)** — no untranslated body is presented as translated. |
| "Example Culture Association (Fictional)", "Example City", invalid NIP `1234567890` / REGON `123456789`, `contact@example.test`, `+00 000 000 000`, `Example Street` / `Przykladowa` / `Прикладова`, `PO Box 0`, `social.example.test/*`, `example.test/privacy` | `supabase/seed.sql`, `supabase/seed.demo.sql` T-048 blocks | **fictional** — policy-guarded; invalid checksums; never production content. |
| `sample-calendar@example.org`, `demo-calendar@example.invalid`, `example.org/fictional-sample-publication`, "Sample … (Fictional)" rows | `supabase/seed.sql`, demo seed/mock | **fictional**. |
| Real NIP `7831961912` / REGON `545503070` | `e2e/admin-settings.spec.ts` | **owner-approved public legal identifiers** (`NGOinfoSources/govIds.txt`, DECISIONS "Resolved inputs"), used to exercise checksum validation; test-only, not seeded/published. |
| Real Facebook/Instagram/Telegram URLs | `e2e/admin-settings.spec.ts`, `e2e/contact.spec.ts`, `src/config/organization.ts` + unit tests | **owner-approved** — T-043 log records the pages verified 2026-10-21. |
| "Barykady Kultury organizes concerts, workshops and publications across Poznań…" / "Early gatherings grew…" | `e2e/about-rail.spec.ts` mock body | **test-only synthetic prose**, never seeded or published; if it is ever promoted to content it needs owner approval (T-016 rule). |
| "Barykady Kultury (demo)" calendar location, `admin@demo.local` / `viewer@demo.local` | `mock/calendar/fixtures.ts`, demo seed/runbook | **demo-only**, fictional local fixtures. |

No fabricated contact/social/team/donation/legal data is published. Launch
content still depends on owner values for D-04/D-06/D-07/D-08 (see decisions).

### Backup/export + rollback

`docs/architecture.md` §9 already required a documented backup/export process;
the concrete export commands and the Netlify rollback path were missing and are
now recorded there. Short form: `supabase db dump` schema + data-only exports
plus Storage exports kept off-provider; Netlify rollback = republish a prior
immutable deploy (UI "Publish deploy" / `restoreSiteDeploy`). A code rollback
does not roll back forward-only migrations — restore the DB export/PITR first.
Full checklist: `docs/RELEASE_HANDOFF.md` §6.

### Handoff & limitations

`docs/RELEASE_HANDOFF.md` written (the only new docs file). It lists shipped
tickets, deferred work (T-036/T-041/T-047 + D-rows), content operations and
scopes, known limitations (observer vision lane unfunded, no manual
screen-reader pass, Chromium-only axe, pgTAP needs Docker, dev-only audit
findings, SPA sitemap limit, `VITE_SITE_URL` requirement), and the launch
sequence (push → Supabase/Netlify provisioning → first admin → calendar →
content → smoke → backup → DNS).

**Gate verdict:** six acceptance boxes are proven by the clean-worktree run;
the seventh (handoff written **and reviewed**) is written and awaits the
orchestrator's @reviewer/@architector reconciliation. Remaining release actions
are owner provisioning/content items, not code gaps.
