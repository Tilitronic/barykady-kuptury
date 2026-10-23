import { describe, expect, it } from "vitest";

import {
  emptyPublicationForm,
  hasPublicationFormErrors,
  publicationFileRows,
  removePublicationFile,
  updatePublicationTranslation,
  upsertPublicationFile,
  validatePublicationForm,
  type PublicationFileDraft
} from "@/features/admin/publications/publicationForm";

/**
 * T-029 RED contract — publication metadata/files.
 *
 * Authority:
 *   - docs/tickets/T-029-admin-publications-documents.md — URL xor file
 *     versions, one active file per language, publish requires a title.
 *   - docs/PRODUCT_REQUIREMENTS.md §4-Publications — title, abstract, authors,
 *     date, language and either a download or an external URL.
 *   - docs/architecture.md §4 — root metadata + one translation per locale.
 */

const enFile: PublicationFileDraft = {
  locale: "en",
  label: "English PDF",
  storagePath: "publications/report-en.pdf",
  mimeType: "application/pdf",
  sizeBytes: 10
};

const plFile: PublicationFileDraft = {
  locale: "pl",
  label: "Polish PDF",
  storagePath: "publications/report-pl.pdf",
  mimeType: "application/pdf",
  sizeBytes: 20
};

describe("validatePublicationForm", () => {
  it("rejects both a URL and file versions", () => {
    const values = {
      ...emptyPublicationForm(),
      slug: "report",
      externalUrl: "https://example.org/report",
      files: [enFile]
    };

    const errors = validatePublicationForm(values, { mode: "draft" });

    expect(errors.action).toBe("both");
    expect(hasPublicationFormErrors(errors)).toBe(true);
  });

  it("allows a draft with neither action while editing", () => {
    const errors = validatePublicationForm(
      { ...emptyPublicationForm(), slug: "report" },
      { mode: "draft" }
    );

    expect(errors.action).toBeNull();
  });

  it("requires exactly one action when publishing", () => {
    const values = {
      ...emptyPublicationForm(),
      slug: "report",
      translations: {
        ...emptyPublicationForm().translations,
        en: { title: "Report", abstract: "", authors: "" }
      }
    };

    const errors = validatePublicationForm(values, { mode: "publish" });

    expect(errors.action).toBe("missing");
  });

  it("accepts file versions as the publish action", () => {
    const values = {
      ...emptyPublicationForm(),
      slug: "report",
      files: [enFile],
      translations: {
        ...emptyPublicationForm().translations,
        en: { title: "Report", abstract: "", authors: "" }
      }
    };

    expect(validatePublicationForm(values, { mode: "publish" })).toMatchObject({
      action: null,
      publish: null
    });
  });

  it("blocks publish without a title", () => {
    const errors = validatePublicationForm(
      { ...emptyPublicationForm(), slug: "report", files: [enFile] },
      { mode: "publish" }
    );

    expect(errors.publish).toBe("fallback-incomplete");
    expect(errors.translations.en?.title).toBe("required");
    expect(hasPublicationFormErrors(errors)).toBe(true);
  });

  it("rejects an external URL that is not http(s)", () => {
    const errors = validatePublicationForm(
      {
        ...emptyPublicationForm(),
        slug: "report",
        externalUrl: "javascript:alert(1)"
      },
      { mode: "draft" }
    );

    expect(errors.externalUrl).toBe("invalid");
  });

  it("applies the canonical slug rules used by D-24/T-038", () => {
    expect(
      validatePublicationForm(
        { ...emptyPublicationForm(), slug: "Not A Slug" },
        { mode: "draft" }
      ).slug
    ).toBe("format");
    expect(
      validatePublicationForm(
        { ...emptyPublicationForm(), slug: "report" },
        {
          mode: "draft",
          existingSlugs: [{ id: "other", slug: "report" }]
        }
      ).slug
    ).toBe("duplicate");
  });
});

describe("publication file rows", () => {
  it("renders a language-labelled row per file", () => {
    const rows = publicationFileRows({
      ...emptyPublicationForm(),
      files: [enFile, plFile]
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      locale: "en",
      language: "English",
      storagePath: "publications/report-en.pdf"
    });
    expect(rows[1]).toMatchObject({
      locale: "pl",
      language: "Polski",
      storagePath: "publications/report-pl.pdf"
    });
  });

  it("replaces the file for the same language instead of adding a second", () => {
    const values = upsertPublicationFile(
      { ...emptyPublicationForm(), files: [enFile] },
      { ...enFile, storagePath: "publications/report-en-v2.pdf" }
    );

    expect(values.files).toHaveLength(1);
    expect(values.files[0]?.storagePath).toBe("publications/report-en-v2.pdf");
  });

  it("removes a language version", () => {
    const values = removePublicationFile(
      { ...emptyPublicationForm(), files: [enFile, plFile] },
      "en"
    );

    expect(values.files.map(file => file.locale)).toEqual(["pl"]);
  });

  it("updates one translation without touching another locale", () => {
    const values = updatePublicationTranslation(emptyPublicationForm(), "pl", {
      title: "Raport"
    });

    expect(values.translations.pl.title).toBe("Raport");
    expect(values.translations.en.title).toBe("");
  });
});
