import { describe, expect, it } from "vitest";

import {
  assignEventProject,
  fetchAdminEventLinks,
  fetchAssignableProjects,
  unassignEventProject
} from "@/features/admin/events/api";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * T-031 — the admin event-mapping data seam.
 *
 * Design authority:
 *   - docs/architecture.md §4: `calendar_event_links` has a UNIQUE
 *     `(calendar_id, google_event_id)` identity and a nullable `project_id`
 *     with `ON DELETE SET NULL`.
 *   - docs/architecture.md §6.1: `events:write` is the write scope for this
 *     table; reads are the second half of the same scope (plus root).
 *   - Ticket T-031: assign/unassign is idempotent, unassign keeps the row with
 *     `project_id = NULL`, and a removed project must be reported rather than
 *     silently creating a dangling link.
 *
 * A single-row upsert is race-safe because PostgreSQL resolves
 * `ON CONFLICT (calendar_id, google_event_id) DO UPDATE` atomically; no RPC is
 * warranted (the ticket explicitly allows plain PostgREST here).
 */

const LINK_ROW = {
  calendar_id: "fixture-calendar@example.org",
  google_event_id: "fixture-event-timed",
  project_id: "00000000-0000-4000-8000-000000000201",
  updated_at: "2026-06-01T12:00:00.000Z"
};

const ASSIGNMENT = {
  calendarId: LINK_ROW.calendar_id,
  googleEventId: LINK_ROW.google_event_id,
  projectId: LINK_ROW.project_id
};

describe("fetchAdminEventLinks", () => {
  it("maps rows, including unlinked mappings with a null project", async () => {
    const fake = createFakeSupabase({
      tables: {
        calendar_event_links: [
          LINK_ROW,
          { ...LINK_ROW, google_event_id: "unlinked", project_id: null }
        ]
      }
    });

    const result = await fetchAdminEventLinks(fake.client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.links).toEqual([
      {
        calendarId: LINK_ROW.calendar_id,
        googleEventId: LINK_ROW.google_event_id,
        projectId: LINK_ROW.project_id,
        updatedAt: LINK_ROW.updated_at
      },
      {
        calendarId: LINK_ROW.calendar_id,
        googleEventId: "unlinked",
        projectId: null,
        updatedAt: LINK_ROW.updated_at
      }
    ]);
  });

  it("reports unavailable without a client", async () => {
    await expect(fetchAdminEventLinks(null)).resolves.toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it("reports a failed read instead of an empty success", async () => {
    const fake = createFakeSupabase({
      tableErrors: { calendar_event_links: "permission denied" }
    });

    await expect(fetchAdminEventLinks(fake.client)).resolves.toEqual({
      ok: false,
      code: "failed",
      message: "permission denied"
    });
  });
});

describe("fetchAssignableProjects", () => {
  it("lists published and draft projects with a fallback title", async () => {
    const fake = createFakeSupabase({
      tables: {
        projects: [
          {
            id: "published",
            slug: "published-project",
            status: "published",
            project_translations: [{ locale: "en", title: "Published Project" }]
          },
          {
            id: "draft",
            slug: "draft-project",
            status: "draft",
            project_translations: [{ locale: "pl", title: "Projekt roboczy" }]
          }
        ]
      }
    });

    const result = await fetchAssignableProjects(fake.client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.projects).toEqual([
      {
        id: "published",
        slug: "published-project",
        status: "published",
        title: "Published Project",
        translations: [{ locale: "en", title: "Published Project" }]
      },
      {
        id: "draft",
        slug: "draft-project",
        status: "draft",
        title: "draft-project",
        translations: [{ locale: "pl", title: "Projekt roboczy" }]
      }
    ]);
  });
});

describe("assignEventProject", () => {
  it("upserts on the calendar/event identity so a repeat assignment is idempotent", async () => {
    const fake = createFakeSupabase({ writes: { data: null } });

    const first = await assignEventProject(fake.client, ASSIGNMENT);
    const second = await assignEventProject(fake.client, ASSIGNMENT);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });

    const upserts = fake.calls.filter(call => call.method === "upsert");
    expect(upserts).toHaveLength(2);
    for (const call of upserts) {
      expect(call.args[0]).toEqual({
        calendar_id: LINK_ROW.calendar_id,
        google_event_id: LINK_ROW.google_event_id,
        project_id: LINK_ROW.project_id
      });
      expect(call.args[1]).toEqual({
        onConflict: "calendar_id,google_event_id"
      });
    }
    // No insert: an insert would violate the unique constraint on the second
    // call instead of converging on one row.
    expect(fake.calls.some(call => call.method === "insert")).toBe(false);
  });

  it("maps a foreign-key violation to project-missing (project deleted elsewhere)", async () => {
    const fake = createFakeSupabase({
      writes: {
        error: {
          code: "23503",
          message: "insert or update violates foreign key constraint"
        }
      }
    });

    await expect(
      assignEventProject(fake.client, ASSIGNMENT)
    ).resolves.toMatchObject({ ok: false, code: "project-missing" });
  });

  it("reports unavailable without a client", async () => {
    await expect(assignEventProject(null, ASSIGNMENT)).resolves.toEqual({
      ok: false,
      code: "unavailable"
    });
  });
});

describe("unassignEventProject", () => {
  it("updates the existing row to a null project instead of deleting it", async () => {
    const fake = createFakeSupabase({ writes: { data: null } });

    const result = await unassignEventProject(fake.client, {
      calendarId: LINK_ROW.calendar_id,
      googleEventId: LINK_ROW.google_event_id
    });

    expect(result).toEqual({ ok: true });

    const update = fake.calls.find(call => call.method === "update");
    expect(update?.args[0]).toEqual({ project_id: null });
    expect(fake.calls.filter(call => call.method === "eq")).toEqual([
      {
        table: "calendar_event_links",
        method: "eq",
        args: ["calendar_id", LINK_ROW.calendar_id]
      },
      {
        table: "calendar_event_links",
        method: "eq",
        args: ["google_event_id", LINK_ROW.google_event_id]
      }
    ]);
    // The event identity must survive unassignment (architecture §4).
    expect(fake.calls.some(call => call.method === "delete")).toBe(false);
  });

  it("reports a failed write", async () => {
    const fake = createFakeSupabase({
      writes: { error: { message: "network down" } }
    });

    await expect(
      unassignEventProject(fake.client, {
        calendarId: LINK_ROW.calendar_id,
        googleEventId: LINK_ROW.google_event_id
      })
    ).resolves.toEqual({ ok: false, code: "failed", message: "network down" });
  });
});
