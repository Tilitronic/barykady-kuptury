import { flushPromises } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import AdminProjectEditPage from "@/pages/admin/AdminProjectEditPage.vue";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * T-029 gate fix — project cover upload through the shared `useUpload` seam.
 *
 * T-027's cover path was moved from `features/admin/projects/api` to the
 * shared composable during T-029, but no test exercised the page seam. This
 * regression test pins the three guarantees the extraction must preserve:
 *   1. validation happens BEFORE any Storage request (an SVG never uploads);
 *   2. the stored value is a bucket-relative `projects/...` object key, not a
 *      public URL;
 *   3. after a successful row write, the replaced object is removed.
 *
 * Authority: docs/architecture.md §6 (validate before transfer, object keys),
 * docs/tickets/T-029-admin-publications-documents.md (shared useUpload), and
 * T-027 (the editor's create/edit contract).
 */

const PROJECT_ID = "00000000-0000-4000-8000-000000000901";
const OLD_COVER = "projects/old-cover.png";

function projectRow() {
  return {
    id: PROJECT_ID,
    slug: "cover-project",
    status: "draft" as const,
    featured_rank: null,
    cover_path: OLD_COVER,
    start_date: null,
    end_date: null,
    published_at: null,
    updated_at: "2026-06-01T12:00:00.000Z",
    project_translations: [
      {
        project_id: PROJECT_ID,
        locale: "en" as const,
        title: "Cover project",
        summary: "Summary.",
        body: "Body."
      }
    ]
  };
}

function pngFile() {
  return new File(["png"], "cover.png", { type: "image/png" });
}

function svgFile() {
  return new File(["<svg/>"], "cover.svg", { type: "image/svg+xml" });
}

async function chooseFile(
  wrapper: {
    get: (selector: string) => {
      element: Element;
      trigger: (event: string) => Promise<void>;
    };
  },
  file: File
): Promise<void> {
  const input = wrapper.get('[data-testid="project-cover"]');
  Object.defineProperty(input.element, "files", {
    configurable: true,
    value: [file]
  });
  await input.trigger("change");
}

describe("AdminProjectEditPage cover upload (T-029 seam)", () => {
  it("validates before transfer, stores projects/…, and removes the replaced object after save", async () => {
    const fake = createFakeSupabase({
      tables: { projects: [projectRow()] },
      rpc: { data: PROJECT_ID }
    });

    const wrapper = await mountWithPlugins(AdminProjectEditPage, {
      initialRoute: `/en/admin/projects/${PROJECT_ID}`,
      supabase: fake.client,
      routes: [
        {
          path: "/:locale(en|pl|uk)/admin/projects/new",
          component: AdminProjectEditPage
        },
        {
          path: "/:locale(en|pl|uk)/admin/projects/:id",
          component: AdminProjectEditPage
        }
      ]
    });

    await flushPromises();
    expect(
      (wrapper.get('[data-testid="project-slug"]').element as HTMLInputElement)
        .value
    ).toBe("cover-project");

    // ── Validation failure: no bytes cross the Storage boundary. ─────────
    await chooseFile(wrapper, svgFile());
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(fake.storageCalls).toHaveLength(0);
    expect(fake.rpcCalls).toHaveLength(0);
    expect(wrapper.get('[data-testid="project-status-message"]').text()).toBe(
      "The cover image could not be uploaded."
    );

    // ── Valid upload: object key persisted, old object removed after save. ─
    await chooseFile(wrapper, pngFile());
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(fake.storageCalls).toEqual([
      {
        op: "upload",
        bucket: "public-media",
        path: "projects/cover.png",
        contentType: "image/png"
      },
      {
        op: "remove",
        bucket: "public-media",
        path: OLD_COVER
      }
    ]);

    expect(fake.rpcCalls[0]).toMatchObject({
      name: "save_project_v1",
      args: {
        p_id: PROJECT_ID,
        p_cover_path: "projects/cover.png"
      }
    });
    // The browser never persists an absolute public URL.
    expect(JSON.stringify(fake.rpcCalls)).not.toContain("http");
  });
});
