import type { Page, Route } from "@playwright/test";

/**
 * T-028 — stateful, deterministic PostgREST mock for site pages and team CRUD.
 *
 * docs/TESTING.md §2 forbids E2E from touching a live Supabase project, and the
 * T-028 journeys write. The project-store helper (T-027) established the
 * pattern: implement the small PostgREST slice the feature modules use over an
 * in-memory store shared by the admin and anonymous pages, so
 * "edit → publish → public reflects it" is proven end to end.
 *
 * The RPC stand-ins mirror the two invariants that matter for the journeys:
 *   - a save is all-or-nothing (staged on a copy before commit);
 *   - public reads only see published rows (the app also filters, matching the
 *     observable effect of RLS; the real policy proof lives in pgTAP).
 */

export interface SitePageStoreRow {
  id: string;
  page_key: string;
  status: "draft" | "published" | "archived";
  sort_order: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SitePageTranslationStoreRow {
  id: string;
  page_id: string;
  locale: "en" | "pl" | "uk";
  title: string;
  body: string | null;
  meta_description: string | null;
  needs_review: boolean;
}

export interface TeamMemberStoreRow {
  id: string;
  name: string;
  status: "draft" | "published" | "archived";
  sort_order: number;
  portrait_path: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberTranslationStoreRow {
  id: string;
  member_id: string;
  locale: "en" | "pl" | "uk";
  role: string | null;
  bio: string | null;
}

export interface ContentStore {
  sitePages: SitePageStoreRow[];
  sitePageTranslations: SitePageTranslationStoreRow[];
  teamMembers: TeamMemberStoreRow[];
  teamMemberTranslations: TeamMemberTranslationStoreRow[];
}

export function createContentStore(
  seed: Partial<ContentStore> = {}
): ContentStore {
  return {
    sitePages: [...(seed.sitePages ?? [])],
    sitePageTranslations: [...(seed.sitePageTranslations ?? [])],
    teamMembers: [...(seed.teamMembers ?? [])],
    teamMemberTranslations: [...(seed.teamMemberTranslations ?? [])]
  };
}

let idCounter = 0;

function nextId(): string {
  idCounter += 1;
  return `e2e00000-0000-4000-8000-${String(idCounter).padStart(12, "0")}`;
}

const FIXED_TIMESTAMP = "2026-06-01T12:00:00.000Z";

interface RpcFailure {
  readonly status: number;
  readonly code: string;
  readonly message: string;
}

interface SitePageTranslationInput {
  locale: SitePageTranslationStoreRow["locale"];
  title: string;
  body: string | null;
  metaDescription: string | null;
}

interface SaveSitePageInput {
  p_id?: string | null;
  p_status: SitePageStoreRow["status"];
  p_published_at?: string | null;
  p_translations?: SitePageTranslationInput[];
}

interface TeamMemberTranslationInput {
  locale: TeamMemberTranslationStoreRow["locale"];
  role: string | null;
  bio: string | null;
}

interface SaveTeamMemberInput {
  p_id?: string | null;
  p_name: string;
  p_status: TeamMemberStoreRow["status"];
  p_sort_order?: number | null;
  p_portrait_path?: string | null;
  p_published_at?: string | null;
  p_translations?: TeamMemberTranslationInput[];
}

function cloneContentStore(store: ContentStore): ContentStore {
  return {
    sitePages: store.sitePages.map(row => ({ ...row })),
    sitePageTranslations: store.sitePageTranslations.map(row => ({ ...row })),
    teamMembers: store.teamMembers.map(row => ({ ...row })),
    teamMemberTranslations: store.teamMemberTranslations.map(row => ({
      ...row
    }))
  };
}

function respondRpcFailure(route: Route, failure: RpcFailure): Promise<void> {
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

function withSitePageTranslations(store: ContentStore, row: SitePageStoreRow) {
  return {
    ...row,
    site_page_translations: store.sitePageTranslations.filter(
      translation => translation.page_id === row.id
    )
  };
}

function withTeamTranslations(store: ContentStore, row: TeamMemberStoreRow) {
  return {
    ...row,
    team_member_translations: store.teamMemberTranslations.filter(
      translation => translation.member_id === row.id
    )
  };
}

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
      if (!value.startsWith("eq.") || key.includes(".")) return true;
      const expected = value.slice(3);
      const actual = row[key];
      return actual === undefined || comparable(actual) === expected;
    })
  );
}

/**
 * Applies one PostgREST `order=column.asc|desc` clause.
 *
 * Numeric columns must be compared as numbers: stringifying first makes
 * `sort_order` order as 1, 10, 2, which would silently hide an admin reorder
 * regression once a team exceeds nine members. Text columns keep the existing
 * deterministic `localeCompare` behaviour.
 *
 * Exported for the focused unit regression test; the handler is the only
 * production caller.
 */
export function sortRows(
  rows: readonly Record<string, unknown>[],
  order: string | null
): Record<string, unknown>[] {
  if (!order) return [...rows];
  const [column, direction] = order.split(".");
  return [...rows].sort((a, b) => {
    const left = a[column ?? ""];
    const right = b[column ?? ""];
    const comparison =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : comparable(left).localeCompare(comparable(right));
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

async function handleSitePages(
  route: Route,
  store: ContentStore,
  params: URLSearchParams
): Promise<void> {
  const method = route.request().method();

  if (method === "GET") {
    await respond(
      route,
      sortRows(
        applyFilters(
          store.sitePages.map(row => withSitePageTranslations(store, row)),
          params
        ),
        params.get("order")
      )
    );
    return;
  }

  await route.fulfill({ status: 405, body: "" });
}

async function handleTeamMembers(
  route: Route,
  store: ContentStore,
  params: URLSearchParams
): Promise<void> {
  const method = route.request().method();

  if (method === "GET") {
    await respond(
      route,
      sortRows(
        applyFilters(
          store.teamMembers.map(row => withTeamTranslations(store, row)),
          params
        ),
        params.get("order")
      )
    );
    return;
  }

  if (method === "DELETE") {
    const id = params.get("id")?.replace("eq.", "");
    store.teamMembers = store.teamMembers.filter(
      row => id !== undefined && row.id !== id
    );
    store.teamMemberTranslations = store.teamMemberTranslations.filter(
      translation => translation.member_id !== id
    );
    await respond(route, []);
    return;
  }

  await route.fulfill({ status: 405, body: "" });
}

function stageSaveSitePage(
  source: ContentStore,
  args: SaveSitePageInput
):
  | { readonly ok: true; readonly next: ContentStore; readonly id: string }
  | { readonly ok: false; readonly failure: RpcFailure } {
  const next = cloneContentStore(source);

  if (!args.p_id) {
    return {
      ok: false,
      failure: {
        status: 400,
        code: "22023",
        message: "site page id is required"
      }
    };
  }

  if (!Array.isArray(args.p_translations)) {
    return {
      ok: false,
      failure: {
        status: 400,
        code: "22023",
        message: "p_translations must be an array"
      }
    };
  }

  if (args.p_status === "published" && !args.p_published_at) {
    return {
      ok: false,
      failure: {
        status: 400,
        code: "23514",
        message: "published_at is required for a published page"
      }
    };
  }

  const page = next.sitePages.find(row => row.id === args.p_id);
  if (!page) {
    return {
      ok: false,
      failure: { status: 404, code: "PGRST116", message: "page not found" }
    };
  }

  page.status = args.p_status;
  page.published_at = args.p_published_at ?? null;
  page.updated_at = FIXED_TIMESTAMP;

  const locales = new Set(args.p_translations.map(entry => entry.locale));

  next.sitePageTranslations = next.sitePageTranslations.filter(
    translation =>
      translation.page_id !== page.id || locales.has(translation.locale)
  );

  for (const entry of args.p_translations) {
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

    const existing = next.sitePageTranslations.find(
      translation =>
        translation.page_id === page.id && translation.locale === entry.locale
    );
    if (existing) {
      Object.assign(existing, {
        title: entry.title,
        body: entry.body,
        meta_description: entry.metaDescription
      });
    } else {
      next.sitePageTranslations.push({
        id: nextId(),
        page_id: page.id,
        locale: entry.locale,
        title: entry.title,
        body: entry.body,
        meta_description: entry.metaDescription,
        needs_review: false
      });
    }
  }

  return { ok: true, next, id: page.id };
}

async function handleSaveSitePageRpc(
  route: Route,
  store: ContentStore
): Promise<void> {
  const args = route.request().postDataJSON() as SaveSitePageInput;
  const staged = stageSaveSitePage(store, args);

  if (!staged.ok) {
    await respondRpcFailure(route, staged.failure);
    return;
  }

  store.sitePages = staged.next.sitePages;
  store.sitePageTranslations = staged.next.sitePageTranslations;

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(staged.id)
  });
}

async function handleTransitionSitePageRpc(
  route: Route,
  store: ContentStore
): Promise<void> {
  const args = route.request().postDataJSON() as {
    p_id: string;
    p_status: SitePageStoreRow["status"];
    p_published_at?: string | null;
  };

  const page = store.sitePages.find(row => row.id === args.p_id);
  if (!page) {
    await route.fulfill({ status: 404, body: "" });
    return;
  }

  page.status = args.p_status;
  page.published_at =
    args.p_status === "published"
      ? (args.p_published_at ?? FIXED_TIMESTAMP)
      : null;
  page.updated_at = FIXED_TIMESTAMP;

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "null"
  });
}

function stageSaveTeamMember(
  source: ContentStore,
  args: SaveTeamMemberInput
):
  | { readonly ok: true; readonly next: ContentStore; readonly id: string }
  | { readonly ok: false; readonly failure: RpcFailure } {
  const next = cloneContentStore(source);

  if (typeof args.p_name !== "string" || args.p_name.trim() === "") {
    return {
      ok: false,
      failure: {
        status: 400,
        code: "23514",
        message: "member name must not be blank"
      }
    };
  }

  if (!Array.isArray(args.p_translations)) {
    return {
      ok: false,
      failure: {
        status: 400,
        code: "22023",
        message: "p_translations must be an array"
      }
    };
  }

  if (args.p_status === "published" && !args.p_published_at) {
    return {
      ok: false,
      failure: {
        status: 400,
        code: "23514",
        message: "published_at is required for a published member"
      }
    };
  }

  let member: TeamMemberStoreRow | undefined;
  if (!args.p_id) {
    const maxOrder = next.teamMembers.reduce(
      (max, row) => Math.max(max, row.sort_order),
      0
    );
    member = {
      id: nextId(),
      name: args.p_name,
      status: args.p_status,
      sort_order: args.p_sort_order ?? maxOrder + 1,
      portrait_path: args.p_portrait_path ?? null,
      published_at: args.p_published_at ?? null,
      created_at: FIXED_TIMESTAMP,
      updated_at: FIXED_TIMESTAMP
    };
    next.teamMembers.push(member);
  } else {
    member = next.teamMembers.find(row => row.id === args.p_id);
    if (!member) {
      return {
        ok: false,
        failure: {
          status: 404,
          code: "PGRST116",
          message: "team member not found"
        }
      };
    }
    member.name = args.p_name;
    member.status = args.p_status;
    member.sort_order = args.p_sort_order ?? member.sort_order;
    member.portrait_path = args.p_portrait_path ?? null;
    member.published_at = args.p_published_at ?? null;
    member.updated_at = FIXED_TIMESTAMP;
  }

  const locales = new Set(args.p_translations.map(entry => entry.locale));
  next.teamMemberTranslations = next.teamMemberTranslations.filter(
    translation =>
      translation.member_id !== member?.id || locales.has(translation.locale)
  );

  for (const entry of args.p_translations) {
    const existing = next.teamMemberTranslations.find(
      translation =>
        translation.member_id === member?.id &&
        translation.locale === entry.locale
    );
    if (existing) {
      Object.assign(existing, { role: entry.role, bio: entry.bio });
    } else {
      next.teamMemberTranslations.push({
        id: nextId(),
        member_id: member.id,
        locale: entry.locale,
        role: entry.role,
        bio: entry.bio
      });
    }
  }

  return { ok: true, next, id: member.id };
}

async function handleSaveTeamMemberRpc(
  route: Route,
  store: ContentStore
): Promise<void> {
  const args = route.request().postDataJSON() as SaveTeamMemberInput;
  const staged = stageSaveTeamMember(store, args);

  if (!staged.ok) {
    await respondRpcFailure(route, staged.failure);
    return;
  }

  store.teamMembers = staged.next.teamMembers;
  store.teamMemberTranslations = staged.next.teamMemberTranslations;

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(staged.id)
  });
}

async function handleTransitionTeamMemberRpc(
  route: Route,
  store: ContentStore
): Promise<void> {
  const args = route.request().postDataJSON() as {
    p_id: string;
    p_status: TeamMemberStoreRow["status"];
    p_published_at?: string | null;
  };

  const member = store.teamMembers.find(row => row.id === args.p_id);
  if (!member) {
    await route.fulfill({ status: 404, body: "" });
    return;
  }

  member.status = args.p_status;
  member.published_at =
    args.p_status === "published"
      ? (args.p_published_at ?? FIXED_TIMESTAMP)
      : null;
  member.updated_at = FIXED_TIMESTAMP;

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "null"
  });
}

async function handleReorderTeamMembersRpc(
  route: Route,
  store: ContentStore
): Promise<void> {
  const args = route.request().postDataJSON() as { p_ids?: string[] };
  const ids = args.p_ids ?? [];

  if (new Set(ids).size !== ids.length) {
    await respondRpcFailure(route, {
      status: 400,
      code: "22023",
      message: "duplicate ids"
    });
    return;
  }

  const missing = ids.find(
    id => !store.teamMembers.some(member => member.id === id)
  );
  if (missing !== undefined) {
    await respondRpcFailure(route, {
      status: 404,
      code: "P0002",
      message: "team member not found"
    });
    return;
  }

  ids.forEach((id, index) => {
    const member = store.teamMembers.find(row => row.id === id);
    if (member) member.sort_order = index + 1;
  });

  const unlisted = store.teamMembers
    .filter(member => !ids.includes(member.id))
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id)
    );
  unlisted.forEach((member, index) => {
    member.sort_order = ids.length + index + 1;
  });

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "null"
  });
}

export async function mockContentApi(
  page: Page,
  store: ContentStore
): Promise<void> {
  // RPCs first: Playwright consults the most recently registered match first.
  await page.route("**/rest/v1/rpc/save_site_page_v1", async route => {
    await handleSaveSitePageRpc(route, store);
  });
  await page.route("**/rest/v1/rpc/transition_site_page_v1", async route => {
    await handleTransitionSitePageRpc(route, store);
  });
  await page.route("**/rest/v1/rpc/save_team_member_v1", async route => {
    await handleSaveTeamMemberRpc(route, store);
  });
  await page.route("**/rest/v1/rpc/transition_team_member_v1", async route => {
    await handleTransitionTeamMemberRpc(route, store);
  });
  await page.route("**/rest/v1/rpc/reorder_team_members_v1", async route => {
    await handleReorderTeamMembersRpc(route, store);
  });

  await page.route("**/rest/v1/site_pages*", async route => {
    const url = new URL(route.request().url());
    await handleSitePages(route, store, url.searchParams);
  });

  await page.route("**/rest/v1/team_members*", async route => {
    const url = new URL(route.request().url());
    await handleTeamMembers(route, store, url.searchParams);
  });

  // Portraits: accept uploads and removals. Journeys assert the reference
  // (portrait_path / rendered img), not stored bytes.
  await page.route("**/storage/v1/object/**", async route => {
    const method = route.request().method();
    if (method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ Key: "public-media/team/e2e-portrait.png" })
      });
      return;
    }
    if (method === "DELETE") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]"
      });
      return;
    }
    await route.fulfill({ status: 404, body: "" });
  });
}
