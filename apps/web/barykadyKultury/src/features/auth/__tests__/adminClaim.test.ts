import { describe, expect, it } from "vitest";

import { deriveAuthStatus, isAdminUser } from "../adminClaim";

/**
 * T-026 — the single trusted-claim parser (docs/architecture.md §6, D-17).
 *
 * The canonical admin claim is `app_metadata.role === "admin"`. `app_metadata`
 * is server-controlled; `user_metadata` is user-editable and must NEVER grant
 * admin. This mirrors the SQL `public.is_admin()` enforcement point — the two
 * must not drift.
 */

/** Builds the narrowest object the claim parser sees (untrusted shape input). */
function userWith(appMetadata: unknown): never {
  return { app_metadata: appMetadata } as never;
}

describe("isAdminUser — canonical admin claim (D-17)", () => {
  it("is true only for the exact server-controlled claim", () => {
    expect(isAdminUser(userWith({ role: "admin" }))).toBe(true);
  });

  it("is false for a missing user or missing metadata", () => {
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser(undefined)).toBe(false);
    expect(isAdminUser(userWith(undefined))).toBe(false);
    expect(isAdminUser(userWith(null))).toBe(false);
  });

  it("is false for any other role value, including near-misses", () => {
    // Exact string match: case, type and array smuggling all fail closed.
    expect(isAdminUser(userWith({ role: "ADMIN" }))).toBe(false);
    expect(isAdminUser(userWith({ role: "admin " }))).toBe(false);
    expect(isAdminUser(userWith({ role: ["admin"] }))).toBe(false);
    expect(isAdminUser(userWith({ role: true }))).toBe(false);
    expect(isAdminUser(userWith({ role: "viewer" }))).toBe(false);
    expect(isAdminUser(userWith({}))).toBe(false);
  });

  it("ignores a role placed in user_metadata (user-editable, never trusted)", () => {
    // The parser only ever reads app_metadata; a user_metadata claim must not
    // even be visible to it. The typed signature makes the distinction.
    const user = {
      app_metadata: {},
      user_metadata: { role: "admin" }
    } as never;
    expect(isAdminUser(user)).toBe(false);
  });
});

describe("deriveAuthStatus — the four explicit session states", () => {
  it("maps no-user to anonymous", () => {
    expect(deriveAuthStatus(null)).toBe("anonymous");
  });

  it("maps a claimless user to authenticated-non-admin", () => {
    expect(deriveAuthStatus(userWith({}))).toBe("authenticated-non-admin");
    expect(deriveAuthStatus(userWith({ role: "editor" }))).toBe(
      "authenticated-non-admin"
    );
  });

  it("maps a claimed user to admin", () => {
    expect(deriveAuthStatus(userWith({ role: "admin" }))).toBe("admin");
  });
});
