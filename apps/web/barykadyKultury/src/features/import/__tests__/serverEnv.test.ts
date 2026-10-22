import { describe, expect, it } from "vitest";

import { readServerSupabaseConfig } from "../serverEnv";

/**
 * D-41/T-042 review fix — Netlify functions must read server-only env names.
 *
 * `VITE_*` variables are inlined into the browser bundle by Vite. Falling back
 * to them in a function blurs the secret boundary and can silently "work" with
 * a publishable key. The helper therefore fails closed unless the server URL
 * and service-role key are both present under their server names.
 */
describe("readServerSupabaseConfig", () => {
  it("reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY", () => {
    expect(
      readServerSupabaseConfig({
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: "service-key"
      })
    ).toEqual({ url: "http://127.0.0.1:54321", serviceKey: "service-key" });
  });

  it("fails closed when only browser VITE_* values are present", () => {
    expect(
      readServerSupabaseConfig({
        VITE_SUPABASE_URL: "http://127.0.0.1:54321",
        VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-key"
      } as never)
    ).toBeNull();
  });

  it("fails closed on a blank service key or URL", () => {
    expect(
      readServerSupabaseConfig({
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: "   "
      })
    ).toBeNull();
    expect(
      readServerSupabaseConfig({
        SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "service-key"
      })
    ).toBeNull();
  });
});
