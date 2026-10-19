# Local demo environment

This document describes the one-command local demo stack for the Barykady
Kultury website (ticket **T-037**). It is a development-only environment: a real
local Supabase stack (migrations, RLS, Storage, Auth), deterministic demo
content, and a Bun mock for the Google Calendar adapter.

> **Demo data is fictional and local-only.** It exists to exercise the design
> system, not to describe the organization. **Never migrate or deploy demo
> data** (including `supabase/seed.demo.sql` and the generated assets) to a
> hosted Supabase project, Netlify, or any public environment.
> `supabase/seed.demo.sql` is deliberately excluded from
> `supabase/config.toml`'s seed list and is never referenced by `pnpm build`.
>
> The demo data is fictional; never migrate or deploy demo data.

## Prerequisites

- **Docker Desktop** with WSL integration enabled (the local stack runs in
  containers). Verify with `docker info`.
- **Node.js** matching the repository `engines` range, plus **pnpm**.
- **Bun** (the demo orchestration scripts and the calendar mock run on Bun;
  developed with Bun 1.4).
- App dependencies installed once:
  ```sh
  pnpm --dir apps/web/barykadyKultury install
  ```
  This also installs the project-pinned Supabase CLI (`supabase` in the app's
  `devDependencies`), which the scripts invoke as
  `pnpm --dir apps/web/barykadyKultury exec supabase`.

## Quick start

```sh
pnpm demo
```

When it finishes, open <http://127.0.0.1:9000/en> (also `/pl` and `/uk`).
`pnpm demo` returns after the servers are healthy; the calendar mock and the
Quasar dev server keep running in the background. Stop everything with
`pnpm demo:stop`.

### What `pnpm demo` does

1. Checks Docker and the project-pinned Supabase CLI.
2. Starts the local Supabase stack if it is stopped (`supabase start`).
3. Applies pending migrations (`supabase migration up --local`).
4. Applies the base seed (`supabase/seed.sql`) idempotently.
5. Runs `bun scripts/demo/setup-demo.ts`, which applies
   `supabase/seed.demo.sql`, generates deterministic assets under
   `.demo/assets/`, uploads them to local Storage, and creates the demo users.
6. Writes `apps/web/barykadyKultury/.env.local` with **only** the browser-safe
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
7. Starts the Bun calendar mock and the Quasar dev server as detached
   processes, waits for both, and prints the URLs.

Every step is safe to re-run. Existing healthy servers are reused rather than
started twice; the seed and Storage uploads are idempotent.

## Ports

| Service | Port | Notes |
| --- | --- | --- |
| Supabase API (REST/Auth/Storage) | `54321` | `VITE_SUPABASE_URL` points here |
| Supabase database (Postgres) | `54322` | local only |
| Supabase Studio | `54323` | <http://127.0.0.1:54323> |
| Mailpit (local email) | `54324` | <http://127.0.0.1:54324> |
| Bun calendar mock | `8787` | override with `CALENDAR_MOCK_PORT` |
| Quasar dev server | `9000` | override with `DEMO_DEV_PORT` |

## Demo credentials

These accounts exist in the local Auth database only. The password is
deterministic so the workflow can print it; it must never be used elsewhere.

| Email | Password | Claim |
| --- | --- | --- |
| `admin@demo.local` | `demo-local-2026` | `app_metadata.role = "admin"` |
| `viewer@demo.local` | `demo-local-2026` | no admin claim |

The viewer exists so the admin guard and RLS denial paths can be exercised
(D-17). Anonymous writes remain denied by RLS.

## Calendar scenarios

The mock serves the production path
`/.netlify/functions/calendar-events` on the app origin; the Quasar/Vite dev
proxy forwards it to the Bun mock, so client code and production wiring are
unchanged.

Switch scenarios with `?scenario=…` on that path:

| Scenario | Behavior |
| --- | --- |
| `default` | 5 upcoming events (3 nearest first) |
| `empty` | 200 with zero events |
| `unavailable` | 502 `{ "error": "calendar_unavailable" }` |
| `dense` | 20 events for list stress |
| `long` | 5 events with long Polish/Ukrainian titles |
| `dst` | 4 events around the Europe/Warsaw spring-forward boundary |

Example:
<http://127.0.0.1:9000/.netlify/functions/calendar-events?scenario=unavailable>

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm demo` | Ensure the stack, seed demo data, write `.env.local`, start mock + dev |
| `pnpm demo:reset` | Drop the local database, replay migrations + base seed, reapply demo data/assets/users |
| `pnpm demo:stop` | Stop the demo mock/dev processes and the local Supabase stack |
| `pnpm demo:stop --dry-run` | Show what would be stopped without changing anything |
| `pnpm demo:check` | Read-only smoke test of a running environment |
| `pnpm demo:calendar` | Run the calendar mock standalone (foreground) |

`pnpm demo:check` probes `${DEMO_BASE_URL:-http://127.0.0.1:9000}` and verifies:

- the database/PostgREST is reachable through the publishable key;
- `/en`, `/pl`, `/uk` return `200`;
- all six calendar scenarios keep their expected shape through the same-origin
  proxy;
- at least one database-referenced demo asset is public and served with the
  expected content type;
- the T-026 data boundary holds: `viewer@demo.local` is denied an insert and
  an update on `projects` by RLS, the row is unchanged, and
  `admin@demo.local` can read the admin-only draft row.

It never seeds, resets, uploads, or writes files. The auth-boundary probe only
attempts writes that RLS is expected to reject; the row is re-read afterwards
to prove nothing changed. Failures print an actionable next step.

### Environment overrides

| Variable | Default | Meaning |
| --- | --- | --- |
| `DEMO_DEV_PORT` | `9000` | Quasar dev server port for `pnpm demo` |
| `CALENDAR_MOCK_PORT` | `8787` | Mock port; the dev proxy reads the same variable |
| `DEMO_BASE_URL` | `http://127.0.0.1:${DEMO_DEV_PORT:-9000}` | Origin probed by `pnpm demo:check` |

Example for a port clash on 9000:

```sh
DEMO_DEV_PORT=9100 pnpm demo
DEMO_BASE_URL=http://127.0.0.1:9100 pnpm demo:check
```

If you change the mock port, pass the same `CALENDAR_MOCK_PORT` to `pnpm demo`
so the dev proxy targets it, and to a standalone `pnpm demo:calendar`.

Open the demo through `http://127.0.0.1:<port>` rather than `localhost`: the dev
server binds IPv4, while `localhost` may resolve to IPv6 on some WSL setups. If
the page renders but stays in loading states and the console says “Supabase is
not configured”, `.env.local` is missing or the dev server was started before
it was written — re-run `pnpm demo` (it rewrites the file before starting Vite).

## Reset semantics

```sh
pnpm demo:reset
```

`supabase db reset` drops the **local** database, replays every migration and
runs `supabase/seed.sql` (the base seed). The script then runs
`bun scripts/demo/setup-demo.ts`, which reapplies the demo dataset, regenerates
and uploads the assets, and recreates the demo users. Fixed UUIDs make the
result deterministic.

`demo:reset` does not start the mock or dev server. If the demo is already
running, refresh the browser; otherwise run `pnpm demo`. It only affects the
local stack — never point it at a hosted project.

## Files, secrets, and generated state

- `apps/web/barykadyKultury/.env.local` — generated by `demo`/`demo:reset`,
  git-ignored, and contains exactly the two browser-safe `VITE_*` values above.
  **No service-role or secret key is ever written to disk by these scripts.**
  The trusted key is read at runtime from `supabase status` inside
  `setup-demo.ts` and stays in process memory.
- `.demo/assets/` — deterministic generated PNG/PDF fixtures. Git-ignored; safe
  to delete because `setup-demo.ts` rebuilds them.
- `.demo/pids/` — PID files used by `demo:stop` to stop only demo-owned
  processes. A stale or foreign PID is removed without being killed.
- `.demo/logs/` — `dev.log` and `calendar-mock.log`. These are the first place
  to look when startup or `demo:check` fails.

`pnpm build` does not read `.demo/`, `.env.local` is ignored, and the demo seed
is never part of the build or the default `db reset` path.

## Troubleshooting

### Docker is not reachable

Start Docker Desktop, enable WSL integration for the distribution you use, and
verify:

```sh
docker info
```

### A port is already in use

The failing command names the port and suggests an override. Inspect the owner
and either stop it or choose another port:

```sh
ss -ltnp | grep :9000
pnpm demo:stop
DEMO_DEV_PORT=9100 pnpm demo
```

For the mock, use `CALENDAR_MOCK_PORT`. The dev proxy reads the same variable,
so the two stay aligned.

### The Supabase CLI is missing

The CLI is a project dependency. Reinstall:

```sh
pnpm --dir apps/web/barykadyKultury install
pnpm --dir apps/web/barykadyKultury exec supabase --version
```

### Stale `.env.local` or stale dev process

`.env.local` is generated and ignored. If the app reports missing Supabase
configuration after a stack change, stop the demo and start it again so Vite
reloads the environment:

```sh
pnpm demo:stop
pnpm demo
```

You can also delete `apps/web/barykadyKultury/.env.local`; `pnpm demo`
recreates it.

### Database reachable but demo content is missing

Run the deterministic rebuild:

```sh
pnpm demo:reset
```

### `/en` does not respond

Check `.demo/logs/dev.log`. The dev server may still be compiling on a slow WSL
filesystem. Wait for the command to report readiness, then refresh. If the port
is held by an unrelated server, `pnpm demo` refuses to reuse it (to avoid stale
credentials) and asks you to free the port or set `DEMO_DEV_PORT`.

### `pnpm demo:stop` seems to do nothing

That is expected when nothing is running: missing PID files and an already
stopped Supabase stack are not errors. Use `--dry-run` to see the shutdown
plan. Processes not started by `pnpm demo` (for example a standalone
`pnpm demo:calendar`) are intentionally not killed.

## Related documents

- `docs/tickets/T-037-demo-environment.md` — ticket scope and acceptance
  criteria.
- `docs/tickets/HANDOFF-S8-2026-10-19.md` — session plan and security notes.
- `docs/TESTING.md` §6 — fixture rules (fictional, no real personal data).
- `docs/architecture.md` §3 (data boundary) and §6 (secrets).
