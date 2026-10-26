# T-048 — Organization settings, visibility flags & tabbed admin

**Session:** 16 · **Lane:** feature/admin · **Owner:** @coder · **Status:** done
**Reviewers:** @reviewer (rev-1 FIX + re-gate SHIP) + @architector (approve; definer-switch approve)
**pgTAP proviso CLEARED 2026-10-26:** Docker restarted, migration applied via
`db reset`, `organization_settings_test.sql` 51/51 PASS after two orchestrator
fixes (explicit per-role EXECUTE revokes incl. service_role — same default-ACL
trap as T-045; test fixtures made seed-independent + fictional). Full pgTAP:
19 files / 827 PASS.
**Depends on:** T-046 · **Blocks:** T-035 (visibility affects release content)

## Origin

Owner direction (Session 16): the admin needs one tabbed surface — general,
contacts, team, documents, projects, events, publications — where org facts
(NIP, REGON, contact addresses, email, paper-mail address, social links) are
editable, every field carries a "visible" checkbox, and unchecking hides the
corresponding public UI block. Each tab has its own edit right. Events /
projects / publications submit through one shared component with
conditionally visible elements per mode.

## Outcome

A root admin edits all org facts in one tabbed form; scoped editors see only
their tabs; any field marked invisible disappears from the public site; the
three entity submits share one form shell.

## Scope

In:

- `organization_settings` store: one row per fact (key, per-locale value
  where textual, `visible` boolean, updated audit). Keys: NIP, REGON,
  seat/address, paper-mail address, contact emails/phones, social links
  (per-network URL + visible). Values validated by kind (email, URL, NIP
  checksum, plain text); secrets never (no credential keys in this store).
- Tabbed admin surface (`/admin/settings` + tab param): General, Contacts,
  Team, Documents, Projects, Events, Publications. Tabs render the existing
  entity editors (T-027…T-031) or the settings form as appropriate — no
  editor rewrites, only hosting + tab chrome.
- Per-tab rights: extend the §6.1 vocabulary (`settings:write` for General +
  Contacts; existing entity scopes for the rest); guard hides tabs; RLS on
  the settings table (`is_admin() OR has_capability('settings:write')`);
  grant runbook extended (T-046 appendix).
- Visibility plumbing: every public component rendering an org fact reads
  `visible` and renders nothing when false (contact blocks, footer NIP/REGON,
  social icons, address lines). E2E: uncheck → block gone publicly; recheck →
  returns. Hidden values must not leak via API payloads either (select only
  visible for anon).
- Shared submit shell for events/projects/publications: one component with
  per-mode conditional sections; migrate the three editors onto it without
  behavior change (their tests prove it). This is the first sanctioned
  cross-entity UI abstraction — keep it presentational; mutation paths stay
  per-entity (architector to confirm the boundary).
- i18n en/pl/uk for all new strings; keyboard-operable tabs (reuse
  AdminLocaleTabs pattern); audit log of who changed what (updated_by +
  timestamp on the settings row).

Out: new entity types, public settings API beyond visibility-filtered reads,
per-locale visibility (visible is global until proven needed), WYSIWYG.

## Design constraints

- `docs/architecture.md` §3/§4/§6/§6.1 (new §6.1 rows for `settings:write`;
  visibility rule recorded before code); AGENTS.md (RLS-first, TDD +
  Playwright + i18n, no invented org facts — seed with clearly fake local
  values only).
- Current hardcoded org facts (contact page, footer, about) become
  settings-driven; keep rendering identical when all flags are visible.

## Acceptance criteria

- [x] Every listed fact editable + visible-toggle; toggle flips public
      rendering same-session (E2E).
- [x] Hidden facts absent from public markup AND anon API payloads.
- [ ] Scoped editor sees only granted tabs; direct URL to denied tab denied
      (E2E); denied settings writes rejected at DB (pgTAP).
- [x] Entity editors behave identically inside tabs (their suites green).
- [x] Shared shell drives all three submits with mode-conditional sections;
      per-entity mutation paths untouched.
- [x] Setting change records who/when.
- [x] Validation rejects malformed email/URL/NIP with localized field errors.

## Log

- (author) start:
- 2026-10-26 implementation: design authority recorded first in
  `docs/architecture.md` §6.1 (`settings:write` row + organization-settings
  visibility rule). Added `organization_settings` migration
  (`20261026120000_organization_settings.sql`) with anon-visible-only SELECT
  policy and one transactional
  `save_settings_v1` RPC (SECURITY DEFINER after the gate fix, pinned
  search_path, key/locale + kind validation, `updated_by` +
  `updated_by_email`/`updated_at` audit).
  Feature seam in `src/features/settings/` (definitions, kind validation
  incl. NIP/REGON checksums, resolver, API, reactive public state, tab policy).
  Public plumbing now settings-driven for footer/contact/header social and the
  new paper-mail line; static parity is preserved when no rows exist, a
  non-editable `org.settings_initialized` sentinel marks a provisioned table,
  and once authoritative an empty visible set hides everything. `/admin/settings?tab=`
  hosts General/Contacts forms plus the existing team/documents/projects/
  events/publications pages; per-tab scopes hide sections and a denied direct
  URL renders an explanation. `AdminSubmitShell` is presentational only and
  drives project/publication form chrome + the event mapping mode; each
  feature keeps its own mutation module. en/pl/uk strings added.
  Evidence (post-gate-fix): 1670 unit/component tests green (168 files); full
  Playwright suite 288/288 green, including `e2e/admin-settings.spec.ts` 4/4 (toggle round trip
  + explicit `visible=eq.true` anon filter, localized validation error, scoped
  tab hiding + direct-URL denial, hosted-editor identity + three shell modes)
  and the affected editor suites (`admin-projects`, `admin-publications`,
  `admin-events`) 13/13; `pnpm typecheck`, `pnpm exec oxlint`, changed-file
  `oxfmt --check` and `pnpm build` green. The gate-fix batch added the seed
  policy guard (`seedPolicy.test.ts`, 6 assertions) and re-ran the full suites
  above.
  pgTAP `supabase/tests/organization_settings_test.sql` (51 assertions after
  the gate-fix batch) is
  authored but NOT executed locally: this environment has no Docker/Supabase
  runtime. AC3's DB half therefore remains open for CI/orchestrator
  (`supabase test db`). Final `pnpm lint:check` is green; the three orchestrator
  oxfmt-hygiene files remain in the tree as instructed (see below).
  Deferred: multiple simultaneous contact emails/phones (the shipped product
  model has one public email + one public phone; a list is a new product
  decision, not an invented fact).

### 2026-10-26 gate-fix batch (reviewer FIX-before-ship + architector follow-ups)

- **FIX-1 (Critical) — sole write path.** Direct `INSERT`/`UPDATE` table
  privileges are revoked from `anon` and `authenticated`; no INSERT/UPDATE/
  DELETE policy exists. `save_settings_v1` is now **SECURITY DEFINER** with a
  pinned empty `search_path` and the same explicit
  `is_admin() OR has_capability('settings:write')` re-check. Invoker rights
  could no longer write after the revoke; definer ownership makes the RPC the
  only writer, so the key whitelist, sentinel and audit stamping hold by
  construction. pgTAP asserts `prosecdef = true`, SELECT-only table
  privileges, and that settings editors **and root** still cannot write the
  table directly (42501).
- **FIX-2 (Major) — DB kind validation.** `save_settings_v1` now delegates to
  `public.validate_organization_setting_v1(key, value)` plus immutable
  `is_valid_{email,public_url,nip,regon}_v1` helpers. Email shape, absolute
  http(s) URLs (no `javascript:`/relative), NIP checksum and REGON 9/14-digit
  checksum are rejected with `22023` for **every** locale value; empty remains
  the explicit "not configured" state. pgTAP proves valid + malformed per kind.
  Helper EXECUTE is revoked from client roles; the definer RPC calls them.
- **FU2 — runbook.** `docs/tickets/T-046-capability-scoped-admin.md` appendix
  now lists `settings:write`, shows it in create/update grant examples, and
  states that it grants General/Contacts only and that the RPC is the sole DB
  writer.
- **Seed policy (decided) — fictional only.** The T-048 organization-settings
  blocks in `seed.sql` and `seed.demo.sql` now contain only clearly fictional
  organization facts: Example Culture
  Association / Example City, `example.test` email/address/social URLs, and
  NIP/REGON-shaped placeholders with deliberately invalid checksums
  (`1234567890` / `123456789`). Verified production identifiers/URLs are
  authored by a root administrator after deploy, never seeded. The guard reads
  the T-048 blocks (pre-existing content seeds are out of scope) and fails if a
  real identifier, real social URL or real settings org name returns; it also
  proves the placeholders fail the client checksum rules. RED→GREEN was observed
  for this guard: temporarily restoring the verified NIP made 2/6 assertions
  fail; the committed fictional seeds pass 6/6.
- **Explicitly NOT doing (logged per instruction):**
  1. *Anon audit-column view restriction* — optional hardening, deferred. The
     anonymous projection already selects `key, value, visible` only, hidden
     rows are removed by RLS + the explicit filter, and audit fields are never
     part of the public payload. A definer view would add a new security
     surface for no demonstrated exposure.
  2. *Formatting-churn split* — not split, per instruction. The three files
     (`e2e/axe-surfaces.spec.ts`, `e2e/support/journey-helpers.ts`,
     `src/shared/color/__tests__/contrast.test.ts`) are orchestrator oxfmt
     hygiene and are kept in the tree; they carry no T-048 logic. With them,
     final `pnpm lint:check` is green.
  3. *pgTAP execution* — Docker is broken at the host. `supabase test db`
     currently fails with `ECONNREFUSED 127.0.0.1:54322` ("Make sure Docker is
     running"). The 51-assertion suite is authored but not executed; the
     orchestrator/CI must run it before deploy. AC3's DB half stays open.
