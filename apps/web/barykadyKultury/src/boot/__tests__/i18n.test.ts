import { describe, expect, it } from "vitest";

import i18nBoot from "@/boot/i18n";

/**
 * Guards the `#q-app` runtime alias. If the alias points at a declaration-only
 * entry (or disappears), this import fails to resolve and the suite breaks —
 * which is exactly the drift this test exists to catch.
 */
describe("#q-app runtime alias", () => {
  it("resolves the Quasar boot wrapper when importing a boot file", () => {
    expect(typeof i18nBoot).toBe("function");
  });
});
