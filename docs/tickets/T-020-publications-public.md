# T-020 — Publications: listing, detail, files

**Session:** 4 · **Lane:** feature/publications · **Owner:** @designer · **Status:** todo
**Reviewers:** @reviewer + @designer
**Depends on:** T-014, T-015 · **Blocks:** T-025, T-029, T-032

## Outcome
Visitors can browse publications and open a detail page where each available language version of a file is clearly selectable, or follow a single external URL.

## Scope
In:
- `/locale/publications`: title, abstract/summary, authors/organization, date, language badge, file/URL availability indicator.
- `/locale/publications/:slug` detail: full abstract, authors, date, each `publication_files` row rendered as a distinct language/version download with type and size, or one external URL (`target="_blank"` + `rel`).
- Publication with neither file nor URL must not render a broken action (validator/test covers this).
- Optional metadata absent ⇒ not rendered (no invented values).
- Empty/error states; keyboard-operable download list with clear labels.
- Component tests: multiple language files, external URL only, missing optional fields.
- E2E: listing → detail; download a public PDF anonymously; external link has `rel="noopener noreferrer"`.

Out: editing/upload (T-029), citation export, search.

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §4 (Publications: metadata fields, localized UI, per-language versions, mobile downloads).
- `docs/architecture.md` §4 (`publication_files` optional, multiple versions), §6 (public files).
- `docs/DESIGN_SYSTEM.md` §6 (document links understandable, mobile).

## TDD plan
1. RED: `PublicationFiles.test.ts` — `renders one labelled download per language`, `renders an external link with rel`, `renders no action when neither exists`.
2. GREEN: implement file-list + detail.
3. RED: `PublicationCard.test.ts` — missing authors/date omitted cleanly.
4. RED E2E: anonymous PDF download returns 200 with correct content type.
5. REFACTOR: reuse the file-link component from T-017.

## Acceptance criteria
- [ ] Each file version labelled with language, type and size.
- [ ] External URL variant opens safely with `rel="noopener noreferrer"`.
- [ ] No action rendered when there is nothing to download/open.
- [ ] Missing optional metadata renders nothing.
- [ ] Downloads work on mobile viewport in E2E.
- [ ] Empty/error states translated.
- [ ] No hard-coded user-facing strings.

## Verification
```
pnpm test --run src/features/publications
pnpm test:e2e --grep "publications"
```

## Review gate
- @reviewer: metadata truthfulness, link safety, reuse vs duplication.
- @designer: detail reading order, file-list affordance clarity on mobile.

## Log
- (author) start:
- (designer) impl 2026-10-18: listing `publications.vue` + `PublicationCard.vue` + detail `publication-detail.vue` + `PublicationFiles.vue` + route `publications/:slug` (`publication-detail`, `meta.pageMeta` = publications keys); hooks `usePublications`/`usePublication` mirror `useProjects` and own the file-URL seam. **Bucket choice (documented, row has no bucket column):** publication files are downloads → `public-documents` (T-014 splits the two public buckets by purpose: PDF/DOCX there, images in `public-media`); each URL carries `?download=<safe-name>` per the T-014 migration's download guidance (Content-Disposition: attachment; the name is sanitized to `[a-z0-9._-]` from the stored path, never author text). **Slug-rule interpretation:** T-019 precedent applied verbatim — `findPublicationBySlug` is STRICT on (requestedLocale, slug) and rejects non-published roots; draft/foreign/unknown slugs render the translated 404 content (`notFound.title/message`), and listing cards standing in from English link under the **owning locale prefix** (`detailPath`), so no dead links and no silent cross-locale resolution. **Shared media seam (rule of three):** the third seam trigger fired — extracted `src/features/files/publicObjectUrl.ts` (tested); `cover.ts` and `portrait.ts` are now thin bucket-owning wrappers delegating to it (their existing tests stay green, behavior identical). **TDD step 5 correction:** the ticket assumed a reusable file-link component from T-017 — none exists (T-017 rendered in-app regulation text; file documents were deferred to T-029), so `PublicationFiles.vue` is created fresh as a presentational component (URLs arrive resolved in the view model). **Fallback reachability:** with `PUBLICATION_REQUIRED_FIELDS = [title]` + the DB non-blank title constraint, a strict (locale, slug) match is always "complete", so the detail's `isFallback` note is unreachable for valid data — kept as data-driven markup per the ticket's scope line ("isFallback surfaced as a subtle note"), with visible fallback coverage on the listing card (tested in pl/uk). The detail test asserts the complementary rule instead: an existing title-only uk row renders uk text only, never a silent English mix-in. Availability indicator: files win over external URL; neither ⇒ no indicator, no action. Missing abstract/authors/date/language render nothing. `publications.placeholder` removed (unused after rewrite); `empty`/`detail.back`/`detail.filesHeading`/`availability.*`/`external` added in en/pl/uk (parity green). Pagination deferred (same T-019 call). Tests: files-helpers(10)/api(+8)/fileUrl(3)/usePublications(6)/PublicationCard(7)/PublicationFiles(6)/listing(6)/detail(8) unit — RED (8 import failures + 13 assertion failures) → GREEN; `e2e/publications.spec.ts` 6 journeys incl. anonymous PDF download 200 + `application/pdf` via `mockSupabaseStorage` (offline fixture body), mobile 375 px download without overflow, external `rel="noopener noreferrer"`, draft-404 no-leak, keyboard Enter on a download link, axe 0 critical + 0 serious on listing/detail/external/404.
