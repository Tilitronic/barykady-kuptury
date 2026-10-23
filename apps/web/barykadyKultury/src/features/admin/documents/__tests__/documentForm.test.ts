import { describe, expect, it } from "vitest";

import {
  emptyDocumentForm,
  hasDocumentFormErrors,
  updateDocumentTranslation,
  validateDocumentForm
} from "@/features/admin/documents/documentForm";

/**
 * T-029 RED contract — organization document metadata.
 *
 * Authority:
 *   - docs/tickets/T-029-admin-publications-documents.md — create/edit/delete
 *     with type, date, language, file, sort order and publish toggle.
 *   - docs/PRODUCT_REQUIREMENTS.md §4-About — title plus optional type/date,
 *     one file language, anonymous download.
 *   - docs/architecture.md §4 — root metadata + localized title/description.
 */

describe("validateDocumentForm", () => {
  it("requires a title before publishing", () => {
    const errors = validateDocumentForm(
      { ...emptyDocumentForm(), slug: "statute", documentType: "statute" },
      { mode: "publish" }
    );

    expect(errors.publish).toBe("fallback-incomplete");
    expect(errors.translations.en?.title).toBe("required");
    expect(hasDocumentFormErrors(errors)).toBe(true);
  });

  it("requires a document type", () => {
    const errors = validateDocumentForm(
      { ...emptyDocumentForm(), slug: "statute" },
      { mode: "draft" }
    );

    expect(errors.documentType).toBe("required");
  });

  it("requires a file for a new document", () => {
    const errors = validateDocumentForm(
      {
        ...emptyDocumentForm(),
        slug: "statute",
        documentType: "statute",
        translations: {
          ...emptyDocumentForm().translations,
          en: { title: "Statute", description: "" }
        }
      },
      { mode: "draft", isNew: true }
    );

    expect(errors.storagePath).toBe("required");
  });

  it("accepts a complete file document", () => {
    const errors = validateDocumentForm(
      {
        ...emptyDocumentForm(),
        slug: "statute",
        documentType: "statute",
        storagePath: "documents/statute.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
        translations: {
          ...emptyDocumentForm().translations,
          en: { title: "Statute", description: "" }
        }
      },
      { mode: "publish", isNew: true }
    );

    expect(hasDocumentFormErrors(errors)).toBe(false);
  });

  it("uses the same canonical slug rule as projects/publications", () => {
    expect(
      validateDocumentForm(
        { ...emptyDocumentForm(), documentType: "report" },
        { mode: "draft" }
      ).slug
    ).toBe("required");
    expect(
      validateDocumentForm(
        {
          ...emptyDocumentForm(),
          slug: "Annual Report",
          documentType: "report"
        },
        { mode: "draft" }
      ).slug
    ).toBe("format");
  });

  it("updates one translation without touching another locale", () => {
    const values = updateDocumentTranslation(emptyDocumentForm(), "uk", {
      title: "Статут"
    });

    expect(values.translations.uk.title).toBe("Статут");
    expect(values.translations.en.title).toBe("");
  });
});
