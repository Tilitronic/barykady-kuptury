import type { SupabaseClient } from "@supabase/supabase-js";

import { SUPPORTED_LOCALES, type Locale } from "@/features/i18n/locales";
import type { Database, Json } from "@/types/database.types";

import {
  emptySitePageTranslation,
  sitePageTranslationsForSave,
  type SitePageFormValues,
  type SitePageStatus,
  type SitePageTranslationDraft
} from "./sitePageForm";

/**
 * T-028 — the ONLY write path for editable site pages.
 *
 * Design authority:
 *   - docs/architecture.md §3: feature data access stays behind a module seam;
 *     the page never builds a query.
 *   - docs/architecture.md §4: root lifecycle + one translation row per locale.
 *   - docs/architecture.md §6.1: reads/writes are gated by `pages:write` at the
 *     data boundary (RLS) and re-checked inside the T-045-style RPCs.
 *   - docs/PRODUCT_REQUIREMENTS.md §6: edit/preview/publish organization
 *     information and see missing translations.
 *
 * T-028 deliberately has NO create function: the product is a picker over
 * existing organization pages, not a page builder. The `save_site_page_v1`
 * RPC also rejects a null id, so the scope is enforced on both sides.
 *
 * Mutations travel as two transactional RPCs copied from the T-045 project
 * pattern (architector decision: per-entity reuse, no generic framework yet):
 * `save_site_page_v1` (root + complete translation set) and
 * `transition_site_page_v1` (status + published_at together).
 */

type SitePageRow = Database["public"]["Tables"]["site_pages"]["Row"];
type SitePageTranslationRow =
  Database["public"]["Tables"]["site_page_translations"]["Row"];

interface AdminSitePageRowWithTranslations extends SitePageRow {
  readonly site_page_translations: readonly SitePageTranslationRow[];
}

export interface AdminSitePageTranslation {
  readonly title: string;
  readonly body: string;
  readonly metaDescription: string;
}

export interface AdminSitePage {
  readonly id: string;
  readonly pageKey: string;
  readonly status: SitePageStatus;
  readonly sortOrder: number;
  readonly publishedAt: string | null;
  readonly updatedAt: string;
  readonly translations: Record<Locale, AdminSitePageTranslation>;
}

export type AdminContentFailureCode = "unavailable" | "failed";

export interface AdminContentFailure {
  readonly ok: false;
  readonly code: AdminContentFailureCode;
  /** Stable diagnostic only — never rendered raw to the user. */
  readonly message?: string;
}

export type AdminContentMutationResult =
  | { readonly ok: true }
  | AdminContentFailure;

export type AdminSitePageSaveResult =
  | { readonly ok: true; readonly id: string }
  | AdminContentFailure;

export type AdminSitePageResult =
  | { readonly ok: true; readonly page: AdminSitePage }
  | {
      readonly ok: false;
      readonly code: "not-found" | AdminContentFailureCode;
    };

export type AdminSitePageListResult =
  | { readonly ok: true; readonly pages: readonly AdminSitePage[] }
  | AdminContentFailure;

const ADMIN_SITE_PAGE_SELECT =
  "id, page_key, status, sort_order, published_at, updated_at, site_page_translations(locale, title, body, meta_description)";

/** T-045-family transaction seams, kept as literals for a single audit point. */
const SAVE_SITE_PAGE_RPC = "save_site_page_v1" as const;
const TRANSITION_SITE_PAGE_RPC = "transition_site_page_v1" as const;

function failure(
  code: AdminContentFailureCode,
  message?: string
): AdminContentFailure {
  return message === undefined
    ? { ok: false, code }
    : { ok: false, code, message };
}

function translationsFromRows(
  rows: readonly SitePageTranslationRow[]
): Record<Locale, AdminSitePageTranslation> {
  const translations = Object.fromEntries(
    SUPPORTED_LOCALES.map(locale => [locale, emptySitePageTranslation()])
  ) as Record<Locale, SitePageTranslationDraft>;

  for (const row of rows) {
    if ((SUPPORTED_LOCALES as readonly string[]).includes(row.locale)) {
      translations[row.locale] = {
        title: row.title,
        body: row.body ?? "",
        metaDescription: row.meta_description ?? ""
      };
    }
  }

  return translations;
}

export function mapAdminSitePage(
  row: AdminSitePageRowWithTranslations
): AdminSitePage {
  return {
    id: row.id,
    pageKey: row.page_key,
    status: row.status,
    sortOrder: row.sort_order,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    translations: translationsFromRows(row.site_page_translations)
  };
}

/** All editable pages, ordered like the public page index (T-012). */
export async function fetchAdminSitePages(
  supabase: SupabaseClient<Database> | null
): Promise<AdminSitePageListResult> {
  if (!supabase) return failure("unavailable");

  const { data, error } = await supabase
    .from("site_pages")
    .select(ADMIN_SITE_PAGE_SELECT)
    .order("sort_order", { ascending: true })
    .overrideTypes<AdminSitePageRowWithTranslations[], { merge: false }>();

  if (error) return failure("failed", error.message);

  return { ok: true, pages: (data ?? []).map(mapAdminSitePage) };
}

/** One page with every translation, by its stable `page_key` (D-24). */
export async function fetchAdminSitePage(
  supabase: SupabaseClient<Database> | null,
  pageKey: string
): Promise<AdminSitePageResult> {
  if (!supabase) return { ok: false, code: "unavailable" };

  const { data, error } = await supabase
    .from("site_pages")
    .select(ADMIN_SITE_PAGE_SELECT)
    .eq("page_key", pageKey)
    .maybeSingle()
    .overrideTypes<AdminSitePageRowWithTranslations, { merge: false }>();

  if (error) return { ok: false, code: "failed" };
  if (!data) return { ok: false, code: "not-found" };

  return { ok: true, page: mapAdminSitePage(data) };
}

export interface SaveSitePageOptions {
  /** Preserves the original publication time on a later content edit. */
  readonly existingPublishedAt?: string | null;
}

/**
 * Persists the root lifecycle and the complete intended translation set in one
 * transaction. A locale omitted from the payload is a deliberate clear, which
 * is exactly what "edit one locale at a time" needs: the page always sends the
 * whole map, built from immutable per-locale drafts.
 */
export async function saveSitePage(
  supabase: SupabaseClient<Database> | null,
  values: SitePageFormValues,
  options: SaveSitePageOptions = {}
): Promise<AdminSitePageSaveResult> {
  if (!supabase) return failure("unavailable");

  const publishedAt =
    values.status === "published"
      ? (options.existingPublishedAt ?? new Date().toISOString())
      : null;

  const { data, error } = await supabase.rpc(SAVE_SITE_PAGE_RPC, {
    p_id: values.id as unknown as string,
    p_status: values.status,
    p_published_at: publishedAt as unknown as string,
    p_translations: sitePageTranslationsForSave(values) as unknown as Json
  });

  if (error) return failure("failed", error.message);

  // A scalar-returning PostgREST function yields the id directly; fail closed
  // when the contract drifts instead of reporting a false success.
  if (typeof data !== "string" || data.length === 0) {
    return failure("failed", "The saved site page id was not returned.");
  }

  return { ok: true, id: data };
}

export async function publishSitePage(
  supabase: SupabaseClient<Database> | null,
  id: string,
  now: Date = new Date()
): Promise<AdminContentMutationResult> {
  return transitionSitePage(supabase, id, "published", now.toISOString());
}

export async function unpublishSitePage(
  supabase: SupabaseClient<Database> | null,
  id: string
): Promise<AdminContentMutationResult> {
  return transitionSitePage(supabase, id, "draft", null);
}

async function transitionSitePage(
  supabase: SupabaseClient<Database> | null,
  id: string,
  status: SitePageStatus,
  publishedAt: string | null
): Promise<AdminContentMutationResult> {
  if (!supabase) return failure("unavailable");

  const { error } = await supabase.rpc(TRANSITION_SITE_PAGE_RPC, {
    p_id: id,
    p_status: status,
    p_published_at: publishedAt as unknown as string
  });

  return error ? failure("failed", error.message) : { ok: true };
}
