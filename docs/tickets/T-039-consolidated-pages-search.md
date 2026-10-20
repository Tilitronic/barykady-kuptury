# T-039 — Consolidated area pages with TOC + two-source site search

**Session:** 10 · **Lane:** public UX + search · **Owner:** @designer (pages/UI) + @coder (search backend)
**Reviewers:** @reviewer + @architector (search/RLS/SEO) + @designer (design sign-off)
**Depends on:** T-017, T-018, T-019, T-020, T-024, T-025, T-038 · **Blocks:** T-034 (sitemap/hreflang), T-027…T-031 (admin content pages)
**Decisions:** D-25 (consolidated pages, keep detail/reader URLs), D-26 (two-section search)

## Outcome

1. **About is one page.** `/about` carries Mission, History, Values, Aims,
   Team and Documents sections with a left-hand table of contents. Team is
   rendered inline; Documents renders cards that link to the existing reader
   pages. The list routes `/about/team` and `/about/documents` are removed and
   redirect to `/about#team` / `/about#documents`. The reader route
   `/about/documents/:slug` stays (SEO + sharing).
2. **Area pages get sections + TOC.** Projects (`#featured`, `#all`),
   publications (year sections), events (`#upcoming`, `#past`, `#calendar`).
   Detail pages for projects/publications are retained; events have no detail
   pages.
3. **Header search with two result sources, searched at once:**
   - **Navigation** (top section): instant client-side index of pages and
     section anchors (About, Projects, Publications, Events, Support, Contact,
     Team, Documents, etc.).
   - **Content** (second section): Postgres full-text/substring search over
     published database content (site pages, projects, publications, documents,
     team). Calendar events are added to the same Content section from the
     existing calendar feed because they are not stored in Postgres.
   - Filter chips (`All / Pages / Projects / Publications / Documents / Team /
     Events`) auto-set from the current route (Projects → Projects,
     Publications → Publications, Events → Events; elsewhere All) and remain
     user-changeable. Navigation results stay at the top.
   - Results link to the exact page/section anchor or detail/reader URL.

## Alternatives considered

| Area pages | Clicks | SEO | Verdict |
|---|---|---|---|
| Keep listing + detail | listing → detail | best | rejected as the only structure (too many clicks to browse) |
| One page per area with TOC + detail retained | 0 to browse, 1 for detail | best (detail URLs kept) | **chosen (D-25)** |
| Inline everything, remove detail URLs | 0 | loses shareable/indexable pages | rejected |

| About | Clicks | SEO | Verdict |
|---|---|---|---|
| Keep Team/Documents pages | 2+ | separate pages | rejected by owner |
| About sections; team inline; documents cards → readers | 0 / 1 | one strong About page; reader pages keep document SEO | **chosen (D-25)** |
| Inline full document bodies | 0 | loses per-document URLs | rejected (regulations are long/legal) |

| Search | Latency | Scale | Complexity | Verdict |
|---|---|---|---|---|
| Client-side only | instant | ~20–200 items | low | not enough for “Postgres materials” |
| Postgres only | network/debounce | thousands | migration + RPC | misses navigation/section intent |
| **Navigation (client) + Postgres content (server) + events (calendar)** | instant nav, debounced content | DB content scales | medium | **chosen (D-26)** |

## Search contract (frozen)

### Navigation results (client-side)

```ts
export type NavigationSearchKind = "page" | "section";

export interface NavigationSearchResult {
  readonly id: string;            // stable registry id
  readonly kind: NavigationSearchKind;
  readonly title: string;         // localized
  readonly description: string | null;
  readonly route: string;         // e.g. "/en/projects#featured"
  readonly keywords: readonly string[];
}
```

Registry covers: Home, About, Support, Contact, Projects (+ Featured/All),
Events (+ Upcoming/Past/Calendar), Publications (+ year sections), About
sections (Mission/History/Values/Aims/Team/Documents), and the homepage
sections (Mission/Upcoming/Featured/Explore). Matching: case-insensitive,
diacritic-insensitive token/prefix match on title, description and keywords;
max 5; instant, no network.

### Content results (Postgres + events)

```ts
export type ContentSearchKind =
  | "page" | "project" | "publication" | "document" | "team" | "event";

export interface ContentSearchResult {
  readonly id: string;
  readonly kind: ContentSearchKind;
  readonly title: string;
  readonly excerpt: string | null;
  readonly route: string;         // detail/reader URL or section anchor
  readonly rank: number;
}
```

Postgres RPC `public.search_published_content(search_query text,
result_locale content_locale, result_kinds text[] default null,
result_limit int default 20)`:

- `security invoker` (RLS remains the boundary) + explicit `status='published'`.
- Searches the requested-locale translation with English fallback (all
  published rows are guaranteed an English translation by T-038).
- Tables: `site_pages`, `projects`, `publications`,
  `organization_documents`, `team_members`.
- Case-insensitive substring via `strpos(lower(...), lower(query))`, so `%`/`_`
  are literal; empty/1-character queries return nothing.
- Rank: title 3, summary/abstract/description/role 2, body/bio 1; order rank
  then title; limit 1–50.
- Returns `kind, entity_id, title, excerpt (≤180 chars), slug/page_key, rank`.
  The client builds routes (`/{locale}/...`).
- No new indexes needed at current volume; revisit if content grows.

Events: fetched from the existing calendar client when search opens (cached by
the existing client), filtered by title/description/location, linked to
`/{locale}/events#event-<id>` (event cards get stable anchors). Calendar
failure must not block navigation or Postgres results.

### Filters + auto-set

- Chips: `all | pages | projects | publications | documents | team | events`.
- Route → default filter: `projects`/`project-detail` → projects;
  `publications`/`publication-detail` → publications; `events` → events;
  everything else → all. User change overrides until the dialog closes/route
  changes.
- `all` searches every content kind; a chip maps to the RPC `result_kinds`
  (events are filtered client-side).

## Page structure

### About (`/{locale}/about`)

Sections and anchors:

- `#mission`, `#history`, `#values`, `#aims` — parsed from the existing about
  body’s `## ` headings; heading ids are stable slugs (en content drives the
  ids for all locales, since the body is localized).
- `#team` — inline team grid (reuse `PersonCard`; extract the list from
  `about-team.vue` into a shared component).
- `#documents` — document cards (extract from `about-documents.vue`); text
  documents link to `/{locale}/about/documents/{slug}`, file documents keep
  their current metadata state.

TOC labels come from the localized page headings for the body sections and
i18n keys for Team/Documents. Loading/empty/error states are independent per
section; one failing section must not blank the page.

### Projects (`/{locale}/projects`)

- `#featured` — featured projects (ranks in order) when any exist.
- `#all` — every published project.
- Detail pages unchanged.

### Publications (`/{locale}/publications`)

- Year sections derived from `publication_date` (descending; `#undated` when
  absent), plus `#all` only if grouping adds no value. TOC lists the years.
- Detail pages unchanged.

### Events (`/{locale}/events`)

- `#upcoming`, `#past`, `#calendar` (calendar link/description).
- Event cards get `id="event-<googleEventId>"` for search/deep links.
- No event detail pages.

## TOC component contract

- `PageToc.vue`: props `items: { id, label }[]`, `ariaLabel`; sticky on
  desktop, `<details>`/select on mobile; scroll spy via IntersectionObserver;
  `aria-current="location"`; honors `prefers-reduced-motion`; 320 px safe.
- Sections use `scroll-margin-top` matching the sticky header.
- Deep links (`/#anchor`) scroll to the section after data loads; focus moves
  to the section heading (not just visual scroll).

## Search UI contract

- Header trigger (desktop + mobile drawer), visually hidden label, `/` and
  `Ctrl/Cmd+K` shortcuts (ignored while typing in inputs).
- Dialog: `role="dialog" aria-modal="true"`, labelled; input with
  `aria-controls`/`aria-activedescendant`; results as options/links.
- Two visible sections: **Navigation** then **Content**; type badges on
  content rows; loading/empty/error states; retry for content failure; nav
  results remain usable if content fails.
- Filter chips; route auto-set; announced via polite live region.
- Keyboard: arrows move across both sections, Enter navigates, Esc closes and
  restores focus; focus trap; 320 px and reduced-motion safe.
- All strings in en/pl/uk.

## Out of scope

- Event detail pages/content model.
- Admin search.
- Postgres stemming/ranking beyond the substring rank above; trigram indexes.
- Sitemap/hreflang/canonical work (T-034).
- Reworking the homepage team section (team lives on About only, D-25).

## TDD plan

1. RED: TOC component (scroll spy, aria-current, keyboard), section parsing,
   route redirects, navigation index matching, filter auto-set, RPC contract
   (pgTAP), search composable (debounce/stale/error), event search merge.
2. GREEN: backend RPC + API, page consolidation, TOC, search dialog.
3. RED/GREEN E2E: About anchors + redirects; area TOC; nav search top section;
   Postgres content search (project/publication/document/team); event search;
   auto-filter on each area page; keyboard-only search; 320 px.
4. REFACTOR: extract shared Team/Documents sections, naming pass, copy review.

## Acceptance criteria

- [ ] `/about` renders Mission/History/Values/Aims/Team/Documents in one page
      with a working TOC; `/about/team` and `/about/documents` redirect to the
      matching anchors; document readers still work.
- [ ] Projects/publications/events pages have working TOC sections and anchors;
      detail/reader URLs unchanged.
- [ ] Search opens from the header on desktop/mobile; Navigation results appear
      first and instantly; Content results come from Postgres (and events from
      the calendar) in the second section.
- [ ] Typing a document title/fragment finds the document and opens the reader;
      a project/publication/team member finds the right entity/section.
- [ ] Filter auto-sets from the route and can be changed; navigation results
      stay on top.
- [ ] Content search failure does not break navigation results; empty/error
      states are explicit.
- [ ] Keyboard-only operation, focus trap/restore, screen-reader labels,
      320 px and reduced-motion pass; en/pl/uk complete.
- [ ] pgTAP: RPC returns only published rows, no drafts/archived, locale
      fallback, kind filter, limit; RLS remains the boundary.
- [ ] Full unit/typecheck/lint/build/E2E, `supabase test db`,
      `pnpm test:db:idempotency`, `pnpm demo:reset` + `pnpm demo:check`.

## Verification

```
supabase db reset && pnpm types:db
pnpm test && pnpm typecheck && pnpm lint:check && pnpm build
pnpm test:e2e --workers=1
supabase test db
pnpm test:db:idempotency
pnpm demo:reset && pnpm demo:check
```

## Review gate

- @reviewer: spec fidelity, no weakened tests/RLS, i18n, scope.
- @architector: RPC security/RLS, search model, SEO impact (detail URLs kept),
  route redirects.
- @designer: TOC/search design and 320 px/keyboard sign-off.

## Log

- (author) start:
- (session 10) Implemented: About as one page (body sections + Team + Documents,
  left TOC, per-section states); `/about/team` and `/about/documents` redirect
  to anchors while readers stay; projects `#featured`/`#all`; publications year
  sections; events `#upcoming`/`#past`/`#calendar` + `#event-<id>` anchors;
  shared `PageToc`/`deepLink`/section parser.
- Search: `search_published_content` RPC (security invoker, published-only,
  EN fallback, literal substring, ranked, kind filter, limit clamp) + 45 pgTAP
  assertions; `features/search` navigation index/normalize/RPC/events/composable;
  header `SiteSearch` dialog with Navigation (top) + Content (second), filters
  auto-set from the route, keyboard/combobox/focus trap, 320 px, i18n.
- Reviews: rev-1, arc-3 and des-2 all APPROVE WITH FIXES. Applied: nav labels
  moved to `search.navEntries.*` (no hard-coded UI copy); publication years
  fetched and wired; homepage section ids + deep-link focus; mobile drawer
  closes on navigation; PL/UK count copy fixed; empty Navigation group hidden;
  TOC grid reserve/skeleton and mobile disclosure close; reader back link
  direct; duplicate trigger label/comment removed; dead `nav.*` keys removed;
  Enter-with-no-row follows the first result; body scroll locked; `#past`
  omitted from the TOC until past events exist. Also fixed a real runtime bug:
  `IntersectionObserver` rootMargin used `rem` (invalid) and is now px.
- Verification: 916 unit tests, 115 E2E, 300 pgTAP, typecheck, lint, build,
  base-seed idempotency, `demo:check`, and a 12/12 live browser smoke with zero
  console errors (TOC anchors/focus, search nav/content, auto-filter, home
  section result, publication year).
- Known limit: the calendar adapter is upcoming-only, so `#past` is an honest
  translated empty state; the anchor stays for links/search.
