# T-017 — About: documents (in-app regulation reader)

**Session:** 4 · **Lane:** feature/content · **Owner:** @coder · **Status:** done
**Reviewers:** @reviewer + @designer (D-12 decision check)
**Depends on:** T-012 (schema, amended), T-015, T-016 · **Blocks:** T-029

## Outcome
The Documents subsection lists published organizational documents. Regulations are published as **in-app readable text** (owner D-12, 2026-10-18): clicking a document opens a dedicated reader with an in-view language switcher whose default is the active UI locale. File-based documents remain supported for other document types.

## Scope
In:
- **Schema evolution** (new migration): add `organization_document_translations.body text` (nullable); make `organization_documents.storage_path` and `organization_documents.language` nullable so a document may be text-only. No new RLS policies expected (policies are status/parent-based). Regenerate `src/types/database.types.ts`.
- **Data access** (`src/features/documents/api.ts`): surface the translation `body`, the set of locales that have a body (for the switcher), and a single-document fetch for the reader. Fallback rules: initial load requested→English→unavailable (reuse `selectTranslation` semantics, never pl↔uk); an explicit language switch renders only the chosen locale with **no** silent fallback.
- **Documents listing** (`/about/documents`): title + document type + publication date, links to the reader for text documents; intentional empty/unavailable states; missing optional metadata collapses (no `—` clutter).
- **Reader route** `/:locale/about/documents/:slug`: single `h1`, body rendered through `LocalizedRichText` (safe Markdown subset, no `v-html`), the content wrapper carries `lang` set to the rendered content language, a fallback note when English stands in, an in-view language switcher (keyboard-operable; unavailability disabled), translated empty/unavailable states.
- **Seed** one "Regulations" document (published) + `pl`/`en`/`uk` translations whose `body` is the **verbatim** regulation text from `NGOinfoSources/regulamen/Regulations_Barykady_Kultury_{PL,EN,UKR}_V4.docx`, converted to the safe Markdown subset.
- **i18n**: reader, switcher, fallback-note and state strings in en/pl/uk; `document_type` resolved to localized copy.
- **Unit tests**: document mapping (body + available locales), fallback resolution (initial vs explicit switch).
- **Component tests**: reader default locale, switcher behaviour incl. disabled locales, `lang` attribute, optional-metadata collapse, empty state.
- **E2E** (via `mockSupabaseRest`): list → reader; default-locale body visible; switching language updates the content; keyboard-operable; axe 0 critical/serious.

Out: file upload/editing UI (T-029), serving DOCX/PDF for regulations, literal compression (Postgres TOAST is sufficient — do not gzip/base64), legal interpretation of the documents.

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §4 (amended 2026-10-18: two document modes), §2.6.
- `docs/architecture.md` §4 (normalized content + translations), §6 (public access deliberate; never serve active content inline).
- `docs/DESIGN_SYSTEM.md` §3 (reading hierarchy, measure), §6 (heading order, focus, language of fallback content).
- `docs/tickets/DECISIONS.md` D-12 (resolved), D-19 (single source of truth).
- @architector design (arc-1, 2026-10-18): extend the existing documents model (option a) — **one** logical document + **three** translations; dedicated route (not a dialog); no literal compression.

## TDD plan
1. RED: documents `api` tests — mapping surfaces `body` + available locales; initial-load fallback resolves requested→EN.
2. GREEN: migration + regenerated types + api.
3. RED: `DocumentReader.test.ts` — default-locale body; fallback note + `lang`; explicit switch renders only the chosen locale; disabled locales.
4. GREEN: reader + listing + router + i18n.
5. RED E2E: list → reader; switch language updates content; a11y.
6. REFACTOR: reuse `LocalizedRichText`/`richText.ts` (do not fork the renderer).

## Acceptance criteria
- [x] Regulations render as in-app text in a dedicated reader; no file download is required for them.
- [x] Reader defaults to the active UI locale; the in-view language switcher changes the text; unavailable locales are disabled (never a silent pl↔uk substitution).
- [x] Initial-load fallback (requested→English) shows a note naming the source language; rendered content carries the matching `lang`.
- [x] One `h1`; headings ordered; readable measure; body rendered safely (no `v-html`).
- [x] Missing optional metadata renders nothing; empty/unavailable states are translated.
- [x] Migration committed, generated types regenerated, seed idempotency + pgTAP suites pass.
- [x] No invented content — regulation text is verbatim from the V4 `.docx` sources.

## Verification
```
pnpm test
pnpm test:e2e --grep "documents"
pnpm typecheck && pnpm lint:check
pnpm dlx supabase@2.121.0 db reset && pnpm dlx supabase@2.121.0 test db
pnpm test:db:idempotency
pnpm types:db
```

## Review gate
- @reviewer: spec axis (D-12 reader behaviour, fallback rules), migration + generated-type correctness, no `v-html`, i18n completeness, no draft leakage.
- @designer: reading hierarchy, language-switcher affordance, mobile reading order.
- Decision check: D-12 recorded in `DECISIONS.md` (done 2026-10-18) before merging the regulation text.

## Log
- (author) start: 2026-10-18
- (coder) RED (unit): `src/features/documents/__tests__/api.test.ts` — 9 failed / 3 passed (missing `body`/`availableLocales`/reader API).
- (coder) GREEN: migration `supabase/migrations/20261018150000_document_text_body.sql` (`organization_document_translations.body text`, `organization_documents.storage_path`/`language` dropped NOT NULL; comments updated; no new RLS policies), types regenerated via `pnpm types:db` (reproducible — byte-identical on re-run). Unit suite for documents api: 12/12.
- (coder) RED→GREEN (component): `src/pages/[locale]/__tests__/about-documents.test.ts` + `document-reader.test.ts` — 11/11. Reused `LocalizedRichText`/`richText.ts` and `selectTranslation` as-is; no new dependency (AGENTS.md rule 7). Extended the shared `src/test-utils/mount.ts` with an optional `routes` option so a test can resolve the reader `:slug` param (reuse, not fork).
- (coder) Seed: one published `regulations` document (`00000000-0000-4000-8000-000000000601`) + pl/en/uk translations (`regulamin`/`regulations`/`rehlament`), bodies VERBATIM from the three V4 `.docx` (dollar-quoted; structural mapping only: `§ N` → `## § N`, source paragraphs → Markdown paragraphs). `publication_date` left null (not in the source).
- (coder) DB: `supabase/tests/schema_test.sql` plan 41→47 (body column, nullability ×2, text-only insert, body round-trip, cascade); `supabase/tests/rls_content_matrix_test.sql` plan 150→152 (published/draft text-document read). `db reset` + `test db` PASS (Files=4, Tests=239); `test:db:idempotency` PASS (12 tables, 29 rows, digests identical — script needs no change; it does not hardcode counts).
- (coder) Verification (sequential): `pnpm test` 379/379 (34 files); `pnpm typecheck` PASS; `pnpm lint:check` PASS; `pnpm build` PASS; `pnpm test:e2e` 45/45 (documents reader 5/5 incl. axe 0 critical + 0 serious).
- (coder) Assumptions: (1) slug resolution prefers (requested locale, slug) then (English, slug), done in-process over the small published set because one PostgREST request cannot both select a parent by a translation column and return all its translations; (2) the switcher lists all supported locales with the bodyless ones `disabled` (covers both "available = body" and "unavailable disabled"); (3) file-based documents render as non-interactive metadata in the listing (T-029 owns the file action).

### Review status (partial, 2026-10-18)

- **@reviewer (rev-1, two-axis): 0 Spec findings; 1 Standards Suggestion (non-blocking).** All acceptance criteria mapped to evidence; no assertions weakened; migration limited to the agreed ALTERs + comments; pgTAP plans honest (schema 41→47, rls 150→152); seed regulation text verified **verbatim** against the three V4 `.docx`; `pnpm types:db` reproducible. The Suggestion: `src/router/typed-router.d.ts` lists `/[locale]/about-document` (file-derived) while the runtime route is `about/documents/:slug` — pre-existing file-based-vs-explicit-route advisory drift, **not** introduced by T-017. Recorded as a follow-up.
- **@designer (design gate, 2026-10-18, session 6): PASS with notes** (resumed after the OpenCode restart made the `barykady` designer model fix effective). Reading hierarchy/measure ✅ (65ch enforced on the article and inherited by the body; reader order `back → h1 → description → fallback note → switcher → body`), mobile reading order ✅ (`flex-wrap`, 44px targets, natural narrow-width order), contrast/focus/reduced-motion ✅ (`.focus-ring`, `--motion-duration` → `0ms` under `prefers-reduced-motion`).
  - Change applied: `src/pages/[locale]/about-document.vue` — surfaced the **existing** `aboutDocuments.reader.languageLabel` string (en/pl/uk, no new key) as a visible bold-muted label inside the switcher group, wired via `aria-labelledby` (so the pills are distinguishable from the sub-nav pills they otherwise match, and the accessible name is unchanged); removed the dead `is-active` class binding (CSS keys off `[aria-pressed="true"]`); added `align-items: center` to the switcher row. No structure, interaction, URL, or dependency change.
  - Non-blocking notes (no change): during reader loading the h1 shows the generic "Documents" string — prefer the listing title if a skeleton title ever ships; give the back-link `padding-block: 0.375rem` only if axe tightens to WCAG 2.5.8.
- Implementation commit: `17a1063`.
- **Verification (orchestrator, working tree with the designer change):** `pnpm test` **34 files / 379 tests**; `pnpm typecheck` clean; `pnpm lint:check` clean (146 files); `pnpm build` PASS; `pnpm test:e2e` **45 passed**. **Status: done.**
