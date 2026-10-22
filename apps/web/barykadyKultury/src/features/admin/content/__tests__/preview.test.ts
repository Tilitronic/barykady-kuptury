import { describe, expect, it } from "vitest";

import {
  mapAdminSitePage,
  type AdminSitePage
} from "@/features/admin/content/api";
import { resolveSitePagePreview } from "@/features/admin/content/preview";

/**
 * T-028 preview policy: the admin preview must resolve exactly like the public
 * About page (complete title + body, English fallback), while still allowing a
 * draft row to be inspected.
 */

function translation(
  locale: "en" | "pl" | "uk",
  title: string,
  body: string | null,
  metaDescription: string | null = null
) {
  return {
    id: `translation-${locale}`,
    page_id: "page-1",
    locale,
    title,
    body,
    meta_description: metaDescription,
    needs_review: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z"
  };
}

const TRANSLATIONS = {
  en: translation("en", "About us", "EN body", "Meta"),
  pl: translation("pl", "O nas", null),
  uk: translation("uk", "Про нас", null)
};

function page(status: "draft" | "published" = "draft"): AdminSitePage {
  return mapAdminSitePage({
    id: "page-1",
    page_key: "about",
    status,
    sort_order: 1,
    published_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    site_page_translations: [TRANSLATIONS.en, TRANSLATIONS.pl, TRANSLATIONS.uk]
  });
}

describe("resolveSitePagePreview", () => {
  it("previews a draft in the requested locale when complete", () => {
    expect(resolveSitePagePreview(page("draft"), "en")).toEqual({
      title: "About us",
      body: "EN body",
      isFallback: false
    });
  });

  it("falls back to English when the requested locale is incomplete", () => {
    expect(resolveSitePagePreview(page(), "pl")).toEqual({
      title: "About us",
      body: "EN body",
      isFallback: true
    });
  });

  it("returns null when no locale is complete (the public page would be empty)", () => {
    const incomplete = page();
    const translations = {
      ...incomplete.translations,
      en: { ...incomplete.translations.en, body: "" }
    };

    expect(
      resolveSitePagePreview({ ...incomplete, translations }, "en")
    ).toBeNull();
  });
});
