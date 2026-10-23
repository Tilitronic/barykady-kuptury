-- T-029 — atomic admin publication and organization-document mutations.
--
-- Design authority:
--   * docs/tickets/T-029-admin-publications-documents.md — publication
--     metadata + one file version per language OR an external URL; documents
--     with type/date/language/file/sort/publish; the URL xor files invariant
--     and "replace removes the old reference".
--   * docs/PRODUCT_REQUIREMENTS.md §4-Publications/§4-About — either a file
--     download or an external URL; anonymous downloads; per-language versions.
--   * docs/architecture.md §4 — root lifecycle/metadata + normalized
--     translations; publication/publication_translations/publication_files and
--     organization_documents + translations are the tables.
--   * docs/architecture.md §6.1 — `publications:write` and `documents:write`
--     gate both the table RPCs and the `public-documents` bucket. RPCs re-check
--     the predicate exactly like the T-045/T-028 family; RLS stays the second
--     independent boundary (SECURITY INVOKER).
--   * T-045/T-028 — copy the paired transactional RPC pattern per entity: one
--     statement per logical mutation = one transaction = all-or-nothing.
--
-- Why the XOR invariant lives here: T-012 deliberately left the cross-table
-- rule to T-029 ("the write path exists"). A publication with both an external
-- URL and file rows is ambiguous to every reader, so both the client form and
-- this database function reject it. A published publication must have exactly
-- one action (URL or at least one file); a draft may be incomplete.
--
-- Storage paths are object keys, never URLs. The existing column checks reject
-- absolute URLs; the functions validate the payload before the constraint so a
-- direct RPC call gets a clear 23514 instead of a generic check violation.

begin;

-- NOTE: unlike T-045/T-028, this ticket deliberately does NOT add a table
-- CHECK for "published requires published_at". The importer RPCs and their
-- fixtures create published rows directly without a timestamp, and a table
-- constraint would break that established path. The admin mutation functions
-- below still stamp published_at on publish and clear it on unpublish, and the
-- publication action invariant is enforced in the RPC.

-- ---------------------------------------------------------------------------
-- Shared payload guards
-- ---------------------------------------------------------------------------
-- Keeping these as tiny immutable helpers avoids four copies of the same
-- jsonb-shape checks. They are not a generic mutation framework: each entity
-- still owns its own function body and contract.

create or replace function public.assert_jsonb_array_v1(
  p_value jsonb,
  p_name text
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null or jsonb_typeof(p_value) <> 'array' then
    raise exception '% must be a JSON array', p_name
      using errcode = '22023';
  end if;
end;
$$;

comment on function public.assert_jsonb_array_v1(jsonb, text) is
  'T-029: shared payload-shape guard; raises 22023 when the value is not a JSON array.';

create or replace function public.assert_storage_path_v1(
  p_path text,
  p_required boolean default true
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_path text := nullif(btrim(coalesce(p_path, '')), '');
begin
  if v_path is null then
    if p_required then
      raise exception 'storage path is required'
        using errcode = '23514';
    end if;
    return null;
  end if;

  if v_path ~* '^https?://' then
    raise exception 'storage path must be a bucket-relative object key'
      using errcode = '23514',
            hint = 'Persist the object key, never an absolute public URL.';
  end if;

  return v_path;
end;
$$;

comment on function public.assert_storage_path_v1(text, boolean) is
  'T-029: returns a trimmed object key, rejecting absolute URLs (23514).';

-- ---------------------------------------------------------------------------
-- save_publication_v1 — root + complete translation set + complete file set
-- ---------------------------------------------------------------------------
-- p_translations: [{"locale","title","abstract"|null,"authors"|null}, …]
-- p_files:        [{"locale","label"|null,"storagePath","mimeType"|null,
--                  "sizeBytes"|null}, …]
--
-- Both arrays are the COMPLETE intended sets: an omitted locale is a
-- deliberate clear, which is how "remove a language version" and "replace a
-- file" work. The `(publication_id, locale)` unique constraint is the final
-- authority for one active file per language; the function checks duplicates
-- first so the error is intentional rather than a constraint accident.

create or replace function public.save_publication_v1(
  p_id uuid,
  p_slug text,
  p_status public.content_status,
  p_language public.content_locale,
  p_publication_date date,
  p_external_url text,
  p_sort_order integer,
  p_published_at timestamptz,
  p_translations jsonb,
  p_files jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_sort_order integer;
  v_external_url text := nullif(btrim(coalesce(p_external_url, '')), '');
  v_file_count integer;
  v_published_at timestamptz;
begin
  if not (
    public.is_admin()
    or public.has_capability('publications:write')
  ) then
    raise exception 'admin role or publications:write capability required'
      using errcode = '42501',
            hint = 'Caller must carry app_metadata.role=admin or publications:write.';
  end if;

  perform public.assert_jsonb_array_v1(p_translations, 'p_translations');
  perform public.assert_jsonb_array_v1(p_files, 'p_files');

  if v_external_url is not null and v_external_url !~* '^https?://' then
    raise exception 'external URL must be an absolute http(s) URL'
      using errcode = '23514';
  end if;

  v_file_count := jsonb_array_length(p_files);

  if exists (
    select 1
      from jsonb_array_elements(p_files) as entry
     where nullif(btrim(coalesce(entry ->> 'storagePath', '')), '') is null
  ) then
    raise exception 'every publication file needs a storage path'
      using errcode = '23514';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_files) as entry
     where (entry ->> 'storagePath') ~* '^https?://'
  ) then
    raise exception 'publication storage path must be a bucket-relative object key'
      using errcode = '23514',
            hint = 'Persist the object key, never an absolute public URL.';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_files) as entry
     group by entry ->> 'locale'
    having count(*) > 1
  ) then
    raise exception 'at most one file version per language is allowed'
      using errcode = '23514';
  end if;

  -- The invariant: never both. A draft with neither is allowed (incomplete);
  -- a published row must have exactly one action.
  if v_external_url is not null and v_file_count > 0 then
    raise exception 'a publication cannot have both an external URL and file versions'
      using errcode = '23514';
  end if;

  if p_status = 'published' and v_external_url is null and v_file_count = 0 then
    raise exception 'a published publication needs an external URL or a file version'
      using errcode = '23514';
  end if;

  v_published_at := case
    when p_status = 'published'
      then coalesce(p_published_at, clock_timestamp())
    else p_published_at
  end;

  if v_id is null then
    v_sort_order := coalesce(
      p_sort_order,
      (select coalesce(max(sort_order), 0) + 1 from public.publications)
    );

    insert into public.publications (
      slug, status, language, publication_date, external_url,
      sort_order, published_at
    )
    values (
      p_slug, p_status, p_language, p_publication_date, v_external_url,
      v_sort_order, v_published_at
    )
    returning id into v_id;
  else
    update public.publications
       set slug = p_slug,
           status = p_status,
           language = p_language,
           publication_date = p_publication_date,
           external_url = v_external_url,
           sort_order = coalesce(p_sort_order, sort_order),
           published_at = v_published_at
     where id = v_id;

    if not found then
      raise exception 'publication not found'
        using errcode = 'P0002',
              hint = 'No publication row is visible for this id.';
    end if;
  end if;

  delete from public.publication_translations
   where publication_id = v_id
     and locale not in (
       select (entry ->> 'locale')::public.content_locale
         from jsonb_array_elements(p_translations) as entry
     );

  insert into public.publication_translations (
    publication_id, locale, title, abstract, authors
  )
  select
    v_id,
    (entry ->> 'locale')::public.content_locale,
    entry ->> 'title',
    nullif(btrim(coalesce(entry ->> 'abstract', '')), ''),
    nullif(btrim(coalesce(entry ->> 'authors', '')), '')
  from jsonb_array_elements(p_translations) as entry
  on conflict (publication_id, locale) do update
     set title = excluded.title,
         abstract = excluded.abstract,
         authors = excluded.authors;

  -- File rows are the complete set for each language. Deleting omitted
  -- locales removes the old reference before the replacement is inserted in
  -- the same transaction, so a crash cannot leave two active versions.
  delete from public.publication_files
   where publication_id = v_id
     and locale not in (
       select (entry ->> 'locale')::public.content_locale
         from jsonb_array_elements(p_files) as entry
     );

  insert into public.publication_files (
    publication_id, locale, label, storage_path, mime_type, file_size_bytes
  )
  select
    v_id,
    (entry ->> 'locale')::public.content_locale,
    nullif(btrim(coalesce(entry ->> 'label', '')), ''),
    public.assert_storage_path_v1(entry ->> 'storagePath', true),
    nullif(btrim(coalesce(entry ->> 'mimeType', '')), ''),
    (entry ->> 'sizeBytes')::bigint
  from jsonb_array_elements(p_files) as entry
  on conflict (publication_id, locale) do update
     set label = excluded.label,
         storage_path = excluded.storage_path,
         mime_type = excluded.mime_type,
         file_size_bytes = excluded.file_size_bytes;

  return v_id;
end;
$$;

comment on function public.save_publication_v1(
  uuid, text, public.content_status, public.content_locale, date, text,
  integer, timestamptz, jsonb, jsonb
) is
  'T-029: atomic publication save (root + complete translations + complete files). Enforces URL xor files and one file per language. SECURITY INVOKER, re-checks is_admin() or publications:write.';

-- ---------------------------------------------------------------------------
-- transition_publication_v1 — publish / unpublish atomically
-- ---------------------------------------------------------------------------

create or replace function public.transition_publication_v1(
  p_id uuid,
  p_status public.content_status,
  p_published_at timestamptz default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_external_url text;
  v_file_count integer;
begin
  if not (
    public.is_admin()
    or public.has_capability('publications:write')
  ) then
    raise exception 'admin role or publications:write capability required'
      using errcode = '42501',
            hint = 'Caller must carry app_metadata.role=admin or publications:write.';
  end if;

  select external_url,
         (select count(*) from public.publication_files f where f.publication_id = p.id)
    into v_external_url, v_file_count
    from public.publications p
   where p.id = p_id;

  if not found then
    raise exception 'publication not found'
      using errcode = 'P0002',
            hint = 'No publication row is visible for this id.';
  end if;

  if p_status = 'published'
     and v_external_url is null
     and v_file_count = 0 then
    raise exception 'a published publication needs an external URL or a file version'
      using errcode = '23514';
  end if;

  update public.publications
     set status = p_status,
         published_at = case
           when p_status = 'published'
             then coalesce(p_published_at, clock_timestamp())
           else null
         end
   where id = p_id;
end;
$$;

comment on function public.transition_publication_v1(
  uuid, public.content_status, timestamptz
) is
  'T-029: atomic publication lifecycle; publish stamps published_at, draft/archived clear it. Refuses to publish an actionless row. SECURITY INVOKER, re-checks is_admin() or publications:write.';

-- ---------------------------------------------------------------------------
-- save_document_v1 — root + complete translation set
-- ---------------------------------------------------------------------------
-- The T-017 `body` column is intentionally absent from the upsert column list:
-- admin metadata edits must never erase imported readable text. Omitting a
-- locale still deletes that translation (a deliberate clear), matching the
-- T-045 family contract.

create or replace function public.save_document_v1(
  p_id uuid,
  p_slug text,
  p_status public.content_status,
  p_document_type text,
  p_language public.content_locale,
  p_publication_date date,
  p_storage_path text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_sort_order integer,
  p_published_at timestamptz,
  p_translations jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_sort_order integer;
  v_storage_path text := public.assert_storage_path_v1(p_storage_path, false);
  v_published_at timestamptz;
begin
  if not (
    public.is_admin()
    or public.has_capability('documents:write')
  ) then
    raise exception 'admin role or documents:write capability required'
      using errcode = '42501',
            hint = 'Caller must carry app_metadata.role=admin or documents:write.';
  end if;

  if nullif(btrim(coalesce(p_document_type, '')), '') is null then
    raise exception 'document type is required'
      using errcode = '23514';
  end if;

  perform public.assert_jsonb_array_v1(p_translations, 'p_translations');

  v_published_at := case
    when p_status = 'published'
      then coalesce(p_published_at, clock_timestamp())
    else p_published_at
  end;

  if v_id is null then
    v_sort_order := coalesce(
      p_sort_order,
      (select coalesce(max(sort_order), 0) + 1 from public.organization_documents)
    );

    insert into public.organization_documents (
      slug, status, document_type, language, publication_date,
      storage_path, mime_type, file_size_bytes, sort_order, published_at
    )
    values (
      p_slug, p_status, btrim(p_document_type), p_language, p_publication_date,
      v_storage_path, nullif(btrim(coalesce(p_mime_type, '')), ''),
      p_file_size_bytes, v_sort_order, v_published_at
    )
    returning id into v_id;
  else
    update public.organization_documents
       set slug = p_slug,
           status = p_status,
           document_type = btrim(p_document_type),
           language = p_language,
           publication_date = p_publication_date,
           storage_path = v_storage_path,
           mime_type = nullif(btrim(coalesce(p_mime_type, '')), ''),
           file_size_bytes = p_file_size_bytes,
           sort_order = coalesce(p_sort_order, sort_order),
           published_at = v_published_at
     where id = v_id;

    if not found then
      raise exception 'document not found'
        using errcode = 'P0002',
              hint = 'No document row is visible for this id.';
    end if;
  end if;

  delete from public.organization_document_translations
   where document_id = v_id
     and locale not in (
       select (entry ->> 'locale')::public.content_locale
         from jsonb_array_elements(p_translations) as entry
     );

  insert into public.organization_document_translations (
    document_id, locale, title, description
  )
  select
    v_id,
    (entry ->> 'locale')::public.content_locale,
    entry ->> 'title',
    nullif(btrim(coalesce(entry ->> 'description', '')), '')
  from jsonb_array_elements(p_translations) as entry
  on conflict (document_id, locale) do update
     set title = excluded.title,
         description = excluded.description;

  return v_id;
end;
$$;

comment on function public.save_document_v1(
  uuid, text, public.content_status, text, public.content_locale, date, text,
  text, bigint, integer, timestamptz, jsonb
) is
  'T-029: atomic document save (root + complete translations). Preserves T-017 body text. SECURITY INVOKER, re-checks is_admin() or documents:write.';

-- ---------------------------------------------------------------------------
-- transition_document_v1 — publish / unpublish atomically
-- ---------------------------------------------------------------------------

create or replace function public.transition_document_v1(
  p_id uuid,
  p_status public.content_status,
  p_published_at timestamptz default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (
    public.is_admin()
    or public.has_capability('documents:write')
  ) then
    raise exception 'admin role or documents:write capability required'
      using errcode = '42501',
            hint = 'Caller must carry app_metadata.role=admin or documents:write.';
  end if;

  update public.organization_documents
     set status = p_status,
         published_at = case
           when p_status = 'published'
             then coalesce(p_published_at, clock_timestamp())
           else null
         end
   where id = p_id;

  if not found then
    raise exception 'document not found'
      using errcode = 'P0002',
            hint = 'No document row is visible for this id.';
  end if;
end;
$$;

comment on function public.transition_document_v1(
  uuid, public.content_status, timestamptz
) is
  'T-029: atomic document lifecycle; publish stamps published_at, draft/archived clear it. SECURITY INVOKER, re-checks is_admin() or documents:write.';

-- ---------------------------------------------------------------------------
-- Privileges: authenticated API role only (no service-role caller-rights path)
-- ---------------------------------------------------------------------------

revoke all on function public.assert_jsonb_array_v1(jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.assert_storage_path_v1(text, boolean)
  from public, anon, authenticated, service_role;
-- The guards are called from the SECURITY INVOKER save functions, so the
-- caller needs EXECUTE on them. They mutate nothing and cannot be used to
-- bypass a policy; they only normalise/validate a payload.
grant execute on function public.assert_jsonb_array_v1(jsonb, text)
  to authenticated;
grant execute on function public.assert_storage_path_v1(text, boolean)
  to authenticated;
revoke all on function public.save_publication_v1(
  uuid, text, public.content_status, public.content_locale, date, text,
  integer, timestamptz, jsonb, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.transition_publication_v1(
  uuid, public.content_status, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.save_document_v1(
  uuid, text, public.content_status, text, public.content_locale, date, text,
  text, bigint, integer, timestamptz, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.transition_document_v1(
  uuid, public.content_status, timestamptz
) from public, anon, authenticated, service_role;

grant execute on function public.save_publication_v1(
  uuid, text, public.content_status, public.content_locale, date, text,
  integer, timestamptz, jsonb, jsonb
) to authenticated;
grant execute on function public.transition_publication_v1(
  uuid, public.content_status, timestamptz
) to authenticated;
grant execute on function public.save_document_v1(
  uuid, text, public.content_status, text, public.content_locale, date, text,
  text, bigint, integer, timestamptz, jsonb
) to authenticated;
grant execute on function public.transition_document_v1(
  uuid, public.content_status, timestamptz
) to authenticated;

commit;
