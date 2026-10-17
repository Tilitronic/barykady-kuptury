# AI Agent Instructions

## Project purpose

Build an accessible, multilingual public website and lightweight content-management interface for an NGO. The primary stack is Quasar (Vue 3 + TypeScript), pnpm workspaces, Turborepo, Supabase, Netlify, Google Calendar, and Playwright.

Before implementation, read:

- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/architecture.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/TESTING.md`

These documents are complementary: product requirements define observable behavior, architecture defines technical boundaries, design requirements define the presentation, and testing defines the required verification workflow. If requirements conflict or an important value is missing, document the uncertainty and choose the smallest safe implementation rather than inventing organizational facts, URLs, credentials, brand colors, or content.

## Non-negotiable engineering rules

1. **Use test-driven development (TDD).** For each behavior change, write or update a focused test first, run it to confirm that it fails for the expected reason, implement the smallest change, then run the test again. Do not postpone tests until after implementation.
2. **Use Playwright for end-to-end tests.** Important public and admin journeys must have E2E coverage. Use deterministic fixtures and mock Google Calendar responses in E2E tests; tests must not depend on real calendar contents or production services.
3. **Verify every meaningful change.** Run the relevant focused test first, then lint, type-check, unit/component tests, E2E tests where applicable, and production build. Report tests that could not be run; never claim they passed without running them.
4. **Security belongs at the data boundary.** UI guards are not authorization. Enforce public/admin access with Supabase Row Level Security (RLS) and Storage policies. Never place service-role keys, email-provider credentials, Google credentials, or other secrets in client code or `VITE_*` variables.
5. **Schema changes are migrations.** Commit Supabase SQL migrations; do not rely on manual production-dashboard edits as the only source of schema truth. Generate and update database types from the schema rather than hand-maintaining generated types.
6. **Do not invent credentials, content, social-media URLs, donation details, team biographies, or legal identifiers.** Use clearly marked development fixtures only in tests and local previews.
7. **Avoid needless complexity.** Keep one Quasar app until there is a proven need for another app. Do not add a backend server, workspace package, dependency, abstraction, or CMS feature without a concrete requirement.
8. **Accessibility is a release requirement.** Do not merge changes that knowingly break keyboard operation, focus visibility, semantic structure, color contrast, reduced-motion behavior, or accessible form feedback.
9. **Preserve multilingual behavior.** Any new UI string must use the localization system and include English, Polish, and Ukrainian messages. Avoid hard-coded user-facing strings.
10. **Use oxlint + oxfmt.** Follow the configuration produced by the Quasar scaffold (decision D-02). Keep linting, formatting, TypeScript checking, tests, and build as separate, reproducible commands.

## Coding conventions

- Use TypeScript with strict settings and Vue 3 Composition API.
- Follow Quasar conventions for boot files, layouts, routing, components, and configuration.
- Organize application code by feature (auth, content pages, projects, publications, events/calendar, contact, support) rather than creating a large generic service layer.
- Keep Supabase access behind small, typed feature-level data-access modules. Components should not repeat raw SQL/API request construction.
- Use explicit loading, empty, error, and success states for asynchronous UI.
- Prefer semantic HTML and native controls; use Quasar components when they preserve semantics and accessibility.
- Validate inputs at trust boundaries. Treat all client input and remote event text as untrusted.
- Render authored rich text safely; do not use unrestricted `v-html` on user-managed content. If Markdown is used, disable raw HTML and sanitize rendered output.
- Do not weaken RLS or tests to make a failing implementation pass. Explain any necessary exception in the change summary.

## Repository and commands

The intended repository is a pnpm/Turborepo monorepo with `apps/web` for Quasar, root-level `supabase/` migrations/functions/tests, and `docs/` for product and engineering documentation. Adapt commands to the actual scaffolded package scripts; do not assume a script exists until verified.

Expected root-level command intent:

- `pnpm dev` — run the web app.
- `pnpm lint` — lint application and shared code.
- `pnpm format:check` — verify formatting.
- `pnpm typecheck` — Vue/TypeScript type checking.
- `pnpm test` — unit/component tests.
- `pnpm test:e2e` — Playwright E2E tests.
- `pnpm build` — production build.

If a command is missing or broken, fix the project scripts as part of the initial setup instead of silently skipping the check.

## Definition of done

A change is done only when the intended behavior is covered by tests, the focused test passed, relevant quality checks passed, no secret or production data was exposed, translations were updated where necessary, and any material architecture/behavior decision was recorded in the appropriate document.
