# T-029 — Admin publications, documents, uploads

**Session:** 6 · **Lane:** feature/admin · **Owner:** @coder · **Status:** done
**Reviewers:** @reviewer (rev-1 FIX + fixes verified) + @architector (approve-with-follow-ups → T-047)
**Depends on:** T-026, T-020, T-017, T-014 · **Blocks:** T-032

## Outcome
Administrators can manage publication metadata, attach one or more language/version files or an external URL, and manage organizational documents — with upload validation enforced before and during transfer.

## Scope
In:
- Publications: list/create/edit/delete, per-locale title/abstract/authors, date, language, external URL **xor** file versions, publish/unpublish.
- `publication_files`: add/remove versions, each with language, label, size/type computed from the stored object; replacing a file removes the old object reference.
- Documents: create/edit/delete organizational documents with type, date, language, file upload, sort order, publish toggle.
- Upload flow: validate via `validateUpload` (T-014) → upload to the correct bucket → persist the storage path (not a public URL) → show progress and recoverable errors.
- Failure handling: validation error, quota/network error, orphaned object cleanup on failed row insert.
- Tests: URL xor file invariant, validator called before upload, removal deletes the object reference, replace keeps only one active file per language, document publish toggle affects public listing.
- E2E: upload a PDF → publish → public download works; reject an `.svg` upload with a visible error.

Out: image cropping, versioned history, virus scanning, bulk import.

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §6 (publication metadata, approved file uploads), §4 (Publications, Documents).
- `docs/architecture.md` §6 (validate type/size, safe names, reject active content).
- `docs/TESTING.md` §3 (storage access policy tests), §2.

## TDD plan
1. RED: `publicationForm.test.ts` — `rejects both a URL and file versions`, `renders a language-labelled row per file`, `blocks publish without title`.
2. RED: `uploadFlow.test.ts` — `calls validateUpload before the storage upload`, `cleans up the object when the row insert fails`.
3. GREEN: implement forms + services.
4. RED E2E: PDF upload → publish → anonymous download; SVG upload → visible rejection.
5. REFACTOR: single `useUpload` composable shared by team portraits, covers, publications, documents.

## Acceptance criteria
- [ ] File-type and size validation blocks disallowed uploads before any bytes are transferred.
- [ ] Exactly one of external URL or file versions can be active per publication.
- [ ] Replacing a file does not leave an orphaned object reference.
- [ ] Failed row insert does not leave an orphaned object (verified by test).
- [ ] Public listing/download reflects publish state immediately (E2E).
- [ ] Storage paths stored, never absolute public URLs.
- [ ] All admin strings translated; destructive actions confirmed.

## Verification
```
pnpm test --run src/features/admin/publications src/features/admin/documents src/features/files
pnpm test:e2e --grep "admin publications|admin documents"
supabase test db
```

## Review gate
- @reviewer: upload boundary, orphan cleanup, xor invariant, no absolute URLs persisted.
- @architector: Storage usage stays within §6 constraints.

## Log
- (author) start:
