import { describe, expect, it } from "vitest";

import {
  emptySitePageForm,
  hasSitePageFormErrors,
  sitePageCompleteness,
  sitePageTranslationsForSave,
  updateSitePageTranslation,
  validateSitePageForm,
  type SitePageFormValues
} from "@/features/admin/content/sitePageForm";

/**
 * T-028 — site page form rules (ticket TDD plan step 1).
 *
 * Design authority:
 *   - docs/PRODUCT_REQUIREMENTS.md §6: edit organization information and see
 *     which translations are missing.
 *   - docs/PRODUCT_REQUIREMENTS.md §4-About: organization information must
 *     support all locales; English is the fallback.
 *   - docs/architecture.md §4: translations are one row per (page, locale),
 *     so an edit to one locale must never touch another row.
 *
 * These tests are deliberately client-independent: the page can only render
 * the verdicts produced here.
 */

function withTranslations(
  translations: Partial<SitePageFormValues["translations"]>
): SitePageFormValues {
  const base = emptySitePageForm("about");
  return {
    ...base,
    translations: { ...base.translations, ...translations }
  };
}

describe("site page form", () => {
  it("blocks publish without a complete fallback translation", () => {
    const state = withTranslations({
      en: { title: "About us", body: "", metaDescription: "" }
    });

    const errors = validateSitePageForm(state, { mode: "publish" });

    expect(errors.publish).toBe("fallback-incomplete");
    expect(errors.translations.en).toEqual({ body: "required" });
    expect(hasSitePageFormErrors(errors)).toBe(true);
  });

  it("allows a draft with an incomplete fallback translation", () => {
    const state = withTranslations({
      en: { title: "About us", body: "", metaDescription: "" }
    });

    const errors = validateSitePageForm(state, { mode: "draft" });

    expect(errors.publish).toBeNull();
    expect(errors.translations.en).toBeUndefined();
    expect(hasSitePageFormErrors(errors)).toBe(false);
  });

  it("preserves other locales when editing one", () => {
    const initial = withTranslations({
      en: { title: "About us", body: "EN body", metaDescription: "EN meta" },
      pl: { title: "O nas", body: "PL body", metaDescription: "PL meta" }
    });

    const next = updateSitePageTranslation(initial, "uk", {
      title: "Про нас",
      body: "UK body"
    });

    // Immutability is the guarantee: the old snapshot cannot be mutated by a
    // later edit, so two locale tabs can never overwrite each other.
    expect(next).not.toBe(initial);
    expect(initial.translations.uk).toEqual({
      title: "",
      body: "",
      metaDescription: ""
    });
    expect(next.translations.en).toEqual(initial.translations.en);
    expect(next.translations.pl).toEqual(initial.translations.pl);
    expect(next.translations.uk).toEqual({
      title: "Про нас",
      body: "UK body",
      metaDescription: ""
    });
  });

  it("requires a title when body text exists (the table's NOT NULL rule)", () => {
    const state = withTranslations({
      pl: { title: "   ", body: "Treść", metaDescription: "" }
    });

    const errors = validateSitePageForm(state, { mode: "draft" });

    expect(errors.translations.pl).toEqual({ title: "required" });
    expect(hasSitePageFormErrors(errors)).toBe(true);
  });

  it("reports missing fields per locale for the shared status formatter", () => {
    const state = withTranslations({
      en: { title: "About us", body: "EN body", metaDescription: "" },
      pl: { title: "O nas", body: "", metaDescription: "" }
    });

    const entries = sitePageCompleteness(state);

    expect(entries.find(entry => entry.locale === "en")).toMatchObject({
      complete: true,
      hasContent: true,
      missing: []
    });
    expect(entries.find(entry => entry.locale === "pl")).toMatchObject({
      complete: false,
      hasContent: true,
      missing: ["body"]
    });
    expect(entries.find(entry => entry.locale === "uk")).toMatchObject({
      complete: false,
      hasContent: false,
      missing: ["title", "body"]
    });
  });

  it("sends only locales with a title and preserves their meta description", () => {
    const state = withTranslations({
      en: {
        title: "About us",
        body: "EN body",
        metaDescription: "About the association."
      },
      pl: { title: "O nas", body: "", metaDescription: "" },
      uk: { title: "  ", body: "", metaDescription: "" }
    });

    expect(sitePageTranslationsForSave(state)).toEqual([
      {
        locale: "en",
        title: "About us",
        body: "EN body",
        metaDescription: "About the association."
      },
      { locale: "pl", title: "O nas", body: null, metaDescription: null }
    ]);
  });
});
