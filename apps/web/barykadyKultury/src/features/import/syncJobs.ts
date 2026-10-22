import type { SupabaseClient } from "@supabase/supabase-js";

import type { Locale } from "../i18n/locales";
import type { Json } from "../../types/database.types";
import type { Database } from "../../types/database.types";

import type { SyncDiffSummary } from "./syncDiff";

/**
 * T-042 S8 — durable sync-job status used by the admin page.
 *
 * RLS restricts this table to admins. The request contains only non-secret
 * metadata; tokens/private keys never leave the server function.
 */
export type SyncJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "unchanged"
  | "blocked"
  | "failed";

export type SyncMode = "preview" | "apply";

export interface SyncJobRequest {
  readonly mode: SyncMode;
  readonly kind: "document" | "publication";
  readonly fileId: string;
  readonly entityId?: string | null;
  readonly locale: Locale;
  readonly slug?: string | null;
  readonly title?: string | null;
  readonly description?: string | null;
  readonly documentType?: string | null;
  readonly publish?: boolean;
  readonly allowOriginalDownload?: boolean;
}

export interface SyncJob {
  readonly id: string;
  readonly kind: "document" | "publication";
  readonly entityId: string | null;
  readonly locale: Locale;
  readonly status: SyncJobStatus;
  readonly errorCode: string | null;
  readonly summary: SyncDiffSummary | null;
  readonly request: SyncJobRequest;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
}

type JobRow = Database["public"]["Tables"]["content_sync_jobs"]["Row"];

function mapJob(row: JobRow): SyncJob {
  return {
    id: row.id,
    kind: row.kind as SyncJob["kind"],
    entityId: row.entity_id,
    locale: row.locale as Locale,
    status: row.status as SyncJobStatus,
    errorCode: row.error_code,
    summary: (row.summary as unknown as SyncDiffSummary | null) ?? null,
    request: row.request as unknown as SyncJobRequest,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  };
}

export async function createSyncJob(
  client: SupabaseClient<Database>,
  request: SyncJobRequest,
  requestedBy: string
): Promise<string> {
  const { data, error } = await client
    .from("content_sync_jobs")
    .insert({
      kind: request.kind,
      entity_id: request.entityId ?? null,
      locale: request.locale,
      status: "queued",
      // D-41: attribution is enforced at the row, not inferred from the token.
      requested_by: requestedBy,
      request: request as unknown as NonNullable<Json>
    })
    .select("id")
    .single();

  if (error !== null) {
    // The partial unique index is the single-flight invariant for direct admin
    // inserts; coalesce onto the active job instead of surfacing a 23505.
    if (
      error.code === "23505" &&
      request.entityId !== undefined &&
      request.entityId !== null
    ) {
      const existing = await client
        .from("content_sync_jobs")
        .select("id")
        .eq("kind", request.kind)
        .eq("entity_id", request.entityId)
        .in("status", ["queued", "running"])
        .limit(1)
        .maybeSingle();
      if (existing.error === null && existing.data !== null) {
        return (existing.data as { id: string }).id;
      }
    }
    throw new Error(error.message);
  }
  if (data === null) {
    throw new Error("sync job insert failed");
  }
  return (data as { id: string }).id;
}

export async function fetchSyncJob(
  client: SupabaseClient<Database>,
  id: string
): Promise<SyncJob | null> {
  const { data, error } = await client
    .from("content_sync_jobs")
    .select(
      "id, kind, entity_id, locale, status, error_code, summary, request, created_at, updated_at, started_at, finished_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error !== null || data === null) return null;
  return mapJob(data as JobRow);
}

export function isTerminalJobStatus(status: SyncJobStatus): boolean {
  return (
    status === "succeeded" ||
    status === "unchanged" ||
    status === "blocked" ||
    status === "failed"
  );
}
