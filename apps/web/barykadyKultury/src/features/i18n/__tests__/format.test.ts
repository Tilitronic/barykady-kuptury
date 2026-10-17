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
      "May 1, 2024"
    );
  });
});
