import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  resolveSupabaseSetup,
  SUPABASE_PUBLISHABLE_KEY_VAR,
  SUPABASE_URL_VAR
} from "@/features/content/supabaseConfig";

/**
 * Spec axis: docs/tickets/T-015-typed-data-access.md (client boots from
 * `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`; fails loudly in dev,
 * degrades to "content unavailable" in production), docs/architecture.md §9
 * (only browser-safe values in the bundle) and §6 (no service-role key).
 *
 * The policy is pure, so every branch is proven without a browser or a network.
 */
const HELPER_PATH = resolve(
  process.cwd(),
  "src/features/content/supabaseConfig.ts"
);

const BOOT_PATH = resolve(process.cwd(), "src/boot/supabase.ts");

const CREDENTIALS = {
  url: "https://example.supabase.co",
  publishableKey: "sb_publishable_example"
};

describe("resolveSupabaseSetup", () => {
  it("returns ready credentials when both variables are present", () => {
    expect(resolveSupabaseSetup(CREDENTIALS, { isDev: false })).toEqual({
      kind: "ready",
      ...CREDENTIALS
    });
  });

  it("trims surrounding whitespace from configured values", () => {
    expect(
      resolveSupabaseSetup(
        { url: "  https://example.supabase.co ", publishableKey: "  key  " },
        { isDev: false }
      )
    ).toEqual({
      kind: "ready",
      url: "https://example.supabase.co",
      publishableKey: "key"
    });
  });

  it("throws in development when the configuration is missing", () => {
    expect(() =>
      resolveSupabaseSetup(
        { url: undefined, publishableKey: undefined },
        { isDev: true }
      )
    ).toThrow(new RegExp(SUPABASE_URL_VAR));

    expect(() =>
      resolveSupabaseSetup(
        { url: "https://example.supabase.co", publishableKey: "" },
        { isDev: true }
      )
    ).toThrow(new RegExp(SUPABASE_PUBLISHABLE_KEY_VAR));
  });

  it("degrades to unavailable in production instead of throwing", () => {
    const setup = resolveSupabaseSetup(
      { url: "   ", publishableKey: undefined },
      { isDev: false }
    );

    expect(setup.kind).toBe("unavailable");
    if (setup.kind === "unavailable") {
      expect(setup.message).toContain(SUPABASE_URL_VAR);
      expect(setup.message).toContain(SUPABASE_PUBLISHABLE_KEY_VAR);
    }
  });

  it("treats a non-string value as missing", () => {
    expect(
      resolveSupabaseSetup({ url: 42, publishableKey: null }, { isDev: false })
        .kind
    ).toBe("unavailable");
  });
});

describe("credential boundary", () => {
  it("names no server-only variable in the config helper or the boot client", () => {
    const forbidden = /SERVICE_ROLE|SERVICE_KEY|SECRET/i;

    expect(readFileSync(HELPER_PATH, "utf8")).not.toMatch(forbidden);
    expect(readFileSync(BOOT_PATH, "utf8")).not.toMatch(forbidden);
  });
});
