# Technical Architecture

## 1. Decisions

| Area | Decision | Reason |
|---|---|---|
| Repository | Single Quasar app in a git repository rooted at the project root (`apps/web/barykadyKultury`); pnpm workspaces + Turborepo deferred | D-01: one app today, no second consumer; avoids work that buys nothing. The layout keeps `apps/` so a monorepo can be adopted without moving files. |
| Web app | Quasar CLI with Vite, Vue 3, TypeScript | Required UI framework and a mature component/router/build setup |
| Lint/format | oxlint + oxfmt (Quasar scaffold default) | D-02: already wired and green, single fast toolchain. Deliberate divergence from the original ESLint + Prettier choice, recorded here rather than silently changed. |
| E2E | Playwright | Required cross-browser end-to-end coverage |
| Content DB | Supabase PostgreSQL | Relational content model, migrations, RLS and typed data access |
| Authentication | Supabase Auth | Managed administrator authentication; no custom password system |
| File storage | Supabase Storage | Publication and document files with access policies |
| Hosting | Netlify | Static Quasar deployment plus optional serverless functions |
| Event source | Dedicated Google Calendar containing public events only | NGO team can maintain event dates/content in a familiar interface |
| Calendar adapter | Read-only Netlify Function | Keeps calendar integration configuration server-side and exposes a normalized event API |

Use Node.js and pnpm for the JavaScript toolchain, pin their versions, and follow the versions supported by the selected Quasar/Turborepo releases when the app is scaffolded. Do not introduce Bun or Deno as another project-wide package manager/runtime without a concrete reason. If Supabase Edge Functions are added in the future, their runtime is separate from the main app's toolchain.

## 2. Repository layout

```text
ngo-platform/
├── apps/
│   └── web/                         # One Quasar public site + admin panel
│       └── src/
│           ├── boot/                # Supabase client, i18n, theme initialization
│           ├── components/          # Truly reusable presentation components
│           ├── features/
│           │   ├── auth/
│           │   ├── content/
│           │   ├── projects/
│           │   ├── publications/
│           │   ├── events/
│           │   ├── contact/
│           │   └── support/
│           ├── layouts/             # PublicLayout and AdminLayout
│           ├── pages/               # Route-level pages, public and admin
│           ├── router/
│           ├── stores/
│           ├── i18n/
│           ├── css/                 # Brand tokens and theme variables
│           └── types/               # Generated Supabase database types
├── netlify/
│   └── functions/
│       └── calendar-events.ts       # Read-only Google Calendar adapter
├── supabase/
│   ├── migrations/                 # Versioned schema and RLS changes
│   ├── tests/                      # SQL/RLS tests
│   ├── seed.sql                    # Non-sensitive local/demo fixture data
│   └── config.toml
├── docs/
├── .github/workflows/ci.yml
├── AGENTS.md
├── netlify.toml
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
└── turbo.json
```

Create only the directories and files needed by implemented features. Do not add `packages/*` until at least two actual consumers require shared code. Keep Quasar-specific UI inside `apps/web`; keep Supabase migrations at repository root in `supabase/`.

### Current layout note (D-01)

The tree above is the target shape for a multi-app repository. Today only one app exists, so the implemented layout is:

```text
barykadyKultury/                  # git repository root
├── apps/web/barykadyKultury/     # the single Quasar app (pnpm workspace + lockfile live here)
├── docs/                         # product, architecture, design, testing, tickets
├── NGOinfoSources/               # brandbook, regulations, logo, legal identifiers
├── netlify.toml                  # base = apps/web/barykadyKultury, publish = dist/spa
├── package.json                  # root scripts delegating into the app
└── AGENTS.md
```

There is no root `pnpm-workspace.yaml`, `pnpm-lock.yaml`, or `turbo.json`. Install and run app tooling with `pnpm --dir apps/web/barykadyKultury <command>`; the root scripts already do this. Adding a root workspace is deferred until a second consumer exists (D-15).

## 3. Application boundaries

- **Pages and layouts:** route-level orchestration, page composition, navigation.
- **Feature modules:** feature-specific components, schemas, typed data-access functions, and domain logic.
- **Supabase client:** a single initialized browser client using the project URL and publishable key.
- **Serverless functions:** integration boundaries that require server-side environment variables or external API adaptation. They must not become a general backend by default.
- **Supabase:** persistence, identity, row-level authorization, and file storage.
- **Google Calendar:** authoritative source for event content and event timing in V1.

Keep components thin and test business/data logic outside page components. Generated database types must be derived from the migrated schema.

## 4. Content model

Use PostgreSQL and normalized translation tables rather than embedding translated text in unrelated UI logic. Exact column types and constraints must be committed through migrations.

Suggested logical entities:

- `site_pages` + `site_page_translations`: editable organization pages and localized title/body/metadata.
- `projects` + `project_translations`: shared project lifecycle/status/dates/media metadata plus localized slug/title/summary/body.
- `team_members` + `team_member_translations`: published team entries, ordering, optional portrait and localized role/bio.
- `publications` + `publication_translations`: publication status, date, external URL/file metadata, and localized title/abstract/authors where appropriate.
- `publication_files` (optional): multiple language/version files for one publication when real content requires it.
- `organization_documents` + translations or metadata: statute, annual reports, financial reports and other approved public files. It may be unified with publications if product modeling shows they are the same entity; avoid duplicating the same document in two unrelated systems.
- `calendar_event_links`: the relationship between a Google Calendar event identifier and an optional project.
- `admin` authorization: use trusted Supabase Auth `app_metadata`/claims or another server-controlled mechanism. Do not use a user-editable profile field as the source of admin privileges.

Content records should support a clear publishing lifecycle (`draft`, `published`, and `archived` where useful), timestamps, and predictable ordering. Only complete translations intended for publication should be presented as localized content; fallback behavior is specified in the product requirements.

### Event-project relation

`calendar_event_links` should contain at least:

- a stable row identifier;
- the configured calendar ID (or equivalent stable calendar scope);
- the Google event ID;
- nullable `project_id` with a foreign key to `projects`;
- created/updated timestamps;
- a unique constraint for the calendar/event identity pair.

One mapping row has zero or one project link. If a project is deleted, the event should remain valid and the mapping should become unlinked (for example, `ON DELETE SET NULL`). Never use event title/date as a database identity: both can change. Google Calendar event IDs are the stable key.

The event link can point to a draft project in the admin interface if useful, but public event output must only include a project link when the linked project and the selected translation are published and public. The event listing must continue to work when the association is absent or its project has been unpublished/deleted.

## 5. Google Calendar integration

The new requirements (homepage upcoming events, project association, and a custom localized event list) mean a plain Google Calendar iframe alone is insufficient.

V1 workflow:

1. Designate a dedicated Google Calendar that contains **public events only**.
2. Authorized NGO staff create and update the events in Google Calendar.
3. `netlify/functions/calendar-events.ts` calls the Google Calendar API in read-only mode and returns a normalized, minimal list of public events.
4. The frontend fetches event-project mappings from Supabase and joins them by `calendar_id` + `google_event_id`.
5. An administrator uses the website's Events admin view to assign or remove the optional project association.
6. Homepage and Events page display the normalized event list; events may link to published project pages.

Function requirements:

- Read calendar configuration from server-side environment variables. Do not accept an arbitrary calendar ID or Google credential from a browser request.
- Do not expose the API key or service credentials to the browser. If a key is used, restrict it to the Google Calendar API. Prefer a read-only identity and dedicated public calendar; never grant the website integration broader calendar access than required.
- Validate query parameters and bound the requested time window/number of results.
- Return only needed event fields, including start/end, timezone/all-day status, location, description and known registration URL where available.
- Normalize missing fields and handle cancelled/deleted events. Do not assume every event has `start.dateTime`; all-day events use `start.date`.
- Set an appropriate short cache policy to reduce repeated API requests while keeping the schedule reasonably fresh.
- Fail with a controlled error response; do not leak credentials, raw exception traces, or API response secrets.
- Use the event's supplied timezone where available; otherwise use the configured organization's timezone (initially `Europe/Warsaw`, confirm with the NGO).
- Calendar adapter success payload is `{ calendarId, events, generatedAt }`.
- `events[*].id` is the Google event identifier (`google_event_id`); the frontend joins mappings by `(calendarId, events[*].id)` against `calendar_event_links (calendar_id, google_event_id)`.
- Missing server-side calendar configuration is a server failure: `500 { "error": "calendar_unavailable" }` with `Cache-Control: no-store`. Request-validation failures remain `400 { "error": "invalid_request" }`.

V1 is read-only with respect to Google Calendar. Creating/editing Google events from the web admin and OAuth write scopes are explicitly deferred. Avoid relying solely on an iframe, because it cannot provide the required project relationship or a tailored homepage event list.

## 6. Security model

- Anonymous visitors can select/read published public content and public calendar data only.
- Anonymous visitors cannot create/update/delete content, access drafts, upload files, or query admin-only records.
- Administrators authenticate via Supabase Auth and receive their admin permission through a trusted process.
- Enforce access in PostgreSQL RLS and Storage policies. Route guards are a UX convenience, not a security control.
- Use deny-by-default policies. Test each operation for anonymous and administrator contexts.
- Do not put the Supabase service-role key in the browser, a `VITE_*` variable, public JSON, source control, test snapshots, logs, or documentation.
- Public bucket/file access must be deliberate; admin upload/write policies must be distinct from public read policies.
- Validate upload type and size, use safe file names, and reject active/executable content. Do not render untrusted uploaded HTML/SVG as inline active content.
- Treat rich text, user inputs, and Calendar descriptions as untrusted. Avoid unrestricted HTML rendering.
- Disable open registration. Do not implement custom password storage.
- Keep production credentials outside local fixtures and CI logs. Use isolated test project/local Supabase for tests.

## 7. Contact form and other external services

A message form requires a server-side delivery path. The frontend must never receive email-provider credentials. Keep the form optional until an email provider, sending identity, and anti-spam measures are configured. A `mailto:` link is an acceptable fallback for the first release.

Donation actions should link to verified NGO-provided destinations. The website must not collect or process card information.

## 8. Routing, localization and rendering

- Use explicit locale-prefixed routes (`/en/...`, `/pl/...`, `/uk/...`).
- The root route chooses the persisted locale first, then a supported browser language, otherwise English, and redirects to its locale-prefixed equivalent.
- An explicit locale URL is authoritative; do not automatically redirect away from it because browser settings differ.
- Use stable route names and localized visible navigation. Localized slugs are optional for V1.
- Set document `lang`, page title, description, and link metadata appropriate to the active route.
- The initial deployment may use Quasar SPA mode, but SEO, link previews, and no-JavaScript page content should be evaluated before launch. Keep data access and routes independent of the rendering mode so prerendering/SSR can be added deliberately.

## 9. Deployment and configuration

- Netlify serves the built Quasar SPA and the read-only Calendar function.
- Netlify build base is the repository root; the Quasar app build/publish paths are explicit (`apps/web/barykadyKultury/...`) and the functions directory is `netlify/functions`.
- The publish directory should match the actual Quasar build output (typically `apps/web/dist/spa` for SPA mode).
- Configure history fallback for client-side routes.
- Configure distinct environment variables for local development, previews, and production.
- Only browser-safe Supabase URL/publishable key belong in public frontend configuration.
- Server-only variables include calendar API credentials/configuration and, if the optional message form is enabled, email-provider credentials.
- CI must not require production credentials. Mock external providers and use isolated local/test services.
- Add database migrations and a documented backup/export process; a free-tier hosted database is not itself a complete backup strategy.

## 10. Deliberately deferred

- A separate custom Node/Bun/Deno server.
- Multiple frontend apps or a component-design-system package.
- Creating/editing Google Calendar events from the NGO website.
- Payment processing, membership accounts, public registration, user profiles, complex roles.
- General-purpose drag-and-drop page building.
- A custom calendar UI before the list/homepage requirements and usability are met.
