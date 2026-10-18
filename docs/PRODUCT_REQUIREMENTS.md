# Product Requirements

## 1. Product goal

Create a polished, trustworthy, accessible NGO website that explains the organization, presents its projects and publications, promotes upcoming events, and makes it straightforward to contact or support the organization. Authorized administrators must be able to maintain public content without editing source code.

The first release should be deliberately small. It is a public information website with a lightweight admin panel, not a general-purpose page builder or a full NGO operations platform.

## 2. Languages and preferences

Supported locales:

- `en` — English; fallback/default when the browser language is unsupported.
- `pl` — Polish.
- `uk` — Ukrainian.

Locale selection behavior:

1. A locale explicitly present in the URL takes precedence.
2. At the root URL, use a previously saved user choice if one exists; otherwise detect the browser's preferred language when it matches `en`, `pl`, or `uk`; otherwise choose English.
3. Provide a visible, keyboard-operable language selector. A manually selected language must persist across visits and route changes.
4. Do not switch the language unexpectedly while the user navigates inside a locale-specific URL.
5. Translate navigation, controls, validation feedback, status messages, dates, accessibility labels, and admin UI—not just page headings.
6. Publicly published organization content must support localized versions. Do not invent or machine-generate translations without approval. Establish an explicit fallback for a missing translation (English content may be used as a fallback and must be identified to administrators as untranslated).
7. Set appropriate document language metadata and locale-aware date/number formatting.

Use localized UI strings in a real i18n system, not conditional expressions scattered across components. Use a locale-prefixed URL structure so a page can be shared in a specific language. Keep route behavior stable across locales; translated slugs are not required for the MVP unless they are needed for discoverability.

## 3. Theme and display preferences

- Support light and dark themes.
- First visit: use the operating system/browser `prefers-color-scheme` preference.
- Provide a visible theme toggle. A deliberate user override takes precedence over system preference and persists across visits.
- Respond to system preference changes when the user has not set an override.
- Avoid a light/dark flash during initial page load where feasible.
- Respect `prefers-reduced-motion`.
- Use responsive layouts for small mobile screens, tablets, laptops, and wide desktop screens. The entire site, including administration, must remain usable at narrow widths and at browser zoom.

## 4. Main navigation and pages

The top navigation contains these top-level destinations, translated into the selected language:

1. **Contact** (`Kontakt` in Polish)
2. **About us** (`O nas`)
3. **Support us** (`Wesprzyj nas`)
4. **Projects** (`Projekty`)
5. **Events**
6. **Publications**

The header also has social-media links/buttons. Render only channels for which the organization supplies a real URL. Each icon-only control must have an accessible name. Do not invent social accounts or placeholder external links.

The About section has these subsections:

- Main organization information / mission.
- Team.
- Documents, such as the statute, annual reports, and other organizational documents that the NGO chooses to publish.

The site footer should include appropriate navigation, contact details, configured social links, and any legal/privacy links supplied by the organization. Do not invent legal names, registration numbers, or addresses.

### Contact

- Show the configured public contact information.
- A message form is optional for the initial release.
- Never display a fake form that appears to send a message but does not. If the form is enabled, submit through a server-side endpoint and a configured email provider; keep credentials server-side and apply validation and anti-spam controls.
- If delivery has not been configured, provide a functional email link (`mailto:`) or the organization's other verified contact channel instead.
- Show accessible labels, field-level errors, submission state, success feedback, and a recoverable error state if a form is enabled.

### About us

- Organization information must have a clear hierarchy, be editable, and support all locales.
- Team members must be presented consistently; optional fields may include name, role, short biography, and portrait. Publish only information and images provided/approved by the NGO.
- Documents must show a descriptive title and, where known, document type and publication date. A document is published in one of two modes:
  1. **In-app readable text document** — opens in a dedicated reader view with an in-view language switcher; the default reader language is the active UI locale. File metadata (type/size) is not required for this mode.
  2. **Downloadable file document** — shows language and file metadata (type/size where known); anonymous public download must work without admin authentication.

### Support us

- Present the organization's approved ways to support it (for example, donation link, bank-transfer information, or volunteering contact), only when supplied.
- Make the main action clear and work on mobile.
- Do not process or collect payment-card data in this application.

### Projects

- Provide a listing page and an individual project detail page.
- Support project title, summary, full description, status, dates (where applicable), cover image (optional), and associated upcoming events.
- Support draft and published content. Drafts must never be exposed to anonymous visitors.
- Projects can be manually selected for homepage display. If no projects are explicitly featured, show the most recently updated published projects.

### Events

- Event date/time and event content are maintained in a dedicated Google Calendar in the MVP.
- Display upcoming events from Google Calendar in an accessible, responsive, site-styled list. A calendar-view embed may be added as a supplementary view, but it must not be the only event experience.
- Show the event title, start/end information when available, location or online details when available, description/registration link when provided, and an associated project link when one is assigned.
- An event can be associated with zero or one project. Events without projects are valid and must display normally.
- The event-project association is managed in the NGO admin panel, independently of creating/editing the event in Google Calendar.
- The website must handle all-day events, timezone-aware events, cancelled/deleted events, missing fields, and API errors gracefully.
- Never expose a private calendar. Use a separate calendar containing only public events.

### Publications

- Provide a listing page and individual publication detail pages where useful.
- Support title, summary/abstract, authors/organization, publication date, language, and either a file download or an external URL. Optional metadata must not require invented values.
- PDFs and other approved public files must be downloadable on mobile and desktop.
- Keep publication metadata and UI localized. Where a document itself is available in multiple languages, make each available version clearly selectable.

## 5. Homepage

The homepage must contain:

- A concise organization introduction and clear explanation of what it does.
- A primary next step appropriate to the NGO's mission (configured, not invented).
- The nearest upcoming public events, ordered by event start time.
- Featured projects selected by an administrator; if none are selected, use the most recently updated published projects.
- A clear route to the full project listing, all events, publications, and contact/support pages.

Do not render fabricated content when project or calendar data is empty. Use intentional empty states. If the calendar endpoint fails, preserve the rest of the homepage and provide a useful fallback link or retry option.

## 6. Admin panel

The admin panel is for invited/authorized administrators only. There is no public account registration.

The MVP should allow administrators to:

- Sign in and sign out.
- Create, edit, preview, publish/unpublish, and archive projects.
- Edit organization information and team entries.
- Manage publication metadata and approved document/file uploads.
- Manage available homepage featured projects and their order.
- View events received from the configured Google Calendar and assign/unassign an optional project to each event.
- See which locales have published content and which translations are missing.

Do not build a custom role-management interface for the MVP. Administrator identities and roles are provisioned through trusted Supabase administration settings. UI route guards improve navigation but must not be treated as authorization enforcement.

V1 non-goal: creating or modifying Google Calendar events directly from the website admin panel. Authorized people create/update events in Google Calendar; they use the website admin panel to connect an event to a project. Google Calendar write/OAuth integration can be a later, explicit scope decision.

## 7. Visual references

Use the following sites for structural/information-architecture inspiration, not as assets or pages to copy:

- [Stowarzyszenie Jeden Świat – SCI Poland](https://jedenswiat.org.pl/): inspect the organization introduction, activity/project summaries, prominent actions, and ways of surfacing recent stories/resources.
- [CIM Horyzonty](https://cimhoryzonty.org/): inspect the separation of organization documents, activities/projects, events, and recent publications/articles.

Do not copy logos, photographs, text, or exact visual layouts. The resulting site must follow this project's brand requirements and feel intentionally designed, current, and coherent.

## 8. Acceptance criteria

The public release is not acceptable until:

- All six main navigation destinations and About subsections work in all three locales.
- Locale detection, explicit URL locale, language switching, and saved language preference behave consistently.
- Theme follows system preference on first visit, supports manual override, and persists that override.
- Homepage event data comes from Google Calendar; upcoming events are ordered correctly and associated projects link to published project pages only.
- Homepage featured-project selection works, with the recent-project fallback when nothing is featured.
- Anonymous visitors cannot read drafts or write content.
- Authorized administrators can manage required content and event-project mappings.
- All admin CRUD operations have appropriate tests, including rejection of unauthorized operations.
- The layout is usable with keyboard only and on mobile widths.
- Playwright E2E, type checking, linting, unit/component tests, accessibility checks, and production build pass in CI.
