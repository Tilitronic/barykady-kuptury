import { describe, expect, it, vi } from "vitest";

import { verifyAdminToken, type ServerSupabaseConfig } from "../serverSupabase";

/**
 * T-042 + T-046 — the background import function must accept a scoped editor
 * with `importer`, not only the root `role = 'admin'` claim.
 *
 * The expression mirrors the database: `is_admin() OR
 * has_capability('importer')`. `app_metadata` is the only claim source;
 * `user_metadata` is user-editable and must never widen access.
 */
function config(payload: unknown, status = 200): ServerSupabaseConfig {
  return {
    url: "https://db.example.test",
    serviceKey: "service-key",
    fetchImpl: vi.fn(
      async () =>
        new Response(JSON.stringify(payload), {
          status,
          headers: { "content-type": "application/json" }
        })
    ) as unknown as typeof fetch
  };
}

function user(appMetadata: Record<string, unknown>, userMetadata = {}) {
  return {
    id: "00000000-0000-4000-8000-0000000000c1",
    email: "editor@example.org",
    app_metadata: appMetadata,
    user_metadata: userMetadata
  };
}

describe("verifyAdminToken (D-17 root or D-42 importer scope)", () => {
  it("accepts the root admin claim", async () => {
    await expect(
      verifyAdminToken(config(user({ role: "admin" })), "jwt")
    ).resolves.toEqual({
      id: "00000000-0000-4000-8000-0000000000c1",
      email: "editor@example.org"
    });
  });

  it("accepts a scoped editor carrying the importer capability", async () => {
    await expect(
      verifyAdminToken(
        config(
          user({ role: "editor", scopes: ["publications:write", "importer"] })
        ),
        "jwt"
      )
    ).resolves.toEqual({
      id: "00000000-0000-4000-8000-0000000000c1",
      email: "editor@example.org"
    });
  });

  it("rejects an authenticated editor without the importer scope", async () => {
    await expect(
      verifyAdminToken(
        config(user({ role: "editor", scopes: ["publications:write"] })),
        "jwt"
      )
    ).resolves.toBeNull();
  });

  it("fails closed for malformed scopes and user_metadata self-grants", async () => {
    await expect(
      verifyAdminToken(
        config(user({ role: "editor", scopes: "importer" })),
        "jwt"
      )
    ).resolves.toBeNull();

    await expect(
      verifyAdminToken(
        config(user({ role: "editor", scopes: [] }, { scopes: ["importer"] })),
        "jwt"
      )
    ).resolves.toBeNull();
  });

  it("rejects an empty token without calling Supabase", async () => {
    const supabase = config(user({ role: "admin" }));
    await expect(verifyAdminToken(supabase, "   ")).resolves.toBeNull();
    expect(supabase.fetchImpl).not.toHaveBeenCalled();
  });
});
