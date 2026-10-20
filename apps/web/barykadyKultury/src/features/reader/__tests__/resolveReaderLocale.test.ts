import { describe, expect, it } from "vitest";

import { resolveReaderLocale } from "@/features/reader/resolveReaderLocale";

/**
 * Reader content-language precedence (D-27/D-38):
 * requested `?lang` → UI locale → English → first available.
 */
describe("resolveReaderLocale", () => {
  it("uses an available requested ?lang", () => {
    expect(
      resolveReaderLocale({
        requested: "pl",
        uiLocale: "en",
        available: ["en", "pl", "uk"]
      })
    ).toEqual({ locale: "pl", shouldNormalize: false });
  });

  it("falls back to the UI locale when ?lang is absent", () => {
    expect(
      resolveReaderLocale({
        requested: null,
        uiLocale: "pl",
        available: ["en", "pl"]
      })
    ).toEqual({ locale: "pl", shouldNormalize: false });
  });

  it("falls back to English when the UI locale is unavailable", () => {
    expect(
      resolveReaderLocale({
        requested: undefined,
        uiLocale: "uk",
        available: ["en", "pl"]
      })
    ).toEqual({ locale: "en", shouldNormalize: false });
  });

  it("falls back to the first available translation", () => {
    expect(
      resolveReaderLocale({
        requested: null,
        uiLocale: "en",
        available: ["pl", "uk"]
      })
    ).toEqual({ locale: "pl", shouldNormalize: false });
  });

  it("normalizes an unsupported language tag", () => {
    expect(
      resolveReaderLocale({
        requested: "de",
        uiLocale: "pl",
        available: ["en", "pl"]
      })
    ).toEqual({ locale: "pl", shouldNormalize: true });
  });

  it("normalizes a supported but unavailable language", () => {
    expect(
      resolveReaderLocale({
        requested: "uk",
        uiLocale: "en",
        available: ["en", "pl"]
      })
    ).toEqual({ locale: "en", shouldNormalize: true });
  });

  it("normalizes a language tag with different casing", () => {
    // Locale tags in the URL contract are lower-case (`?lang=en|pl|uk`); any
    // other form is invalid input and is replaced with the fallback locale.
    expect(
      resolveReaderLocale({
        requested: "PL",
        uiLocale: "en",
        available: ["en", "pl"]
      })
    ).toEqual({ locale: "en", shouldNormalize: true });
  });

  it("treats a blank ?lang as absent", () => {
    expect(
      resolveReaderLocale({
        requested: "   ",
        uiLocale: "pl",
        available: ["pl"]
      })
    ).toEqual({ locale: "pl", shouldNormalize: false });
  });

  it("keeps a valid locale when no translation is readable", () => {
    expect(
      resolveReaderLocale({
        requested: null,
        uiLocale: "uk",
        available: []
      })
    ).toEqual({ locale: "uk", shouldNormalize: false });
  });

  it("deduplicates available locales without changing order", () => {
    expect(
      resolveReaderLocale({
        requested: null,
        uiLocale: "en",
        available: ["pl", "pl", "uk"]
      })
    ).toEqual({ locale: "pl", shouldNormalize: false });
  });
});
