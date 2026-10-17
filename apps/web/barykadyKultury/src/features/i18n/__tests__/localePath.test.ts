import { describe, expect, it } from "vitest";

import { replaceLocaleInPath } from "@/features/i18n/localePath";

/**
 * Language switching must preserve the current route and its params
 * (docs/PRODUCT_REQUIREMENTS.md §2 item 3; T-009 acceptance criterion).
 * Only the leading locale segment is rewritten.
 */
describe("replaceLocaleInPath", () => {
  it("swaps the leading locale segment and keeps the rest of the path", () => {
    expect(replaceLocaleInPath("/pl/projects", "uk")).toBe("/uk/projects");
  });

  it("keeps path params after the route", () => {
    expect(replaceLocaleInPath("/pl/projects/42", "en")).toBe(
      "/en/projects/42"
    );
  });

  it("prefixes locale-less paths", () => {
    expect(replaceLocaleInPath("/", "pl")).toBe("/pl");
  });
});
