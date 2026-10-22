import type { Page, Route } from "@playwright/test";

/**
 * T-046 gate fix — deterministic, scoped stand-in for the publication feature
 * API and the project mutation RPCs.
 *
 * Why this exists: the T-046 acceptance criterion is "a scoped editor completes
 * their journeys", not "a scoped editor can open a route". The publication
 * admin UI is owned by T-029 and does not exist yet, so the journey is driven
 * at the same wire boundary the feature API uses —
 * `src/features/import/persistConvertedTranslation.ts` posts
 * `persist_reader_import_v1` (and `src/features/admin/projects/api.ts` posts
 * `save_project_v1`). This helper answers those RPCs from the scoped session's
 * bearer token and persists a published row into an in-memory store so the
 * public listing can read it back.
 *
 * It is deliberately NOT a database. It mirrors the *observable* contract the
 * database enforces (allow `publications:write`, deny `projects:write` without
 * the capability); the authorization proof itself lives in
 * `supabase/tests/scoped_admin_matrix_test.sql`. The mock exists so the E2E
 * cannot pass with an unscoped session or a no-op write.
 */

export interface PublicationTranslationRow {
  locale: "en" | "pl" | "uk";
  title: string;
  abstract: string | null;
  authors: string | null;
}

export interface PublicationStoreRow {
  id: string;
  slug: string;
  status: "draft" | "published" | "archived";
  language: "en" | "pl" | "uk" | null;
  publication_date: string | null;
  external_url: string | null;
  sort_order: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  publication_translations: PublicationTranslationRow[];
  publication_files: unknown[];
}

export interface PublicationStore {
  publications: PublicationStoreRow[];
}

const FIXED_TIMESTAMP = "2026-06-01T12:00:00.000Z";

/** A deterministic, empty store (the journey creates its own row). */
export function createPublicationStore(
  seed: Partial<PublicationStore> = {}
): PublicationStore {
  return { publications: [...(seed.publications ?? [])] };
}

/** The `persist_reader_import_v1` argument slice the journey sends. */
export interface PersistImportRpcArgs {
  p_kind: "document" | "publication";
  p_entity_id: string | null;
  p_slug: string;
  p_locale: "en" | "pl" | "uk";
  p_title: string;
  p_description: string | null;
  p_status: "draft" | "published" | "archived";
}

function rpcFailure(
  route: Route,
  status: number,
  code: string,
  message: string
): Promise<void> {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({ code, message, details: null, hint: null })
  });
}

/**
 * Reads the bearer token supabase-js persisted after the mocked sign-in. The
 * storage key is derived from the project URL, so the helper scans for the
 * `-auth-token` suffix instead of hard-coding it.
 */
export async function readSupabaseAccessToken(page: Page): Promise<string> {
  return page.evaluate(() => {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.endsWith("-auth-token")) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as { access_token?: unknown };
        if (typeof parsed.access_token === "string") return parsed.access_token;
      } catch {
        // Not the session envelope; keep scanning.
      }
    }
    return "";
  });
}

export interface ScopedContentApiOptions {
  /**
   * The capabilities the signed-in fixture actually carries. Keeping this in
   * the test (not inferred from the request) means an unscoped session cannot
   * silently pass the mutation assertion.
   */
  scopesForToken: (token: string) => readonly string[];
}

/**
 * Installs the publication + project RPC handlers. Register this AFTER
 * `mockSupabaseRest` so these more specific routes win (Playwright consults
 * the most recently registered match first).
 */
export async function mockScopedContentApi(
  page: Page,
  store: PublicationStore,
  options: ScopedContentApiOptions
): Promise<void> {
  await page.route(
    "**/rest/v1/rpc/persist_reader_import_v1",
    async (route: Route) => {
      const token = (route.request().headers()["authorization"] ?? "").replace(
        /^Bearer\s+/i,
        ""
      );
      const scopes = options.scopesForToken(token);

      if (!scopes.includes("publications:write")) {
        await rpcFailure(
          route,
          403,
          "42501",
          "admin role or publications:write capability required"
        );
        return;
      }

      const args = route.request().postDataJSON() as PersistImportRpcArgs;
      const row: PublicationStoreRow = {
        id: `e2e04600-0000-4000-8000-${String(store.publications.length + 1).padStart(12, "0")}`,
        slug: args.p_slug,
        status: args.p_status,
        language: args.p_locale,
        publication_date: null,
        external_url: null,
        sort_order: 0,
        published_at: args.p_status === "published" ? FIXED_TIMESTAMP : null,
        created_at: FIXED_TIMESTAMP,
        updated_at: FIXED_TIMESTAMP,
        publication_translations: [
          {
            locale: args.p_locale,
            title: args.p_title,
            abstract: args.p_description,
            authors: null
          }
        ],
        publication_files: []
      };
      store.publications.push(row);

      // A scalar-returning PostgREST function responds with a JSON string.
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(row.id)
      });
    }
  );

  await page.route("**/rest/v1/rpc/save_project_v1", async (route: Route) => {
    const token = (route.request().headers()["authorization"] ?? "").replace(
      /^Bearer\s+/i,
      ""
    );
    const scopes = options.scopesForToken(token);

    if (!scopes.includes("projects:write")) {
      await rpcFailure(
        route,
        403,
        "42501",
        "admin role or projects:write capability required"
      );
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify("e2e-scoped-project")
    });
  });
}
