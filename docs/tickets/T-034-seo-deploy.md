# T-034 — SEO, metadata, deploy configuration

**Session:** 7 · **Lane:** release · **Owner:** @coder · **Status:** done
**Reviewers:** @reviewer (rev-1 FIX + fixes verified) + @architector (PASS + D-10 recorded)
**Depends on:** T-025, T-032, D-10 · **Blocks:** T-035

## Outcome
Every route exposes correct language/title/description metadata, the site deploys to Netlify with the calendar function and environment configuration, and the rendering-mode decision is recorded and applied.

## Scope
In:
- Per-route metadata: `<title>`, meta description, canonical URL with locale, `og:*`, `hreflang` alternates for en/pl/uk + `x-default`.
- `document.documentElement.lang` correctness verified across navigation (already covered in T-009; re-check).
- `robots.txt`, `sitemap.xml` generation from published routes (or a documented manual equivalent if prerender is deferred), favicons/manifest from brand assets.
- Netlify: `netlify.toml` build command, publish dir `apps/web/barykadyKultury/dist/spa`, SPA redirect, functions directory, security headers (CSP considered — document if deferred), cache headers for assets.
- Env documentation: `docs/environment.md` listing browser-safe vs server-only variables, with no real values; `.env.example`.
- D-10 decision recorded; if prerender/SSG is chosen, minimal config that keeps routes/data rendering-mode agnostic and a documented build change.
- Verification: `netlify build` equivalent locally, function reachable, headers present.

Out: analytics, consent management, social accounts, CDN tuning.

## Design constraints
- `docs/architecture.md` §8 (document lang/title/description/link metadata), §9 (publish dir, fallback, env separation).
- `docs/PRODUCT_REQUIREMENTS.md` §2.7, §8.
- `AGENTS.md` rule 4 (no secrets in client or `VITE_*`).

## TDD plan
1. RED: E2E assertions — each route has a non-empty title, description, canonical, and matching `html[lang]`; current build fails for at least one route.
2. GREEN: implement meta helper + head management.
3. RED: `hreflang` assertions for three locales + `x-default`.
4. GREEN: add alternates; then deploy config verified with a local `netlify` run or a documented manual header check.

## Acceptance criteria
- [ ] Every public route has locale-correct title, description, canonical, and hreflang set.
- [ ] Login-required routes are `noindex`.
- [ ] SPA deep links work on Netlify (redirect verified).
- [ ] Calendar function is reachable at the documented path and reads only server env.
- [ ] `docs/environment.md` + `.env.example` complete, no real values.
- [ ] Security headers configured or explicitly deferred with rationale.
- [ ] Build output path matches `netlify.toml`.

## Verification
```
pnpm build
pnpm test:e2e --grep "metadata"
netlify deploy --build --dry   # or documented equivalent
```

## Review gate
- @reviewer: metadata accuracy (no invented descriptions), secret hygiene, no noindex on public pages.
- @architector: deployment shape matches §9; D-10 decision recorded.

## Log
- (author) start:
- 2026-10-26 (@coder) implementation complete; validation gates (reviewer/architector) pending.

### Acceptance status

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Every public route has locale-correct title, description, canonical, hreflang | done | `e2e/seo-metadata.spec.ts` iterates 7 routes × en/pl/uk: title, description, `html[lang]`, canonical, `og:url`/`og:title`, 3 hreflang + `x-default`. Unit: `seoHead.test.ts` (canonical shape, prefix swap, query-free reader URLs). |
| 2 | Login-required routes are `noindex` | done | `meta.noindex` on the admin parent (inherited by every child) + both 404 records; `seoHead` suppresses canonical/hreflang for noindex. E2E asserts sign-in and the `/pl/admin` → sign-in redirect are `noindex, nofollow` with no canonical. |
| 3 | SPA deep links work on Netlify | done | `/*` → `/index.html` status 200 present and ordered after `/api/content-check`; checked by `verify:deploy` (25 checks) and exercised locally by the Playwright build + `serve-spa.mjs` history fallback. |
| 4 | Calendar function reachable; server env only | verified (unchanged) | `netlify/functions/calendar-events.ts` reads `GOOGLE_CALENDAR_ID`/`GOOGLE_CALENDAR_API_KEY` from `process.env` per request; no `VITE_*` fallback (T-042 boundary). Path documented in `docs/environment.md` §4. No code change needed. |
| 5 | `docs/environment.md` + `.env.example`, no real values | done | New `docs/environment.md` (browser-safe vs server-only tables, deploy contract) and root `.env.example` (names only). Secret hygiene also asserted by `verify:deploy`. |
| 6 | Security headers configured or deferred with rationale | done (configured) | CSP + `X-Frame-Options`/`nosniff`/`Referrer-Policy`/`Permissions-Policy` already in `netlify.toml`; rationale, meta/header mirroring and the provisional `*.supabase.co` source recorded in `docs/environment.md` §4. Added 1-hour cache + explicit content types for `robots.txt`/`sitemap.xml`. |
| 7 | Build output path matches `netlify.toml` | done | `pnpm build` reports `dist/spa` at `apps/web/barykadyKultury/dist/spa`; `verify:deploy` asserts the publish value, build command, base and functions path. |

Favicons/manifest verification: the existing brand favicons (SVG + 16/32/96/128 PNG +
`favicon.ico` + apple-touch) were already wired in `index.html`. T-034 adds the
missing `public/manifest.webmanifest` using only those existing assets plus the
D-13 brand colours; it does **not** add a service worker and keeps
`display: "browser"` because V1 has no offline/installability requirement.

### D-10 record (rendering mode)

**Decision: SPA for V1 (status quo confirmed, not changed).** Rationale: architecture
§8/§9 already specify an SPA-capable Netlify deployment; every data source is
runtime (Supabase + Calendar functions), so prerender/SSG would not remove a
dependency, and routes/data access stay rendering-mode agnostic for a later,
deliberate prerender. Consequence recorded in `docs/environment.md` §4:
content-dependent detail URLs cannot be enumerated at build time and are
therefore absent from the generated sitemap; static routes are complete, and
canonical/hreflang/OG are still emitted per detail page at runtime. The
`DECISIONS.md` D-10 row is intentionally left for the @architector gate (this
ticket's docs edit scope was limited to this Log + the new environment doc).

### Deferred / known limitations

- Dynamic sitemap entries (`projects/:slug`, `publications/:slug`,
  `about/documents/:slug`) need prerender or a post-publish sitemap job. Manual
  equivalent documented in `docs/environment.md`.
- `og:image` / social card is not emitted: no brand-approved social image asset
  exists, and inventing one would violate AGENTS.md rule 6. Add when supplied.
- `VITE_SITE_URL` must be set in Netlify production/preview scopes; without it
  canonicals fall back to `location.origin` and the build skips `sitemap.xml`
  with a warning (deliberate: a wrong-host sitemap is worse than none).
- The Supabase CSP source remains the `https://*.supabase.co` wildcard until
  D-08 pins the hosted origin (update meta + header together).
- `netlify deploy --build --dry` was replaced by the documented local equivalent
  `pnpm verify:deploy` (no account/network needed); full Netlify runtime
  behaviour still needs a preview deploy in T-035.

### Files changed

- `apps/web/barykadyKultury/src/features/seo/seoHead.ts` (new) — pure
  canonical/hreflang/OG builder + idempotent DOM writer.
- `apps/web/barykadyKultury/src/features/seo/publicPaths.ts` +
  `public-paths.json` (new) — sitemap source shared by app and generator.
- `apps/web/barykadyKultury/src/features/seo/__tests__/seoHead.test.ts`,
  `publicPaths.test.ts` (new).
- `apps/web/barykadyKultury/src/features/i18n/localeGuard.ts` — applies the SEO
  graph per navigation; optional `siteUrl` dependency.
- `apps/web/barykadyKultury/src/router/index.ts` — wires `VITE_SITE_URL`.
- `apps/web/barykadyKultury/src/router/routes.ts` — `RouteMeta.noindex`; admin
  parent + both 404 records set it.
- `apps/web/barykadyKultury/e2e/seo-metadata.spec.ts` (new).
- `apps/web/barykadyKultury/scripts/generate-seo-files.mjs` (new) —
  robots/sitemap generator, runs inside `pnpm build`.
- `apps/web/barykadyKultury/scripts/verify-deploy-config.mjs` (new).
- `apps/web/barykadyKultury/scripts/serve-spa.mjs` — `.txt`/`.xml`/`.webmanifest`
  MIME types.
- `apps/web/barykadyKultury/public/manifest.webmanifest` (new) and `index.html`
  manifest link — icons reuse the existing brand assets.
- `apps/web/barykadyKultury/package.json` — `build` runs the SEO generator;
  `seo:build`, `verify:deploy` scripts.
- `apps/web/barykadyKultury/playwright.config.ts` — deterministic
  `VITE_SITE_URL` for the E2E build.
- `apps/web/barykadyKultury/env.d.ts` — `VITE_SITE_URL` typing.
- `netlify.toml` — cache/content-type headers for `robots.txt`, `sitemap.xml`,
  and the manifest content type.
- `.env.example` (new, root), `docs/environment.md` (new).

### Verification evidence

- RED: `seoHead.test.ts` failed to resolve `@/features/seo/seoHead`; all three
  `seo-metadata` E2E cases failed (missing canonical, no robots meta, no
  sitemap) against the pre-change build.
- RED (manifest): the new manifest/icons E2E case failed because
  `link[rel="manifest"]` did not exist.
- GREEN: `pnpm test:e2e --grep "seo metadata"` → 4 passed; combined
  `page-meta.spec.ts` + `locale.spec.ts` + `seo-metadata.spec.ts` → 13 passed
  (before the manifest case was added).
- `pnpm test` (full unit suite) → 170 passed / 1682 tests.
- `pnpm typecheck` → clean; `pnpm lint:check` → clean.
- `pnpm build` → succeeded; output `apps/web/barykadyKultury/dist/spa`; writes
  `robots.txt` (warns and skips `sitemap.xml` when `VITE_SITE_URL` is unset).
- `pnpm --dir apps/web/barykadyKultury verify:deploy` → 25/25 deployment checks
  passed (publish dir, SPA fallback order, functions dir, CSP, headers, caching,
  manifest content type, secret hygiene).

### Gate fix batch (2026-10-26, @coder)

Addresses reviewer FIX items and architector S4 lows. No commits.

1. **Exact cache assertions (reviewer Major/Standards).**
   `verify-deploy-config.mjs` now extracts each `[[headers]]` block and compares
   literal `Cache-Control`/`Content-Type` values for `/sitemap.xml` and
   `/robots.txt` instead of checking only that the block exists.
   RED: expected `max-age=86400` temporarily → 1/28 failed with the actual
   `public, max-age=3600` shown. GREEN: 28/28 checks passed.
2. **Calendar reachability (reviewer Major/Spec).**
   Added `scripts/local-function-runtime.mjs` (Netlify Functions v2 local
   equivalent: executes the real binding at
   `/.netlify/functions/calendar-events`) and `scripts/resolve-ts.mjs` (ESM
   extension resolution + TypeScript transpilation). `pnpm verify:deploy` now
   also runs `scripts/verify-function-reachability.mjs` → 6 checks: non-404,
   JSON (not HTML), fail-closed `calendar_unavailable` with no server config,
   `VITE_*` lookalikes ignored, HEAD parity, POST 405. `serve-spa.mjs` routes
   `/.netlify/functions/*` before the SPA fallback, and
   `e2e/deploy-runtime.spec.ts` provides E2E evidence (2 tests).
   RED: with function routing disabled, both deploy-runtime tests failed because
   the SPA returned `index.html`; restored → 2 passed.
3. **E2E matrix derived from the shared source (reviewer Suggestion).**
   `e2e/seo-metadata.spec.ts` reads `src/features/seo/public-paths.json` with
   `node:fs` instead of duplicating the route list; the 21-combination matrix is
   unchanged and still green.
4. **Documentation accuracy (architector S4 lows).**
   `docs/environment.md` now documents the two intentional CSP asymmetries
   (explicit header `font-src 'self'` vs meta `default-src` inheritance; the
   meta's dev-only branch) and calls out `VITE_E2E_CONTACT_FIXTURE` as a
   Playwright-only build flag compiled to `__BK_E2E_CONTACT_FIXTURE__`, never a
   Netlify/browser variable. The `netlify.toml` CSP comment was corrected to
   match that wording. Verification commands updated with the deploy-runtime grep.

Files touched in this batch:
- `apps/web/barykadyKultury/scripts/verify-deploy-config.mjs`
- `apps/web/barykadyKultury/scripts/local-function-runtime.mjs` (new)
- `apps/web/barykadyKultury/scripts/resolve-ts.mjs` (new)
- `apps/web/barykadyKultury/scripts/verify-function-reachability.mjs` (new)
- `apps/web/barykadyKultury/scripts/serve-spa.mjs`
- `apps/web/barykadyKultury/e2e/deploy-runtime.spec.ts` (new)
- `apps/web/barykadyKultury/e2e/seo-metadata.spec.ts`
- `apps/web/barykadyKultury/playwright.config.ts`
- `apps/web/barykadyKultury/package.json`
- `netlify.toml`
- `docs/environment.md`

Gate-fix evidence: `verify:deploy` → **28 config + 6 reachability checks passed**;
`playwright e2e/seo-metadata.spec.ts e2e/deploy-runtime.spec.ts` → **6 passed**;
`pnpm typecheck` clean; `pnpm lint:check` clean.
