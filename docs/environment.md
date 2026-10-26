# Environment and deployment contract

**Owner:** T-034 (SEO, metadata, deploy configuration) · **Last reviewed:** 2026-10-26
**Authority:** `docs/architecture.md` §8–§9, `docs/PRODUCT_REQUIREMENTS.md` §2.7 / §8,
`AGENTS.md` rule 4. This file owns the *inventory* of environment variables and the
deployment shape. It contains **names and rules only — never real values**.

`/.env.example` is the copy-paste companion: same names, empty values.

---

## 1. Browser-safe variables

These values are inlined into the client bundle by Vite/Quasar. They must be
publishable by definition: anyone can read them in DevTools.

| Variable | Consumer | Why it is safe |
|---|---|---|
| `VITE_SUPABASE_URL` | `src/boot/supabase.ts` | Public project endpoint. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `src/boot/supabase.ts` | Publishable/anon key. Authorization is enforced by Supabase RLS, not by hiding this key. |
| `VITE_SITE_URL` | SEO guard (`src/features/i18n/localeGuard.ts`), `scripts/generate-seo-files.mjs` | The public origin of the site. Used for canonical / `og:url` / sitemap. Not a credential. |

Rules:

- Only these three names are browser configuration. The one other `VITE_`-style
  name on the platform, `VITE_E2E_CONTACT_FIXTURE`, is a **test-only build
  flag**, not a fourth browser variable: only `playwright.config.ts` sets it,
  only `quasar.config.ts` reads it (via `process.env`), and it is compiled into
  the `__BK_E2E_CONTACT_FIXTURE__` boolean (`false` in every shipped build).
  Application code never reads it from `import.meta.env`, it must never be set
  in Netlify, and it carries no secret (T-032 J7).
- Never rename a server-only variable to `VITE_*` to "make it available". That
  ships the value to every visitor.
- `VITE_SITE_URL` is the single source of truth for absolute URLs. Without it,
  the browser falls back to `location.origin` (correct for previews) and the
  build skips `sitemap.xml` with a warning (see §4).

## 2. Server-only variables

Read from `process.env` at request time by Netlify functions. They are never
bundled, returned to a page, or logged. Configure them in the Netlify UI (or an
untracked local shell); **never** in `apps/web/barykadyKultury/.env.local`.

### Supabase (functions)

| Variable | Used by |
|---|---|
| `SUPABASE_URL` | `readServerSupabaseConfig` (`src/features/import/serverEnv.ts`) |
| `SUPABASE_SERVICE_ROLE_KEY` | same — bypasses RLS; master credential |

Functions fail closed when either name is missing. There is no `VITE_*`
fallback (T-042 review fix, D-41).

### Google Calendar (read-only)

| Variable | Used by |
|---|---|
| `GOOGLE_CALENDAR_ID` | `netlify/functions/calendar-events.ts` |
| `GOOGLE_CALENDAR_API_KEY` | same |

### Google Drive import / sync (T-041, T-042)

| Variable | Used by | Notes |
|---|---|---|
| `GOOGLE_IMPORT_AUTH_MODE` | `googleCredentials.ts` | `per_admin_oauth` (default) or `service_account`. `env_oauth` is a deprecated dev/demo fixture. |
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth flow | |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth flow | Secret. |
| `GOOGLE_OAUTH_REDIRECT_URI` | OAuth flow | Must match the registered redirect exactly. |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | deprecated env-OAuth mode only | Shared credential; not the production model. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | service-account mode | |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | service-account mode | Secret; escaped newlines are normalised in memory. |
| `GOOGLE_SHARED_DRIVE_ID` | service-account mode | |
| `GOOGLE_SHARED_DRIVE_FOLDER_ID` | import scope guard | The one shared NGO folder every import must belong to. |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | refresh-token vault | AES-256-GCM key. Rotation invalidates stored connections. |
| `GOOGLE_PICKER_APP_ID` | Picker session | Public in the response, but server-configured. |
| `GOOGLE_PICKER_API_KEY` | Picker session | Referrer-restricted API key. **Not secret, but still not `VITE_*`** — it is only returned to an authenticated admin. |
| `CONTENT_SYNC_SCHEDULE` | `content-sync-scheduled.ts` | Optional; default `@daily`. |

## 3. Local development

1. `cp .env.example apps/web/barykadyKultury/.env.local` (or create the file).
2. Keep only the three `VITE_*` entries. Leave every server-only value out.
3. Server functions are not run by `pnpm dev`; the Quasar dev server proxies
   `/.netlify/functions/calendar-events` to the Bun mock (T-037). All other
   functions require `netlify dev` or a deployed preview.
4. `VITE_SITE_URL` can stay empty locally: canonicals use `location.origin`.

## 4. Netlify deployment shape

`netlify.toml` at the repository root is authoritative (D-23). The build base is
the repo root so `netlify/functions` stays inside base-path resolution.

| Concern | Value |
|---|---|
| Build command | installs the app workspace with `--frozen-lockfile`, then `pnpm --dir apps/web/barykadyKultury build` |
| Publish directory | `apps/web/barykadyKultury/dist/spa` (Quasar SPA output) |
| Functions directory | `netlify/functions` |
| SPA fallback | `/*` → `/index.html`, status 200, after the `/api/content-check` function redirect |
| Function reachability | `/.netlify/functions/calendar-events` (and the `/api/content-check` shortcut) |

### Environment scopes

Set `VITE_SITE_URL` (absolute origin, no trailing slash) in **Production** and,
if previews should self-canonicalise, in **Deploy previews**. Server-only names
belong in the scopes where their features are enabled; CI never needs them
(TESTING.md §2, architecture §9).

### robots.txt and sitemap.xml

Generated at build time by `scripts/generate-seo-files.mjs`, which runs as part
of `pnpm build`:

- `robots.txt` is always written. It disallows `/*/admin` and `/api/`, and
  appends `Sitemap: <VITE_SITE_URL>/sitemap.xml` when the origin is known.
- `sitemap.xml` expands `src/features/seo/public-paths.json` across `en|pl|uk`
  with `hreflang` alternates and `x-default` → English. A unit test fails if
  that list drifts from the router's static public routes.
- If `VITE_SITE_URL` is unset, `sitemap.xml` is skipped and the build prints a
  warning. A sitemap advertising the wrong host is worse than none.

### Rendering mode (D-10) and sitemap limitation

**D-10 record (T-034, SPA confirmed for V1):** launch stays in Quasar **SPA**
mode with history routing and the Netlify fallback above. Rationale:
architecture §8/§9 already specify an SPA-capable deployment; all data access is
already runtime (Supabase/Calendar functions), so switching to SSG/prerender
would not remove a data dependency. Routes and data access remain
rendering-mode agnostic (no build-time-only assumptions), so prerendering can be
added deliberately later.

Consequence: content-dependent detail URLs (`projects/:slug`,
`publications/:slug`, `about/documents/:slug`) cannot be enumerated at build time
and are **not** in the generated sitemap. Until prerender or a post-publish
sitemap job exists, the manual equivalent is: extend `public-paths.json` only
with static routes; use the Supabase admin export to append published detail
URLs to `dist/spa/sitemap.xml` for a release, or submit them directly in Search
Console. This is a documented limitation, not an oversight. Per-route canonical,
`hreflang` and `og:` metadata *is* emitted for those pages at runtime.

### Security headers and CSP

Headers are configured (not deferred) in `netlify.toml`; the
`<meta http-equiv="Content-Security-Policy">` in `index.html` carries the same
directive set for the production branch. Two documented asymmetries are
intentional, not drift:

1. **`font-src`** — the header declares `font-src 'self'` explicitly; the meta
   omits it and inherits `default-src 'self'`. Same-origin fonts are treated
   identically by both, and `typography.css` documents the inheritance. If a
   cross-origin font host is ever added, add `font-src` to **both**.
2. **Development branch** — the meta tag also has a `ctx.dev` branch that permits
   localhost Supabase/HMR origins. The header always mirrors the **production**
   branch only.

- `default-src 'self'`, `script-src 'self'` plus the Google Picker loader,
  `font-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
  `worker-src 'self' blob:` (import worker), `frame-src` the Docs/Picker hosts.
- `frame-ancestors 'none'`, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- The Supabase source is currently the wildcard `https://*.supabase.co`. It is
  provisional until D-08 pins the hosted project origin; when it changes,
  update **both** the meta policy and `netlify.toml` together.
- `frame-ancestors` only works as a header (a meta tag cannot enforce it), which
  is why it lives solely in `netlify.toml`.
- `style-src` allows `'unsafe-inline'` because Vue/Quasar apply inline style
  bindings (theme tokens, measured reader layout). Remove only after a nonce/hash
  migration.

### Cache policy

- `/assets/*` (content-hashed by Vite): `public, max-age=31536000, immutable`.
- `/fonts/*`: 30 days (filenames are versioned on change).
- `/sitemap.xml`, `/robots.txt`: 1 hour, regenerated per deploy.

## 5. Verification

```bash
pnpm build                                          # Quasar build + SEO file generation
pnpm --dir apps/web/barykadyKultury verify:deploy   # static contract + function reachability
pnpm test:e2e --grep "seo metadata"                 # built-app metadata/robots/sitemap
pnpm test:e2e --grep "deploy runtime"               # function path is not the SPA fallback
```

`verify:deploy` is the documented local equivalent of
`netlify deploy --build --dry`. It runs two stages without a Netlify account or
production data:

1. `verify-deploy-config.mjs` — publish path, SPA fallback order, function
   directory, CSP directives, security headers, **exact** cache/content-type
   values for `sitemap.xml`/`robots.txt`, and secret hygiene.
2. `verify-function-reachability.mjs` — boots the local Netlify Functions v2
   runtime (`scripts/local-function-runtime.mjs`) on an ephemeral loopback port
   and calls `/.netlify/functions/calendar-events`. It asserts a non-404 JSON
   response, the fail-closed `calendar_unavailable` code when server config is
   absent, and that browser-prefixed `VITE_*` lookalikes are ignored (server-env
   boundary).

The Playwright server (`serve-spa.mjs`) executes the same runtime for
`/.netlify/functions/*` **before** the SPA fallback, so
`pnpm test:e2e --grep "deploy runtime"` provides E2E reachability evidence and
proves an unknown function path is a JSON 404, never `index.html`.

## 6. Secret-handling rules (summary)

1. No secret in client code, `VITE_*`, or `netlify.toml`.
2. The service-role key is read only inside functions and never written to
   `.env.local` (T-037 also keeps it out of the demo environment file).
3. Rotate `GOOGLE_TOKEN_ENCRYPTION_KEY` only with a plan for reconnecting every
   stored Google account.
4. If a value leaks, rotate it at the provider — removing it from git history is
   not sufficient.
