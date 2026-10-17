import { describe, expect, it } from "vitest";

import { resolveLocale } from "@/features/i18n/resolveLocale";

/**
 * Spec axis: docs/PRODUCT_REQUIREMENTS.md §2 "Locale selection behavior" and
 * docs/architecture.md §8 (root chooses persisted → browser → English; an
 * explicit locale URL is authoritative).
 *
 * `resolveLocale` is a pure function: every browser/injection surface is
 * supplied by the caller, so there are no hidden globals to stub.
 */
describe("resolveLocale precedence", () => {
  it("prefers a saved choice over the browser preference", () => {
    expect(
      resolveLocale({
        saved: "pl",
        languages: ["en-US", "en"],
        url: null
      })
    ).toBe("pl");
  });

  it("detects Ukrainian from the ordered browser languages", () => {
    expect(
      resolveLocale({
        saved: null,
        languages: ["de-DE", "uk-UA", "en-US"],
        url: null
      })
    ).toBe("uk");
  });

  it("falls back to English when no browser language is supported", () => {
    expect(
      resolveLocale({
        saved: null,
        languages: ["de-DE", "fr-FR"],
        url: null
      })
    ).toBe("en");
  });

  it("lets an explicit URL locale beat a saved choice", () => {
    expect(
      resolveLocale({
        saved: "uk",
        languages: ["uk-UA"],
        url: "pl"
      })
    ).toBe("pl");
  });

  it("ignores an unsupported locale in the URL and falls back", () => {
    expect(
      resolveLocale({ url: "xx", saved: null, languages: ["pl-PL"] })
    ).toBe("pl");
    expect(resolveLocale({ url: "xx", saved: null, languages: [] })).toBe("en");
  });

  it("defaults to English when there is no saved choice or storage", () => {
    expect(resolveLocale({ languages: ["en-GB"] })).toBe("en");
    expect(resolveLocale()).toBe("en");
  });
});
