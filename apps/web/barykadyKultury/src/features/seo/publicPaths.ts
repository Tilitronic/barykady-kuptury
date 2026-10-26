import paths from "./public-paths.json";

/**
 * T-034 — the indexable, statically-known public destinations.
 *
 * Locale-less form: the sitemap generator expands every entry across `en|pl|uk`.
 * This is deliberately a JSON file because it has two consumers with different
 * runtimes:
 *   - the app (parity test against the real route table);
 *   - `scripts/generate-seo-files.mjs` (plain Node, no TypeScript loader).
 *
 * Exclusions (documented because silence looks like an oversight):
 *   - `/about/team` and `/about/documents` are redirects into the consolidated
 *     About page (T-039, D-25); redirecting URLs must not be in a sitemap.
 *   - `projects/:slug`, `publications/:slug`, `about/documents/:slug` are
 *     content-dependent. With SPA rendering (D-10) their published set is only
 *     known at request time, so they are deferred to the documented manual /
 *     future prerender sitemap step (see docs/environment.md).
 *   - admin and not-found routes are noindex.
 *
 * `publicPaths.test.ts` fails when a static public route is added or removed
 * without updating this file, so the sitemap cannot silently drift.
 */
export const PUBLIC_SITE_PATHS: readonly string[] = paths;
