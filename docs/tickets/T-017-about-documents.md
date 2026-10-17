# T-017 — About: documents

**Session:** 4 · **Lane:** feature/content · **Owner:** @coder · **Status:** todo
**Reviewers:** @reviewer + (D-12 decision check)
**Depends on:** T-014, T-016 · **Blocks:** T-029

## Outcome
The Documents subsection lists published organizational documents with descriptive metadata and working public downloads — starting with the three regulation files.

## Scope
In:
- Listing from `organization_documents` + translations: title, document type, publication date, language, file type, file size.
- Download links use Storage public URLs with `download` attribute and a human-readable filename; no admin auth required.
- Seed the three verified regulations (`PL/EN/UKR V4`) as documents with correct language tags, and record D-12 outcome. If conversion to PDF is chosen, store both PDF and the original DOCX and expose both.
- Sort: explicit `sort_order`, then newest publication date.
- Empty state when no documents published.
- Unit tests: metadata formatting (size in KB/MB, locale-aware date), grouping by type.
- Component test: all metadata rendered; missing optional fields collapse without an empty dash cluster.
- E2E: anonymous download of a document succeeds (response 200, correct content type).

Out: document editing/upload UI (T-029), legal interpretation of the documents.

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §4 (documents: title, type, date, language, file type/size; public downloads).
- `docs/architecture.md` §6 (public file access deliberate), §4 (`organization_documents` may unify with publications — keep separate here, document the choice).
- `docs/DESIGN_SYSTEM.md` §6 (document links have understandable labels).

## TDD plan
1. RED: `formatFileSize.test.ts` + `formatDocumentDate.test.ts` (locale-aware) fail.
2. GREEN: implement formatters + listing component.
3. RED: component test `renders language and file type for each document`.
4. RED E2E: download link returns 200 with `application/pdf` or `application/vnd...docx`.
5. REFACTOR: share the file-link component with publications (T-020).

## Acceptance criteria
- [ ] Three regulation documents appear with distinct language labels and correct file sizes.
- [ ] Download works anonymously in E2E, filename is human-readable.
- [ ] Metadata follows the active locale, including dates.
- [ ] Missing optional metadata renders nothing (no `—` clutter, no "unknown" repetition).
- [ ] Empty state translated; no fabricated documents.
- [ ] Files are served with a safe content type and never inline-rendered as HTML/SVG.

## Verification
```
pnpm test --run src/features/documents
pnpm test:e2e --grep "documents"
```

## Review gate
- @reviewer: metadata truthfulness (no invented publication dates), download semantics, shared component reuse.
- Decision check: D-12 recorded before merging the assets.

## Log
- (author) start:
