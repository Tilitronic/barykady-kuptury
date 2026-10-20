-- T-040 — unified reader: versioned AST, plain-text projection, assets and
-- private source files.
--
-- Design authority:
--   * docs/tickets/DECISIONS.md D-32 — translations store a versioned
--     ReaderDocument AST (`body_ast` + `body_ast_version`) plus a plain-text
--     `body` used by search. No raw HTML and no mdast as the storage contract.
--   * D-36 — AST images reference `content_assets` rows (owner XOR, locale,
--     storage path, MIME, dimensions, sha256) instead of inline URLs.
--   * D-37 — AST validation and projection are write-time DB invariants.
--   * D-38 — row resolution stays published + canonical slug; translation
--     fallback moves to the reader layer.
--   * D-30 — original source files live in the private `content-sources`
--     bucket and downloads are off by default.
--   * docs/tickets/T-040-unified-reader.md §Content model — node allowlist,
--     link schemes, heading levels 2–4, table semantics, image alt rules.
--
-- Why the AST lives on the translation, not the root:
--   Localized text belongs to `<entity>_translations` (architecture §4), and
--   alt text/captions are per-translation content. The image *file* is shared
--   metadata, so it lives in `content_assets` and is referenced by id.
--
-- Why validation is in PostgreSQL:
--   The admin UI is a client; a client can be bypassed. The trigger makes an
--   invalid AST impossible to persist through any path (admin form, import,
--   seed, future sync), and the projection cannot drift from the AST.

begin;

-- ---------------------------------------------------------------------------
-- Source-provider domain
-- ---------------------------------------------------------------------------

create type public.content_source_provider as enum ('manual', 'upload', 'google_doc');
comment on type public.content_source_provider is
  'Where a reader document/publication came from (D-30, T-041/T-042). Manual is the default so existing rows remain valid.';

-- ---------------------------------------------------------------------------
-- Translation columns
-- ---------------------------------------------------------------------------

alter table public.organization_document_translations
  add column body_ast jsonb,
  add column body_ast_version smallint;

alter table public.publication_translations
  add column body text,
  add column body_ast jsonb,
  add column body_ast_version smallint;

comment on column public.organization_document_translations.body_ast is
  'ReaderDocument v1 AST; null for legacy body-only translations. Validated and projected by trigger (D-32/D-37).';
comment on column public.organization_document_translations.body_ast_version is
  'AST schema version; null iff body_ast is null. Only version 1 is supported.';
comment on column public.publication_translations.body is
  'Plain-text projection derived from body_ast for search (T-039 RPC); legacy rows may author it directly.';
comment on column public.publication_translations.body_ast is
  'ReaderDocument v1 AST; null for legacy abstract/body-only translations (D-32/D-37).';
comment on column public.publication_translations.body_ast_version is
  'AST schema version; null iff body_ast is null. Only version 1 is supported.';

-- Coupling is declarative as well as enforced by the trigger, so a table-wide
-- UPDATE that bypasses the trigger's column list still cannot persist a
-- half-written AST.
alter table public.organization_document_translations
  add constraint organization_document_translations_body_ast_coupling_check
    check ((body_ast is null) = (body_ast_version is null)),
  add constraint organization_document_translations_body_ast_version_check
    check (body_ast_version is null or body_ast_version = 1);

alter table public.publication_translations
  add constraint publication_translations_body_ast_coupling_check
    check ((body_ast is null) = (body_ast_version is null)),
  add constraint publication_translations_body_ast_version_check
    check (body_ast_version is null or body_ast_version = 1);

-- ---------------------------------------------------------------------------
-- Root source metadata (documents and publications)
-- ---------------------------------------------------------------------------

alter table public.organization_documents
  add column source_provider public.content_source_provider not null default 'manual',
  add column source_path text,
  add column source_mime text,
  add column source_external_id text,
  add column source_synced_at timestamptz,
  add column allow_original_download boolean not null default false;

alter table public.publications
  add column source_provider public.content_source_provider not null default 'manual',
  add column source_path text,
  add column source_mime text,
  add column source_external_id text,
  add column source_synced_at timestamptz,
  add column allow_original_download boolean not null default false;

comment on column public.organization_documents.source_provider is
  'manual (authored in-app), upload (imported file), or google_doc (Drive sync).';
comment on column public.organization_documents.source_path is
  'Private content-sources object path; never a URL (D-30).';
comment on column public.organization_documents.allow_original_download is
  'When true the reader may issue a short-lived signed URL; requires source_path.';
comment on column public.publications.source_provider is
  'manual, upload, or google_doc; mirrors organization_documents.source_provider.';
comment on column public.publications.source_path is
  'Private content-sources object path; never a URL (D-30).';
comment on column public.publications.allow_original_download is
  'When true the reader may issue a short-lived signed URL; requires source_path.';

-- `source_provider` stays enum-typed; the remaining checks keep metadata
-- internally consistent without inventing a workflow column.
alter table public.organization_documents
  add constraint organization_documents_source_path_check
    check (source_path is null or (length(btrim(source_path)) > 0 and source_path !~* '^https?://')),
  add constraint organization_documents_source_mime_check
    check (source_mime is null or length(btrim(source_mime)) > 0),
  add constraint organization_documents_source_external_id_check
    check (source_external_id is null or length(btrim(source_external_id)) > 0),
  add constraint organization_documents_upload_source_check
    check (source_provider <> 'upload' or source_path is not null),
  add constraint organization_documents_google_doc_source_check
    check (source_provider <> 'google_doc' or source_external_id is not null),
  add constraint organization_documents_download_source_check
    check (not allow_original_download or source_path is not null);

alter table public.publications
  add constraint publications_source_path_check
    check (source_path is null or (length(btrim(source_path)) > 0 and source_path !~* '^https?://')),
  add constraint publications_source_mime_check
    check (source_mime is null or length(btrim(source_mime)) > 0),
  add constraint publications_source_external_id_check
    check (source_external_id is null or length(btrim(source_external_id)) > 0),
  add constraint publications_upload_source_check
    check (source_provider <> 'upload' or source_path is not null),
  add constraint publications_google_doc_source_check
    check (source_provider <> 'google_doc' or source_external_id is not null),
  add constraint publications_download_source_check
    check (not allow_original_download or source_path is not null);

-- ---------------------------------------------------------------------------
-- content_assets (D-36)
-- ---------------------------------------------------------------------------

create table public.content_assets (
  id uuid primary key default gen_random_uuid(),
  organization_document_id uuid references public.organization_documents (id) on delete cascade,
  publication_id uuid references public.publications (id) on delete cascade,
  locale public.content_locale not null,
  storage_path text not null,
  mime_type text not null,
  width integer not null,
  height integer not null,
  sha256 text not null,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- XOR owner: exactly one parent, never both and never neither.
  constraint content_assets_owner_xor_check check (
    (case when organization_document_id is not null then 1 else 0 end)
    + (case when publication_id is not null then 1 else 0 end) = 1
  ),
  constraint content_assets_storage_path_key unique (storage_path),
  constraint content_assets_storage_path_check check (
    length(btrim(storage_path)) > 0 and storage_path !~* '^https?://'
  ),
  constraint content_assets_mime_type_check check (
    mime_type in ('image/png', 'image/jpeg', 'image/webp')
  ),
  constraint content_assets_width_check check (width > 0),
  constraint content_assets_height_check check (height > 0),
  constraint content_assets_sha256_check check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint content_assets_size_bytes_check check (size_bytes is null or size_bytes >= 0)
);

comment on table public.content_assets is
  'Reader images (D-36): one raster file per row, owned by exactly one document/publication and one locale. Public read follows the owner publish state.';
comment on column public.content_assets.storage_path is
  'Object path in public-media (never a URL). The renderer builds the public URL.';
comment on column public.content_assets.locale is
  'Translation locale this asset may be referenced from; the AST trigger enforces it.';
comment on column public.content_assets.sha256 is
  'Lower-case hex digest used for import deduplication and integrity checks.';

create index content_assets_organization_document_id_idx
  on public.content_assets (organization_document_id)
  where organization_document_id is not null;
create index content_assets_publication_id_idx
  on public.content_assets (publication_id)
  where publication_id is not null;

create trigger content_assets_set_updated_at
  before update on public.content_assets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- AST validation helpers (D-37)
-- ---------------------------------------------------------------------------
-- Every invalid node raises SQLSTATE 23514 (check_violation) so callers and
-- pgTAP can distinguish content-rule failures from syntax/runtime errors.

create or replace function public.reader_ast_assert_keys_v1(
  node jsonb,
  required_keys text[],
  allowed_keys text[]
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  bad_keys text;
  missing_keys text;
begin
  if node is null or jsonb_typeof(node) <> 'object' then
    raise exception 'reader AST node must be a JSON object' using errcode = '23514';
  end if;

  select string_agg(key, ', ' order by key)
    into bad_keys
    from jsonb_object_keys(node) as key
   where not (key = any(allowed_keys));

  if bad_keys is not null then
    raise exception 'reader AST node has unknown properties: %', bad_keys
      using errcode = '23514';
  end if;

  select string_agg(key, ', ' order by key)
    into missing_keys
    from unnest(required_keys) as key
   where not (node ? key);

  if missing_keys is not null then
    raise exception 'reader AST node is missing required properties: %', missing_keys
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.reader_ast_validate_inlines_v1(
  children jsonb,
  depth integer default 0
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  child jsonb;
begin
  if jsonb_typeof(children) <> 'array' then
    raise exception 'reader AST inline children must be an array' using errcode = '23514';
  end if;

  for child in select value from jsonb_array_elements(children)
  loop
    perform public.validate_reader_inline_v1(child, depth);
  end loop;
end;
$$;

create or replace function public.validate_reader_inline_v1(
  node jsonb,
  depth integer default 0
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  node_kind text;
  href text;
begin
  if depth > 32 then
    raise exception 'reader AST inline nesting is too deep' using errcode = '23514';
  end if;

  if node is null or jsonb_typeof(node) <> 'object' then
    raise exception 'reader AST node must be a JSON object' using errcode = '23514';
  end if;
  node_kind := node ->> 'kind';

  case node_kind
    when 'text', 'inlineCode' then
      perform public.reader_ast_assert_keys_v1(
        node, array['kind', 'value'], array['kind', 'value']);
      if jsonb_typeof(node -> 'value') <> 'string'
         or btrim(node ->> 'value') = '' then
        raise exception 'reader AST % requires a non-empty string value', node_kind
          using errcode = '23514';
      end if;

    when 'strong', 'emphasis', 'sup', 'sub' then
      perform public.reader_ast_assert_keys_v1(
        node, array['kind', 'children'], array['kind', 'children']);
      perform public.reader_ast_validate_inlines_v1(node -> 'children', depth + 1);

    when 'link' then
      perform public.reader_ast_assert_keys_v1(
        node, array['kind', 'href', 'children'], array['kind', 'href', 'children']);
      href := node ->> 'href';
      if href is null or btrim(href) = '' then
        raise exception 'reader AST link requires a non-empty href' using errcode = '23514';
      end if;
      -- Allowlist only the link forms the renderer can safely emit:
      --   http://…, https://…, mailto:…, in-page fragments (#…), and
      --   same-origin absolute paths (/…).
      -- Rejected on purpose: protocol-relative `//host` (inherits the page
      -- scheme and escapes the origin allowlist), javascript:, data:, file:,
      -- and every non-slash relative form.
      if not (
        lower(href) like 'http://%'
        or lower(href) like 'https://%'
        or lower(href) like 'mailto:%'
        or href like '#%'
        or (href like '/%' and href not like '//%')
      ) then
        raise exception 'reader AST link scheme is not allowed: %', href
          using errcode = '23514';
      end if;
      perform public.reader_ast_validate_inlines_v1(node -> 'children', depth + 1);

    when 'span' then
      perform public.reader_ast_assert_keys_v1(
        node, array['kind', 'children'], array['kind', 'children', 'lang']);
      if node ? 'lang'
         and (jsonb_typeof(node -> 'lang') <> 'string' or btrim(node ->> 'lang') = '') then
        raise exception 'reader AST span lang must be a non-empty string'
          using errcode = '23514';
      end if;
      perform public.reader_ast_validate_inlines_v1(node -> 'children', depth + 1);

    else
      raise exception 'unsupported reader AST inline kind: %', coalesce(node_kind, '<missing>')
        using errcode = '23514';
  end case;
end;
$$;

create or replace function public.reader_ast_validate_blocks_v1(
  children jsonb,
  depth integer default 0
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  child jsonb;
begin
  if jsonb_typeof(children) <> 'array' then
    raise exception 'reader AST block children must be an array' using errcode = '23514';
  end if;

  for child in select value from jsonb_array_elements(children)
  loop
    perform public.validate_reader_block_v1(child, depth);
  end loop;
end;
$$;

create or replace function public.validate_reader_block_v1(
  block jsonb,
  depth integer default 0
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  block_kind text;
  heading_level integer;
  item jsonb;
  row_json jsonb;
  cell jsonb;
  row_count integer;
  header_rows integer;
  is_header boolean;
  scope_value text;
  alt_text text;
  decorative boolean;
begin
  if depth > 32 then
    raise exception 'reader AST block nesting is too deep' using errcode = '23514';
  end if;

  if block is null or jsonb_typeof(block) <> 'object' then
    raise exception 'reader AST block must be a JSON object' using errcode = '23514';
  end if;
  block_kind := block ->> 'kind';

  case block_kind
    when 'heading' then
      perform public.reader_ast_assert_keys_v1(
        block, array['kind', 'level', 'children'], array['kind', 'level', 'children']);
      if jsonb_typeof(block -> 'level') <> 'number'
         or (block ->> 'level') !~ '^[0-9]+$' then
        raise exception 'reader AST heading level must be an integer' using errcode = '23514';
      end if;
      heading_level := (block ->> 'level')::integer;
      if heading_level < 2 or heading_level > 4 then
        raise exception 'reader AST heading level must be 2, 3 or 4 (got %)', heading_level
          using errcode = '23514';
      end if;
      perform public.reader_ast_validate_inlines_v1(block -> 'children', 0);

    when 'paragraph' then
      perform public.reader_ast_assert_keys_v1(
        block, array['kind', 'children'], array['kind', 'children']);
      perform public.reader_ast_validate_inlines_v1(block -> 'children', 0);

    when 'list' then
      perform public.reader_ast_assert_keys_v1(
        block, array['kind', 'ordered', 'items'], array['kind', 'ordered', 'items']);
      if jsonb_typeof(block -> 'ordered') <> 'boolean' then
        raise exception 'reader AST list ordered must be a boolean' using errcode = '23514';
      end if;
      if jsonb_typeof(block -> 'items') <> 'array' then
        raise exception 'reader AST list items must be an array' using errcode = '23514';
      end if;
      for item in select value from jsonb_array_elements(block -> 'items')
      loop
        perform public.reader_ast_assert_keys_v1(
          item, array['children'], array['children']);
        perform public.reader_ast_validate_inlines_v1(item -> 'children', 0);
      end loop;

    when 'table' then
      perform public.reader_ast_assert_keys_v1(
        block, array['kind', 'headerRows', 'rows'],
        array['kind', 'headerRows', 'rows', 'caption']);
      if block ? 'caption' and jsonb_typeof(block -> 'caption') <> 'string' then
        raise exception 'reader AST table caption must be a string' using errcode = '23514';
      end if;
      if jsonb_typeof(block -> 'headerRows') <> 'number'
         or (block ->> 'headerRows') !~ '^[0-9]+$' then
        raise exception 'reader AST table headerRows must be a non-negative integer'
          using errcode = '23514';
      end if;
      if jsonb_typeof(block -> 'rows') <> 'array' then
        raise exception 'reader AST table rows must be an array' using errcode = '23514';
      end if;
      row_count := jsonb_array_length(block -> 'rows');
      header_rows := (block ->> 'headerRows')::integer;
      if header_rows > row_count then
        raise exception 'reader AST table headerRows (%) exceeds row count (%)',
          header_rows, row_count using errcode = '23514';
      end if;
      for row_json in select value from jsonb_array_elements(block -> 'rows')
      loop
        if jsonb_typeof(row_json) <> 'array' then
          raise exception 'reader AST table row must be an array' using errcode = '23514';
        end if;
        for cell in select value from jsonb_array_elements(row_json)
        loop
          perform public.reader_ast_assert_keys_v1(
            cell, array['header', 'children'],
            array['header', 'children', 'scope', 'colspan', 'rowspan']);
          if jsonb_typeof(cell -> 'header') <> 'boolean' then
            raise exception 'reader AST table cell header must be a boolean'
              using errcode = '23514';
          end if;
          is_header := (cell ->> 'header')::boolean;
          if is_header then
            if not (cell ? 'scope') then
              raise exception 'reader AST header cell requires scope' using errcode = '23514';
            end if;
            scope_value := cell ->> 'scope';
            if scope_value is null
               or scope_value not in ('col', 'row', 'colgroup', 'rowgroup') then
              raise exception 'reader AST header scope must be col, row, colgroup or rowgroup'
                using errcode = '23514';
            end if;
          elsif cell ? 'scope' then
            raise exception 'reader AST non-header cell must not carry scope'
              using errcode = '23514';
          end if;
          if cell ? 'colspan' then
            if jsonb_typeof(cell -> 'colspan') <> 'number'
               or (cell ->> 'colspan') !~ '^[0-9]+$'
               or (cell ->> 'colspan')::integer < 1 then
              raise exception 'reader AST table colspan must be a positive integer'
                using errcode = '23514';
            end if;
          end if;
          if cell ? 'rowspan' then
            if jsonb_typeof(cell -> 'rowspan') <> 'number'
               or (cell ->> 'rowspan') !~ '^[0-9]+$'
               or (cell ->> 'rowspan')::integer < 1 then
              raise exception 'reader AST table rowspan must be a positive integer'
                using errcode = '23514';
            end if;
          end if;
          perform public.reader_ast_validate_inlines_v1(cell -> 'children', 0);
        end loop;
      end loop;

    when 'image' then
      perform public.reader_ast_assert_keys_v1(
        block, array['kind', 'assetId', 'alt'],
        array['kind', 'assetId', 'alt', 'caption', 'decorative']);
      if jsonb_typeof(block -> 'assetId') <> 'string'
         or (block ->> 'assetId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'reader AST image assetId must be a UUID string'
          using errcode = '23514';
      end if;
      if jsonb_typeof(block -> 'alt') <> 'string' then
        raise exception 'reader AST image alt must be a string' using errcode = '23514';
      end if;
      alt_text := block ->> 'alt';
      decorative := false;
      if block ? 'decorative' then
        if jsonb_typeof(block -> 'decorative') <> 'boolean' then
          raise exception 'reader AST image decorative must be a boolean'
            using errcode = '23514';
        end if;
        decorative := (block ->> 'decorative')::boolean;
      end if;
      if block ? 'caption' and jsonb_typeof(block -> 'caption') <> 'string' then
        raise exception 'reader AST image caption must be a string' using errcode = '23514';
      end if;
      if decorative and btrim(alt_text) <> '' then
        raise exception 'reader AST decorative image must have empty alt text'
          using errcode = '23514';
      end if;
      if not decorative and btrim(alt_text) = '' then
        raise exception 'reader AST non-decorative image requires alt text'
          using errcode = '23514';
      end if;

    when 'blockquote' then
      perform public.reader_ast_assert_keys_v1(
        block, array['kind', 'children'], array['kind', 'children']);
      perform public.reader_ast_validate_blocks_v1(block -> 'children', depth + 1);

    when 'code' then
      perform public.reader_ast_assert_keys_v1(
        block, array['kind', 'value'], array['kind', 'value', 'language']);
      if jsonb_typeof(block -> 'value') <> 'string' then
        raise exception 'reader AST code value must be a string' using errcode = '23514';
      end if;
      if block ? 'language'
         and (jsonb_typeof(block -> 'language') <> 'string'
              or btrim(block ->> 'language') = '') then
        raise exception 'reader AST code language must be a non-empty string'
          using errcode = '23514';
      end if;

    when 'footnote' then
      perform public.reader_ast_assert_keys_v1(
        block, array['kind', 'label', 'children'], array['kind', 'label', 'children']);
      if jsonb_typeof(block -> 'label') <> 'string' or btrim(block ->> 'label') = '' then
        raise exception 'reader AST footnote label must be a non-empty string'
          using errcode = '23514';
      end if;
      perform public.reader_ast_validate_inlines_v1(block -> 'children', 0);

    when 'divider' then
      perform public.reader_ast_assert_keys_v1(
        block, array['kind'], array['kind']);

    else
      raise exception 'unsupported reader AST block kind: %', coalesce(block_kind, '<missing>')
        using errcode = '23514';
  end case;
end;
$$;

/**
 * Validates the whole ReaderDocument v1.
 *
 * Version coupling is part of the function contract (not only the trigger) so
 * direct callers and tests get the same rule. `ast = null` is the legacy
 * body-only path and is valid only with a null version.
 */
create or replace function public.validate_reader_ast_v1(
  ast jsonb,
  ast_version smallint
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if ast is null and ast_version is null then
    return;
  end if;

  if ast is null or ast_version is null then
    raise exception 'body_ast and body_ast_version must both be null or both be set'
      using errcode = '23514';
  end if;

  if ast_version <> 1 then
    raise exception 'unsupported reader AST version: %', ast_version
      using errcode = '23514';
  end if;

  perform public.reader_ast_assert_keys_v1(
    ast, array['kind', 'blocks'], array['kind', 'blocks']);

  if ast ->> 'kind' <> 'document' then
    raise exception 'reader AST top-level kind must be document' using errcode = '23514';
  end if;

  if jsonb_typeof(ast -> 'blocks') <> 'array' then
    raise exception 'reader AST blocks must be an array' using errcode = '23514';
  end if;

  perform public.reader_ast_validate_blocks_v1(ast -> 'blocks', 0);
end;
$$;

comment on function public.validate_reader_ast_v1(jsonb, smallint) is
  'T-040/D-37: validates ReaderDocument v1 (version coupling, node/prop allowlist, link schemes, heading levels 2–4, table semantics, image alt rules). Raises 23514 on any violation.';

-- ---------------------------------------------------------------------------
-- Plain-text projection (D-32/D-37)
-- ---------------------------------------------------------------------------

create or replace function public.reader_ast_inline_text_v1(nodes jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    string_agg(
      case node.value ->> 'kind'
        when 'text' then node.value ->> 'value'
        when 'inlineCode' then node.value ->> 'value'
        else public.reader_ast_inline_text_v1(node.value -> 'children')
      end,
      '' order by node.ord
    ),
    ''
  )
  from jsonb_array_elements(coalesce(nodes, '[]'::jsonb))
       with ordinality as node(value, ord);
$$;

create or replace function public.reader_ast_block_text_v1(block jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  block_kind text := block ->> 'kind';
  lines text[] := '{}';
  line text;
  child jsonb;
  row_json jsonb;
  cell jsonb;
  cells text[];
begin
  case block_kind
    when 'heading', 'paragraph' then
      return public.reader_ast_inline_text_v1(block -> 'children');

    when 'list' then
      for child in select value from jsonb_array_elements(block -> 'items')
      loop
        lines := array_append(
          lines, public.reader_ast_inline_text_v1(child -> 'children'));
      end loop;
      return array_to_string(lines, E'\n');

    when 'table' then
      if nullif(btrim(block ->> 'caption'), '') is not null then
        lines := array_append(lines, btrim(block ->> 'caption'));
      end if;
      for row_json in select value from jsonb_array_elements(block -> 'rows')
      loop
        cells := '{}';
        for cell in select value from jsonb_array_elements(row_json)
        loop
          cells := array_append(
            cells, public.reader_ast_inline_text_v1(cell -> 'children'));
        end loop;
        lines := array_append(lines, array_to_string(cells, ' | '));
      end loop;
      return array_to_string(lines, E'\n');

    when 'image' then
      return concat_ws(
        ' ',
        nullif(btrim(block ->> 'alt'), ''),
        nullif(btrim(block ->> 'caption'), '')
      );

    when 'blockquote' then
      for child in select value from jsonb_array_elements(block -> 'children')
      loop
        line := public.reader_ast_block_text_v1(child);
        if btrim(coalesce(line, '')) <> '' then
          lines := array_append(lines, btrim(line));
        end if;
      end loop;
      return array_to_string(lines, E'\n\n');

    when 'code' then
      return coalesce(block ->> 'value', '');

    when 'footnote' then
      return btrim(
        btrim(block ->> 'label') || ': '
        || public.reader_ast_inline_text_v1(block -> 'children'));

    when 'divider' then
      return '';

    else
      return '';
  end case;
end;
$$;

create or replace function public.reader_ast_to_plain_text_v1(ast jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    string_agg(
      nullif(btrim(public.reader_ast_block_text_v1(node.value)), ''),
      E'\n\n' order by node.ord
    ),
    ''
  )
  from jsonb_array_elements(coalesce(ast -> 'blocks', '[]'::jsonb))
       with ordinality as node(value, ord);
$$;

comment on function public.reader_ast_to_plain_text_v1(jsonb) is
  'T-040/D-37: derives the searchable plain-text body from a ReaderDocument v1 AST (headings, paragraphs, lists, tables, image alt/caption, blockquotes, code, footnotes).';

-- ---------------------------------------------------------------------------
-- Asset ownership/locale validation used by the translation trigger
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER: the caller must be able to see the asset row. Admins can
-- (public.is_admin() select policy) and the service role bypasses RLS; a
-- non-admin cannot write a translation in the first place (RLS denies it).
-- The check is therefore both an integrity rule and a second ownership gate.

create or replace function public.assert_reader_ast_assets_v1(
  ast jsonb,
  target_document_id uuid,
  target_publication_id uuid,
  asset_locale public.content_locale
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  image_node jsonb;
  asset_id uuid;
begin
  if ast is null then
    return;
  end if;

  for image_node in
    select image.value
      from jsonb_path_query(ast, 'strict $.** ? (@.kind == "image")')
        as image(value)
  loop
    asset_id := (image_node ->> 'assetId')::uuid;

    if not exists (
      select 1
        from public.content_assets a
       where a.id = asset_id
         and a.locale = asset_locale
         and (
           (target_document_id is not null
            and a.organization_document_id = target_document_id)
           or (target_publication_id is not null
            and a.publication_id = target_publication_id)
         )
    ) then
      raise exception
        'reader AST image asset % is missing or owned by another entity/locale',
        asset_id using errcode = '23514';
    end if;
  end loop;
end;
$$;

create or replace function public.reader_translation_before_write_v1()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_document_id uuid;
  target_publication_id uuid;
begin
  if (new.body_ast is null) <> (new.body_ast_version is null) then
    raise exception 'body_ast and body_ast_version must both be null or both be set'
      using errcode = '23514';
  end if;

  -- Legacy body-only rows are untouched: `body` is the authored text.
  if new.body_ast is null then
    return new;
  end if;

  perform public.validate_reader_ast_v1(new.body_ast, new.body_ast_version);

  if tg_table_name = 'organization_document_translations' then
    target_document_id := (to_jsonb(new) ->> 'document_id')::uuid;
    perform public.assert_reader_ast_assets_v1(
      new.body_ast, target_document_id, null, new.locale);
  else
    target_publication_id := (to_jsonb(new) ->> 'publication_id')::uuid;
    perform public.assert_reader_ast_assets_v1(
      new.body_ast, null, target_publication_id, new.locale);
  end if;

  -- `body` is derived, never authored, when an AST is present.
  new.body := public.reader_ast_to_plain_text_v1(new.body_ast);
  return new;
end;
$$;

comment on function public.reader_translation_before_write_v1() is
  'T-040/D-37: validates body_ast/version, checks image assets against the translation parent+locale, and projects body for both translation tables. Null AST preserves legacy body.';

create trigger organization_document_translations_reader_ast
  before insert or update on public.organization_document_translations
  for each row execute function public.reader_translation_before_write_v1();

create trigger publication_translations_reader_ast
  before insert or update on public.publication_translations
  for each row execute function public.reader_translation_before_write_v1();

-- ---------------------------------------------------------------------------
-- content_assets RLS (D-36)
-- ---------------------------------------------------------------------------

alter table public.content_assets enable row level security;

create policy content_assets_select_published on public.content_assets
  for select to anon, authenticated
  using (
    exists (
      select 1
        from public.organization_documents d
       where d.id = content_assets.organization_document_id
         and public.is_published(d.status)
    )
    or exists (
      select 1
        from public.publications p
       where p.id = content_assets.publication_id
         and public.is_published(p.status)
    )
  );

create policy content_assets_select_admin on public.content_assets
  for select to authenticated
  using (public.is_admin());

create policy content_assets_insert_admin on public.content_assets
  for insert to authenticated
  with check (public.is_admin());

create policy content_assets_update_admin on public.content_assets
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy content_assets_delete_admin on public.content_assets
  for delete to authenticated
  using (public.is_admin());

-- Defence in depth: RLS already denies anon writes, but anon must never hold
-- write privileges on an asset table (T-013 precedent).
revoke insert, update, delete, truncate, references, trigger
  on public.content_assets from anon;

-- ---------------------------------------------------------------------------
-- Private source bucket (D-30)
-- ---------------------------------------------------------------------------
-- Originals are admin-only. The existing public-read policy is scoped to
-- public-documents/public-media, so adding this bucket does not widen anon
-- access; the policies below are bucket-scoped and admin-only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-sources',
  'content-sources',
  false,
  52428800, -- 50 MiB, same operational ceiling as the public buckets
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/markdown',
    'text/plain'
  ]::text[]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy storage_objects_select_content_sources_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'content-sources' and public.is_admin());

create policy storage_objects_insert_content_sources_admin on storage.objects
  for insert to authenticated
  with check (bucket_id = 'content-sources' and public.is_admin());

create policy storage_objects_update_content_sources_admin on storage.objects
  for update to authenticated
  using (bucket_id = 'content-sources' and public.is_admin())
  with check (bucket_id = 'content-sources' and public.is_admin());

create policy storage_objects_delete_content_sources_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'content-sources' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Search projection: publications now search their derived body (T-039)
-- ---------------------------------------------------------------------------
-- Replaces the T-039 function with an identical contract plus publication
-- `body` in the match/excerpt/rank logic. The other four branches are
-- intentionally unchanged.

create or replace function public.search_published_content(
  search_query text,
  result_locale public.content_locale,
  result_kinds text[] default null,
  result_limit integer default 20
)
returns table (
  kind text,
  entity_id uuid,
  title text,
  excerpt text,
  slug text,
  page_key text,
  rank integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      lower(btrim(search_query)) as q,
      least(greatest(coalesce(result_limit, 20), 1), 50) as max_rows
    where search_query is not null
      and length(btrim(search_query)) >= 2
      and (result_kinds is null or cardinality(result_kinds) > 0)
  ),

  matches as (
    -- Site pages: title, meta description, body.
    select
      'page'::text as kind,
      p.id as entity_id,
      t.title,
      nullif(
        left(
          btrim(regexp_replace(
            coalesce(nullif(t.meta_description, ''), t.body, ''),
            '\s+', ' ', 'g'
          )),
          180
        ),
        ''
      ) as excerpt,
      null::text as slug,
      p.page_key,
      case
        when strpos(lower(t.title), prm.q) > 0 then 3
        when strpos(lower(coalesce(t.meta_description, '')), prm.q) > 0 then 2
        when strpos(lower(coalesce(t.body, '')), prm.q) > 0 then 1
        else 0
      end as rank
    from public.site_pages p
    cross join params prm
    join lateral (
      select tr.title, tr.meta_description, tr.body
      from public.site_page_translations tr
      where tr.page_id = p.id
        and tr.locale in (result_locale, 'en')
      order by (tr.locale = result_locale) desc
      limit 1
    ) t on true
    where p.status = 'published'
      and (result_kinds is null or 'page' = any(result_kinds))

    union all

    -- Projects: title, summary, body.
    select
      'project'::text,
      p.id,
      t.title,
      nullif(
        left(
          btrim(regexp_replace(
            coalesce(nullif(t.summary, ''), t.body, ''),
            '\s+', ' ', 'g'
          )),
          180
        ),
        ''
      ),
      p.slug,
      null::text,
      case
        when strpos(lower(t.title), prm.q) > 0 then 3
        when strpos(lower(coalesce(t.summary, '')), prm.q) > 0 then 2
        when strpos(lower(coalesce(t.body, '')), prm.q) > 0 then 1
        else 0
      end
    from public.projects p
    cross join params prm
    join lateral (
      select tr.title, tr.summary, tr.body
      from public.project_translations tr
      where tr.project_id = p.id
        and tr.locale in (result_locale, 'en')
      order by (tr.locale = result_locale) desc
      limit 1
    ) t on true
    where p.status = 'published'
      and (result_kinds is null or 'project' = any(result_kinds))

    union all

    -- Publications: title, abstract, derived/plain body (T-040).
    select
      'publication'::text,
      p.id,
      t.title,
      nullif(
        left(
          btrim(regexp_replace(
            coalesce(nullif(t.abstract, ''), t.body, ''),
            '\s+', ' ', 'g'
          )),
          180
        ),
        ''
      ),
      p.slug,
      null::text,
      case
        when strpos(lower(t.title), prm.q) > 0 then 3
        when strpos(lower(coalesce(t.abstract, '')), prm.q) > 0 then 2
        when strpos(lower(coalesce(t.body, '')), prm.q) > 0 then 1
        else 0
      end
    from public.publications p
    cross join params prm
    join lateral (
      select tr.title, tr.abstract, tr.body
      from public.publication_translations tr
      where tr.publication_id = p.id
        and tr.locale in (result_locale, 'en')
      order by (tr.locale = result_locale) desc
      limit 1
    ) t on true
    where p.status = 'published'
      and (result_kinds is null or 'publication' = any(result_kinds))

    union all

    -- Organization documents: title, description, readable body.
    select
      'document'::text,
      p.id,
      t.title,
      nullif(
        left(
          btrim(regexp_replace(
            coalesce(nullif(t.description, ''), t.body, ''),
            '\s+', ' ', 'g'
          )),
          180
        ),
        ''
      ),
      p.slug,
      null::text,
      case
        when strpos(lower(t.title), prm.q) > 0 then 3
        when strpos(lower(coalesce(t.description, '')), prm.q) > 0 then 2
        when strpos(lower(coalesce(t.body, '')), prm.q) > 0 then 1
        else 0
      end
    from public.organization_documents p
    cross join params prm
    join lateral (
      select tr.title, tr.description, tr.body
      from public.organization_document_translations tr
      where tr.document_id = p.id
        and tr.locale in (result_locale, 'en')
      order by (tr.locale = result_locale) desc
      limit 1
    ) t on true
    where p.status = 'published'
      and (result_kinds is null or 'document' = any(result_kinds))

    union all

    -- Team members: name, role, bio.
    select
      'team'::text,
      m.id,
      m.name,
      nullif(
        left(
          btrim(regexp_replace(
            coalesce(nullif(t.role, ''), t.bio, ''),
            '\s+', ' ', 'g'
          )),
          180
        ),
        ''
      ),
      null::text,
      null::text,
      case
        when strpos(lower(m.name), prm.q) > 0 then 3
        when strpos(lower(coalesce(t.role, '')), prm.q) > 0 then 2
        when strpos(lower(coalesce(t.bio, '')), prm.q) > 0 then 1
        else 0
      end
    from public.team_members m
    cross join params prm
    left join lateral (
      select tr.role, tr.bio
      from public.team_member_translations tr
      where tr.member_id = m.id
        and tr.locale in (result_locale, 'en')
      order by (tr.locale = result_locale) desc
      limit 1
    ) t on true
    where m.status = 'published'
      and (result_kinds is null or 'team' = any(result_kinds))
  )

  select
    m.kind,
    m.entity_id,
    m.title,
    m.excerpt,
    m.slug,
    m.page_key,
    m.rank
  from matches m
  cross join params prm
  where m.rank > 0
  order by m.rank desc, m.title asc
  limit (select max_rows from params);
$$;

comment on function public.search_published_content(text, public.content_locale, text[], integer) is
  'T-039/D-26 + T-040: literal, case-insensitive substring search over published '
  'pages, projects, publications (including the derived reader body), documents '
  'and team. Requested locale with English fallback; rank 3 title, 2 '
  'summary/abstract/description/role, 1 body/bio. SECURITY INVOKER; RLS remains '
  'the boundary and every source filters status = ''published''.';

revoke all on function public.search_published_content(
  text, public.content_locale, text[], integer
) from public;

grant execute on function public.search_published_content(
  text, public.content_locale, text[], integer
) to anon, authenticated, service_role;

commit;
