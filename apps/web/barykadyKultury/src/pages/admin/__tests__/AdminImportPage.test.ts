import type { SupabaseClient } from "@supabase/supabase-js";
import { flushPromises } from "@vue/test-utils";
import { Quasar } from "quasar";
import { mountWithPlugins } from "@/test-utils/mount";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/database.types";
import type { SyncJob } from "@/features/import/syncJobs";

import AdminImportPage from "../AdminImportPage.vue";

const JOB: SyncJob = {
  id: "job-1",
  kind: "document",
  entityId: "entity-1",
  locale: "en",
  status: "succeeded",
  errorCode: null,
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
  request: { mode: "apply", kind: "document", fileId: "drive-1", locale: "en" },
  createdAt: "2030-05-01T00:00:00Z",
  updatedAt: "2030-05-01T00:00:01Z",
  startedAt: null,
  finishedAt: null
};

async function mountImport(overrides: Record<string, unknown> = {}) {
  return mountWithPlugins(AdminImportPage, {
    initialRoute: "/en/admin/import",
    props: overrides,
    plugins: [Quasar],
    supabase: { from: vi.fn() } as unknown as SupabaseClient<Database>
  });
}

async function fillGoogle(
  wrapper: Awaited<ReturnType<typeof mountImport>>
): Promise<void> {
  await wrapper.get("input[data-testid='import-title']").setValue("Statute");
  await wrapper.get("input[data-testid='import-slug']").setValue("statute");
  await wrapper
    .get("input[data-testid='import-google-id']")
    .setValue("https://docs.google.com/document/d/drive-1/edit");
}

describe("AdminImportPage (Google v1)", () => {
  it("renders only the Google source, not a file dropzone", async () => {
    const wrapper = await mountImport();

    expect(wrapper.text()).toContain("Title");
    expect(wrapper.text()).toContain("Language");
    expect(wrapper.text()).toContain("Google Doc");
    expect(wrapper.find("input[type='file']").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("dropzone");
  });

  it("validates title/slug before starting a Drive job", async () => {
    const startGoogle = vi.fn(async () => "job-1");
    const wrapper = await mountImport({ startGoogle });

    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(startGoogle).not.toHaveBeenCalled();
    expect(wrapper.get("[data-testid='import-status']").text()).toContain(
      "Enter a title"
    );
  });

  it("starts the apply job, polls it and shows the diff summary", async () => {
    const startGoogle = vi.fn(async () => "job-1");
    const waitForJob = vi.fn(async () => JOB);
    const wrapper = await mountImport({ startGoogle, waitForJob });

    await fillGoogle(wrapper);
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(startGoogle).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        mode: "apply",
        kind: "document",
        fileId: "drive-1",
        slug: "statute"
      })
    );
    expect(wrapper.text()).toContain("Change summary");
    expect(wrapper.text()).toContain("Added: New");
    expect(wrapper.text()).toContain("Sync complete");
  });

  it("runs a preview check without persisting and keeps the diff visible", async () => {
    const startGoogle = vi.fn(async () => "job-1");
    const waitForJob = vi.fn(async () => JOB);
    const wrapper = await mountImport({ startGoogle, waitForJob });

    await fillGoogle(wrapper);
    await wrapper.get("[data-testid='import-check']").trigger("click");
    await flushPromises();

    expect(startGoogle).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mode: "preview" })
    );
    expect(wrapper.text()).toContain("Change summary");
  });

  it("shows Sync now once an entity id is known", async () => {
    const startGoogle = vi.fn(async () => "job-1");
    const waitForJob = vi.fn(async () => JOB);
    const wrapper = await mountImport({ startGoogle, waitForJob });

    await fillGoogle(wrapper);
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("Sync now");
  });
});
