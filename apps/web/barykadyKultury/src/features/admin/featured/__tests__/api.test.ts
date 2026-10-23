import { describe, expect, it } from "vitest";

import {
  addFeaturedProject,
  fetchFeaturedAdminData,
  moveFeaturedProject,
  removeFeaturedProject,
  reorderFeaturedProjects
} from "@/features/admin/featured/api";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * T-030 — featured-admin data seam.
 *
 * The pgTAP suite proves the database invariants (dense ranks, published-only,
 * unpublish/delete cleanup). These unit tests prove the client seam:
 *   - the featured list honours rank and defensively drops non-published rows;
 *   - a draft cannot even reach the add RPC (localized service error);
 *   - mutations use the dedicated RPCs and retry once on a deferred-index
 *     conflict, never on an authorization failure.
 */

function publishedRow(
  id: string,
  rank: number | null,
  title: string,
  updatedAt = "2026-01-01T00:00:00Z"
) {
  return {
    id,
    slug: id,
    status: "published",
    featured_rank: rank,
    updated_at: updatedAt,
    project_translations: [{ locale: "en", title }]
  };
}

describe("fetchFeaturedAdminData", () => {
  it("orders featured rows by rank and lists unfeatured published rows", async () => {
    const fake = createFakeSupabase({
      tables: {
        projects: [
          publishedRow("second", 2, "Second"),
          publishedRow("first", 1, "First"),
          publishedRow("available", null, "Available")
        ]
      }
    });

    const result = await fetchFeaturedAdminData(fake.client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.featured.map(row => row.id)).toEqual(["first", "second"]);
    expect(result.available.map(row => row.id)).toEqual(["available"]);
    expect(fake.calls.some(call => call.method === "eq")).toBe(true);
  });

  it("removes unpublished rows even if the query leaked them", async () => {
    const fake = createFakeSupabase({
      tables: {
        projects: [
          { ...publishedRow("draft", 1, "Draft"), status: "draft" },
          publishedRow("live", 2, "Live")
        ]
      }
    });

    const result = await fetchFeaturedAdminData(fake.client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.featured.map(row => row.id)).toEqual(["live"]);
  });

  it("falls back to the slug when no English title exists", async () => {
    const fake = createFakeSupabase({
      tables: {
        projects: [
          {
            ...publishedRow("slug-only", 1, "ignored"),
            project_translations: [{ locale: "pl", title: "Tylko polski" }]
          }
        ]
      }
    });

    const result = await fetchFeaturedAdminData(fake.client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.featured[0]?.title).toBe("slug-only");
  });

  it("reports unavailable without a client", async () => {
    await expect(fetchFeaturedAdminData(null)).resolves.toEqual({
      ok: false,
      code: "unavailable"
    });
  });
});

describe("featured mutations", () => {
  it("rejects a draft before calling the RPC", async () => {
    const fake = createFakeSupabase({
      tables: {
        projects: [{ id: "draft", status: "draft" }]
      }
    });

    const result = await addFeaturedProject(fake.client, "draft");

    expect(result).toMatchObject({ ok: false, code: "not-published" });
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it("reports a missing project as not-found", async () => {
    const fake = createFakeSupabase({ tables: { projects: [] } });

    await expect(addFeaturedProject(fake.client, "missing")).resolves.toEqual({
      ok: false,
      code: "not-found"
    });
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it("adds a published project through set_project_featured_v1", async () => {
    const fake = createFakeSupabase({
      tables: {
        projects: [{ id: "project-1", status: "published" }]
      }
    });

    const result = await addFeaturedProject(fake.client, "project-1");

    expect(result).toEqual({ ok: true });
    expect(fake.rpcCalls[0]).toEqual({
      name: "set_project_featured_v1",
      args: { p_id: "project-1", p_featured: true }
    });
  });

  it("maps a database published-only rejection to not-published", async () => {
    const fake = createFakeSupabase({
      tables: {
        projects: [{ id: "project-1", status: "published" }]
      },
      rpc: {
        error: {
          message: "only published projects can be featured",
          code: "23514"
        }
      }
    });

    const result = await addFeaturedProject(fake.client, "project-1");

    expect(result).toMatchObject({ ok: false, code: "not-published" });
    expect(fake.rpcCalls).toHaveLength(1);
  });

  it("removes a project through the same RPC with p_featured=false", async () => {
    const fake = createFakeSupabase();

    const result = await removeFeaturedProject(fake.client, "project-1");

    expect(result).toEqual({ ok: true });
    expect(fake.rpcCalls[0]).toEqual({
      name: "set_project_featured_v1",
      args: { p_id: "project-1", p_featured: false }
    });
  });

  it("persists the complete desired order through the reorder RPC", async () => {
    const fake = createFakeSupabase();

    const result = await reorderFeaturedProjects(fake.client, ["c", "a", "b"]);

    expect(result).toEqual({ ok: true });
    expect(fake.rpcCalls[0]).toEqual({
      name: "reorder_featured_projects_v1",
      args: { p_ids: ["c", "a", "b"] }
    });
  });

  it("retries the reorder once on a deferred-rank conflict", async () => {
    const fake = createFakeSupabase({
      rpcResults: [
        { error: { message: "duplicate key", code: "23505" } },
        { data: null, error: null }
      ]
    });

    const result = await reorderFeaturedProjects(fake.client, ["b", "a"]);

    expect(result).toEqual({ ok: true });
    expect(fake.rpcCalls).toHaveLength(2);
    expect(fake.rpcCalls[1]?.args).toEqual({ p_ids: ["b", "a"] });
  });

  it("does not retry an authorization failure", async () => {
    const fake = createFakeSupabase({
      rpc: { error: { message: "permission denied", code: "42501" } }
    });

    const result = await reorderFeaturedProjects(fake.client, ["b", "a"]);

    expect(result).toMatchObject({ ok: false, code: "failed" });
    expect(fake.rpcCalls).toHaveLength(1);
  });

  it("moves a project and persists the resulting order", async () => {
    const fake = createFakeSupabase();

    const result = await moveFeaturedProject(
      fake.client,
      ["a", "b", "c"],
      "c",
      "up"
    );

    expect(result).toEqual({ ok: true, ids: ["a", "c", "b"] });
    expect(fake.rpcCalls[0]?.args).toEqual({ p_ids: ["a", "c", "b"] });
  });
});
