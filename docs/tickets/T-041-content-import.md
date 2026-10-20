# T-041 — Content import pipeline (MD + DOCX) + source files

**Session:** 10 · **Lane:** admin/content ingestion · **Owner:** @coder + @designer (admin UX)
**Reviewers:** @reviewer + @architector (security/conversion) + @designer (admin UX sign-off)
**Depends on:** T-040 (body/images/source columns), T-026 (admin shell), T-027/T-029/T-030 (admin forms) · **Blocks:** T-042
**Decisions:** D-28 (MD + DOCX + Google Docs), D-30 (source files), D-35 (ODT deferred)

## Outcome

An admin can add a document or publication language version by **importing**
content instead of typing it in an editor:
- drag/drop or select a `.md` or `.docx` file
  (`.odt` is not accepted in this release — a localized “Save as DOCX”
  guidance is shown, per D-35),
- preview the converted, sanitized content and images,
- fix metadata (title required per language, description, language, source),
- publish.

The original file is stored in a **private** bucket and offered as a download
only when `allow_original_download` is on (default **off**). The admin panel is
not a rich-text editor.

## Conversion pipeline

```
upload (admin) → convert in a Web Worker (manual imports)
  → MD: unified/remark → mdast
  → DOCX: mammoth → HTML → rehype-parse + hast-util-sanitize → HAST
  → map to the versioned ReaderDocument AST (never raw HTML)
  → extract images → upload to public-media (alt required)
  → preview (T-040 reader) → publish (body_ast + body + source metadata)
```

- **MD**: `unified` + `remark-parse` + `remark-gfm` → mdast; map to the
  ReaderDocument AST. Drop mdast `html` nodes (no raw HTML). No `marked`/
  `markdown-it` HTML-string pipeline.
- **DOCX**: `mammoth` in a Web Worker (style→heading map, lists, tables,
  `convertImage` extraction); mammoth emits no sanitization, so its HTML is
  parsed with `rehype-parse` + `hast-util-sanitize` and mapped to the AST.
- **ODT**: deferred (D-35). No reliable Netlify path; the import UI rejects
  `.odt` with a localized “Save as DOCX” message. Revisit only with a
  maintained pure-JS converter or an external conversion service.
- **Manual imports run client-side** (Web Worker) because Netlify's buffered
  binary request limit is ~4.5 MB; Google sync pulls the file in a background
  function (T-042).
- **Security**: untrusted input; size/type limits; convert in a bounded
  process; never render raw HTML; sanitize to the AST; image MIME/extension
  checks; no service-role key in the client; conversion runs server-side where
  a service key is needed.
- **Images**: extracted from DOCX, uploaded to `public-media`, alt required
  (fallback filename flagged for review), captions preserved. Markdown image
  URLs must already point at Supabase Storage; remote URLs are stripped with a
  warning (no hotlinking/tracking pixels).
- **Tables**: map to the AST table node with `<caption>`, `th scope`, row
  headers and `colspan`/`rowspan`; reject unsupported layouts with an
  actionable message. GFM alone cannot carry a caption or row header.
- **Errors**: per-file, localized messages; never publish a partial conversion.
- **AST validation**: enforce `body_ast_version`, node/prop allowlists, URL
  schemes (`http/https/mailto` only), image origin and alt completeness on
  write, not only in the admin client.
- **Limits**: reject `.docm`, cap compressed/uncompressed size and zip entry
  count before inflation; validate image MIME (PNG/JPEG/WebP only).

## Source files

- Private `content-sources` bucket; `source_path`, `source_mime`,
  `source_provider='upload'`, `source_external_id=null`, `source_synced_at`.
- `allow_original_download` default false. When true, the public reader shows a
  "Download original" action backed by a short-lived signed URL (Netlify
  function or Supabase signed URL). A public bucket would make the toggle
  cosmetic and is not acceptable.
- Store the original for provenance only; the rendered body is the source of
  truth for display.

## Admin UX

- Import dropzone + provider tabs (File / Google Docs in T-042).
- Language tabs; title required for every language version; import per
  language.
- Preview uses the T-040 reader (same rendering/a11y).
- Save/publish with explicit loading/error/success states.
- No freeform editor; "replace content" is another import.
- Works at 320 px and keyboard-only; labels and error association per
  DESIGN_SYSTEM §6.

## Out of scope

- Google Docs sync (T-042).
- ODT import (deferred, D-35; save-as-DOCX guidance only).
- PDF import.
- Rich-text WYSIWYG.
- Public content-language SEO (T-034).

## TDD plan

1. RED: converter fixtures (MD/DOCX → AST), ODT rejection guidance,
   sanitization, image extraction, alt-missing rejection, table mapping,
   size/type limits, source storage.
2. GREEN: conversion module, import component, admin preview/save.
3. RED/GREEN E2E: import each format, preview, publish, download original
   on/off, error states.
4. REFACTOR: shared converter interface; naming pass.

## Acceptance criteria

- [ ] MD and DOCX import produce the same safe AST; headings, lists, links,
      emphasis, images and tables render correctly. ODT upload is rejected
      with the localized “Save as DOCX” guidance.
- [ ] DOCX images are extracted, uploaded, and rendered with alt/caption;
      missing alt blocks publish.
- [ ] Original files are private; the download action appears only when the
      toggle is on and uses a short-lived signed URL.
- [ ] The admin flow is import + metadata + preview; no freeform editor.
- [ ] Malicious/oversized/unsupported files are rejected with localized errors;
      no raw HTML reaches the renderer.
- [ ] Import is per language; title required for each version.
- [ ] Unit/typecheck/lint/build/E2E, pgTAP, demo:check.

## Verification

```
supabase db reset && pnpm types:db
pnpm test && pnpm typecheck && pnpm lint:check && pnpm build
pnpm test:e2e --workers=1
supabase test db
pnpm demo:reset && pnpm demo:check
```

## Log

- (author) start:
