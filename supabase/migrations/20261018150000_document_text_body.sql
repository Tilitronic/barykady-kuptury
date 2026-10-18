-- T-017 — organization documents: in-app readable text (D-12, 2026-10-18).
--
-- Design authority:
--   * docs/PRODUCT_REQUIREMENTS.md §4 (amended 2026-10-18) — a document has two
--     modes: an uploaded file (storage_path + language) or in-app readable text
--     (a per-translation `body`). Regulations use the text mode (owner D-12).
--   * docs/architecture.md §4 — localized content lives in
--     `<entity>_translations`; the root carries shared lifecycle metadata. The
--     body therefore belongs on the translation, not the root.
--   * docs/architecture.md §6 — access stays status/parent based; no policy
--     needs to change because no access rule depends on these columns. The RLS
--     matrix remains the proof (supabase/tests/rls_content_matrix_test.sql).
--
-- Postgres TOAST already stores large `text` values out of line, so the body is
-- stored as plain `text`: no gzip/base64 and no new dependency
-- (docs/tickets/DECISIONS.md D-19; AGENTS.md rule 7).

-- In-app readable text for a translation (safe Markdown subset). Null for a
-- file-based document, which carries its content in Storage instead.
alter table public.organization_document_translations
  add column body text;

-- A text document has no file, so the file-only columns become optional. The
-- existing `organization_documents_storage_path_check` still rejects a blank
-- or URL value when a path is present (a CHECK is satisfied by NULL).
alter table public.organization_documents
  alter column storage_path drop not null;

alter table public.organization_documents
  alter column language drop not null;

comment on table public.organization_documents is
  'Public documents (D-12, T-017). A document is either file-based (storage_path/language set, content in Storage) or in-app readable text (storage_path/language null, body on each translation).';

comment on column public.organization_documents.storage_path is
  'Storage object path for a file-based document; null when the document is in-app text (never a URL).';

comment on column public.organization_documents.language is
  'Language of the uploaded file for a file-based document; null when the document is in-app text (each translation carries its own locale).';

comment on column public.organization_document_translations.body is
  'In-app readable text in the safe Markdown subset for a text document; null when the document is file-based.';
