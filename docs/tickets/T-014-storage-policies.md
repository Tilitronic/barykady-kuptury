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
- (author) start: 2026-10-18 — implemented by @coder.

### RED (reconstructed after an interrupted session)
The first session was interrupted before the RED output was captured. The tests were already written
and the implementation already on disk, so the RED steps below were **reconstructed** by temporarily
moving the implementation aside and re-running the relevant commands. Both files were restored
automatically afterwards; the restored tree is what the GREEN evidence below was produced from.

**Unit RED** — `validateUpload.ts` moved aside, then `pnpm test --run src/features/files` → exit 1:
```
Error: Failed to resolve import "@/features/files/validateUpload" from
"src/features/files/__tests__/validateUpload.test.ts". Does the file exist?
Test Files  1 failed (1)
     Tests  no tests
```

**SQL RED** — `20261018140000_storage_policies.sql` moved aside, then
`pnpm dlx supabase@2.121.0 db reset` (only the two earlier migrations apply) and
`pnpm dlx supabase@2.121.0 test db` → exit 1:
```
# Failed test 1: "public-documents bucket exists"                 have: 0     want: 1
# Failed test 2: "public-documents is public-read"                have: NULL  want: true
# Failed test 8: "public-media allows PNG, JPEG and WebP only"    have: NULL  want: {image/png,image/jpeg,image/webp}
# Failed test 11: "storage.objects has public select plus admin insert/update/delete policies"
#                                                                 have: 0     want: 4
ERROR: insert or update on table "objects" violates foreign key constraint "objects_bucketId_fkey"
Failed 22/24 subtests
Result: FAIL
```
The negative assertions (anon cannot insert/update/delete) already passed before policies because
`storage.objects` ships with RLS enabled and zero policies; the genuine RED is the positive path
(buckets absent, policy inventory 0, public read/admin write impossible).

### GREEN (final tree)
- `pnpm dlx supabase@2.121.0 db reset` → exit 0:
```
Applying migration 20261018091038_content_model.sql...
Applying migration 20261018120000_rls_policies.sql...
Applying migration 20261018140000_storage_policies.sql...
Seeding data from supabase/seed.sql...
Finished supabase db reset on branch main.
```
- `pnpm dlx supabase@2.121.0 test db` → exit 0:
```
rls_content_matrix_test.sql .. ok
rls_helpers_test.sql ......... ok
schema_test.sql .............. ok
storage_policies_test.sql .... ok
All tests successful.
Files=4, Tests=231, ... Result: PASS
```
- `pnpm test` → exit 0: `Test Files 24 passed (24) / Tests 302 passed (302)`.
- `pnpm test --run src/features/files` → exit 0: `Test Files 1 passed (1) / Tests 19 passed (19)`.
- `pnpm typecheck` → exit 0.
- `pnpm lint:check` → exit 0; `pnpm format:check` → exit 0.

### Bucket / policy matrix
Buckets are migration-as-truth (`insert into storage.buckets ... on conflict (id) do update`), both
`public = true`, `file_size_limit = 52428800` (50 MiB), no public write path.

| Bucket | anon SELECT | anon INSERT/UPDATE/DELETE | auth non-admin SELECT | auth non-admin write | admin SELECT | admin INSERT/UPDATE/DELETE |
|---|---|---|---|---|---|---|
| `public-documents` (PDF, DOCX) | allowed (bucket-scoped policy) | denied (no anon policy) | allowed | denied | allowed | allowed (`is_admin()`) |
| `public-media` (PNG, JPEG, WebP) | allowed (bucket-scoped policy) | denied (no anon policy) | allowed | denied | allowed | allowed (`is_admin()`) |
| any other bucket | denied | denied | denied | denied | denied (no admin-select policy) | allowed (`is_admin()` only) |

Policies added on `storage.objects` (4 total; no existing policy was changed):
- `storage_objects_select_public` — `anon, authenticated`, `using (bucket_id in ('public-documents','public-media'))`.
- `storage_objects_insert_admin` — `authenticated`, `with check (public.is_admin())`.
- `storage_objects_update_admin` — `authenticated`, `using + with check (public.is_admin())`.
- `storage_objects_delete_admin` — `authenticated`, `using (public.is_admin())`.

All admin policies reuse the single T-013 `public.is_admin()` helper (D-17); no second claim check
was introduced. The SQL test also proves a test-only private bucket is invisible to anon, so the
public SELECT policy is scoped rather than table-wide.

### D-12 DOCX MIME note
`public-documents.allowed_mime_types` includes
`application/vnd.openxmlformats-officedocument.wordprocessingml.document` because D-12 recommends
publishing the original regulation documents alongside the PDF. DOCX is a ZIP container and is not
executed inline by browsers; it is downloaded. There is no `application/zip`, `application/vnd.ms-word.document.macroEnabled.12`,
SVG, HTML or JavaScript in any allow-list. The split is:
- `public-documents`: PDF + DOCX (D-12).
- `public-media`: PNG + JPEG + WebP only.
The union is exactly the ticket's list. If D-12 resolves to PDF-only, remove the DOCX MIME from the
migration and the DOCX entry from `ALLOWED_EXTENSIONS` / `ALLOWED_MIME_TYPES` / `MIME_BY_EXTENSION`
in the validator.

### Content-Disposition / download guidance
The migration header records the rule for T-017/T-020/T-029: public links must force a download via
Supabase Storage's `?download=<safe-name>` (which returns `Content-Disposition: attachment`), or the
HTML `download` attribute for same-origin URLs. No untrusted SVG/HTML is ever rendered inline, and
neither type is accepted by either bucket. "Documents open with a predictable filename" is satisfied
by passing the sanitised `fileName` from the validator as the `download` query value.

### Notes / uncertainty for @architector
- **Migration-vs-`config.toml` bucket creation.** Chosen: migration-as-truth (`storage.buckets`
  insert), so `supabase db reset` recreates buckets, limits and MIME lists from a committed file
  (AGENTS.md rule 5). `config.toml` keeps no duplicate bucket definition. `on conflict (id) do update`
  makes the migration idempotent and updates drift. Flag if you prefer declarative `[storage.buckets.*]`
  config plus a policies-only migration; the two mechanisms could otherwise diverge in a future CLI.
- **DOCX while D-12 is `open`.** Including the DOCX MIME/extension is a forward-compatible allowance,
  not an active-content risk; uploads still require `is_admin()`. The only residual is a trusted admin
  mislabeling a macro-enabled DOCM as the DOCX MIME (the bucket checks MIME, the validator checks the
  extension `.docm`, which is not allowed). If D-12 must be frozen before launch, the DOCX entry can
  be dropped in one place; flag your preference.
- **Per-bucket MIME split.** The ticket lists five MIME types at bucket level; this implementation
  splits them by purpose (documents: PDF/DOCX; media: PNG/JPEG/WebP) rather than allowing all five in
  both buckets. Confirm this is the intended reading; the union matches the ticket exactly.
- **Admin write scope.** Admin INSERT/UPDATE/DELETE policies are not bucket-scoped by design — the
  only check is `public.is_admin()`, per the ticket wording. Public reads are bucket-scoped. If you
  want admin writes restricted to the two V1 buckets (so a future private bucket is closed to admin
  writes too), add `bucket_id in (...)` to the three write policies in a follow-up.
- **Actual call site.** `validateUpload()` is not wired into an upload form yet; T-029 owns the
  admin upload path and must call it before requesting an upload (review gate). T-017/T-020/T-029
  must also apply the `?download=` guidance.
