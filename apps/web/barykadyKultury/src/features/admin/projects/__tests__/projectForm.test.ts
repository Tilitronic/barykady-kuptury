import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "@/features/i18n/locales";

import {
  emptyProjectForm,
  translationCompleteness,
  validateProjectForm,
  type ProjectFormValues
} from "@/features/admin/projects/projectForm";

/**
 * Spec axis: docs/tickets/T-027-admin-projects.md (TDD plan step 1) and
 * docs/PRODUCT_REQUIREMENTS.md §6 / §4-projects.
 *
 * The admin form is the write-side mirror of the public read rule
 * (src/features/projects/api.ts PROJECT_REQUIRED_FIELDS): a draft may be
 * incomplete, but publishing needs a usable fallback translation, and the
 * canonical slug (D-24/T-038) must be globally unique and stable.
 */

function translation(
  title = "",
  summary = "",
  body = ""
): { title: string; summary: string; body: string } {
  return { title, summary, body };
}

/** A valid fallback (English) draft and empty pl/uk rows. */
function form(overrides: Partial<ProjectFormValues> = {}): ProjectFormValues {
  const base = emptyProjectForm();

  return {
    ...base,
    slug: "spring-workshop",
    ...overrides,
    // Translations merge last so a partial override keeps the other locales.
    translations: {
      ...base.translations,
      en: translation("Spring Workshop", "A short summary.", "Body."),
      ...overrides.translations
    }
  };
}

const existing = [{ id: "project-1", slug: "spring-workshop" }];

describe("validateProjectForm — publish gate", () => {
  it("requires a title in the fallback locale to publish", () => {
    const values = form({
      translations: {
        en: translation("", "Summary only.", ""),
        pl: translation("Warsztat", "Podsumowanie.", ""),
        uk: translation("", "", "")
      }
    });

    const errors = validateProjectForm(values, { mode: "publish" });

    expect(errors.publish).toBe("fallback-incomplete");
    // A specific field error so the user knows which tab to open.
    expect(errors.translations.en?.title).toBe("required");
  });

  it("requires a summary in the fallback locale to publish", () => {
    const values = form({
      translations: {
        en: translation("Title only", "", "Body."),
        pl: translation("", "", ""),
        uk: translation("", "", "")
      }
    });

    const errors = validateProjectForm(values, { mode: "publish" });

    expect(errors.publish).toBe("fallback-incomplete");
    expect(errors.translations.en?.summary).toBe("required");
  });

  it("passes publish validation with a complete fallback translation", () => {
    const errors = validateProjectForm(form(), {
      mode: "publish",
      existingSlugs: []
    });

    expect(errors.publish).toBeNull();
    expect(errors.slug).toBeNull();
    expect(errors.translations).toEqual({});
  });

  it("allows a non-fallback locale to stay incomplete when publishing", () => {
    // pl/uk are simply not public until complete; the fallback is what gates
    // the root publication (T-027 scope: "complete locale to publish that
    // locale").
    const errors = validateProjectForm(form(), { mode: "publish" });

    expect(errors.publish).toBeNull();
    expect(errors.translations.pl).toBeUndefined();
    expect(errors.translations.uk).toBeUndefined();
  });
});

describe("validateProjectForm — draft save", () => {
  it("allows saving an incomplete draft", () => {
    const values = form({
      translations: {
        en: translation("", "", ""),
        pl: translation("", "", ""),
        uk: translation("", "", "")
      }
    });

    const errors = validateProjectForm(values, { mode: "draft" });

    expect(errors.publish).toBeNull();
    expect(errors.translations).toEqual({});
    expect(errors.slug).toBeNull();
  });

  it("still requires an editorial slug for a draft", () => {
    expect(
      validateProjectForm(form({ slug: "" }), { mode: "draft" }).slug
    ).toBe("required");
  });
});

describe("validateProjectForm — canonical slug (D-24/T-038)", () => {
  it("rejects a duplicate canonical slug globally", () => {
    const errors = validateProjectForm(form(), {
      mode: "draft",
      existingSlugs: existing
    });

    expect(errors.slug).toBe("duplicate");
  });

  it("does not treat the project's own slug as a duplicate", () => {
    const errors = validateProjectForm(form(), {
      mode: "draft",
      existingSlugs: existing,
      currentProjectId: "project-1"
    });

    expect(errors.slug).toBeNull();
  });

  it("rejects a malformed slug", () => {
    for (const slug of [
      "Spring Workshop",
      "spring_workshop",
      "-spring",
      "spring-"
    ]) {
      expect(
        validateProjectForm(form({ slug }), { mode: "draft" }).slug,
        slug
      ).toBe("format");
    }
  });

  it("never rewrites the slug to match a changed title", () => {
    const values = form({
      slug: "stable-editorial-slug",
      translations: {
        en: translation("A Completely Different Title", "Summary.", "Body."),
        pl: translation("", "", ""),
        uk: translation("", "", "")
      }
    });

    validateProjectForm(values, { mode: "publish" });

    expect(values.slug).toBe("stable-editorial-slug");
  });
});

describe("validateProjectForm — dates", () => {
  it("rejects an end date before the start date", () => {
    const errors = validateProjectForm(
      form({ startDate: "2026-03-20", endDate: "2026-03-01" }),
      { mode: "draft" }
    );

    expect(errors.endDate).toBe("before-start");
  });

  it("accepts an open-ended project", () => {
    const errors = validateProjectForm(form({ startDate: "2026-03-20" }), {
      mode: "draft"
    });

    expect(errors.endDate).toBeNull();
  });

  it("rejects an unparseable date", () => {
    const errors = validateProjectForm(form({ startDate: "not-a-date" }), {
      mode: "draft"
    });

    expect(errors.startDate).toBe("invalid");
  });
});

describe("validateProjectForm — translation rows", () => {
  it("requires a title before a locale can carry any text", () => {
    // The database enforces `title NOT NULL` per translation row; text with no
    // title cannot be persisted, so it must be reported instead of dropped.
    const errors = validateProjectForm(
      form({
        translations: {
          en: translation("Spring Workshop", "A short summary.", "Body."),
          pl: translation("", "Podsumowanie bez tytułu.", ""),
          uk: translation("", "", "")
        }
      }),
      { mode: "draft" }
    );

    expect(errors.translations.pl?.title).toBe("required");
  });
});

describe("translationCompleteness", () => {
  it("reports missing fields per locale without mixing locales", () => {
    const report = translationCompleteness(
      form({
        translations: {
          en: translation("Title", "Summary", "Body"),
          pl: translation("Tytuł", "", ""),
          uk: translation("", "", "")
        }
      })
    );

    expect(report).toHaveLength(SUPPORTED_LOCALES.length);
    expect(report.find(entry => entry.locale === "en")).toEqual({
      locale: "en",
      complete: true,
      hasContent: true,
      missing: []
    });
    expect(report.find(entry => entry.locale === "pl")).toEqual({
      locale: "pl",
      complete: false,
      hasContent: true,
      missing: ["summary", "body"]
    });
    expect(report.find(entry => entry.locale === "uk")).toEqual({
      locale: "uk",
      complete: false,
      hasContent: false,
      missing: ["title", "summary", "body"]
    });
  });
});
