import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "@/types/database.types";
import { fetchLatestSyncRun } from "../contentSyncRuns";

const ROW = {
  id: "run-1",
  started_at: "2030-05-01T00:00:00Z",
  finished_at: "2030-05-01T00:01:00Z",
  checked: 4,
  updated: 2,
  failed: 1,
  skipped: 1
};

function client(row: unknown) {
  const builder = {
    select: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => ({ data: row, error: null })
  };
  return { from: () => builder } as unknown as SupabaseClient<Database>;
}

describe("fetchLatestSyncRun", () => {
  it("maps the aggregate row", async () => {
    await expect(fetchLatestSyncRun(client(ROW))).resolves.toEqual({
      id: "run-1",
      startedAt: ROW.started_at,
      finishedAt: ROW.finished_at,
      checked: 4,
      updated: 2,
      failed: 1,
      skipped: 1
    });
  });

  it("returns null when no run exists", async () => {
    await expect(fetchLatestSyncRun(client(null))).resolves.toBeNull();
  });
});
