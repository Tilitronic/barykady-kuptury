import { describe, expect, it } from "vitest";

import { deleteDocument, saveDocument } from "@/features/admin/documents/api";
import {
  emptyDocumentForm,
  type DocumentFormValues
} from "@/features/admin/documents/documentForm";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * T-029 RED contract — document mutation seam.
 *
 * One transactional RPC (same T-045/T-028 per-entity pattern). The stored path
 * is a bucket-relative object key, never an absolute URL.
 */

const DOCUMENT_ID = "00000000-0000-4000-8000-000000000801";

function form(overrides: Partial<DocumentFormValues> = {}): DocumentFormValues {
  const base = emptyDocumentForm();

  return {
    ...base,
    slug: "statute",
    documentType: "statute",
    storagePath: "documents/statute.pdf",
    mimeType: "application/pdf",
    sizeBytes: 456,
    ...overrides,
    translations: {
      ...base.translations,
      en: { title: "Statute", description: "" },
      ...overrides.translations
    }
  };
}

describe("saveDocument", () => {
  it("sends root and translations in one RPC call", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [] },
      rpc: { data: DOCUMENT_ID }
    });

    const result = await saveDocument(fake.client, form());

    expect(result).toEqual({ ok: true, id: DOCUMENT_ID });
    expect(fake.rpcCalls).toHaveLength(1);
    expect(fake.rpcCalls[0]).toMatchObject({
      name: "save_document_v1",
      args: {
        p_id: null,
        p_slug: "statute",
        p_status: "draft",
        p_document_type: "statute",
        p_storage_path: "documents/statute.pdf",
        p_mime_type: "application/pdf",
        p_file_size_bytes: 456,
        p_translations: [{ locale: "en", title: "Statute", description: null }]
      }
    });
    expect(fake.calls.filter(call => call.method === "insert")).toHaveLength(0);
  });

  it("never sends an absolute storage URL", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [] },
      rpc: { data: DOCUMENT_ID }
    });

    const result = await saveDocument(
      fake.client,
      form({ storagePath: "https://example.org/statute.pdf" })
    );

    expect(result).toEqual({ ok: false, code: "invalid-path" });
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it("maps a duplicate canonical slug", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [] },
      rpc: { error: { message: "duplicate key", code: "23505" } }
    });

    expect(await saveDocument(fake.client, form())).toEqual({
      ok: false,
      code: "duplicate-slug"
    });
  });
});

describe("deleteDocument", () => {
  it("removes the stored object best-effort before deleting the row", async () => {
    const fake = createFakeSupabase();

    expect(
      await deleteDocument(fake.client, DOCUMENT_ID, "documents/statute.pdf")
    ).toEqual({ ok: true });
    expect(fake.storageCalls[0]).toMatchObject({
      op: "remove",
      bucket: "public-documents",
      path: "documents/statute.pdf"
    });
    expect(fake.calls.filter(call => call.method === "delete")).toHaveLength(1);
  });
});
