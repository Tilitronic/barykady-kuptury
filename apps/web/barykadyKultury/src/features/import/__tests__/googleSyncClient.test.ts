import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/database.types";

import { startGoogleSync, waitForSyncJob } from "../googleSyncClient";
import type { SyncJobRequest } from "../syncJobs";

const REQUEST: SyncJobRequest = {
  mode: "apply",
  kind: "document",
  fileId: "drive-1",
  entityId: "entity-1",
  locale: "en"
};

function client(
  rows: readonly unknown[],
  token: string | null = "admin-token",
  inserts: Record<string, unknown>[] = []
) {
  const builder = {
    insert: (value: Record<string, unknown>) => {
      inserts.push(value);
      return builder;
    },
    select: () => builder,
    eq: () => builder,
    single: async () => ({ data: { id: "job-1" }, error: null }),
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null })
  };
  return {
    from: () => builder,
    auth: {
      getSession: async () => ({
        data: {
          session:
            token === null
              ? null
              : {
                  access_token: token,
                  user: { id: "user-1", email: "admin@demo.local" }
                }
        }
      })
    }
  } as unknown as SupabaseClient<Database>;
}

const JOB = {
  id: "job-1",
  kind: "document",
  entity_id: "entity-1",
  locale: "en",
  status: "succeeded",
  error_code: null,
  summary: null,
  request: REQUEST,
  requested_by: null,
  created_at: "2030-05-01T00:00:00Z",
  updated_at: "2030-05-01T00:00:01Z",
  started_at: null,
  finished_at: null
};

describe("googleSyncClient", () => {
  it("creates the job then invokes the background function with the admin token", async () => {
    const startBackground = vi.fn(
      async () => new Response("{}", { status: 202 })
    );

    await expect(
      startGoogleSync(client([]), REQUEST, { startBackground })
    ).resolves.toBe("job-1");
    expect(startBackground).toHaveBeenCalledWith("job-1", "admin-token");
  });

  it("attributes the job to the acting admin (requested_by)", async () => {
    const inserts: Record<string, unknown>[] = [];
    await startGoogleSync(client([], "admin-token", inserts), REQUEST, {
      startBackground: async () => new Response("{}", { status: 202 })
    });

    expect(inserts[0]).toMatchObject({ requested_by: "user-1" });
  });

  it("refuses to invoke the function without a session", async () => {
    await expect(
      startGoogleSync(client([], null), REQUEST, {
        startBackground: async () => new Response("{}", { status: 202 })
      })
    ).rejects.toThrow("missing-admin-session");
  });

  it("polls until a terminal status", async () => {
    const sleep = vi.fn(async () => undefined);
    const job = await waitForSyncJob(client([JOB]), "job-1", {
      sleep,
      timeoutMs: 10
    });

    expect(job?.status).toBe("succeeded");
    expect(sleep).not.toHaveBeenCalled();
  });

  it("returns the last observed job on timeout", async () => {
    const running = { ...JOB, status: "running" };
    const job = await waitForSyncJob(client([running]), "job-1", {
      sleep: async () => undefined,
      timeoutMs: 0
    });

    // The first poll happens before the timeout check loop exits.
    expect(job?.status).toBe("running");
  });
});
