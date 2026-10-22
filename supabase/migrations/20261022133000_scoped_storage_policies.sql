-- T-046 — scoped Storage policies (D-42).
--
-- Design authority:
--   * docs/architecture.md §6.1 — bucket ↔ scope mapping. `media:write` owns
--     the public image bucket; publication/document editors may write public
--     documents; `importer` owns the private source originals.
--   * docs/architecture.md §6 — public read stays deliberate and unchanged;
--     write policies remain authenticated-only and root-or-scoped.
--   * D-21 — no capability, no write. Anon remains unable to write any bucket.
--
-- Why the bucket checks are inside each policy:
--   storage.objects is one table shared by every bucket. A capability check
--   without the bucket guard would let a media editor write PDFs into
--   public-documents (or vice versa), widening the scope beyond its feature.
--   The existing public SELECT policy remains bucket-scoped and untouched.

begin;

-- ---------------------------------------------------------------------------
-- Public buckets: media vs documents write grants
-- ---------------------------------------------------------------------------

drop policy storage_objects_insert_admin on storage.objects;
drop policy storage_objects_update_admin on storage.objects;
drop policy storage_objects_delete_admin on storage.objects;

create policy storage_objects_insert_admin on storage.objects
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      bucket_id = 'public-media'
      and public.has_capability('media:write')
    )
    or (
      bucket_id = 'public-documents'
      and (
        public.has_capability('publications:write')
        or public.has_capability('documents:write')
      )
    )
  );

create policy storage_objects_update_admin on storage.objects
  for update to authenticated
  using (
    public.is_admin()
    or (
      bucket_id = 'public-media'
      and public.has_capability('media:write')
    )
    or (
      bucket_id = 'public-documents'
      and (
        public.has_capability('publications:write')
        or public.has_capability('documents:write')
      )
    )
  )
  with check (
    public.is_admin()
    or (
      bucket_id = 'public-media'
      and public.has_capability('media:write')
    )
    or (
      bucket_id = 'public-documents'
      and (
        public.has_capability('publications:write')
        or public.has_capability('documents:write')
      )
    )
  );

create policy storage_objects_delete_admin on storage.objects
  for delete to authenticated
  using (
    public.is_admin()
    or (
      bucket_id = 'public-media'
      and public.has_capability('media:write')
    )
    or (
      bucket_id = 'public-documents'
      and (
        public.has_capability('publications:write')
        or public.has_capability('documents:write')
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Private originals: importer only
-- ---------------------------------------------------------------------------

drop policy storage_objects_select_content_sources_admin on storage.objects;
drop policy storage_objects_insert_content_sources_admin on storage.objects;
drop policy storage_objects_update_content_sources_admin on storage.objects;
drop policy storage_objects_delete_content_sources_admin on storage.objects;

create policy storage_objects_select_content_sources_admin on storage.objects
  for select to authenticated
  using (
    bucket_id = 'content-sources'
    and (public.is_admin() or public.has_capability('importer'))
  );

create policy storage_objects_insert_content_sources_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'content-sources'
    and (public.is_admin() or public.has_capability('importer'))
  );

create policy storage_objects_update_content_sources_admin on storage.objects
  for update to authenticated
  using (
    bucket_id = 'content-sources'
    and (public.is_admin() or public.has_capability('importer'))
  )
  with check (
    bucket_id = 'content-sources'
    and (public.is_admin() or public.has_capability('importer'))
  );

create policy storage_objects_delete_content_sources_admin on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'content-sources'
    and (public.is_admin() or public.has_capability('importer'))
  );

commit;
