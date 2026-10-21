/**
 * T-042 S9 — public stale-while-revalidate endpoint (`GET /api/content-check`).
 *
 * The reader renders the stored copy immediately; this binding only checks one
 * published Google-backed row's Drive `modifiedTime` and, when newer, enqueues
 * the same single-flight sync job. The service key and Google token stay here.
 * The response contains no source path, file id or credential.
 */

import { createContentCheckHandler } from "../../apps/web/barykadyKultury/src/features/import/contentCheckHandler";
import { createGoogleDriveClient } from "../../apps/web/barykadyKultury/src/features/import/googleDriveClient";
import {
  exchangeGoogleCredentials,
  resolveGoogleCredentials,
} from "../../apps/web/barykadyKultury/src/features/import/googleCredentials";
import {
  callServiceRpc,
  type ServerSupabaseConfig,
} from "../../apps/web/barykadyKultury/src/features/import/serverSupabase";

const BASE_INTERVAL_MINUTES = 15;

function config(): ServerSupabaseConfig | null {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (url.trim() === "" || serviceKey.trim() === "") return null;
  return { url, serviceKey };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

interface ClaimRow {
  readonly outcome?: unknown;
  readonly entity_id?: unknown;
  readonly file_id?: unknown;
  readonly locale?: unknown;
  readonly source_synced_at?: unknown;
  readonly source_modified_at?: unknown;
}

async function claim(
  supabase: ServerSupabaseConfig,
  kind: "document" | "publication",
  slug: string,
) {
  const payload = await callServiceRpc(supabase, "claim_content_check_v1", {
    p_kind: kind,
    p_slug: slug,
    p_base_interval_minutes: BASE_INTERVAL_MINUTES,
  });
  const row = Array.isArray(payload) ? (payload[0] as ClaimRow | undefined) : undefined;
  const outcome = row?.outcome;
  if (outcome !== "checked") {
    return {
      outcome:
        outcome === "throttled" || outcome === "not-found" || outcome === "not-google"
          ? outcome
          : "not-found",
    } as const;
  }
  if (
    typeof row?.entity_id !== "string" ||
    typeof row.file_id !== "string" ||
    typeof row.locale !== "string"
  ) {
    return { outcome: "not-found" as const };
  }
  return {
    outcome: "checked" as const,
    target: {
      entityId: row.entity_id,
      kind,
      fileId: row.file_id,
      locale: row.locale,
      sourceSyncedAt: typeof row.source_synced_at === "string" ? row.source_synced_at : null,
      sourceModifiedAt: typeof row.source_modified_at === "string" ? row.source_modified_at : null,
    },
  };
}

async function getDriveToken(): Promise<string | null> {
  const credentials = resolveGoogleCredentials(process.env);
  if (credentials.mode === "unavailable") return null;
  const token = await exchangeGoogleCredentials(credentials, async (request) => {
    const response = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: request.body,
    });
    if (!response.ok) return null;
    return response.json();
  });
  return token?.accessToken ?? null;
}

export default async function contentCheck(request: Request): Promise<Response> {
  const supabase = config();
  if (supabase === null) return json({ updateAvailable: false });

  return createContentCheckHandler({
    claimCheck: (kind, slug) => claim(supabase, kind, slug),
    getModifiedTime: async (fileId) => {
      const token = await getDriveToken();
      if (token === null) throw new Error("credentials-unavailable");
      const metadata = await createGoogleDriveClient({
        accessToken: token,
      }).getFileMetadata(fileId);
      return metadata.modifiedTime;
    },
    enqueueSync: async (target) => {
      const request = {
        mode: "apply",
        kind: target.kind,
        fileId: target.fileId,
        entityId: target.entityId,
        locale: target.locale,
      };
      const payload = await callServiceRpc(supabase, "enqueue_content_sync_job_v1", {
        p_kind: target.kind,
        p_entity_id: target.entityId,
        p_locale: target.locale,
        p_request: request,
      });
      return typeof payload === "string" ? payload : null;
    },
    recordSuccess: async (target) => {
      await callServiceRpc(supabase, "record_content_check_result_v1", {
        p_kind: target.kind,
        p_entity_id: target.entityId,
        p_success: true,
      });
    },
    recordFailure: async (target) => {
      await callServiceRpc(supabase, "record_content_check_result_v1", {
        p_kind: target.kind,
        p_entity_id: target.entityId,
        p_success: false,
      });
    },
  })(request);
}
