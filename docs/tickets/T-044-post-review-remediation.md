# T-044 — Post-review remediation: security, performance, readability

**Session:** 11 · **Owner:** @coder (data/security/perf) + @designer (readability/UI)
**Reviewers:** @reviewer + @architector
**Sources:** security review (arc-3), performance review (analyzer), readability review (rev-2), all 2026-10-21.

## Outcome

Apply the must-fixes and high-ROI findings from the three reviews without changing
product behavior.

## Security must-fixes

1. **Stop exposing private source metadata to public readers.**
   - Remove `source_path`, `source_external_id` (and the public `ReaderSourceMeta`)
     from `features/reader` selects, mapping, types and tests. Keep the columns
     server/admin-only for T-041/T-042 signed downloads.
2. **Response-level security headers** in `netlify.toml`:
   - CSP header (same policy as the meta, plus `frame-ancestors 'none'`),
     `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
     `Referrer-Policy: strict-origin-when-cross-origin`,
     `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
   - Immutable `Cache-Control` for `/assets/*`; long-lived for `/fonts/*`;
     index HTML remains revalidated.
   - Keep the meta CSP for dev; production gets the header.
3. Pin the hosted Supabase origin in CSP when D-08 supplies it (deferred to
   T-034; wildcard stays for now with a comment).

## Performance fixes

- **F1 (critical):** route-level lazy imports for every page and the admin
  subtree; verify the home entry chunk shrinks and admin code is in separate
  chunks. (`router/routes.ts`; no product change.)
- **F3 (major):** lean listing projections for projects/publications/documents
  (no `body`/`body_ast` on list queries); detail queries keep the full payload.
- **F4b:** remove `material-icons` from Quasar extras (zero `qi-*` usage;
  125 KB unused font).
- **F5:** immutable asset cache headers (above).
- **F6:** memoize `LocalizedRichText` parsing with a `computed` keyed on
  content/offset.
- **F2 (deferred):** unify publication-detail's 2–3 heavy queries into one
  reader-shaped fetch; tied to T-041 import volume. Recorded as follow-up.
- **F4 CSS tree-shaking / test-pipeline tuning:** follow-up (needs a separate
  spike; do not destabilize the build now).

## Readability fixes

- `AppHeader` brand link: use `RouterLink` (no `@click.prevent` on a real
  anchor; preserve modified-click behavior).
- `SiteSearch`: restore focus through a local trigger `ref`, not a global
  `document.querySelector`.
- Extract the configured-social-links predicate/helper and reuse it in
  `SocialLinks` and `contact.vue`.
- Replace the platform icon `v-if` chain with a typed map (if not already).
- Trim historical/changelog comments in `AppHeader`; keep intent/why only.

## Out of scope

- T-041/T-042 import/Google sync.
- Hosted Supabase CSP pinning (T-034).
- Full Quasar CSS tree-shaking and Vitest/Playwright pipeline tuning (separate
  performance spike).
- Any visual redesign.

## Acceptance

- [ ] Reader API/payload contains no private storage keys or provider file IDs.
- [ ] Production headers include CSP + frame-ancestors + XFO + nosniff +
      referrer/permissions policies; hashed assets immutable.
- [ ] Home entry JS is materially smaller; admin code is not in the public
      entry chunk.
- [ ] Listing queries no longer fetch full bodies; detail payloads unchanged.
- [ ] Material Icons removed; rich text parse memoized.
- [ ] AppHeader brand is a real RouterLink; search focus uses a local ref;
      social predicate is shared.
- [ ] Full unit/typecheck/lint/build/E2E, pgTAP, idempotency, demo:check.

## Verification

```
pnpm test && pnpm typecheck && pnpm lint:check && pnpm build
pnpm test:e2e --workers=1
supabase test db && pnpm test:db:idempotency
pnpm demo:reset && pnpm demo:check
```

## Log

- (author) start:
- (session 11) Implemented the security must-fixes (reader source metadata
  removed from public payloads; Netlify CSP/frame-ancestors/XFO/nosniff/
  referrer/permissions headers + immutable asset/font caching), performance
  quick wins (route-level lazy imports: entry JS ~557→360 KB, admin/reader/
  search split; lean list projections; Material Icons removed; rich-text parse
  memoized) and readability fixes (RouterLink brand, local search trigger ref,
  shared social predicate, typed icon map, comments trimmed).
- Deferred with evidence: **F2** unify publication-detail's 2–3 heavy queries
  (tied to T-041 content volume) and **F4** Quasar CSS tree-shaking /
  Vitest-Playwright pipeline tuning. Both are follow-ups, not release blockers.
- Verified: 1065 unit, 136 E2E, 397 pgTAP, typecheck, lint, build, base-seed
  idempotency, demo:check, and a live smoke (lazy navigation, social links,
  reader, 320 px search close, no console errors).
