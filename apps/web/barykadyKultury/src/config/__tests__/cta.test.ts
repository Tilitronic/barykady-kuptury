import { describe, expect, it } from "vitest";

import { ctaInternalPath, ctaIsExternal } from "@/config/cta";

/**
 * CTA config (T-025): the destination is configured or absent — the UI never
 * invents one (AGENTS.md rule 6). These are the two pure decisions the CTA
 * component makes; the component itself is exercised through the page.
 */

describe("cta config helpers", () => {
  it("classifies absolute http(s) hrefs as external, everything else internal", () => {
    expect(ctaIsExternal("https://example.org/donate")).toBe(true);
    expect(ctaIsExternal("http://example.org")).toBe(true);
    expect(ctaIsExternal("support")).toBe(false);
    expect(ctaIsExternal("about/team")).toBe(false);
    // Not a scheme a browser would navigate externally:
    expect(ctaIsExternal("javascript:alert(1)")).toBe(false);
  });

  it("builds internal paths under the active locale from locale-agnostic segments", () => {
    expect(ctaInternalPath("support", "pl")).toBe("/pl/support");
    expect(ctaInternalPath("about/team", "uk")).toBe("/uk/about/team");
  });
});
