import { describe, expect, it } from "vitest";

import {
  deletePublication,
  savePublication
} from "@/features/admin/publications/api";
import {
  emptyPublicationForm,
  type PublicationFormValues
} from "@/features/admin/publications/publicationForm";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * T-029 RED contract — publication mutation seam.
 *
 * One RPC carries root + translations + files (the T-045/T-028 per-entity
 * transactional pattern). The client never persists an absolute URL, and a
 * replacement removes the old object only after the row write succeeds.
 */

const PUBLICATION_ID = "00000000-0000-4000-8000-000000000701";

function form(
  overrides: Partial<PublicationFormValues> = {}
): PublicationFormValues {
  const base = emptyPublicationForm();

  return {
    ...base,
    slug: "annual-report",
    ...overrides,
    translations: {
      ...base.translations,
      en: { title: "Annual report", abstract: "Abstract.", authors: "Author" },
      ...overrides.translations
    }
  };
}

describe("savePublication", () => {
  it("sends root, translations and files in one RPC call", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [] },
      rpc: { data: PUBLICATION_ID }
    });

    const result = await savePublication(
      fake.client,
      form({
        files: [
          {
            locale: "en",
            label: "English PDF",
            storagePath: "publications/annual-report-en.pdf",
            mimeType: "application/pdf",
            sizeBytes: 123
          }
        ]
      })
    );

    expect(result).toEqual({ ok: true, id: PUBLICATION_ID });
    expect(fake.rpcCalls).toHaveLength(1);
    expect(fake.rpcCalls[0]).toMatchObject({
      name: "save_publication_v1",
      args: {
        p_id: null,
        p_slug: "annual-report",
        p_status: "draft",
        p_external_url: null,
        p_published_at: null,
        p_translations: [
          {
            locale: "en",
            title: "Annual report",
            abstract: "Abstract.",
            authors: "Author"
          }
        ],
        p_files: [
          {
            locale: "en",
            label: "English PDF",
            storagePath: "publications/annual-report-en.pdf",
            mimeType: "application/pdf",
            sizeBytes: 123
          }
        ]
      }
    });
    // No independent table writes: the database transaction is the unit.
    expect(fake.calls.filter(call => call.method === "insert")).toHaveLength(0);
    expect(fake.calls.filter(call => call.method === "update")).toHaveLength(0);
  });

  it("maps the unique violation to a recoverable duplicate-slug error", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [] },
      rpc: { error: { message: "duplicate key", code: "23505" } }
    });

    expect(await savePublication(fake.client, form())).toEqual({
      ok: false,
      code: "duplicate-slug"
    });
  });

  it("does not misreport a slug-check failure as a duplicate", async () => {
    const fake = createFakeSupabase({
      tableErrors: { publications: "network unavailable" }
    });

    expect(await savePublication(fake.client, form())).toEqual({
      ok: false,
      code: "failed",
      message: "network unavailable"
    });
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it("removes replaced objects only after the RPC succeeds", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [] },
      rpc: { data: PUBLICATION_ID }
    });

    const result = await savePublication(fake.client, form(), {
      replaceStoragePaths: ["publications/annual-report-old.pdf"]
    });

    expect(result).toEqual({ ok: true, id: PUBLICATION_ID });
    expect(fake.storageCalls).toEqual([
      {
        op: "remove",
        bucket: "public-documents",
        path: "publications/annual-report-old.pdf"
      }
    ]);
  });

  it("does not delete anything when the RPC fails", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [] },
      rpc: { error: { message: "transaction failed", code: "23514" } }
    });

    await savePublication(fake.client, form(), {
      replaceStoragePaths: ["publications/annual-report-old.pdf"]
    });

    expect(fake.storageCalls).toHaveLength(0);
  });

  it("reports unavailable without a client", async () => {
    expect(await savePublication(null, form())).toEqual({
      ok: false,
      code: "unavailable"
    });
  });
});

describe("deletePublication", () => {
  it("removes stored files best-effort before deleting the row", async () => {
    const fake = createFakeSupabase();

    const result = await deletePublication(fake.client, PUBLICATION_ID, [
      "publications/report-en.pdf",
      "publications/report-pl.pdf"
    ]);

    expect(result).toEqual({ ok: true });
    expect(fake.storageCalls.map(call => call.op)).toEqual([
      "remove",
      "remove"
    ]);
    expect(fake.calls.filter(call => call.method === "delete")).toHaveLength(1);
  });
});
