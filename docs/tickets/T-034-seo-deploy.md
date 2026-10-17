# T-034 — SEO, metadata, deploy configuration

**Session:** 7 · **Lane:** release · **Owner:** @coder · **Status:** todo
**Reviewers:** @reviewer + @architector
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
