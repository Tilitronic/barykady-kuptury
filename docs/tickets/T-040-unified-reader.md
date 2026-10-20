# T-040 — Unified long-form reader for documents and publications

**Session:** 10 · **Lane:** public reader/accessibility · **Owner:** @designer + @coder (data)
**Reviewers:** @reviewer + @architector (content model/SEO) + @designer (a11y sign-off)
**Depends on:** T-017, T-020, T-039 (PageToc), T-038 · **Blocks:** T-041, T-042, T-027/T-029/T-030 admin preview
**Decisions:** D-27 (`?lang=`), D-28 (import formats), D-30 (source files)

## Outcome

One `LongFormReader` renders organization documents and publications with:
- a language selector that changes **content** only (never the UI locale),
- a hideable left TOC of sections/subsections with scroll spy and deep links,
- right-hand reading controls (text size, measure/paragraph width, line and
  paragraph spacing) persisted per reader,
- inline images with alt text and captions,
- semantic, WCAG 2.2 AA markup.

Documents (`/about/documents/:slug`) and publications
(`/publications/:slug`) both use it. Changing the reading language does not
change the route locale or the site chrome. Default reading language = UI
locale when available, else English, else the first available translation.

## Content model

- Content is stored as a versioned, project-owned **ReaderDocument AST**:
  `body_ast jsonb` + `body_ast_version smallint` on each translation, plus a
  plain-text `body` projection used by the existing search RPC. Never store
  raw HTML; never render mdast directly.
- AST block kinds: `heading`, `paragraph`, `list`, `table`, `image`,
  `blockquote`, `code`, `footnote`, `divider`. Inline kinds: `text`, `strong`,
  `emphasis`, `link`, `inlineCode`, `sup`, `sub`, `span(lang?)`.
- Tables carry `caption?`, `headerRows`, and per-cell `header`/`colspan`/
  `rowspan` so accessible legal tables are representable (GFM cannot express
  a caption or row header).
- Images carry `{ assetId, alt, caption?, decorative? }`; alt is required for
  non-decorative images in every published translation. The renderer allows
  only the Supabase Storage origin; no remote image URLs, no SVG.
- The reader model exposes `availableLocales` and per-locale
  `{ title, bodyAst }`; documents keep their existing translation model.
- AST validation on write (DB constraint/trigger or a small server check):
  version, node kinds, URL schemes, image alt completeness.
- Reading state: `?lang=<en|pl|uk>` selects the content language; it is
  shareable and does **not** alter the route locale. Invalid/unavailable
  `?lang=` falls back to the default rule and is replaced in the URL.
- Source-file metadata is added here for T-041/T-042:
  `source_provider`, `source_path`, `source_mime`, `source_external_id`,
  `source_synced_at`, `allow_original_download` (default false) on
  `organization_documents` and `publications`.

## Reader component contract

```
<LongFormReader
  :title="..."
  :body-ast="..."
  :content-locale="..."
  :available-locales="..."
  @change-locale="..."
/>
```

- `ReaderToc` uses the T-039 `PageToc` pattern (reuse, do not fork):
  hierarchy from h2/h3/h4, hide/show control, sticky desktop, drawer/select
  mobile, `aria-current`, focus moves to the target heading, `scroll-margin`.
- `ReaderControls`: text size (A−/A+ or steps), measure (narrow/medium/wide),
  line spacing and paragraph spacing; labeled native/Quasar controls; reset;
  persisted in `localStorage`; announced politely; no color-only state.
- Images render `loading="lazy"`, explicit dimensions/aspect when known,
  captions associated with the image, no placeholder when absent.
- Content language selector: buttons/links with `lang` and `aria-current`;
  only available languages; selecting one updates `?lang=` and the article
  `lang` without touching the route locale or chrome language.
- States: loading, unavailable, empty body, unsupported translation; a failed
  document must not blank the page shell.

## Accessibility (release requirement)

- One `h1`, ordered headings, landmarks, skip link, `lang` on the article and
  on language options.
- TOC: labeled `nav`, `aria-current="location"`, keyboard, mobile focus trap,
  Esc closes.
- Controls: visible labels and values, keyboard operable, live-region
  announcement, reset; 200% zoom and 320 px reflow without horizontal scroll;
  contrast; reduced motion; print styles.
- Tables: caption + `th scope`; images: meaningful alt/caption; no keyboard
  traps. Axe + manual keyboard/screen-reader pass; include in T-033.

## SEO

- `?lang=` is shareable; canonical to the UI-locale reader URL and `hreflang`
  alternates are defined in T-034. The reader keeps stable reader/detail URLs.
- The article `lang` and heading structure are correct for crawlers.

## Out of scope

- Import/conversion (T-041) and Google Docs sync (T-042).
- Admin CRUD forms (T-027/T-029/T-030); they consume the reader preview.
- Event reader (events have no detail model).

## TDD plan

1. RED: reader language default/fallback, `?lang=` handling, TOC hierarchy,
   controls persistence, image alt validation, a11y roles/labels.
2. GREEN: data model + reader components + document/publication pages.
3. RED/GREEN E2E: language switch changes content only; `?lang=` shareable;
   TOC hide/show + scroll spy; text size/measure/spacing; images; 320 px;
   keyboard-only; axe.
4. REFACTOR: extract shared reader pieces, remove old reader markup.

## Acceptance criteria

- [ ] Documents and publications render through the same `LongFormReader`.
- [ ] Changing reading language changes only the article; UI locale and URL
      path stay; default = UI locale if available, else EN, else first.
- [ ] `?lang=` selects/validates the content language and is shareable.
- [ ] TOC shows sections/subsections, hides/shows, scroll-spies, deep-links,
      and is keyboard/mobile usable.
- [ ] Text size, measure and line/paragraph spacing work and persist; reset
      works; controls are labeled and announced.
- [ ] Inline images render with alt/caption; missing alt is rejected on publish.
- [ ] WCAG 2.2 AA checks: 200% zoom, 320 px reflow, focus, contrast, reduced
      motion, screen reader labels, no keyboard traps.
- [ ] Unit/typecheck/lint/build/E2E, pgTAP where data changes, demo:check.

## Verification

```
supabase db reset && pnpm types:db
pnpm test && pnpm typecheck && pnpm lint:check && pnpm build
pnpm test:e2e --workers=1
supabase test db
pnpm test:db:idempotency
pnpm demo:reset && pnpm demo:check
```

## Log

- (author) start:
