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

/** Mirrors the D-24 canonical slug check on public.projects. */
const CANONICAL_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface SaveProjectRpcInput {
  p_id?: string | null;
  p_slug: string;
  p_status: ProjectStoreRow["status"];
  p_featured_rank?: number | null;
  p_cover_path?: string | null;
  p_start_date?: string | null;
  p_end_date?: string | null;
  p_published_at?: string | null;
  p_translations?: {
    locale: ProjectTranslationRow["locale"];
    title: string;
    summary: string | null;
    body: string | null;
  }[];
}

interface MockRpcFailure {
  readonly status: number;
  readonly code: string;
  readonly message: string;
}

/**
 * Deep-enough copy for the write paths: every mutation replaces scalar fields
 * on root/translation rows, never nested structures, so one level is enough.
 */
function cloneProjectStore(store: ProjectStore): ProjectStore {
  return {
    projects: store.projects.map(row => ({ ...row })),
    translations: store.translations.map(row => ({ ...row }))
  };
}

function respondRpcFailure(
  route: Route,
  failure: MockRpcFailure
): Promise<void> {
  return route.fulfill({
    status: failure.status,
    contentType: "application/json",
    body: JSON.stringify({
      code: failure.code,
      message: failure.message,
      details: null,
      hint: null
    })
  });
}

function withTranslations(store: ProjectStore, row: ProjectStoreRow) {
  return {
    ...row,
    project_translations: store.translations.filter(
      translation => translation.project_id === row.id
    )
  };
}

/**
 * T-030 — dense 1..n featured ranks, mirroring the database trigger: only
 * published rows keep a rank; order is the current rank, then created_at/id.
 */
function densifyFeaturedRanks(store: ProjectStore): void {
  const ordered = store.projects
    .filter(row => row.status === "published" && row.featured_rank !== null)
    .sort(
      (a, b) =>
        (a.featured_rank ?? 0) - (b.featured_rank ?? 0) ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id)
    );

  ordered.forEach((row, index) => {
    row.featured_rank = index + 1;
  });
}

function nextFeaturedRank(store: ProjectStore): number {
  return (
    store.projects.reduce(
      (max, row) => Math.max(max, row.featured_rank ?? 0),
      0
    ) + 1
  );
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
    densifyFeaturedRanks(store);
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
 * T-045 — transactional save RPC stand-in. The admin module now sends one
 * request (`save_project_v1`) instead of separate root/translation writes, so
 * the mock applies the same all-or-nothing intent to the in-memory store.
 *
 * All mutations are staged on a copy and committed only after every row has
 * been validated. That mirrors the database function: a failure while staging
 * (for example a blank translation title, or a duplicate slug) leaves the real
 * store untouched, so E2E cannot accidentally prove a partial-write behaviour.
 */
function stageSaveProject(
  source: ProjectStore,
  args: SaveProjectRpcInput
):
  | {
      readonly ok: true;
      readonly next: ProjectStore;
      readonly row: ProjectStoreRow;
    }
  | { readonly ok: false; readonly failure: MockRpcFailure } {
  const next = cloneProjectStore(source);

  if (typeof args.p_slug !== "string" || !CANONICAL_SLUG.test(args.p_slug)) {
    return {
      ok: false,
      failure: { status: 400, code: "23514", message: "invalid canonical slug" }
    };
  }

  // The database check constraint rejects a published row without a timestamp.
  if (args.p_status === "published" && !args.p_published_at) {
    return {
      ok: false,
      failure: {
        status: 400,
        code: "23514",
        message: "published_at is required for a published project"
      }
    };
  }

  // The unique slug constraint excludes the row being updated.
  if (
    next.projects.some(
      candidate => candidate.slug === args.p_slug && candidate.id !== args.p_id
    )
  ) {
    return {
      ok: false,
      failure: {
        status: 409,
        code: "23505",
        message: "duplicate canonical slug"
      }
    };
  }

  const existingRow = next.projects.find(
    candidate => candidate.id === args.p_id
  );
  // T-030 normalization: drafts cannot be featured; an already-featured row
  // keeps its slot (order is owned by the reorder RPC); a newly featured row
  // appends. Mirrors save_project_v1.
  const featuredRank =
    args.p_status !== "published" || args.p_featured_rank === null
      ? null
      : (existingRow?.featured_rank ?? nextFeaturedRank(next));

  const root = {
    slug: args.p_slug,
    status: args.p_status,
    featured_rank: featuredRank,
    cover_path: args.p_cover_path ?? null,
    start_date: args.p_start_date ?? null,
    end_date: args.p_end_date ?? null,
    published_at: args.p_published_at ?? null,
    updated_at: FIXED_TIMESTAMP
  };

  let row: ProjectStoreRow | undefined;
  if (args.p_id === null || args.p_id === undefined) {
    row = {
      id: nextId(),
      created_at: FIXED_TIMESTAMP,
      ...root
    };
    next.projects.push(row);
  } else {
    row = next.projects.find(candidate => candidate.id === args.p_id);
    if (!row) {
      return {
        ok: false,
        failure: { status: 404, code: "PGRST116", message: "project not found" }
      };
    }
    Object.assign(row, root);
  }

  const translations = args.p_translations ?? [];
  const locales = new Set(translations.map(entry => entry.locale));

  // The payload is the complete intended set: omitted locales are cleared.
  next.translations = next.translations.filter(
    translation =>
      translation.project_id !== row.id || locales.has(translation.locale)
  );

  for (const entry of translations) {
    // This is deliberately inside the staging loop: earlier entries (and the
    // root update) have already been applied to the copy when a later invalid
    // entry aborts, exactly like the pgTAP fault-injection proof.
    if (typeof entry.title !== "string" || entry.title.trim() === "") {
      return {
        ok: false,
        failure: {
          status: 400,
          code: "23514",
          message: "translation title must not be blank"
        }
      };
    }

    const existing = next.translations.find(
      translation =>
        translation.project_id === row.id && translation.locale === entry.locale
    );
    if (existing) {
      Object.assign(existing, entry);
    } else {
      next.translations.push({
        id: nextId(),
        project_id: row.id,
        locale: entry.locale,
        title: entry.title,
        summary: entry.summary,
        body: entry.body
      });
    }
  }

  densifyFeaturedRanks(next);

  return { ok: true, next, row };
}

async function handleSaveProjectRpc(
  route: Route,
  store: ProjectStore
): Promise<void> {
  let args: SaveProjectRpcInput;
  try {
    const parsed: unknown = route.request().postDataJSON();
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      await respondRpcFailure(route, {
        status: 400,
        code: "22P02",
        message: "invalid JSON body"
      });
      return;
    }
    args = parsed as SaveProjectRpcInput;
  } catch {
    await respondRpcFailure(route, {
      status: 400,
      code: "22P02",
      message: "invalid JSON body"
    });
    return;
  }

  const staged = stageSaveProject(store, args);
  if (!staged.ok) {
    await respondRpcFailure(route, staged.failure);
    return;
  }

  // Commit: the only point where the shared store changes.
  store.projects = staged.next.projects;
  store.translations = staged.next.translations;

  // A scalar-returning PostgREST function responds with a JSON string.
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(staged.row.id)
  });
}

/** T-045 lifecycle RPC stand-in: status and published_at move together. */
async function handleTransitionProjectRpc(
  route: Route,
  store: ProjectStore
): Promise<void> {
  const args = route.request().postDataJSON() as {
    p_id: string;
    p_status: ProjectStoreRow["status"];
    p_published_at?: string | null;
  };

  const row = store.projects.find(candidate => candidate.id === args.p_id);
  if (!row) {
    await route.fulfill({ status: 404, body: "" });
    return;
  }

  row.status = args.p_status;
  row.published_at =
    args.p_status === "published"
      ? (args.p_published_at ?? FIXED_TIMESTAMP)
      : null;
  // T-030: unpublishing removes the project from the featured set and the
  // remaining ranks close up, exactly like the database trigger.
  if (args.p_status !== "published") row.featured_rank = null;
  row.updated_at = FIXED_TIMESTAMP;
  densifyFeaturedRanks(store);

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "null"
  });
}

/** T-030 add/remove RPC stand-in. */
async function handleSetProjectFeaturedRpc(
  route: Route,
  store: ProjectStore
): Promise<void> {
  const args = route.request().postDataJSON() as {
    p_id: string;
    p_featured: boolean;
  };
  const row = store.projects.find(candidate => candidate.id === args.p_id);

  if (!row) {
    await route.fulfill({ status: 404, body: "" });
    return;
  }

  if (args.p_featured && row.status !== "published") {
    await respondRpcFailure(route, {
      status: 400,
      code: "23514",
      message: "only published projects can be featured"
    });
    return;
  }

  if (args.p_featured) {
    if (row.featured_rank === null) row.featured_rank = nextFeaturedRank(store);
  } else {
    row.featured_rank = null;
  }

  densifyFeaturedRanks(store);
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "null"
  });
}

/** T-030 complete-order RPC stand-in (dense 1..n, omitted rows appended). */
async function handleReorderFeaturedRpc(
  route: Route,
  store: ProjectStore
): Promise<void> {
  const args = route.request().postDataJSON() as { p_ids: string[] };
  const ids = args.p_ids ?? [];

  if (new Set(ids).size !== ids.length) {
    await respondRpcFailure(route, {
      status: 400,
      code: "22023",
      message: "p_ids must not contain duplicate ids"
    });
    return;
  }

  const invalid = ids.find(id => {
    const row = store.projects.find(candidate => candidate.id === id);
    return (
      row === undefined ||
      row.status !== "published" ||
      row.featured_rank === null
    );
  });
  if (invalid !== undefined) {
    await respondRpcFailure(route, {
      status: 400,
      code: "23514",
      message: "every id must be a featured published project"
    });
    return;
  }

  ids.forEach((id, index) => {
    const row = store.projects.find(candidate => candidate.id === id);
    if (row) row.featured_rank = index + 1;
  });

  const unlisted = store.projects
    .filter(
      row =>
        row.status === "published" &&
        row.featured_rank !== null &&
        !ids.includes(row.id)
    )
    .sort(
      (a, b) =>
        (a.featured_rank ?? 0) - (b.featured_rank ?? 0) ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id)
    );
  unlisted.forEach((row, index) => {
    row.featured_rank = ids.length + index + 1;
  });

  densifyFeaturedRanks(store);
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "null"
  });
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
  // Register the more specific RPC handlers first; Playwright consults the
  // most recently registered matching route first.
  await page.route("**/rest/v1/rpc/save_project_v1", async (route: Route) => {
    await handleSaveProjectRpc(route, store);
  });

  await page.route(
    "**/rest/v1/rpc/set_project_featured_v1",
    async (route: Route) => {
      await handleSetProjectFeaturedRpc(route, store);
    }
  );

  await page.route(
    "**/rest/v1/rpc/reorder_featured_projects_v1",
    async (route: Route) => {
      await handleReorderFeaturedRpc(route, store);
    }
  );

  await page.route(
    "**/rest/v1/rpc/transition_project_v1",
    async (route: Route) => {
      await handleTransitionProjectRpc(route, store);
    }
  );

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
