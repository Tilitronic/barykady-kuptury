# T-042 — Google Docs import/sync

**Session:** 10 · **Lane:** integrations · **Owner:** @coder
**Reviewers:** @reviewer + @architector (security/credentials) + @designer (admin UX)
**Depends on:** T-041 (converter/source model) · **Blocks:** none
**Decisions:** D-28 (MD + DOCX + Google Docs), D-30 (source files), D-31 (both auth modes)

## Outcome

An admin can connect a Google Doc to a document/publication language version,
import its content through the same safe converter as T-041, and re-sync it on
demand (and optionally on a schedule). The public site renders the **stored,
sanitized copy**, not a live iframe. The last sync time and source link are
shown in the admin.

## Scope

- Store `source_provider='google_doc'`, `source_external_id` (Drive file id),
  `source_url`, `source_synced_at`, source file metadata.
- Drive `files.export` → **DOCX** (10 MB export cap) → T-041 mammoth/HAST
  converter → AST → images rehosted. Markdown export is optional for
  text-only docs but references Google-hosted images.
- Auth (D-31): support **both** modes.
  - Default: per-admin OAuth + Google Picker + `drive.file` (non-sensitive,
    no verification; personal Drives, per-file access).
  - Optional: service account for a Workspace shared drive (long-lived key,
    access managed by the org).
  Never expose tokens/keys to the client; store refresh tokens encrypted
  server-side or use short-lived OAuth. Do not request `drive.readonly`
  (restricted, verification/CASA) or `documents.readonly` unless unavoidable.
- Run the export/conversion in a Netlify **background function** (15 min);
  the public site never calls Google at render time.
- Sync triggers: "Sync now" in admin; optional scheduled/manual re-sync.
  Detect changes via `modifiedTime`/revision; show a diff summary before
  replacing published content.
- Failure handling: keep the last published copy, show an actionable error,
  never blank the public page.
- No live iframe embedding: loses SEO, accessibility, CSP control, offline
  resilience and content search.

## Out of scope

- Live Google Docs embedding.
- Two-way sync back to Google.
- Google Sheets/Slides.
- Public content-language SEO (T-034).

## TDD plan

1. RED: export payload → AST (fixtures), image extraction, sync state,
   credential boundary, stale/failed sync keeps the last copy.
2. GREEN: Drive client (server-side), sync action, admin UI, source metadata.
3. RED/GREEN E2E: connect a mocked Doc, preview/publish, sync update, failure
   state, original/source link.
4. Security review: OAuth/service-account scope, token storage, revocation.

## Acceptance criteria

- [ ] An admin can connect a Google Doc by URL/ID and import it through the
      T-041 converter with images and tables.
- [ ] "Sync now" updates the stored content and `source_synced_at`; the public
      reader shows the new copy only after a successful conversion.
- [ ] A failed sync keeps the last published copy and surfaces a localized
      error; the public page never breaks.
- [ ] Both auth modes work: per-admin OAuth + Picker (`drive.file`) and the
      optional service-account mode; switching modes never exposes tokens/keys
      to the client or logs.
- [ ] Credentials/tokens never reach the client or logs; least-privilege scope.
- [ ] No iframe/live embed is used.
- [ ] Unit/typecheck/lint/build/E2E, pgTAP where data changes, demo:check.

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
