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
 * docs/architecture.md §4 (lifecycle + published_at) and §6 (RLS is the real
 * write boundary; this module is the only client write path).
 *
 * Optimistic-free contract: publish/unpublish return the persisted outcome and
 * the caller re-reads. These tests assert the exact row payload sent to
 * PostgREST — status transitions cannot silently drop `published_at`.
 */

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

describe("publishProject", () => {
  it("sets status published and a published_at timestamp", async () => {
    const fake = createFakeSupabase({ tables: { projects: [] } });

    const result = await publishProject(
      fake.client,
      "00000000-0000-4000-8000-000000000201",
      new Date("2026-05-01T10:00:00Z")
    );

    expect(result).toEqual({ ok: true });

    const update = callsOf(fake, "update")[0];
    expect(update?.table).toBe("projects");
    expect(update?.args[0]).toMatchObject({
      status: "published",
      published_at: "2026-05-01T10:00:00.000Z"
    });
    expect(
      fake.calls.some(
        call =>
          call.method === "eq" &&
          call.args[0] === "id" &&
          call.args[1] === "00000000-0000-4000-8000-000000000201"
      )
    ).toBe(true);
  });

  it("reports unavailable without a client", async () => {
    expect(await publishProject(null, "id")).toEqual({
      ok: false,
      code: "unavailable"
    });
  });
});

describe("unpublishProject", () => {
  it("returns the project to draft and clears published_at", async () => {
    const fake = createFakeSupabase();

    const result = await unpublishProject(
      fake.client,
      "00000000-0000-4000-8000-000000000201"
    );

    expect(result).toEqual({ ok: true });
    expect(callsOf(fake, "update")[0]?.args[0]).toMatchObject({
      status: "draft",
      published_at: null
    });
  });

  it("unpublished rows disappear from the public query", async () => {
    // The public data layer always narrows to `status = published`, and the
    // shared translation selector rejects a non-published root even if a
    // payload leaks it — the app-layer complement to RLS (architecture §6).
    const draftRow = {
      id: "00000000-0000-4000-8000-000000000201",
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
  it("sets archived and clears published_at", async () => {
    const fake = createFakeSupabase();

    expect(await archiveProject(fake.client, "project-1")).toEqual({
      ok: true
    });
    expect(callsOf(fake, "update")[0]?.args[0]).toMatchObject({
      status: "archived",
      published_at: null
    });
  });

  it("an archived row is absent from the public listing", async () => {
    const archivedRow = {
      id: "00000000-0000-4000-8000-000000000201",
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

describe("saveProject", () => {
  it("creates the root row and stores an incomplete draft translation", async () => {
    const fake = createFakeSupabase({
      tables: { projects: [] },
      writes: { data: { id: "00000000-0000-4000-8000-000000000301" } }
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

    expect(result).toEqual({
      ok: true,
      id: "00000000-0000-4000-8000-000000000301"
    });

    const insert = callsOf(fake, "insert")[0];
    expect(insert?.table).toBe("projects");
    expect(insert?.args[0]).toMatchObject({
      slug: "spring-workshop",
      status: "draft",
      featured_rank: null,
      cover_path: null,
      start_date: null,
      end_date: null,
      published_at: null
    });

    const translationWrite = fake.calls.find(
      call => call.table === "project_translations" && call.method === "upsert"
    );
    expect(translationWrite?.args[0]).toEqual([
      {
        project_id: "00000000-0000-4000-8000-000000000301",
        locale: "en",
        title: "Draft title",
        summary: null,
        body: null
      }
    ]);
  });

  it("refuses a duplicate canonical slug before writing", async () => {
    const fake = createFakeSupabase({
      tables: {
        projects: [{ id: "other", slug: "spring-workshop" }]
      }
    });

    const result = await saveProject(fake.client, form());

    expect(result).toEqual({ ok: false, code: "duplicate-slug" });
    expect(callsOf(fake, "insert")).toHaveLength(0);
  });

  it("maps a database unique violation to a field-level slug error", async () => {
    // The pre-check is advisory; the database constraint is authoritative. A
    // concurrent insert must surface as a recoverable field error, not a crash.
    const fake = createFakeSupabase({
      tables: { projects: [] },
      writes: {
        error: { message: "duplicate key value", code: "23505" }
      }
    });

    expect(await saveProject(fake.client, form())).toEqual({
      ok: false,
      code: "duplicate-slug"
    });
  });

  it("updates the root row instead of inserting when an id is supplied", async () => {
    const fake = createFakeSupabase();

    await saveProject(
      fake.client,
      form({ status: "published", featured: true }),
      {
        id: "00000000-0000-4000-8000-000000000201",
        existingFeaturedRank: 3,
        existingPublishedAt: "2026-04-01T09:00:00Z"
      }
    );

    expect(callsOf(fake, "insert")).toHaveLength(0);
    expect(callsOf(fake, "update")[0]?.args[0]).toMatchObject({
      slug: "spring-workshop",
      status: "published",
      // Featured keeps its existing rank (ordering is T-030); publishing keeps
      // the original publication timestamp.
      featured_rank: 3,
      published_at: "2026-04-01T09:00:00Z"
    });
  });
});

describe("fetchAdminProject", () => {
  it("maps the row and its translations into the admin domain model", async () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000201",
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

    const result = await fetchAdminProject(
      fake.client,
      "00000000-0000-4000-8000-000000000201"
    );

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
