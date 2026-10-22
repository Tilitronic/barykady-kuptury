import { describe, expect, it } from "vitest";

import {
  ADMIN_SCOPES,
  deriveAuthStatus,
  getAdminCapabilities,
  hasCapability,
  isAdminAreaUser,
  isAdminUser,
  parseAdminScopes
} from "../adminClaim";

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

describe("capability scopes — D-42 client mirror", () => {
  it("parses the fixed vocabulary in order and ignores duplicates", () => {
    expect(
      parseAdminScopes(
        userWith({
          scopes: ["publications:write", "importer", "publications:write"]
        })
      )
    ).toEqual(["publications:write", "importer"]);
  });

  it("fails closed for a missing, non-array or empty scopes value", () => {
    expect(parseAdminScopes(userWith({}))).toEqual([]);
    expect(parseAdminScopes(userWith({ scopes: "projects:write" }))).toEqual(
      []
    );
    expect(parseAdminScopes(userWith({ scopes: [] }))).toEqual([]);
    expect(parseAdminScopes(null)).toEqual([]);
  });

  it("drops unknown, case-mismatched and non-string scope entries", () => {
    expect(
      parseAdminScopes(
        userWith({
          scopes: [
            "PROJECTS:WRITE",
            "projects",
            "projects:delete",
            42,
            null,
            "media:write"
          ]
        })
      )
    ).toEqual(["media:write"]);
  });

  it("never reads user_metadata.scopes (self-escalation stays unrepresentable)", () => {
    const user = {
      app_metadata: {},
      user_metadata: { scopes: ["projects:write"] }
    } as never;

    expect(parseAdminScopes(user)).toEqual([]);
    expect(getAdminCapabilities(user)).toEqual([]);
    expect(hasCapability(user, "projects:write")).toBe(false);
    expect(isAdminAreaUser(user)).toBe(false);
    expect(deriveAuthStatus(user)).toBe("authenticated-non-admin");
  });

  it("gives root the whole vocabulary because SQL is_admin() is the bypass", () => {
    const root = userWith({ role: "admin" });
    expect(getAdminCapabilities(root)).toEqual(ADMIN_SCOPES);
    expect(hasCapability(root, "importer")).toBe(true);
    expect(hasCapability(root, "projects:write")).toBe(true);
  });

  it("grants only the exact requested capability", () => {
    const editor = userWith({ scopes: ["publications:write"] });
    expect(hasCapability(editor, "publications:write")).toBe(true);
    expect(hasCapability(editor, "projects:write")).toBe(false);
    expect(hasCapability(editor, "importer")).toBe(false);
  });

  it("treats a zero-scope account exactly like a non-admin", () => {
    const user = userWith({ role: "editor", scopes: [] });
    expect(isAdminAreaUser(user)).toBe(false);
    expect(deriveAuthStatus(user)).toBe("authenticated-non-admin");
  });

  it("parses scopes into a frozen array so a consumer cannot widen it", () => {
    const scopes = parseAdminScopes(userWith({ scopes: ["team:write"] }));
    expect(Object.isFrozen(scopes)).toBe(true);
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

  it("maps a scoped editor to admin-area access, not a second denial state", () => {
    expect(deriveAuthStatus(userWith({ scopes: ["publications:write"] }))).toBe(
      "admin"
    );
  });
});
