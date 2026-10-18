-- T-014 — Storage buckets and storage.objects policies.
--
-- Design authority:
--   * docs/architecture.md §6 — public access must be deliberate; admin
--     upload/write policies must be distinct from public read policies;
--     validate upload type/size, use safe file names, and reject active
--     content (SVG/HTML/JS) rather than serving it inline.
--   * docs/PRODUCT_REQUIREMENTS.md §4 — public downloads must work without
--     admin authentication.
--   * docs/tickets/T-014-storage-policies.md — two public-read/admin-write
--     buckets, no public write bucket, anonymous cannot list outside them.
--   * docs/tickets/DECISIONS.md D-12 — publish regulation documents as PDF
--     and (recommended) the original DOCX. D-17 — public.is_admin() is the
--     single admin-claim check; this migration does not re-implement it.
--   * docs/TESTING.md §3 — prove the policy behavior for anonymous,
--     authenticated non-admin and administrator identities.
--
-- Bucket creation is migration-as-truth (AGENTS.md rule 5) rather than a
-- config.toml-only setting: `supabase db reset` must recreate the buckets and
-- their limits from a committed file. The Storage API enforces
-- `file_size_limit` and `allowed_mime_types` on upload; the client validator
-- in src/features/files/validateUpload.ts mirrors the same lists.
--
-- Download guidance (T-017/T-020/T-029):
--   Public file links must force a download rather than inline execution.
--   Supabase Storage returns `Content-Disposition: attachment` when the URL
--   carries `?download=<safe-name>`; same-origin links may also use the HTML
--   `download` attribute. Never render an untrusted SVG/HTML inline. This
--   migration makes that impossible for V1 by not allowing those MIME types in
--   either bucket (no SVG, no HTML, no JavaScript).

-- ---------------------------------------------------------------------------
-- Buckets
-- ---------------------------------------------------------------------------
-- MIME types are split by purpose, not merely by bucket name:
--   * public-documents: PDF and DOCX (the D-12 statute/report/publication set).
--   * public-media: raster images only (PNG/JPEG/WebP); no SVG.
-- Both are public-read, admin-write. There is no public write bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'public-documents',
    'public-documents',
    true,
    52428800, -- 50 MiB, matching the client validator
    array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]::text[]
  ),
  (
    'public-media',
    'public-media',
    true,
    52428800, -- 50 MiB, matching the client validator
    array['image/png', 'image/jpeg', 'image/webp']::text[]
  )
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- storage.objects policies
-- ---------------------------------------------------------------------------
-- RLS is enabled on storage.objects by Supabase; this migration does not
-- change that. The public SELECT policy is scoped to the two public buckets,
-- so anonymous callers cannot list objects in any other bucket. Anonymous
-- INSERT/UPDATE/DELETE are denied because no policy is granted to anon; the
-- table privileges remain at Supabase defaults (RLS is the boundary).

create policy storage_objects_select_public on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('public-documents', 'public-media'));

create policy storage_objects_insert_admin on storage.objects
  for insert to authenticated
  with check (public.is_admin());

create policy storage_objects_update_admin on storage.objects
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy storage_objects_delete_admin on storage.objects
  for delete to authenticated
  using (public.is_admin());
