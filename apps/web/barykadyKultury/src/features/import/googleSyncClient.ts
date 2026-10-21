import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database.types";

import {
  createSyncJob,
  fetchSyncJob,
  isTerminalJobStatus,
  type SyncJob,
  type SyncJobRequest
} from "./syncJobs";

/**
 * T-042 S7/S8 — browser side of the background sync.
 *
 * The page creates a job (admin RLS), then invokes the Netlify background
 * function with the admin's Supabase access token. The function verifies that
 * token and runs the server-side pipeline. The page polls its own job row; no
 * Google token or service key ever reaches the browser.
 */
export interface StartSyncDependencies {
  readonly startBackground?: (
    jobId: string,
    accessToken: string
  ) => Promise<Response>;
  readonly getAccessToken?: () => Promise<string | null>;
}

export const SYNC_JOB_ENDPOINT =
  "/.netlify/functions/google-doc-sync-background";

export async function startGoogleSync(
  client: SupabaseClient<Database>,
  request: SyncJobRequest,
  dependencies: StartSyncDependencies = {}
): Promise<string> {
  const jobId = await createSyncJob(client, request);

  const accessToken =
    dependencies.getAccessToken !== undefined
      ? await dependencies.getAccessToken()
      : await readAccessToken(client);

  if (accessToken === null || accessToken === "") {
    throw new Error("missing-admin-session");
  }

  const startBackground =
    dependencies.startBackground ??
    ((id: string, token: string) =>
      fetch(SYNC_JOB_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ jobId: id })
      }));

  const response = await startBackground(jobId, accessToken);
  if (!response.ok) {
    throw new Error("sync-start-failed");
  }
  return jobId;
}

async function readAccessToken(
  client: SupabaseClient<Database>
): Promise<string | null> {
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

export interface WaitForSyncOptions {
  readonly intervalMs?: number;
  readonly timeoutMs?: number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}

const defaultSleep = (milliseconds: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });

/**
 * Polls the job until a terminal state. A timeout returns the last observed
 * job (including queued/running) so the UI can show an honest "still running"
 * state instead of hanging.
 */
export async function waitForSyncJob(
  client: SupabaseClient<Database>,
  jobId: string,
  options: WaitForSyncOptions = {}
): Promise<SyncJob | null> {
  const intervalMs = options.intervalMs ?? 2_000;
  const timeoutMs = options.timeoutMs ?? 120_000;
  const sleep = options.sleep ?? defaultSleep;
  const started = Date.now();
  let last: SyncJob | null = null;

  while (Date.now() - started <= timeoutMs) {
    last = await fetchSyncJob(client, jobId);
    if (last !== null && isTerminalJobStatus(last.status)) return last;
    await sleep(intervalMs);
  }

  return last;
}
