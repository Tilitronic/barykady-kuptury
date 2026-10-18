import { describe, expect, it } from "vitest";

import { selectTranslation } from "@/shared/content/selectTranslation";

/**
 * Spec axis: docs/architecture.md §4 ("Only complete translations intended for
 * publication should be presented as localized content") and
 * docs/tickets/T-015-typed-data-access.md — only complete, published
 * translations are considered; the fallback is English-only and disableable per
 * call site.
 *
 * The mapper is pure, so locale precedence, completeness and the fallback flag
 * are proven without a client or a database.
 */
const EN = { locale: "en", title: "Title (EN)", body: "Body (EN)" };
const PL = { locale: "pl", title: "Tytul (PL)", body: "Tresc (PL)" };

const REQUIRED = { requiredFields: ["title", "body"] } as const;

describe("selectTranslation", () => {
  it("returns Polish when complete", () => {
    expect(
      selectTranslation(
        { status: "published", translations: [EN, PL] },
        "pl",
        REQUIRED
      )
    ).toEqual({ value: PL, isFallback: false });
  });

  it("falls back to English and flags isFallback", () => {
    expect(
      selectTranslation(
        { status: "published", translations: [EN] },
        "pl",
        REQUIRED
      )
    ).toEqual({ value: EN, isFallback: true });
  });

  it("ignores an incomplete published translation", () => {
    const incompletePl = { locale: "pl", title: "Tytul (PL)", body: "   " };

    expect(
      selectTranslation(
        { status: "published", translations: [incompletePl, EN] },
        "pl",
        REQUIRED
      )
    ).toEqual({ value: EN, isFallback: true });
  });

  it("does not fall back when fallback is disabled per call site", () => {
    expect(
      selectTranslation({ status: "published", translations: [EN] }, "pl", {
        ...REQUIRED,
        allowFallback: false
      })
    ).toBeNull();
  });

  it("never falls back from one non-English locale to another", () => {
    expect(
      selectTranslation(
        { status: "published", translations: [PL] },
        "uk",
        REQUIRED
      )
    ).toBeNull();
  });

  it("ignores a non-published parent row", () => {
    expect(
      selectTranslation(
        { status: "draft", translations: [EN, PL] },
        "pl",
        REQUIRED
      )
    ).toBeNull();
  });

  it("treats a null or missing translation list as no content", () => {
    type Fixture = { locale: string; title: string; body: string };

    expect(
      selectTranslation<Fixture>(
        { status: "published", translations: null },
        "pl",
        REQUIRED
      )
    ).toBeNull();
    expect(selectTranslation<Fixture>(null, "pl", REQUIRED)).toBeNull();
  });
});
