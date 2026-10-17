# Barykady Kultury — website

Public website and lightweight admin panel for the ordinary association
**Barykady Kultury** (Poznań, Poland). Trilingual: English, Polish, Ukrainian.

## Stack

Quasar (Vue 3 + TypeScript), Supabase (Postgres, Auth, Storage), Netlify
(hosting + read-only Google Calendar function), Playwright for E2E.

## Layout

```text
apps/web/barykadyKultury/   Quasar application (single app for now)
docs/                       Product, architecture, design and testing docs
docs/tickets/               Vertical task board, decision register, status ledger
NGOinfoSources/             Source material: brandbook, regulations, logo, legal IDs
```

Turborepo is deliberately not used while a single app exists
(`docs/tickets/DECISIONS.md` D-01, D-15).

## Commands

Run from the repository root:

- `pnpm dev` — start the app in development mode
- `pnpm build` — production build (`apps/web/barykadyKultury/dist/spa`)
- `pnpm lint` / `pnpm lint:check` — oxlint + oxfmt (fix / verify)
- `pnpm format:check` — formatting check only
- `pnpm typecheck` — Vue/TypeScript type checking

Test commands are added by tickets T-002 and T-003.

## Documentation

- [Product requirements](./docs/PRODUCT_REQUIREMENTS.md)
- [Architecture](./docs/architecture.md)
- [Design system and accessibility](./docs/DESIGN_SYSTEM.md)
- [Testing and TDD policy](./docs/TESTING.md)
- [Ticket board and working protocol](./docs/tickets/README.md)

## Content rule

No contact details, social URLs, team biographies, donation information or
legal identifiers may be invented. Only values supplied in `NGOinfoSources/`
or by the project owner are rendered; everything else stays hidden.
