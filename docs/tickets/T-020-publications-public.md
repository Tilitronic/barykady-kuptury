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
