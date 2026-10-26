# Release handoff — Barykady Kultury

**Status:** release-gate complete (code + docs); production provisioning and DNS
remain owner actions.
**Gate date:** 2026-10-26 · **Ticket:** T-035
**Gate commit:** `ae34406` plus the T-035 gate fixes listed in §7 (uncommitted at
handoff time; the release commit must include them).
**Authority:** `docs/PRODUCT_REQUIREMENTS.md` §8, `docs/TESTING.md` §5,
`docs/architecture.md` §9–§10, `AGENTS.md` definition of done.

This document is the operator-facing handoff. The item-by-item acceptance
evidence lives in the T-035 Log (`docs/tickets/T-035-release-readiness.md`).

---

## 1. What shipped

Everything below is implemented and covered by the clean-checkout gate
(`bash scripts/ci-local.sh`, 8/8 gates) unless explicitly marked partial.

| Area | Tickets | Shipped capability |
|---|---|---|
| Foundation | T-001–T-005 | Single-repo Quasar app, unit/component + Playwright harnesses, eight CI gates mirrored by `scripts/ci-local.sh`. |
| Design system | T-006–T-008 | Brand tokens (SCARLET/NERO/GRAY93), self-hosted GNU FreeSerif (D-40), logo/favicons. |
| Public shell | T-009–T-011 | Locale routing (`/en`, `/pl`, `/uk`), theme preference, header/nav/footer, skip link, social slots (T-043). |
| Data & security | T-012–T-015 | Content schema, RLS + admin claim, Storage policies, generated DB types and feature data-access modules. |
| Public content | T-016–T-025 | About (mission/history/values/aims, team, documents reader), projects, publications, contact, support, read-only Google Calendar adapter, events, homepage composition. |
| Admin | T-026–T-031, T-045, T-046, T-048 | Auth/layout, projects CRUD, site pages/team, publications/documents/uploads, featured ordering, event mapping + translation coverage, transactional saves, capability scopes, org settings with visibility flags and tabbed admin. |
| URLs, reader, search | T-038–T-040 | One canonical slug per entity, consolidated area pages + two-source search, unified accessible long-form reader. |
| Import / sync | T-042 (+ T-041 partial) | Google Docs import/sync through the safe converter, private source files, signed original download. **Manual MD/DOCX file import from T-041 is deferred** (see §2). |
| Deploy & QA | T-032–T-034, T-037, T-043, T-044 | SPA deploy config, SEO metadata/sitemap, security headers, full E2E journey matrix, accessibility audit and fixes, local demo environment, social links, post-review remediation. |

**Deliberately not built:** payment processing, membership/public registration,
Google Calendar write-back, a custom calendar grid, and general-purpose page
building (`docs/architecture.md` §10).

---

## 2. Deliberately deferred

| Item | Ticket / decision | Impact and handling |
|---|---|---|
| Manual MD/DOCX file import + source-file workflow | **T-041** (open) | Admins can import Google Docs (T-042) and edit metadata; the file dropzone is not shipped. `AdminImportPage` intentionally renders only the Google source. |
| "What your support does" content slot | **T-036** (open) | Omitted because no approved content source exists. Blocked by D-06 + owner-approved copy; never invent impact claims. |
| `published_at` CHECKs on publications/documents | **T-047** (open) | Admin RPC paths stamp the invariant; importer/direct-fixture paths are not yet constrained. Blocks no shipped feature, but remains data-integrity debt. |
| Per-locale calendar descriptions | D-14 | Decided default implemented: calendar text is shown as-is with one language note on the Events page. Separate calendars can be revisited later. |
| Contact form | D-09 | V1 ships **no form**; `mailto:`/configured channels only. A form requires a provider decision and a server endpoint. |
| MD/DOCX in-browser editor, ODT import, live Google Docs iframe | D-28/D-29/D-35 | Out of V1 by decision; Google Docs import stores a sanitized copy instead. |
| SSG/prerender and dynamic sitemap entries | D-10 | V1 is SPA. Static routes are in the sitemap; detail URLs are intentionally excluded (see §5). |
| Turborepo / shared packages | D-15 | Deferred until a second consumer exists. |

Open decisions that are **launch blockers** because the owner must supply
values (the app fails safe until then): **D-04** (public contact data),
**D-06** (support/donation destinations), **D-07** (dedicated public Google
Calendar ID + read-only credentials), **D-08** (Supabase project URL/key +
first admin). D-05 is resolved by the owner-verified social URLs (T-043); D-09,
D-14 and D-16 are resolved by the implemented defaults (see the T-035 Log).

---

## 3. Content operations

### 3.1 Admin surface

Sign in at `/{en|pl|uk}/admin`. Access is provisioned in Supabase; there is no
public registration.

| Surface | Path | Who |
|---|---|---|
| General + Contacts (org facts, visibility toggles) | `/{locale}/admin/settings?tab=general` / `?tab=contacts` | root admin or `settings:write` |
| Team | `/{locale}/admin/settings?tab=team` | `team:write` |
| Documents | `/{locale}/admin/settings?tab=documents` | `documents:write` |
| Projects | `/{locale}/admin/settings?tab=projects` | `projects:write` |
| Events (project mapping only) | `/{locale}/admin/settings?tab=events` | `events:write` |
| Publications | `/{locale}/admin/settings?tab=publications` | `publications:write` |
| Translation coverage | `/{locale}/admin/coverage` | any admin scope |

Every org fact has a global **visible** checkbox. Unchecking removes the fact
from the public site *and* from anonymous API payloads (T-048). Hidden is
indistinguishable from "not configured".

### 3.2 Publishing workflow

1. Author/edit one locale at a time. Publishing requires a complete English
   fallback; the coverage dashboard shows missing translations and fields.
2. Publish/unpublish explicitly. Drafts are invisible to anonymous visitors.
3. Events are created in the organization's Google Calendar; the website only
   assigns/unassigns an optional published project.
4. Originals imported from Google Docs stay private; the "original download"
   toggle serves a short-lived signed URL and is off by default.

### 3.3 Scopes and grants

The scope vocabulary and Admin-API grant runbook are in
`docs/tickets/T-046-capability-scoped-admin.md` (Appendix) and
`docs/architecture.md` §6.1: `pages:write`, `projects:write`,
`publications:write`, `documents:write`, `team:write`, `events:write`,
`settings:write`, `media:write`, `importer`. The canonical root claim is
`app_metadata.role = 'admin'` (D-17). Grants happen only through the Supabase
Admin API with the service-role key; the key never enters the browser, the
repo, or logs.

### 3.4 Seed policy (T-048)

`supabase/seed.sql` and `supabase/seed.demo.sql` are **local/demo fixtures**.
Every organization fact in the settings block is clearly fictional
(`example.test`, `Example City`, invalid-checksum NIP/REGON placeholders), and
`src/features/settings/__tests__/seedPolicy.test.ts` fails if a real identifier,
social URL, or organization name returns to that block.

**Do not run either seed against production.** With `org.settings_initialized`
absent, the public site falls back to the static, owner-verified values in
`src/config/organization.ts` (name, seat, NIP, REGON, social links; contact
empty). Author real About/team/documents/projects/publications and the contact
/ support / calendar values through the admin after deploy.

---

## 4. Known limitations

| Limitation | Detail / mitigation |
|---|---|
| **Observer (vision) lane unfunded** | The final owner visual pass against the brandbook is outstanding (STATUS session 14). Typography/code/axe checks passed; this is a human visual sign-off, not a code gate. |
| **No manual screen-reader test** | Automated axe + keyboard/reflow/contrast journeys pass, and form errors are programmatically associated. Screen-reader output was not verifiable in this environment; no external audit/VPAT (T-033). |
| **Chromium-only browser coverage** | Playwright runs Chromium by default; Firefox/WebKit projects are documented but disabled (browser cache/CI cost). Axe therefore reflects Chromium. |
| **pgTAP needs Docker** | `supabase test db` requires the local Supabase stack. Gate 6 is a real run locally (827 assertions) and uses `SUPABASE_DB_URL` in CI; a stopped Docker stack fails the gate rather than silently skipping. |
| **`rg` not installed here** | The documented secret scan (`rg -i "service_role|..." dist`) was executed with the equivalent `grep -riE`; result: zero matches. |
| **Dependency audit** | Production dependencies: 0 known vulnerabilities. Full tree: 1 **high** (`happy-dom <21.0.4`, dev/test-only) and 1 **low** (`serialize-javascript <7.1.3`, build-time via `@quasar/app-vite`). Fixes exist; per the T-035 instruction only critical-with-fix issues are patched. |
| **SPA sitemap** | Dynamic detail URLs (`projects/:slug`, `publications/:slug`, `about/documents/:slug`) are not in `sitemap.xml` until prerender or a post-publish sitemap job. Runtime canonical/hreflang is emitted. |
| **`VITE_SITE_URL` required for SEO output** | Without it the build omits `sitemap.xml` and the robots `Sitemap:` line (it warns). Set it in Netlify Production. |
| **T-041 / T-047 / T-036** | See §2. None silently blocks a shipped feature; each has an explicit ticket. |

---

## 5. Next steps (launch checklist)

1. **Commit and push.** Include the T-035 gate fixes (§7); push `main` (the
   branch is ahead of `origin`). The project owner performs the push.
2. **Provision Supabase (hosted).** Create the project; set
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`; apply migrations with
   `supabase db push` (or the CI migration job). Do **not** apply
   `supabase/seed.sql` / `seed.demo.sql`.
3. **Provision the first admin.** Use the T-046 Appendix runbook:
   `app_metadata.role = 'admin'` (root) or scoped editors with
   `app_metadata.scopes`. Deliver the set-password link out-of-band.
4. **Calendar.** Create a dedicated **public** calendar, create a read-only API
   key, and set `GOOGLE_CALENDAR_ID` + `GOOGLE_CALENDAR_API_KEY` in Netlify
   (server scope only). Never point at a private calendar.
5. **Netlify.** Create the site from the repo root (`netlify.toml` is
   authoritative), set `VITE_SITE_URL` to the production origin, add the
   server-only env from `docs/environment.md`, deploy, and verify:
   `/` redirect, locale URLs, history fallback, security headers,
   `/.netlify/functions/calendar-events`, `/api/content-check`,
   `robots.txt` + `sitemap.xml`.
6. **Author production content.** Through the admin: About mission/history/
   values/aims (approved T-016 copy), regulations/team/documents, contact
   details and visibility toggles, support destinations, social links, and at
   least one published project/publication. Verify no `Example ... (Fictional)`
   value is visible publicly.
7. **Smoke test in production.** Public pages in all three locales; language
   and theme persistence; homepage upcoming events; event → published project
   link; publication download; admin sign-in; anonymous admin rejection;
   mobile 360 px and keyboard-only pass; axe spot check; secret scan of the
   deployed bundle.
8. **Backup before launch.** Run the export in §6 and store it off-provider;
   record the restore drill owner and cadence.
9. **DNS cutover (out of T-035 scope).** Point the domain, keep
   `VITE_SITE_URL` in sync, redeploy, and re-verify canonical/sitemap hostnames.
10. **Record the deploy.** Note the commit SHA, migration head, and Netlify
    deploy ID in the release notes.

---

## 6. Backup/export and rollback

The authoritative rules are `docs/architecture.md` §9. Operational shape:

### 6.1 Database and Storage export

```bash
# Logical exports (run from a trusted shell; never commit the URL or dumps)
supabase db dump --db-url "$SUPABASE_DB_URL" -f "backup-$(date +%F)-schema.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" --data-only -f "backup-$(date +%F)-data.sql"

# Storage: export each bucket (public-media, public-documents, content-sources)
# through the Supabase CLI/API and record a manifest of object paths + hashes.
```

Keep exports outside the provider account. Define a retention window and a
restore drill (at minimum before the first production content import). A
free-tier hosted database is **not** a backup; point-in-time recovery is an
add-on, not a substitute for off-account exports.

### 6.2 Netlify rollback

Netlify deploys are immutable. Roll back code by republishing the last
known-good deploy:

- **UI:** Deploys → select the known-good deploy → **Publish deploy**.
- **API:** `restoreSiteDeploy` for the site/deploy ID.

A code rollback does **not** roll back Supabase. Migrations are forward-only;
if the bad release included a destructive migration, restore the database from
the export/PITR first, then republish the matching code deploy. Always record
the deployed commit SHA and migration head so the pair can be restored
together.

---

## 7. Release-gate fixes applied in this pass

These are part of the release commit (they were uncommitted when the gate ran;
the clean worktree included them):

1. **`.gitignore` source-directory trap.** A bare `coverage/` also ignored
   `apps/web/barykadyKultury/src/features/admin/coverage/`, so T-031's source
   was never committed and a clean checkout failed type-check. The rule is now
   anchored to the generated directories only.
2. **T-031 lint error in the recovered source.** Removed an unused
   `DEFAULT_LOCALE` import from `src/features/admin/coverage/api.ts` (the file
   had never been linted because it was ignored).
3. **`scripts/ci-local.sh` Gate 6 detection.** Gate 6 only looked for a global
   `supabase`, so it silently skipped despite the app-local CLI (D-22) and
   shipped pgTAP tests. It now resolves the app-local binary; a stopped stack
   is a real failure, not a skip.

---

## 8. Release-gate evidence (2026-10-26)

Clean worktree of `ae34406` with the §7 fixes, fresh
`pnpm --dir apps/web/barykadyKultury install --frozen-lockfile`:

| Gate | Command | Result |
|---|---|---|
| 1 Install | `pnpm --dir apps/web/barykadyKultury install --frozen-lockfile` | PASS (15.1 s) |
| 2 Format | `pnpm format:check` | PASS (496–500 files) |
| 3 Lint | `pnpm lint:check` | PASS |
| 4 Type check | `pnpm typecheck` | PASS |
| 5 Unit/component | `pnpm test` | **170 files / 1682 tests passed** |
| 6 DB/RLS pgTAP | `supabase test db` | **19 files / 827 tests, Result: PASS** |
| 7 E2E | `pnpm test:e2e:install && pnpm test:e2e` | **294 passed** (Chromium) |
| 8 Build | `pnpm build` 2026-10-26T20:26:58Z | PASS (`dist/spa`, 164 files, no-VITE_SITE_URL warning expected) |
| Secrets | same-tree `grep -riE "service_role\|SUPABASE_SERVICE_ROLE\|PRIVATE KEY\|BEGIN.*PRIVATE" dist` immediately after the above build | **0 matches** (grep exit 1) |
| Audit | `pnpm audit --prod` / `pnpm audit` | 0 production / 1 high + 1 low dev-only |

`bash scripts/ci-local.sh` exits 0 with all eight gates PASS in the clean
worktree. CI mirrors the same gate names in `.github/workflows/ci.yml`.
