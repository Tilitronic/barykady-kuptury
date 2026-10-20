# T-038 — One canonical slug per entity across all locales

**Session:** 9 · **Lane:** data-model/routing · **Owner:** @coder
**Reviewers:** @reviewer + @architector (security/model) + @designer (URL/UX sign-off)
**Depends on:** T-012, T-015, T-019, T-020 · **Blocks:** T-027…T-031 (slug rule for admin CRUD), T-034 (hreflang/sitemap)
**Decision:** D-24 (owner: one shared slug per entity, `/{locale}/` prefix stays)

## Outcome

Every content URL uses ONE canonical slug shared by all languages:
`/{en|pl|uk}/projects/cultural-bridge`, `/{locale}/publications/<slug>`,
`/{locale}/about/documents/<slug>`. Switching language is a pure prefix swap —
no lookups, no redirects, no 404s. Per-locale slugs are deleted from the schema,
the data-access layer, the seeds, and the tests. The uncommitted
cross-locale-redirect patch (`findLocalizedSlug` + `fetch*LocaleSlug` +
`redirectSlug` + page watchers) is reverted, not merged: the machinery it
supports no longer exists.

## Scope

### In

- **Schema migration** (new committed migration, single source of truth per
  AGENTS.md rule 5): add `slug text not null` + table-level `unique(slug)` +
  `slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'` check to `projects`, `publications`,
  `organization_documents`; backfill each row from its **English** translation
  slug. An English translation is required: the migration aborts loudly if any
  row lacks one rather than inventing identity from another locale;
  drop `slug` (+ its unique/format constraints) from **all** translation
  tables: `project_translations`, `publication_translations`,
  `organization_document_translations`, `site_page_translations`,
  `team_member_translations`.
  - `site_pages` keeps `page_key` as its stable identity; `team_members` keep
    name-based identity. Their translation slugs are unused in routing
    (verified: only `projects/:slug`, `publications/:slug`,
    `about/documents/:slug` are routed) — dropping the columns removes the
    ambiguity class everywhere, not just on routed entities.
- **Regenerated DB types** via `pnpm types:db` (committed, not hand-edited).
- **Data access**: strict lookup becomes "published row WHERE root `slug` =
  `:slug` AND a translation exists for the locale, else 404" (the T-019
  strictness rule, now trivially satisfied — there is only one slug). Update
  the `SELECT` strings (root `slug` in, translation `slug` out), listing links,
  and `events/projectLink.ts` (uses `project_translations(locale, slug, …)`).
  `documents/api.ts` loses its try-locale-then-English slug fallback
  (`findDocumentBySlug` lines ~196–235): resolution is the root slug.
- **Seeds**: `supabase/seed.sql` + `supabase/seed.demo.sql` — one slug per
  entity, equal to the former English slug; delete all per-locale slug values.
  Base-seed idempotency gate must stay green.
- **E2E fixtures/mocks/specs**: canonical slugs in fixtures; replace the
  redirect tests with "language switch keeps the URL and renders the target
  title" assertions for projects, publications, AND documents (closes the
  documents gap des-3 C1); keep an EN-only entity proving the documented
  no-translation 404.
- **Detail pages**: remove the cod-5 redirect watchers; `empty` renders the
  translated 404 content, never a cross-locale match, never a draft.
- **404 dead ends (des-3 m1, small)**: add a localized "back to section/home"
  link to the project/publication/document detail 404 branches (i18n en/pl/uk).
- **Naming pass (rev-2 rename table, highest-value items only)** in touched
  files + trim performative comments to why-only; no logic changes in this step.
- **Docs**: D-24 entry (this ticket), T-019 line-16 wording note (strict rule
  now reads "strict slug + published + translation-exists"), `architecture.md`
  §4/§8 touch-ups, `DEMO_ENVIRONMENT.md` URL examples if any mention
  localized slugs, editorial slug rule note for T-027 (unique, lowercase,
  ASCII, stable — never auto-rename on title edits).

### Out

- Localized-slug redirects/301s (nothing is deployed or indexed; no legacy
  URLs exist to preserve).
- Admin CRUD UI (T-027…T-031 consume the slug rule; they do not define it).
- Dropping the `/{locale}/` prefix or cookie-based language (rejected, D-24).
- UUID-in-URL (rejected, D-24).

## Design constraints

- `docs/architecture.md` §4 (content model), §6 (RLS stays the boundary),
  §8 (locale routing contract — prefix stays).
- `docs/PRODUCT_REQUIREMENTS.md` §2 (shareable per-language URLs).
- AGENTS.md rules 4, 5 (migrations), 7 (no extra query round-trips on
  normal loads), 9 (every UI string localized en/pl/uk).
- D-24; des-3 smallest-safe-design steps 1–7; rev-2 keep-as-is list.

## TDD plan

1. RED: migration + regenerated types break compilation/tests (expected).
2. GREEN: data-access rewrite; strict-by-root-slug unit tests in
   `__tests__/api.test.ts` for all three entities (match, unknown slug,
   draft rejected, missing-locale-translation → empty).
3. RED E2E: language switch keeps URL + renders target title for fully
   translated projects/publications; the documents in-view switch updates the
   URL; a PL listing fallback card opens the English detail; foreign-locale
   direct URLs for untranslated projects/publications 404.
4. GREEN: seeds/fixtures updated; suites pass.
5. REFACTOR: rev-2 rename pass + comment trim + 404 back-links; re-run.

## Acceptance criteria

- [x] `supabase db reset` from scratch applies the migration; every migrated
      row carries its former English slug; no translation table has a slug.
- [x] Projects/publications: switching language on a fully translated detail
      keeps the URL except the locale segment and renders the target title with
      zero extra lookups. Listing cards whose visible text is an English
      fallback link to the **owning (English) locale**, so no visible card
      dead-ends. A direct foreign-locale URL for a row with no translation in
      that locale still renders 404.
- [x] Documents: the reader resolves the canonical slug regardless of which
      translations exist, renders the requested locale or English with the
      existing D-12 fallback note, and its in-view language switch updates the
      URL locale (no URL/content mismatch). The header switcher stays a pure
      prefix swap.
- [x] Unknown slugs, drafts and archived rows render the translated 404 with a
      back link, never another locale's content.
- [x] `findLocalizedSlug.ts`, `fetch*LocaleSlug`, `redirectSlug`, page
      redirect watchers, and redirect tests are gone from the tree.
- [x] Full suites green: unit, typecheck, lint, build, E2E, `supabase test db`,
      `pnpm test:db:idempotency`, `pnpm demo:reset` + `pnpm demo:check`.
- [x] No removed localized-slug VALUE remains in a slug position in code,
      seeds, fixtures or E2E (regulation body text is content, not a slug;
      history/decision records may quote the old values).

## Verification

```
supabase db reset
pnpm test && pnpm typecheck && pnpm lint:check && pnpm build
pnpm test:e2e --workers=1
supabase test db
pnpm test:db:idempotency
pnpm demo:reset && pnpm demo:check
rg -n "'(demo-kulturnyi-mist|demo-warsztat-kulturowy|demo-movna-laboratoriia|demo-laboratorium-jezykowe|demo-arkhiv-pamiati|demo-archiwum-pamieci|regulamin|rehlament)'" \
  supabase/seed.sql supabase/seed.demo.sql apps/web/barykadyKultury/src apps/web/barykadyKultury/e2e
```

## Rollback

Local-only today (no hosted project exists, D-08). Before applying to a hosted
project (T-034), take a database snapshot/export first.

- **In-flight failure:** the migration runs inside an explicit `begin; … commit;`
  block (required because Supabase CLI 2.115+ pipelines statements), so a failed
  statement leaves no partially populated columns or partially dropped slugs.
- **Post-apply issue:** restore the snapshot and redeploy the previous app
  revision together. Dropped translation slugs are not unique data: the
  canonical root slug is the former English value, and the old localized values
  remain recoverable from git history (`seed.sql`, `seed.demo.sql`, this
  migration).
- **Re-verify after rollback:** `supabase db reset`, `pnpm test`,
  `pnpm test:e2e --workers=1`, `supabase test db`.

## Review gate

- @reviewer: spec fidelity to D-24 + this ticket; no scope creep; no weakened
  tests/RLS; i18n completeness; the cod-5 patch fully removed.
- @architector: migration safety (backfill, constraints, no exposure window);
  strictness preserved; slug editorial rule recorded for T-027.
- @designer: URL/UX sign-off (shareability, switch behavior, 404 back-links,
  no visual regressions).

## Log

- (author) start:
- (session 9) Implemented: root canonical `slug` on projects/publications/
  organization_documents (unique + format, English backfill with abort guard);
  translation slug columns dropped from all five translation tables; data
  access, detail pages, seeds, E2E fixtures and pgTAP rewritten to the canonical
  rule; T-019/T-027 contracts updated; uncommitted redirect patch reverted.
  Lane N added the rev-2 naming pass, localized 404 back-links, CSP hardening,
  admin redirect allowlist and truthful route comments.
- (review) rev-1 two-axis: APPROVE WITH FIXES -> T-019 wording, T-038 grep gate,
  events.vue comment, abort-vs-coalesce wording. Applied.
- (review) arc-3 migration/security: BLOCK -> explicit `begin; … commit;`
  (Supabase CLI 2.115+ pipelines statements; supabase/cli#6347), rollback
  section, T-027 acceptance corrected. Re-verified with db reset + pgTAP.
- (review) des-2 URL/UX: APPROVE WITH FIXES -> C1 fallback listing cards now
  link to the owning locale (no dead 404s), M2 document in-view switch updates
  the URL, M3 documents restored to the D-12 English-fallback-with-note.
  All three fixed and live-verified.
- (demo) T-037 seed collision surfaced by live verification: the demo seed
  repurposed the base `regulations` document IDs (D-12 in-app reader). Fixed:
  demo documents use their own UUIDs; base regulations and its three bodies are
  preserved. Demo now has 4 documents.
- Verification: 793 unit tests / 101 E2E / 255 pgTAP; typecheck, lint, build;
  `pnpm test:db:idempotency`; `pnpm demo:reset` + `pnpm demo:check`; live
  browser checks for project prefix-switch, PL fallback card → EN detail,
  UK regulations reader, in-view EN switch → `/en/...`, admin sign-in.
