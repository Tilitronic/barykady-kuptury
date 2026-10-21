-- T-041 S3 / T-042 S7 — transactional import persistence.
--
-- Design authority:
--   * D-32/D-37 — translations store a versioned ReaderDocument AST; `body`
--     is derived by the existing trigger, never authored by the import path.
--   * D-36 — images are `content_assets` rows with a ready UUID, an XOR owner
--     and the translation locale. The AST may only reference assets that
--     belong to that owner+locale.
--   * D-30 — originals stay in the private `content-sources` bucket. The
--     download toggle requires a source path.
--   * T-042 — store Drive file metadata (`source_url`, `source_modified_at`)
--     so a sync can detect an unchanged document before exporting/converting.
--
-- Why one RPC instead of client-side inserts:
--   A browser cannot open a multi-request transaction. The import pipeline
--   writes assets, the translation AST and root source metadata together; if
--   any step fails (for example an asset belongs to another owner), the whole
--   import must roll back and the previous published copy must remain intact.
--   A `security invoker` function keeps RLS as the authorization boundary.

begin;

alter table public.organization_documents
  add column source_url text,
  add column source_modified_at timestamptz;

alter table public.publications
  add column source_url text,
  add column source_modified_at timestamptz;

alter table public.organization_documents
  add constraint organization_documents_source_url_check
    check (source_url is null or source_url ~* '^https?://'),
  add constraint organization_documents_source_modified_at_check
    check (source_modified_at is null or source_synced_at is not null);

alter table public.publications
  add constraint publications_source_url_check
    check (source_url is null or source_url ~* '^https?://'),
  add constraint publications_source_modified_at_check
    check (source_modified_at is null or source_synced_at is not null);

comment on column public.organization_documents.source_url is
  'Canonical source URL (for a Google Doc, the Drive edit URL); http(s) only. Never a signed URL.';
comment on column public.organization_documents.source_modified_at is
  'Upstream modifiedTime at the last successful sync; lets T-042 skip an unchanged export.';
comment on column public.publications.source_url is
  'Canonical source URL; mirrors organization_documents.source_url.';
comment on column public.publications.source_modified_at is
  'Upstream modifiedTime at the last successful sync; mirrors organization_documents.source_modified_at.';

-- ---------------------------------------------------------------------------
-- Transactional import writer
-- ---------------------------------------------------------------------------

create or replace function public.persist_reader_import_v1(
  p_kind text,
  p_entity_id uuid,
  p_slug text,
  p_locale public.content_locale,
  p_title text,
  p_description text,
  p_document_type text,
  p_body_ast jsonb,
  p_assets jsonb,
  p_source_provider public.content_source_provider,
  p_source_path text,
  p_source_mime text,
  p_source_external_id text,
  p_source_url text,
  p_source_synced_at timestamptz,
  p_source_modified_at timestamptz,
  p_allow_original_download boolean,
  p_status public.content_status
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_entity_id uuid := coalesce(p_entity_id, gen_random_uuid());
  v_slug text := nullif(btrim(coalesce(p_slug, '')), '');
  v_title text := btrim(coalesce(p_title, ''));
  v_status public.content_status := coalesce(p_status, 'draft');
  v_assets jsonb := coalesce(p_assets, '[]'::jsonb);
  v_asset jsonb;
  v_asset_id uuid;
  v_existing_slug text;
begin
  if p_kind not in ('document', 'publication') then
    raise exception 'import kind must be document or publication'
      using errcode = '23514';
  end if;
  if v_title = '' then
    raise exception 'import title is required' using errcode = '23514';
  end if;
  if p_locale is null then
    raise exception 'import locale is required' using errcode = '23514';
  end if;
  if p_body_ast is null then
    raise exception 'import body_ast is required' using errcode = '23514';
  end if;
  if jsonb_typeof(v_assets) <> 'array' then
    raise exception 'import assets must be a JSON array' using errcode = '23514';
  end if;
  if p_source_provider = 'upload'
     and nullif(btrim(coalesce(p_source_path, '')), '') is null then
    raise exception 'upload source requires a source path' using errcode = '23514';
  end if;
  if p_source_provider = 'google_doc'
     and nullif(btrim(coalesce(p_source_external_id, '')), '') is null then
    raise exception 'google_doc source requires an external id' using errcode = '23514';
  end if;
  if coalesce(p_allow_original_download, false)
     and nullif(btrim(coalesce(p_source_path, '')), '') is null then
    raise exception 'original download requires a source path' using errcode = '23514';
  end if;

  if p_kind = 'document' then
    if p_entity_id is null then
      if v_slug is null then
        raise exception 'a new import requires a slug' using errcode = '23514';
      end if;

      insert into public.organization_documents (
        id, slug, status, document_type, language, published_at,
        source_provider, source_path, source_mime, source_external_id,
        source_url, source_synced_at, source_modified_at,
        allow_original_download
      ) values (
        v_entity_id, v_slug, v_status,
        coalesce(nullif(btrim(p_document_type), ''), 'report'),
        p_locale,
        case when v_status = 'published' then now() else null end,
        p_source_provider, nullif(btrim(p_source_path), ''),
        nullif(btrim(p_source_mime), ''),
        nullif(btrim(p_source_external_id), ''),
        nullif(btrim(p_source_url), ''),
        p_source_synced_at, p_source_modified_at,
        coalesce(p_allow_original_download, false)
      );
    else
      select slug into v_existing_slug
        from public.organization_documents
       where id = p_entity_id
       for update;
      if not found then
        raise exception 'document import target does not exist' using errcode = '23514';
      end if;
      v_slug := v_existing_slug;

      update public.organization_documents
         set status = v_status,
             source_provider = p_source_provider,
             source_path = nullif(btrim(p_source_path), ''),
             source_mime = nullif(btrim(p_source_mime), ''),
             source_external_id = nullif(btrim(p_source_external_id), ''),
             source_url = nullif(btrim(p_source_url), ''),
             source_synced_at = p_source_synced_at,
             source_modified_at = p_source_modified_at,
             allow_original_download = coalesce(p_allow_original_download, false),
             published_at = case
               when v_status = 'published' then coalesce(published_at, now())
               else published_at
             end
       where id = v_entity_id;
    end if;

    delete from public.content_assets a
     where a.organization_document_id = v_entity_id
       and a.locale = p_locale
       and not exists (
         select 1
           from jsonb_array_elements(v_assets) candidate
          where (candidate ->> 'id')::uuid = a.id
       );

    for v_asset in select value from jsonb_array_elements(v_assets)
    loop
      v_asset_id := (v_asset ->> 'id')::uuid;

      if exists (
        select 1 from public.content_assets a
         where a.id = v_asset_id
           and (a.organization_document_id is distinct from v_entity_id
                or a.publication_id is not null
                or a.locale <> p_locale)
      ) then
        raise exception
          'content asset % belongs to another owner or locale', v_asset_id
          using errcode = '23514';
      end if;

      insert into public.content_assets (
        id, organization_document_id, publication_id, locale,
        storage_path, mime_type, width, height, sha256, size_bytes
      ) values (
        v_asset_id, v_entity_id, null, p_locale,
        v_asset ->> 'storage_path',
        v_asset ->> 'mime_type',
        (v_asset ->> 'width')::integer,
        (v_asset ->> 'height')::integer,
        v_asset ->> 'sha256',
        nullif(v_asset ->> 'size_bytes', '')::bigint
      )
      on conflict (id) do update
        set storage_path = excluded.storage_path,
            mime_type = excluded.mime_type,
            width = excluded.width,
            height = excluded.height,
            sha256 = excluded.sha256,
            size_bytes = excluded.size_bytes;
    end loop;

    insert into public.organization_document_translations (
      document_id, locale, title, description, body_ast, body_ast_version
    ) values (
      v_entity_id, p_locale, v_title, p_description, p_body_ast, 1
    )
    on conflict (document_id, locale) do update
      set title = excluded.title,
          description = excluded.description,
          body_ast = excluded.body_ast,
          body_ast_version = 1;

    return v_entity_id;
  end if;

  if p_entity_id is null then
    if v_slug is null then
      raise exception 'a new import requires a slug' using errcode = '23514';
    end if;

    insert into public.publications (
      id, slug, status, language, published_at,
      source_provider, source_path, source_mime, source_external_id,
      source_url, source_synced_at, source_modified_at,
      allow_original_download
    ) values (
      v_entity_id, v_slug, v_status, p_locale,
      case when v_status = 'published' then now() else null end,
      p_source_provider, nullif(btrim(p_source_path), ''),
      nullif(btrim(p_source_mime), ''),
      nullif(btrim(p_source_external_id), ''),
      nullif(btrim(p_source_url), ''),
      p_source_synced_at, p_source_modified_at,
      coalesce(p_allow_original_download, false)
    );
  else
    select slug into v_existing_slug
      from public.publications
     where id = p_entity_id
     for update;
    if not found then
      raise exception 'publication import target does not exist' using errcode = '23514';
    end if;
    v_slug := v_existing_slug;

    update public.publications
       set status = v_status,
           source_provider = p_source_provider,
           source_path = nullif(btrim(p_source_path), ''),
           source_mime = nullif(btrim(p_source_mime), ''),
           source_external_id = nullif(btrim(p_source_external_id), ''),
           source_url = nullif(btrim(p_source_url), ''),
           source_synced_at = p_source_synced_at,
           source_modified_at = p_source_modified_at,
           allow_original_download = coalesce(p_allow_original_download, false),
           published_at = case
             when v_status = 'published' then coalesce(published_at, now())
             else published_at
           end
     where id = v_entity_id;
  end if;

  delete from public.content_assets a
   where a.publication_id = v_entity_id
     and a.locale = p_locale
     and not exists (
       select 1
         from jsonb_array_elements(v_assets) candidate
        where (candidate ->> 'id')::uuid = a.id
     );

  for v_asset in select value from jsonb_array_elements(v_assets)
  loop
    v_asset_id := (v_asset ->> 'id')::uuid;

    if exists (
      select 1 from public.content_assets a
       where a.id = v_asset_id
         and (a.publication_id is distinct from v_entity_id
              or a.organization_document_id is not null
              or a.locale <> p_locale)
    ) then
      raise exception
        'content asset % belongs to another owner or locale', v_asset_id
        using errcode = '23514';
    end if;

    insert into public.content_assets (
      id, organization_document_id, publication_id, locale,
      storage_path, mime_type, width, height, sha256, size_bytes
    ) values (
      v_asset_id, null, v_entity_id, p_locale,
      v_asset ->> 'storage_path',
      v_asset ->> 'mime_type',
      (v_asset ->> 'width')::integer,
      (v_asset ->> 'height')::integer,
      v_asset ->> 'sha256',
      nullif(v_asset ->> 'size_bytes', '')::bigint
    )
    on conflict (id) do update
      set storage_path = excluded.storage_path,
          mime_type = excluded.mime_type,
          width = excluded.width,
          height = excluded.height,
          sha256 = excluded.sha256,
          size_bytes = excluded.size_bytes;
  end loop;

  insert into public.publication_translations (
    publication_id, locale, title, abstract, body_ast, body_ast_version
  ) values (
    v_entity_id, p_locale, v_title, p_description, p_body_ast, 1
  )
  on conflict (publication_id, locale) do update
    set title = excluded.title,
        abstract = excluded.abstract,
        body_ast = excluded.body_ast,
        body_ast_version = 1;

  return v_entity_id;
end;
$$;

comment on function public.persist_reader_import_v1(
  text, uuid, text, public.content_locale, text, text, text, jsonb, jsonb,
  public.content_source_provider, text, text, text, text, timestamptz,
  timestamptz, boolean, public.content_status
) is
  'T-041 S3: atomically creates/updates a document/publication import, its '
  'content_assets (owner+locale enforced) and the AST translation. `body` is '
  'never written here; the reader trigger derives it. SECURITY INVOKER so RLS '
  'remains the authorization boundary.';

revoke all on function public.persist_reader_import_v1(
  text, uuid, text, public.content_locale, text, text, text, jsonb, jsonb,
  public.content_source_provider, text, text, text, text, timestamptz,
  timestamptz, boolean, public.content_status
) from public;

grant execute on function public.persist_reader_import_v1(
  text, uuid, text, public.content_locale, text, text, text, jsonb, jsonb,
  public.content_source_provider, text, text, text, text, timestamptz,
  timestamptz, boolean, public.content_status
) to authenticated, service_role;

commit;
