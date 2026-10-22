import { describe, expect, it } from "vitest";

import { fetchPublishedProjects } from "@/features/projects/api";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

import {
  archiveProject,
  fetchAdminProject,
  publishProject,
  saveProject,
  unpublishProject
} from "@/features/admin/projects/api";
import {
  emptyProjectForm,
  type ProjectFormValues
} from "@/features/admin/projects/projectForm";

/**
 * Spec axis: docs/tickets/T-027-admin-projects.md (TDD plan step 3),
 * docs/tickets/T-045-admin-mutation-hardening.md (one transactional RPC),
 * docs/architecture.md §4 (lifecycle + published_at) and §6 (authorization at
 * the data boundary).
 *
 * T-045 cutover: the module still owns the discriminated result union and the
 * page contract, but it no longer orchestrates root/translation/lifecycle
 * requests itself. These tests therefore assert the RPC envelope — name and
 * argument payload — and that no independent table write is issued. Atomicity
 * itself is proven by supabase/tests/admin_project_mutations_test.sql.
 */

const PROJECT_ID = "00000000-0000-4000-8000-000000000301";
const EXISTING_ID = "00000000-0000-4000-8000-000000000201";

function form(overrides: Partial<ProjectFormValues> = {}): ProjectFormValues {
  const base = emptyProjectForm();

  return {
    ...base,
    slug: "spring-workshop",
    ...overrides,
    translations: {
      ...base.translations,
      en: { title: "Spring Workshop", summary: "Summary.", body: "Body." },
      ...overrides.translations
    }
  };
}

function callsOf(fake: ReturnType<typeof createFakeSupabase>, method: string) {
  return fake.calls.filter(call => call.method === method);
}

describe("saveProject", () => {
  it("sends the root and complete translation set in one RPC call", async () => {
    const fake = createFakeSupabase({
      tables: { projects: [] },
      rpc: { data: PROJECT_ID }
    });

    const result = await saveProject(
      fake.client,
      form({
        translations: {
          en: { title: "Draft title", summary: "", body: "" },
          pl: { title: "", summary: "", body: "" },
          uk: { title: "", summary: "", body: "" }
        }
      })
    );

    expect(result).toEqual({ ok: true, id: PROJECT_ID });

    expect(fake.rpcCalls).toHaveLength(1);
    expect(fake.rpcCalls[0]).toMatchObject({
      name: "save_project_v1",
      args: {
        p_id: null,
        p_slug: "spring-workshop",
        p_status: "draft",
        p_featured_rank: null,
        p_cover_path: null,
        p_start_date: null,
        p_end_date: null,
        p_published_at: null,
        // A locale row exists only when it has a title; blank summary/body
        // become null. This is exactly what makes an incomplete draft savable.
        p_translations: [
          {
            locale: "en",
            title: "Draft title",
            summary: null,
            body: null
          }
        ]
      }
    });

    // T-045: the browser must not issue the old multi-request write sequence.
    expect(callsOf(fake, "insert")).toHaveLength(0);
    expect(callsOf(fake, "update")).toHaveLength(0);
    expect(callsOf(fake, "upsert")).toHaveLength(0);
    expect(callsOf(fake, "delete")).toHaveLength(0);
  });

  it("refuses a duplicate canonical slug before writing", async () => {
    const fake = createFakeSupabase({
      tables: {
        projects: [{ id: "other", slug: "spring-workshop" }]
      }
    });

    const result = await saveProject(fake.client, form());

    expect(result).toEqual({ ok: false, code: "duplicate-slug" });
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it("maps a database unique violation to a field-level slug error", async () => {
    // The pre-check is advisory; the database constraint is authoritative. A
    // concurrent insert must surface as a recoverable field error, not a crash.
    const fake = createFakeSupabase({
      tables: { projects: [] },
      rpc: {
        error: { message: "duplicate key value", code: "23505" }
      }
    });

    expect(await saveProject(fake.client, form())).toEqual({
      ok: false,
      code: "duplicate-slug"
    });
  });

  it("updates the root row instead of inserting when an id is supplied", async () => {
    const fake = createFakeSupabase({
      rpc: { data: EXISTING_ID }
    });

    await saveProject(
      fake.client,
      form({ status: "published", featured: true }),
      {
        id: EXISTING_ID,
        existingFeaturedRank: 3,
        existingPublishedAt: "2026-04-01T09:00:00Z"
      }
    );

    expect(fake.rpcCalls[0]).toMatchObject({
      name: "save_project_v1",
      args: {
        p_id: EXISTING_ID,
        p_status: "published",
        // Featured keeps its existing rank (ordering is T-030); publishing
        // keeps the original publication timestamp.
        p_featured_rank: 3,
        p_published_at: "2026-04-01T09:00:00Z"
      }
    });
    expect(callsOf(fake, "insert")).toHaveLength(0);
    expect(callsOf(fake, "update")).toHaveLength(0);
  });

  it("stamps a fresh publication time when publishing without one", async () => {
    const fake = createFakeSupabase({ rpc: { data: PROJECT_ID } });

    await saveProject(fake.client, form({ status: "published" }));

    const args = fake.rpcCalls[0]?.args ?? {};
    expect(args.p_status).toBe("published");
    expect(typeof args.p_published_at).toBe("string");
    expect(args.p_published_at).toEqual(expect.any(String));
  });

  it("reports unavailable without a client", async () => {
    expect(await saveProject(null, form())).toEqual({
      ok: false,
      code: "unavailable"
    });
  });
});

describe("publishProject", () => {
  it("sends one atomic lifecycle transition with a publication timestamp", async () => {
    const fake = createFakeSupabase();

    const result = await publishProject(
      fake.client,
      EXISTING_ID,
      new Date("2026-05-01T10:00:00Z")
    );

    expect(result).toEqual({ ok: true });
    expect(fake.rpcCalls).toEqual([
      {
        name: "transition_project_v1",
        args: {
          p_id: EXISTING_ID,
          p_status: "published",
          p_published_at: "2026-05-01T10:00:00.000Z"
        }
      }
    ]);
    expect(callsOf(fake, "update")).toHaveLength(0);
  });

  it("reports unavailable without a client", async () => {
    expect(await publishProject(null, "id")).toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it("maps a denied or failed transition to the shared failure contract", async () => {
    const fake = createFakeSupabase({
      rpc: { error: { message: "admin role required" } }
    });

    expect(await publishProject(fake.client, EXISTING_ID)).toEqual({
      ok: false,
      code: "failed",
      message: "admin role required"
    });
  });
});

describe("unpublishProject", () => {
  it("returns the project to draft and clears published_at atomically", async () => {
    const fake = createFakeSupabase();

    const result = await unpublishProject(fake.client, EXISTING_ID);

    expect(result).toEqual({ ok: true });
    expect(fake.rpcCalls[0]).toEqual({
      name: "transition_project_v1",
      args: {
        p_id: EXISTING_ID,
        p_status: "draft",
        p_published_at: null
      }
    });
    expect(callsOf(fake, "update")).toHaveLength(0);
  });

  it("unpublished rows disappear from the public query", async () => {
    // The public data layer always narrows to `status = published`, and the
    // shared translation selector rejects a non-published root even if a
    // payload leaks it — the app-layer complement to RLS (architecture §6).
    const draftRow = {
      id: EXISTING_ID,
      slug: "spring-workshop",
      status: "draft" as const,
      featured_rank: null,
      cover_path: null,
      start_date: null,
      end_date: null,
      published_at: null,
      updated_at: "2026-05-01T10:00:00Z",
      project_translations: [
        { locale: "en", title: "Spring Workshop", summary: "Summary." }
      ]
    };
    const fake = createFakeSupabase({ tables: { projects: [draftRow] } });

    expect(await fetchPublishedProjects(fake.client, "en")).toEqual({
      kind: "empty"
    });
    expect(
      fake.calls
        .filter(call => call.method === "eq" && call.args[0] === "status")
        .map(call => call.args[1])
    ).toEqual(["published"]);
  });
});

describe("archiveProject", () => {
  it("sets archived and clears published_at atomically", async () => {
    const fake = createFakeSupabase();

    expect(await archiveProject(fake.client, "project-1")).toEqual({
      ok: true
    });
    expect(fake.rpcCalls[0]).toEqual({
      name: "transition_project_v1",
      args: {
        p_id: "project-1",
        p_status: "archived",
        p_published_at: null
      }
    });
    expect(callsOf(fake, "update")).toHaveLength(0);
  });

  it("an archived row is absent from the public listing", async () => {
    const archivedRow = {
      id: EXISTING_ID,
      slug: "spring-workshop",
      status: "archived" as const,
      featured_rank: null,
      cover_path: null,
      start_date: null,
      end_date: null,
      published_at: null,
      updated_at: "2026-05-01T10:00:00Z",
      project_translations: [
        { locale: "en", title: "Spring Workshop", summary: "Summary." }
      ]
    };
    const fake = createFakeSupabase({ tables: { projects: [archivedRow] } });

    expect(await fetchPublishedProjects(fake.client, "en")).toEqual({
      kind: "empty"
    });
  });
});

describe("fetchAdminProject", () => {
  it("maps the row and its translations into the admin domain model", async () => {
    const row = {
      id: EXISTING_ID,
      slug: "spring-workshop",
      status: "draft",
      featured_rank: null,
      cover_path: null,
      start_date: "2026-03-01",
      end_date: null,
      published_at: null,
      updated_at: "2026-05-01T10:00:00Z",
      project_translations: [
        {
          locale: "en",
          title: "Spring Workshop",
          summary: "Summary.",
          body: "Body."
        }
      ]
    };
    const fake = createFakeSupabase({
      tables: { projects: [row] }
    });

    const result = await fetchAdminProject(fake.client, EXISTING_ID);

    expect(result).toEqual({
      ok: true,
      project: {
        id: row.id,
        slug: "spring-workshop",
        status: "draft",
        featured: false,
        featuredRank: null,
        coverPath: null,
        startDate: "2026-03-01",
        endDate: null,
        publishedAt: null,
        updatedAt: "2026-05-01T10:00:00Z",
        translations: {
          en: { title: "Spring Workshop", summary: "Summary.", body: "Body." },
          pl: { title: "", summary: "", body: "" },
          uk: { title: "", summary: "", body: "" }
        }
      }
    });
  });
});
