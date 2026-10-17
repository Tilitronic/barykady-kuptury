# NGO Website — AI Agent Brief

This folder contains the initial project brief intended to be copied into the root of the new repository.

## Files

- `AGENTS.md` — repository-wide instructions for OpenCode and other coding agents.
- `docs/PRODUCT_REQUIREMENTS.md` — page structure, user-facing behavior, locales, homepage, admin scope and acceptance criteria.
- `docs/architecture.md` — selected stack, repository shape, data boundaries, security, calendar integration and deployment.
- `docs/tickets/` — vertical ticket board, decision register and status ledger.
- `docs/DESIGN_SYSTEM.md` — brand token roles, responsive design and WCAG 2.2 AA target.
- `docs/TESTING.md` — TDD workflow, Playwright E2E coverage, database security tests and CI gates.

## OpenCode setup

OpenCode automatically reads project-level `AGENTS.md`. For reliable inclusion of the longer reference documents in agent context, merge the following `instructions` entries into the existing `opencode.json` configuration (do not replace any existing model, permission or provider settings):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": [
    "docs/PRODUCT_REQUIREMENTS.md",
    "docs/architecture.md",
    "docs/DESIGN_SYSTEM.md",
    "docs/TESTING.md"
  ]
}
```

If an `instructions` array already exists, append these paths to it rather than creating a duplicate property.

## Decisions to confirm before public launch

Tracked with status, owner and blocking tickets in [`docs/tickets/DECISIONS.md`](./tickets/DECISIONS.md).

1. ~~Add the actual brandbook and confirm the exact `GRAY93`, `nero`, and `scarlet` color values and logo rules.~~ **Resolved:** the brandbook is in `NGOinfoSources/`; verified values (`#C60001`, `#262424`, `#EDEDED`), the contrast matrix and the logo rules are recorded in `docs/DESIGN_SYSTEM.md` §1–§2.
2. Confirm the NGO's preferred organization timezone (the architecture provisionally uses `Europe/Warsaw`).
3. Configure a dedicated Google Calendar containing only public events and create read-only API credentials for the calendar adapter.
4. Supply real social-media URLs, public contact details, support/donation information, team data and localized content.
5. Select an email-delivery provider if the optional website contact form is required.
6. Decide whether Quasar SPA is sufficient for the first public launch or whether server-side rendering/pre-rendering is required for SEO and social previews.

Items 2–6 should not prevent scaffolding, tests, the shared layout, brand-grounded components, or local Supabase migrations. The agent must not fill them with invented organizational facts.
