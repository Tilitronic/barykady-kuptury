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

- `pnpm install` **is not** the install command for this repo: dependencies live
  inside the app workspace. Use `pnpm --dir apps/web/barykadyKultury install`
  (or run `pnpm install` from that directory).
- `pnpm dev` — start the app in development mode
- `pnpm build` — production build (`apps/web/barykadyKultury/dist/spa`)
- `pnpm lint` / `pnpm lint:check` — oxlint + oxfmt (fix / verify)
- `pnpm format:check` — formatting check only
- `pnpm typecheck` — Vue/TypeScript type checking
- `pnpm test` — unit/component tests (vitest)
- `pnpm test:coverage` — unit/component tests with coverage
- `pnpm test:e2e` — Playwright E2E tests (starts and stops its own server)
- `pnpm test:e2e:install` — install the Playwright browsers used by E2E

## Continuous integration

[![CI](https://github.com/Tilitronic/barykady-kuptury/actions/workflows/ci.yml/badge.svg)](https://github.com/Tilitronic/barykady-kuptury/actions/workflows/ci.yml)

`.github/workflows/ci.yml` runs the eight quality gates from `docs/TESTING.md`
§5 on every push to `main` and every pull request, in order:

1. install from the committed lockfile (`--frozen-lockfile`)
2. formatting check (oxfmt)
3. lint (oxlint + oxfmt)
4. type check (vue-tsc)
5. unit/component tests (vitest)
6. DB/RLS tests — optional; skipped cleanly while Supabase is not configured
7. Playwright E2E — cached chromium; the HTML report is uploaded even on failure
8. production build (`quasar build`)

CI pins Node 24 and pnpm 10.33.0 to match the local toolchain, and no secret is
required for a green run: the workflow exports obviously fake, loopback-pointing
`VITE_SUPABASE_*` placeholders instead of credentials (architecture §9).

Reproduce the full gate sequence locally:

```bash
bash scripts/ci-local.sh
```

The script stops at the first failing gate, prints it by name, and exits
non-zero. Its gate names mirror the workflow's step names one-to-one.

## Content sources

`NGOinfoSources/` is deliberately versioned: it holds the brandbook, the
three-language regulations, the logo package and the only confirmed legal
identifiers (NIP/REGON). The 21 MB brandbook PDF is the single source of truth
for brand values; Git LFS is intentionally not used at this size. Do not delete
these files and do not copy them into the app bundle unless a ticket says so.

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
