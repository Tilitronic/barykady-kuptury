# T-014 — Storage buckets & upload policy

**Session:** 3 · **Lane:** data/security · **Owner:** @coder · **Status:** todo
**Reviewers:** @reviewer + @architector
**Depends on:** T-012, T-013 · **Blocks:** T-017, T-020, T-029

## Outcome
Public downloads work without authentication; uploads are admin-only, type/size validated, and active content (HTML/SVG) can never be served as executable inline content.

## Scope
In:
- Buckets: `public-documents` (statute, reports, publications/PDF) and `public-media` (project covers, portraits). Both public-read, admin-write. No public write bucket.
- Policy SQL: public `select` on the two buckets, admin insert/update/delete; denial tests for anonymous upload and anonymous listing of non-public paths.
- Bucket-level `file_size_limit` and `allowed_mime_types` (`application/pdf`, `image/png|jpeg|webp`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` per D-12).
- Upload validation util `src/features/files/validateUpload.ts` (pure): extension + MIME + size + filename sanitisation + reject SVG/HTML/JS.
- Content-Disposition/`download` attribute guidance for all user-facing file links; no inline rendering of untrusted SVG/HTML.
- Tests: RLS/SQL for storage policies; unit tests for the validator.

Out: virus scanning, image transformation pipeline, signed URLs (not needed for public files).

## Design constraints
- `docs/architecture.md` §6 (deliberate public access, distinct admin write policies, safe names, reject active content).
- `AGENTS.md` rule 4, rule 7.
- `docs/PRODUCT_REQUIREMENTS.md` §4 (public downloads without admin auth).

## TDD plan
1. RED: `validateUpload.test.ts` — rejects `.svg`, `.html`, oversized file, `../` filename, mismatched extension/MIME.
2. GREEN: implement validator.
3. RED: SQL test — anonymous insert into `storage.objects` for the bucket is denied.
4. GREEN: policies until matrix passes; then prove public read of an existing object succeeds.

## Acceptance criteria
- [ ] Anonymous GET of a known public object succeeds; anonymous upload/list-denied per policy.
- [ ] Admin upload of allowed types succeeds; disallowed types rejected by both bucket config and app validation.
- [ ] Filenames sanitised (no path traversal, no unicode control chars, collision-safe append).
- [ ] No SVG/HTML upload path exists in V1.
- [ ] File links download rather than execute; documents open with a predictable filename.
- [ ] Tests cover size boundary (just under/over limit).

## Verification
```
supabase db reset && supabase test db
pnpm test --run src/features/files
```

## Review gate
- @reviewer: policy isolation between buckets, no public write, validator is actually called before upload in T-029.
- @architector: bucket split justified; no signed-URL complexity added prematurely.

## Log
- (author) start:
