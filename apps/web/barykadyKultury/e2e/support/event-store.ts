import type { Page, Route } from "@playwright/test";

/**
 * T-031 — stateful, deterministic PostgREST mock for the event-mapping admin
 * page and the public Events join.
 *
 * The real behavior this fake must preserve:
 *   - `calendar_event_links` is UNIQUE on `(calendar_id, google_event_id)`, so
 *     `upsert` on that target converges on one row (idempotency);
 *   - unassign is an `UPDATE ... SET project_id = NULL`, never a delete;
 *   - the PUBLIC read policy hides mappings to unpublished projects, while the
 *     admin read returns them (docs/architecture.md §4, T-013 RLS).
 *
 * The fake distinguishes the two reads by the PostgREST `select` projection:
 * the public join embeds `projects(...)`, the admin read does not. That keeps
 * the RLS analogue honest without inspecting auth tokens (the proof of the
 * real policy lives in `supabase/tests/rls_content_matrix_test.sql`).
 */

export interface EventLinkRow {
  calendar_id: string;
  google_event_id: string;
  project_id: string | null;
  updated_at: string;
}

export interface EventStoreProjectRow {
  id: string;
  slug: string;
  status: "draft" | "published" | "archived";
  updated_at: string;
  project_translations: {
    locale: "en" | "pl" | "uk";
    title: string;
    summary: string | null;
    body: string | null;
  }[];
}

export interface EventStore {
  links: EventLinkRow[];
  projects: EventStoreProjectRow[];
}

const FIXED_TIMESTAMP = "2026-06-01T12:00:00.000Z";

export function createEventStore(seed: Partial<EventStore> = {}): EventStore {
  return {
    links: [...(seed.links ?? [])],
    projects: [...(seed.projects ?? [])]
  };
}

/** Stringifies a scalar cell without `[object Object]` for nested values. */
function comparable(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value) ?? "";
}

function applyFilters(
  rows: readonly Record<string, unknown>[],
  params: URLSearchParams
): Record<string, unknown>[] {
  return rows.filter(row =>
    [...params.entries()].every(([key, value]) => {
      if (key === "select" || !value.startsWith("eq.")) return true;
      const actual = row[key];
      return actual === undefined || comparable(actual) === value.slice(3);
    })
  );
}

function isPublicJoin(params: URLSearchParams): boolean {
  return (params.get("select") ?? "").includes("projects(");
}

function wantsUnlinkedExcluded(params: URLSearchParams): boolean {
  return params.get("project_id") === "not.is.null";
}

/** Public embed shape consumed by `features/events/api.ts`. */
function withPublicProject(store: EventStore, link: EventLinkRow) {
  const project =
    link.project_id === null
      ? null
      : (store.projects.find(entry => entry.id === link.project_id) ?? null);

  return {
    ...link,
    projects:
      project === null
        ? null
        : {
            slug: project.slug,
            status: project.status,
            project_translations: project.project_translations.map(
              translation => ({
                locale: translation.locale,
                title: translation.title
              })
            )
          }
  };
}

async function handleLinks(
  route: Route,
  store: EventStore,
  params: URLSearchParams
): Promise<void> {
  const method = route.request().method();

  if (method === "GET") {
    const publicJoin = isPublicJoin(params);
    let rows = applyFilters(
      store.links as unknown as Record<string, unknown>[],
      params
    );

    if (publicJoin) {
      // Public RLS: a mapping is readable only when it is unlinked or its
      // project is published (T-013 calendar_event_links_select_public).
      rows = rows.filter(row => {
        const projectId = row.project_id;
        if (projectId === null) return true;
        const project = store.projects.find(entry => entry.id === projectId);
        return project?.status === "published";
      });
      if (wantsUnlinkedExcluded(params)) {
        rows = rows.filter(row => row.project_id !== null);
      }
    }

    const payload = publicJoin
      ? rows.map(row =>
          withPublicProject(store, row as unknown as EventLinkRow)
        )
      : rows;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload)
    });
    return;
  }

  if (method === "POST") {
    const body = route.request().postDataJSON() as
      | Partial<EventLinkRow>
      | Partial<EventLinkRow>[];
    const input = Array.isArray(body) ? body : [body];

    const saved = input.map(item => {
      const existing = store.links.find(
        row =>
          row.calendar_id === item.calendar_id &&
          row.google_event_id === item.google_event_id
      );

      if (existing) {
        // ON CONFLICT (calendar_id, google_event_id) DO UPDATE.
        existing.project_id = item.project_id ?? null;
        existing.updated_at = FIXED_TIMESTAMP;
        return existing;
      }

      const row: EventLinkRow = {
        calendar_id: item.calendar_id ?? "",
        google_event_id: item.google_event_id ?? "",
        project_id: item.project_id ?? null,
        updated_at: FIXED_TIMESTAMP
      };
      store.links.push(row);
      return row;
    });

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(saved)
    });
    return;
  }

  if (method === "PATCH") {
    const patch = route.request().postDataJSON() as Partial<EventLinkRow>;
    const updated = store.links
      .filter(row => {
        const calendar = params.get("calendar_id");
        const event = params.get("google_event_id");
        return (
          (calendar === null ||
            row.calendar_id === calendar.replace("eq.", "")) &&
          (event === null || row.google_event_id === event.replace("eq.", ""))
        );
      })
      .map(row => {
        Object.assign(row, patch, { updated_at: FIXED_TIMESTAMP });
        return row;
      });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(updated)
    });
    return;
  }

  await route.fulfill({ status: 405, body: "" });
}

async function handleProjects(
  route: Route,
  store: EventStore,
  params: URLSearchParams
): Promise<void> {
  if (route.request().method() !== "GET") {
    await route.fulfill({ status: 405, body: "" });
    return;
  }

  const rows = applyFilters(
    store.projects as unknown as Record<string, unknown>[],
    params
  );

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(rows)
  });
}

/**
 * Installs the link + project handlers. Call it after `mockCalendarEvents` and
 * `mockSupabaseAuth`; Playwright evaluates the most recently registered route
 * first.
 */
export async function mockEventApi(
  page: Page,
  store: EventStore
): Promise<void> {
  await page.route("**/rest/v1/calendar_event_links*", async route => {
    const url = new URL(route.request().url());
    await handleLinks(route, store, url.searchParams);
  });

  await page.route("**/rest/v1/projects*", async route => {
    const url = new URL(route.request().url());
    await handleProjects(route, store, url.searchParams);
  });
}
