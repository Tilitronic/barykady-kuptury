import { describe, expect, it } from "vitest";

import { formatDate, formatNumber } from "@/features/i18n/format";

/**
 * docs/PRODUCT_REQUIREMENTS.md §2 item 7 requires locale-aware date/number
 * formatting bound to the active locale. The Polish decimal separator (`,`) is
 * the canonical proof that the locale — not the machine default — is applied.
 */
describe("locale-aware formatting helpers", () => {
  it("formats numbers with the Polish decimal separator", () => {
    expect(formatNumber(3.5, "pl")).toBe("3,5");
    expect(formatNumber(3.5, "en")).toBe("3.5");
    expect(formatNumber(3.5, "uk")).toBe("3,5");
  });

  it("formats dates in the active locale", () => {
    const may1 = new Date(Date.UTC(2024, 4, 1));

    expect(formatDate(may1, "pl", { dateStyle: "long", timeZone: "UTC" })).toBe(
      "1 maja 2024"
    );
    expect(formatDate(may1, "en", { dateStyle: "long", timeZone: "UTC" })).toBe(
      "1 May 2024"
    );
  });

  it("renders English in European order and 24-hour time (en maps to en-GB)", () => {
    // D1 (T-024 review): the site is a Polish/European NGO; US-style
    // "May 1, 2024, 4:00 PM" reads as a foreign convention. The mapping is
    // confined to the Intl tag inside `formatDate` — the `Locale` union,
    // URLs, storage and `document.lang` stay "en".
    const timed = new Date("2030-05-14T16:00:00+02:00");

    expect(
      formatDate(timed, "en", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Warsaw"
      })
    ).toBe("14 May 2030, 16:00");
  });
});
