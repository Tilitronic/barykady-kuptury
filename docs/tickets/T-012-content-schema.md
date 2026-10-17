# T-012 — Content schema migrations

**Session:** 3 · **Lane:** data/architecture · **Owner:** @coder · **Status:** todo
**Reviewers:** @architector + @reviewer
**Depends on:** T-001, D-08 · **Blocks:** T-013…T-031

## Outcome
Versioned Supabase migrations define the whole V1 content model with constraints, lifecycle fields, and translation tables — committed as the single source of schema truth.

## Scope
In:
- `supabase/config.toml`, `supabase/migrations/<timestamp>_content_model.sql`, `supabase/seed.sql`.
- Tables (with translation siblings): `site_pages`, `site_page_translations`, `projects`, `project_translations`, `team_members`, `team_member_translations`, `publications`, `publication_translations`, `publication_files`, `organization_documents`, `organization_document_translations`, `calendar_event_links`.
- Lifecycle enum `content_status ('draft','published','archived')`, `created_at/updated_at` + trigger, `published_at`, ordering columns (`sort_order`), slug uniqueness **per locale**, locale enum `('en','pl','uk')`.
- `projects.featured_rank` (nullable, ordered), `projects.cover_path` (Storage path, not URL).
- `calendar_event_links`: `calendar_id`, `google_event_id`, nullable `project_id` FK `ON DELETE SET NULL`, unique `(calendar_id, google_event_id)`, timestamps.
- Indexes for published listing, featured ordering, event lookup.
- Seed data: clearly fictional fixtures per `docs/TESTING.md` §6 (published + draft project, complete + incomplete translation, publication with/without file, team member, event link rows).

Out: RLS policies (T-013), Storage buckets (T-014), app queries (T-015).

## Design constraints
- `docs/architecture.md` §4 (entities, event-project relation, stable Google event ID identity, no title/date identity).
- `AGENTS.md` rule 5 (migrations, generated types).
- `docs/TESTING.md` §6 (fixture set).

## TDD plan
1. RED: `supabase/tests/schema_test.sql` assertions (tables exist, unique per-locale slug rejects duplicates, `ON DELETE SET NULL` unlinks an event) fail before migrations run.
2. GREEN: write migrations + seed until `supabase db reset` and the schema test pass.
3. REFACTOR: split migrations by concern only if a single file becomes unreadable; keep one migration per logical change after V1.

## Acceptance criteria
- [ ] `supabase db reset` succeeds from scratch and applies seed idempotently.
- [ ] Duplicate `(project_id, locale)` slug insert is rejected.
- [ ] Deleting a project sets `calendar_event_links.project_id` to NULL and keeps the row.
- [ ] Cannot associate one Google event twice (unique constraint proven).
- [ ] All translation tables cascade on parent delete; no orphan rows possible.
- [ ] `updated_at` advances on update (trigger proven by test).
- [ ] Fixtures contain only fictional content and no personal data.
- [ ] No RLS is disabled anywhere (policies land in T-013, tables start closed).

## Verification
```
supabase db reset
supabase test db   # schema assertions
pnpm typecheck
```

## Review gate
- @architector: model matches §4, event identity rules respected, no premature generalisation.
- @reviewer: constraints are declarative (not app-enforced), naming consistent, seed data obviously fake.

## Log
- (author) start:
