import type { Page, Route } from "@playwright/test";

import { PDF_FIXTURE_BODY } from "./mocks";

/**
 * T-029 — deterministic, stateful PostgREST/Storage stand-in for the admin
 * publication and document journeys.
 *
 * docs/TESTING.md §2 forbids E2E tests from touching a live Supabase project,
 * and T-029 writes through transactional RPCs plus Storage uploads. This helper
 * mirrors the *observable* contract the database enforces:
 *   - URL xor files (23514);
 *   - a published publication needs an action (23514);
 *   - one file per language;
 *   - upload returns an object key, never a public URL;
 *   - public reads only see `status=eq.published` rows.
 *
 * It is deliberately not a database. The transactional proof lives in
 * `supabase/tests/admin_publication_document_mutations_test.sql`; the mock
 * exists so E2E cannot pass with a no-op write or an unscoped request.
 */

export interface PublicationRow {
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
  publication_translations: {
    locale: "en" | "pl" | "uk";
    title: string;
    abstract: string | null;
    authors: string | null;
  }[];
  publication_files: {
    locale: "en" | "pl" | "uk";
    label: string | null;
    storage_path: string;
    mime_type: string | null;
    file_size_bytes: number | null;
  }[];
}

export interface DocumentRow {
  id: string;
  slug: string;
  status: "draft" | "published" | "archived";
  document_type: string;
  language: "en" | "pl" | "uk" | null;
  publication_date: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  sort_order: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  organization_document_translations: {
    locale: "en" | "pl" | "uk";
    title: string;
    description: string | null;
    body_ast_version: number | null;
  }[];
}

export interface AdminContentStore {
  publications: PublicationRow[];
  documents: DocumentRow[];
  uploads: { bucket: string; path: string }[];
  removals: { bucket: string; path: string }[];
}

const FIXED_TIMESTAMP = "2026-06-01T12:00:00.000Z";

export function createAdminContentStore(): AdminContentStore {
  return {
    publications: [],
    documents: [],
    uploads: [],
    removals: []
  };
}

let idCounter = 0;
function nextId(prefix = "e2e02900"): string {
  idCounter += 1;
  return `${prefix}-0000-4000-8000-${String(idCounter).padStart(12, "0")}`;
}

function comparable(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value) ?? "";
}

function applyFilters<T extends Record<string, unknown>>(
  rows: readonly T[],
  params: URLSearchParams
): T[] {
  return rows.filter(row =>
    [...params.entries()].every(([key, value]) => {
      if (!value.startsWith("eq.") || key.includes(".")) return true;
      const actual = row[key];
      return actual === undefined || comparable(actual) === value.slice(3);
    })
  );
}

function wantsSingle(route: Route): boolean {
  return (route.request().headers()["accept"] ?? "").includes("pgrst.object");
}

function respond(route: Route, rows: unknown[], status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(wantsSingle(route) ? (rows[0] ?? null) : rows)
  });
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

interface SavePublicationArgs {
  p_id?: string | null;
  p_slug: string;
  p_status: PublicationRow["status"];
  p_language?: PublicationRow["language"];
  p_publication_date?: string | null;
  p_external_url?: string | null;
  p_sort_order?: number | null;
  p_published_at?: string | null;
  p_translations?: PublicationRow["publication_translations"];
  p_files?: {
    locale: "en" | "pl" | "uk";
    label?: string | null;
    storagePath?: string;
    storage_path?: string;
    mimeType?: string | null;
    mime_type?: string | null;
    sizeBytes?: number | null;
    file_size_bytes?: number | null;
  }[];
}

async function savePublicationRpc(
  route: Route,
  store: AdminContentStore
): Promise<void> {
  const args = route.request().postDataJSON() as SavePublicationArgs;
  const externalUrl =
    typeof args.p_external_url === "string" && args.p_external_url.trim() !== ""
      ? args.p_external_url
      : null;
  const files = args.p_files ?? [];

  // Mirror the DB's one-active-file-per-language rule. The real function
  // rejects the payload before touching a row, so the mock must not mutate
  // the store either (all-or-nothing fidelity).
  const locales = new Set<string>();
  for (const file of files) {
    if (locales.has(file.locale)) {
      await rpcFailure(
        route,
        400,
        "23514",
        "at most one file version per language is allowed"
      );
      return;
    }
    locales.add(file.locale);
  }

  if (externalUrl !== null && files.length > 0) {
    await rpcFailure(
      route,
      400,
      "23514",
      "a publication cannot have both an external URL and file versions"
    );
    return;
  }
  if (
    args.p_status === "published" &&
    externalUrl === null &&
    files.length === 0
  ) {
    await rpcFailure(
      route,
      400,
      "23514",
      "a published publication needs an external URL or a file version"
    );
    return;
  }
  if (
    store.publications.some(
      row => row.slug === args.p_slug && row.id !== args.p_id
    )
  ) {
    await rpcFailure(route, 409, "23505", "duplicate canonical slug");
    return;
  }

  const existing = args.p_id
    ? store.publications.find(row => row.id === args.p_id)
    : undefined;
  const row: PublicationRow = {
    id: existing?.id ?? nextId(),
    slug: args.p_slug,
    status: args.p_status,
    language: args.p_language ?? null,
    publication_date: args.p_publication_date ?? null,
    external_url: externalUrl,
    sort_order:
      args.p_sort_order ??
      existing?.sort_order ??
      store.publications.length + 1,
    published_at: args.p_published_at ?? null,
    created_at: existing?.created_at ?? FIXED_TIMESTAMP,
    updated_at: FIXED_TIMESTAMP,
    publication_translations: (args.p_translations ?? []).map(entry => ({
      locale: entry.locale,
      title: entry.title,
      abstract: entry.abstract ?? null,
      authors: entry.authors ?? null
    })),
    publication_files: files.map(file => ({
      locale: file.locale,
      label: file.label ?? null,
      // The client sends the documented camelCase RPC payload; the REST row
      // uses the snake_case column names. Accept both so the mock mirrors the
      // real function boundary instead of a hand-written shape.
      storage_path: file.storagePath ?? file.storage_path ?? "",
      mime_type: file.mimeType ?? file.mime_type ?? null,
      file_size_bytes: file.sizeBytes ?? file.file_size_bytes ?? null
    }))
  };

  if (existing) {
    Object.assign(existing, row);
  } else {
    store.publications.push(row);
  }

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(row.id)
  });
}

async function transitionPublicationRpc(
  route: Route,
  store: AdminContentStore
): Promise<void> {
  const args = route.request().postDataJSON() as {
    p_id: string;
    p_status: PublicationRow["status"];
    p_published_at?: string | null;
  };
  const row = store.publications.find(candidate => candidate.id === args.p_id);
  if (!row) {
    await route.fulfill({ status: 404, body: "" });
    return;
  }

  if (
    args.p_status === "published" &&
    row.external_url === null &&
    row.publication_files.length === 0
  ) {
    await rpcFailure(
      route,
      400,
      "23514",
      "a published publication needs an external URL or a file version"
    );
    return;
  }

  row.status = args.p_status;
  row.published_at =
    args.p_status === "published"
      ? (args.p_published_at ?? FIXED_TIMESTAMP)
      : null;
  row.updated_at = FIXED_TIMESTAMP;
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "null"
  });
}

interface SaveDocumentArgs {
  p_id?: string | null;
  p_slug: string;
  p_status: DocumentRow["status"];
  p_document_type: string;
  p_language?: DocumentRow["language"];
  p_publication_date?: string | null;
  p_storage_path?: string | null;
  p_mime_type?: string | null;
  p_file_size_bytes?: number | null;
  p_sort_order?: number | null;
  p_published_at?: string | null;
  p_translations?: DocumentRow["organization_document_translations"];
}

async function saveDocumentRpc(
  route: Route,
  store: AdminContentStore
): Promise<void> {
  const args = route.request().postDataJSON() as SaveDocumentArgs;
  if (
    typeof args.p_storage_path === "string" &&
    /^https?:\/\//iu.test(args.p_storage_path)
  ) {
    await rpcFailure(route, 400, "23514", "storage path must be an object key");
    return;
  }
  if (
    store.documents.some(
      row => row.slug === args.p_slug && row.id !== args.p_id
    )
  ) {
    await rpcFailure(route, 409, "23505", "duplicate canonical slug");
    return;
  }

  const existing = args.p_id
    ? store.documents.find(row => row.id === args.p_id)
    : undefined;
  const row: DocumentRow = {
    id: existing?.id ?? nextId("e2e02901"),
    slug: args.p_slug,
    status: args.p_status,
    document_type: args.p_document_type,
    language: args.p_language ?? null,
    publication_date: args.p_publication_date ?? null,
    storage_path: args.p_storage_path ?? null,
    mime_type: args.p_mime_type ?? null,
    file_size_bytes: args.p_file_size_bytes ?? null,
    sort_order:
      args.p_sort_order ?? existing?.sort_order ?? store.documents.length + 1,
    published_at: args.p_published_at ?? null,
    created_at: existing?.created_at ?? FIXED_TIMESTAMP,
    updated_at: FIXED_TIMESTAMP,
    organization_document_translations: (args.p_translations ?? []).map(
      entry => ({
        locale: entry.locale,
        title: entry.title,
        description: entry.description ?? null,
        body_ast_version: null
      })
    )
  };

  if (existing) {
    Object.assign(existing, row);
  } else {
    store.documents.push(row);
  }

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(row.id)
  });
}

async function transitionDocumentRpc(
  route: Route,
  store: AdminContentStore
): Promise<void> {
  const args = route.request().postDataJSON() as {
    p_id: string;
    p_status: DocumentRow["status"];
    p_published_at?: string | null;
  };
  const row = store.documents.find(candidate => candidate.id === args.p_id);
  if (!row) {
    await route.fulfill({ status: 404, body: "" });
    return;
  }

  row.status = args.p_status;
  row.published_at =
    args.p_status === "published"
      ? (args.p_published_at ?? FIXED_TIMESTAMP)
      : null;
  row.updated_at = FIXED_TIMESTAMP;
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "null"
  });
}

function objectLocation(route: Route): { bucket: string; path: string } | null {
  const url = new URL(route.request().url());
  const marker = "/storage/v1/object/";
  const index = url.pathname.indexOf(marker);
  if (index === -1) return null;
  const remainder = url.pathname.slice(index + marker.length);
  const [bucket = "", ...rest] = remainder.split("/");
  return { bucket, path: rest.join("/") };
}

/**
 * Installs the publication/document REST + RPC + Storage handlers. Register
 * this AFTER `mockSupabaseRest` so these more specific routes win (Playwright
 * consults the most recently registered match first).
 */
export async function mockAdminContentApi(
  page: Page,
  store: AdminContentStore
): Promise<void> {
  await page.route("**/rest/v1/rpc/save_publication_v1", async route => {
    await savePublicationRpc(route, store);
  });
  await page.route("**/rest/v1/rpc/transition_publication_v1", async route => {
    await transitionPublicationRpc(route, store);
  });
  await page.route("**/rest/v1/rpc/save_document_v1", async route => {
    await saveDocumentRpc(route, store);
  });
  await page.route("**/rest/v1/rpc/transition_document_v1", async route => {
    await transitionDocumentRpc(route, store);
  });

  await page.route("**/rest/v1/publications*", async route => {
    const method = route.request().method();
    const url = new URL(route.request().url());

    if (method === "DELETE") {
      const id = url.searchParams.get("id")?.replace("eq.", "");
      store.publications = store.publications.filter(row => row.id !== id);
      await respond(route, []);
      return;
    }

    await respond(
      route,
      applyFilters(
        store.publications as unknown as Record<string, unknown>[],
        url.searchParams
      )
    );
  });

  await page.route("**/rest/v1/organization_documents*", async route => {
    const method = route.request().method();
    const url = new URL(route.request().url());

    if (method === "DELETE") {
      const id = url.searchParams.get("id")?.replace("eq.", "");
      store.documents = store.documents.filter(row => row.id !== id);
      await respond(route, []);
      return;
    }

    await respond(
      route,
      applyFilters(
        store.documents as unknown as Record<string, unknown>[],
        url.searchParams
      )
    );
  });

  // Embedded joins are part of the parent payload above; these endpoints are
  // registered for completeness (a future direct query cannot hit the network).
  await page.route("**/rest/v1/publication_translations*", async route => {
    await respond(route, []);
  });
  await page.route("**/rest/v1/publication_files*", async route => {
    await respond(route, []);
  });
  await page.route(
    "**/rest/v1/organization_document_translations*",
    async route => {
      await respond(route, []);
    }
  );

  await page.route("**/storage/v1/object/**", async route => {
    const method = route.request().method();
    const location = objectLocation(route);

    if (method === "POST" && location) {
      store.uploads.push(location);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          Key: `${location.bucket}/${location.path}`
        })
      });
      return;
    }

    if (method === "DELETE") {
      let paths: string[] = [];
      try {
        const body = route.request().postDataJSON() as {
          prefixes?: string[];
        };
        paths = body.prefixes ?? [];
      } catch {
        paths = [];
      }
      const bucket = location?.bucket ?? "public-documents";
      for (const path of paths) {
        store.removals.push({ bucket, path });
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]"
      });
      return;
    }

    // Public download.
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: PDF_FIXTURE_BODY
    });
  });
}
