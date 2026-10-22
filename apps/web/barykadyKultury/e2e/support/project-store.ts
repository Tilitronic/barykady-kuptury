import type { Page, Route } from "@playwright/test";

/**
 * T-027 — stateful, deterministic PostgREST mock for project CRUD.
 *
 * docs/TESTING.md §2 forbids E2E tests from touching a live Supabase project,
 * and the T-027 journeys are the first to *write*. A read-only fixture cannot
 * prove "create → publish → appears publicly", so this helper implements the
 * small slice of PostgREST the admin module uses (select/filter/insert/update/
 * upsert/delete) over an in-memory store shared by the admin and anonymous
 * pages. It is deliberately not a database: it applies `eq` filters, embeds
 * `project_translations`, and mirrors RLS's *observable* effect by trusting the
 * app's own `status=eq.published` narrowing on public reads (the RLS proof
 * itself lives in `supabase/tests/rls_content_matrix_test.sql`).
 */

export interface ProjectStoreRow {
  id: string;
  slug: string;
  status: "draft" | "published" | "archived";
  featured_rank: number | null;
  cover_path: string | null;
  start_date: string | null;
  end_date: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectTranslationRow {
  id: string;
  project_id: string;
  locale: "en" | "pl" | "uk";
  title: string;
  summary: string | null;
  body: string | null;
}

export interface ProjectStore {
  projects: ProjectStoreRow[];
  translations: ProjectTranslationRow[];
}

/** A deterministic, empty store (the journeys create their own rows). */
export function createProjectStore(
  seed: Partial<ProjectStore> = {}
): ProjectStore {
  return {
    projects: [...(seed.projects ?? [])],
    translations: [...(seed.translations ?? [])]
  };
}

let idCounter = 0;

/** Deterministic ids keep failures readable (no random UUIDs in the store). */
function nextId(): string {
  idCounter += 1;
  return `e2e00000-0000-4000-8000-${String(idCounter).padStart(12, "0")}`;
}

const FIXED_TIMESTAMP = "2026-06-01T12:00:00.000Z";

function withTranslations(store: ProjectStore, row: ProjectStoreRow) {
  return {
    ...row,
    project_translations: store.translations.filter(
      translation => translation.project_id === row.id
    )
  };
}

/** Stringifies a cell for comparison/sorting without `[object Object]`. */
function comparable(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value) ?? "";
}

/** Applies the `eq.` filters a PostgREST query would (ignoring relations). */
function applyFilters(
  rows: readonly Record<string, unknown>[],
  params: URLSearchParams
): Record<string, unknown>[] {
  return rows.filter(row =>
    [...params.entries()].every(([key, value]) => {
      if (!value.startsWith("eq.") || key.includes(".")) return true;
      const expected = value.slice(3);
      const actual = row[key];
      return actual === undefined || comparable(actual) === expected;
    })
  );
}

function sortRows(
  rows: readonly Record<string, unknown>[],
  order: string | null
): Record<string, unknown>[] {
  if (!order) return [...rows];
  const [column, direction] = order.split(".");
  return [...rows].sort((a, b) => {
    const left = comparable(a[column ?? ""]);
    const right = comparable(b[column ?? ""]);
    const comparison = left.localeCompare(right);
    return direction === "asc" ? comparison : -comparison;
  });
}

function wantsSingleObject(route: Route): boolean {
  return route.request().headers()["accept"]?.includes("pgrst.object") ?? false;
}

function respond(route: Route, rows: unknown[], status = 200): Promise<void> {
  const payload = wantsSingleObject(route) ? (rows[0] ?? null) : rows;
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload)
  });
}

async function handleProjects(
  route: Route,
  store: ProjectStore,
  params: URLSearchParams
): Promise<void> {
  const method = route.request().method();

  if (method === "GET") {
    const rows = sortRows(
      applyFilters(
        store.projects.map(row => withTranslations(store, row)),
        params
      ),
      params.get("order")
    );
    await respond(route, rows);
    return;
  }

  if (method === "POST") {
    const body = route.request().postDataJSON() as
      | Partial<ProjectStoreRow>
      | Partial<ProjectStoreRow>[];
    const input = Array.isArray(body) ? body : [body];
    const created = input.map(item => {
      const row: ProjectStoreRow = {
        id: item.id ?? nextId(),
        slug: item.slug ?? "",
        status: item.status ?? "draft",
        featured_rank: item.featured_rank ?? null,
        cover_path: item.cover_path ?? null,
        start_date: item.start_date ?? null,
        end_date: item.end_date ?? null,
        published_at: item.published_at ?? null,
        created_at: FIXED_TIMESTAMP,
        updated_at: FIXED_TIMESTAMP
      };
      store.projects.push(row);
      return row;
    });
    await respond(route, created, 201);
    return;
  }

  if (method === "PATCH") {
    const patch = route.request().postDataJSON() as Partial<ProjectStoreRow>;
    const id = params.get("id")?.replace("eq.", "");
    const updated = store.projects
      .filter(row => id === undefined || row.id === id)
      .map(row => {
        Object.assign(row, patch, { updated_at: FIXED_TIMESTAMP });
        return row;
      });
    await respond(route, updated);
    return;
  }

  if (method === "DELETE") {
    const id = params.get("id")?.replace("eq.", "");
    store.projects = store.projects.filter(
      row => id !== undefined && row.id !== id
    );
    store.translations = store.translations.filter(
      translation => translation.project_id !== id
    );
    await respond(route, []);
    return;
  }

  await route.fulfill({ status: 405, body: "" });
}

async function handleTranslations(
  route: Route,
  store: ProjectStore,
  params: URLSearchParams
): Promise<void> {
  const method = route.request().method();

  if (method === "GET") {
    await respond(
      route,
      applyFilters(
        store.translations as unknown as Record<string, unknown>[],
        params
      )
    );
    return;
  }

  if (method === "POST") {
    const body = route.request().postDataJSON() as
      | Partial<ProjectTranslationRow>
      | Partial<ProjectTranslationRow>[];
    const input = Array.isArray(body) ? body : [body];
    const written = input.map(item => {
      // Upsert semantics keyed by (project_id, locale) — the constraint the
      // real table declares.
      const existing = store.translations.find(
        row => row.project_id === item.project_id && row.locale === item.locale
      );
      if (existing) {
        Object.assign(existing, item);
        return existing;
      }
      const row: ProjectTranslationRow = {
        id: nextId(),
        project_id: item.project_id ?? "",
        locale: item.locale ?? "en",
        title: item.title ?? "",
        summary: item.summary ?? null,
        body: item.body ?? null
      };
      store.translations.push(row);
      return row;
    });
    await respond(route, written, 201);
    return;
  }

  if (method === "DELETE") {
    const projectId = params.get("project_id")?.replace("eq.", "");
    const locale = params.get("locale")?.replace("eq.", "");
    store.translations = store.translations.filter(
      row =>
        !(
          (projectId === undefined || row.project_id === projectId) &&
          (locale === undefined || row.locale === locale)
        )
    );
    await respond(route, []);
    return;
  }

  await route.fulfill({ status: 405, body: "" });
}

/**
 * Installs the project/translation/storage handlers on `page`. The same `store`
 * may be installed on several pages (for example an admin page and an anonymous
 * context) so a write is visible to the public read.
 */
export async function mockProjectApi(
  page: Page,
  store: ProjectStore
): Promise<void> {
  await page.route("**/rest/v1/projects*", async (route: Route) => {
    const url = new URL(route.request().url());
    await handleProjects(route, store, url.searchParams);
  });

  await page.route("**/rest/v1/project_translations*", async (route: Route) => {
    const url = new URL(route.request().url());
    await handleTranslations(route, store, url.searchParams);
  });

  // Cover uploads: accept the object and return the storage envelope. The
  // journey does not assert the stored bytes, only that the write succeeded.
  await page.route("**/storage/v1/object/**", async (route: Route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ Key: "public-media/projects/e2e-cover.png" })
      });
      return;
    }
    await route.fulfill({ status: 404, body: "" });
  });
}
