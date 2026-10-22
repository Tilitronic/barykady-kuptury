import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "@/types/database.types";

import {
  createSyncJob,
  fetchSyncJob,
  isTerminalJobStatus,
  type SyncJobRequest
} from "../syncJobs";

/** T-042 S8 — job row mapping/creation contract with a chainable fake. */
const REQUEST: SyncJobRequest = {
  mode: "apply",
  kind: "document",
  fileId: "drive-1",
  locale: "en",
  slug: "statute",
  title: "Statute",
  publish: true
};

const ROW = {
  id: "job-1",
  kind: "document",
  entity_id: "entity-1",
  locale: "en",
  status: "succeeded",
  error_code: null,
  summary: {
    previousBlocks: 1,
    nextBlocks: 2,
    previousHeadings: ["Old"],
    nextHeadings: ["New"],
    addedHeadings: ["New"],
    removedHeadings: ["Old"],
    imageCount: 0,
    tableCount: 0
  },
  request: REQUEST,
  requested_by: null,
  created_at: "2030-05-01T00:00:00Z",
  updated_at: "2030-05-01T00:00:01Z",
  started_at: "2030-05-01T00:00:00Z",
  finished_at: "2030-05-01T00:00:01Z"
};

function createClient(rows: readonly unknown[] = [ROW]) {
  const inserts: Record<string, unknown>[] = [];
  const filters: { method: string; args: unknown[] }[] = [];

  const builder = {
    insert: (value: Record<string, unknown>) => {
      inserts.push(value);
      return builder;
    },
    select: () => builder,
    eq: (...args: unknown[]) => {
      filters.push({ method: "eq", args });
      return builder;
    },
    single: async () => ({ data: { id: "job-1" }, error: null }),
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null })
  };

  return {
    client: { from: () => builder } as unknown as SupabaseClient<Database>,
    inserts,
    filters
  };
}

describe("syncJobs", () => {
  it("inserts a queued job with non-secret request metadata", async () => {
    const fake = createClient();
    await expect(createSyncJob(fake.client, REQUEST, "user-1")).resolves.toBe(
      "job-1"
    );

    expect(fake.inserts[0]).toMatchObject({
      kind: "document",
      locale: "en",
      status: "queued",
      request: REQUEST,
      requested_by: "user-1"
    });
  });

  it("coalesces a direct insert onto the active job on 23505", async () => {
    const builder = {
      insert: () => builder,
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      limit: () => builder,
      single: async () => ({
        data: null,
        error: { code: "23505", message: "duplicate active job" }
      }),
      maybeSingle: async () => ({ data: { id: "job-active" }, error: null })
    };
    const client = {
      from: () => builder
    } as unknown as SupabaseClient<Database>;

    await expect(
      createSyncJob(client, { ...REQUEST, entityId: "entity-1" }, "user-1")
    ).resolves.toBe("job-active");
  });

  it("maps a job row and its diff summary", async () => {
    const fake = createClient();
    await expect(fetchSyncJob(fake.client, "job-1")).resolves.toMatchObject({
      id: "job-1",
      status: "succeeded",
      entityId: "entity-1",
      summary: { addedHeadings: ["New"], removedHeadings: ["Old"] }
    });
    expect(fake.filters).toContainEqual({
      method: "eq",
      args: ["id", "job-1"]
    });
  });

  it("returns null for a missing/error row", async () => {
    const fake = createClient([]);
    await expect(fetchSyncJob(fake.client, "missing")).resolves.toBeNull();
  });

  it("knows which statuses stop polling", () => {
    expect(isTerminalJobStatus("queued")).toBe(false);
    expect(isTerminalJobStatus("running")).toBe(false);
    expect(isTerminalJobStatus("succeeded")).toBe(true);
    expect(isTerminalJobStatus("unchanged")).toBe(true);
    expect(isTerminalJobStatus("blocked")).toBe(true);
    expect(isTerminalJobStatus("failed")).toBe(true);
  });
});
