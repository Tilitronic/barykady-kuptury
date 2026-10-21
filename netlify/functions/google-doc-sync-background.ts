/**
 * T-042 S7/S8 — Netlify background sync binding.
 *
 * The admin page enqueues a `content_sync_jobs` row, then POSTs `{ jobId }`
 * with the admin's Supabase access token. This function verifies that token,
 * runs the shared server pipeline and writes the terminal job status. Tokens,
 * service keys and Google credentials never leave this process.
 */

import { isLocale } from "../../apps/web/barykadyKultury/src/features/i18n/locales";
import {
  runServerGoogleSync,
  type ServerGoogleSyncInitial,
} from "../../apps/web/barykadyKultury/src/features/import/serverGoogleSync";
import {
  selectRows,
  updateRows,
  verifyAdminToken,
  type ServerSupabaseConfig,
} from "../../apps/web/barykadyKultury/src/features/import/serverSupabase";

interface SyncRequest {
  readonly mode?: unknown;
  readonly kind?: unknown;
  readonly fileId?: unknown;
  readonly entityId?: unknown;
  readonly locale?: unknown;
  readonly slug?: unknown;
  readonly title?: unknown;
  readonly description?: unknown;
  readonly documentType?: unknown;
  readonly publish?: unknown;
  readonly allowOriginalDownload?: unknown;
}

function config(): ServerSupabaseConfig | null {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (url.trim() === "" || serviceKey.trim() === "") return null;
  return { url, serviceKey };
}

function bearer(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
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

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function validKind(value: unknown): value is "document" | "publication" {
  return value === "document" || value === "publication";
}

function validMode(value: unknown): value is "preview" | "apply" {
  return value === "preview" || value === "apply";
}

async function updateJob(
  supabase: ServerSupabaseConfig,
  jobId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await updateRows(supabase, "content_sync_jobs", `id=eq.${encodeURIComponent(jobId)}`, patch);
}

export default async function googleDocSyncBackground(request: Request): Promise<Response> {
  const supabase = config();
  if (supabase === null) return json({ error: "server_unavailable" }, 500);

  const identity = await verifyAdminToken(supabase, bearer(request));
  if (identity === null) return json({ error: "unauthorized" }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  const jobId =
    typeof body === "object" && body !== null
      ? asString((body as { jobId?: unknown }).jobId)
      : null;
  if (jobId === null || jobId.trim() === "") {
    return json({ error: "invalid_request" }, 400);
  }

  const jobRows = await selectRows(
    supabase,
    "content_sync_jobs",
    `select=id,status,entity_id,locale,request&id=eq.${encodeURIComponent(jobId)}&limit=1`,
  );
  const job = jobRows[0];
  if (job === undefined) return json({ error: "not_found" }, 404);
  if (
    job.status === "succeeded" ||
    job.status === "unchanged" ||
    job.status === "blocked" ||
    job.status === "failed" ||
    job.status === "running"
  ) {
    // A duplicate invocation must not run a second pipeline.
    return json({ ok: true });
  }

  await updateJob(supabase, jobId, {
    status: "running",
    started_at: new Date().toISOString(),
  });

  const syncRequest = job.request as SyncRequest;
  const kind = syncRequest.kind;
  const mode = syncRequest.mode;
  const fileId = asString(syncRequest.fileId);
  const locale = syncRequest.locale;
  const entityId = asString(job.entity_id);

  if (!validKind(kind) || !validMode(mode) || fileId === null || !isLocale(locale)) {
    await updateJob(supabase, jobId, {
      status: "failed",
      error_code: "invalid-target",
      finished_at: new Date().toISOString(),
    });
    return json({ ok: false }, 202);
  }

  const initial: ServerGoogleSyncInitial | undefined =
    entityId === null
      ? {
          slug: asString(syncRequest.slug) ?? "",
          title: asString(syncRequest.title) ?? "",
          description: asString(syncRequest.description),
          documentType: asString(syncRequest.documentType) ?? "report",
          publish: asBoolean(syncRequest.publish),
          allowOriginalDownload: asBoolean(syncRequest.allowOriginalDownload),
        }
      : undefined;

  try {
    const result = await runServerGoogleSync(
      {
        supabase,
        googleEnv: process.env,
        now: () => new Date(),
      },
      {
        kind,
        entityId,
        locale,
        fileId,
        mode,
        ...(initial !== undefined ? { initial } : {}),
      },
    );

    if (result.status === "synced") {
      await updateJob(supabase, jobId, {
        status: "succeeded",
        entity_id: result.entityId,
        summary: result.summary,
        finished_at: new Date().toISOString(),
      });
    } else if (result.status === "preview") {
      await updateJob(supabase, jobId, {
        status: "succeeded",
        summary: result.summary,
        finished_at: new Date().toISOString(),
      });
    } else if (result.status === "unchanged") {
      await updateJob(supabase, jobId, {
        status: "unchanged",
        finished_at: new Date().toISOString(),
      });
    } else if (result.status === "blocked") {
      await updateJob(supabase, jobId, {
        status: "blocked",
        finished_at: new Date().toISOString(),
      });
    } else {
      await updateJob(supabase, jobId, {
        status: "failed",
        error_code: result.error,
        finished_at: new Date().toISOString(),
      });
    }
  } catch {
    await updateJob(supabase, jobId, {
      status: "failed",
      error_code: "sync-failed",
      finished_at: new Date().toISOString(),
    });
  }

  return json({ ok: true }, 202);
}
