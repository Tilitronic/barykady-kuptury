import { describe, expect, test } from "bun:test";

import { DEMO_PASSWORD, DEMO_USERS, findUserByEmail } from "./users";

describe("demo users", () => {
  test("defines exactly the admin and viewer accounts", () => {
    expect(DEMO_USERS.map(user => user.email)).toEqual([
      "admin@demo.local",
      "viewer@demo.local"
    ]);
    expect(DEMO_USERS[0]!.appMetadata).toEqual({ role: "admin" });
    expect(DEMO_USERS[1]!.appMetadata).toEqual({});
  });

  test("uses a non-empty deterministic local-only password", () => {
    expect(DEMO_PASSWORD.length).toBeGreaterThanOrEqual(12);
    expect(DEMO_PASSWORD).toMatch(/^[a-z0-9-]+$/);
  });

  test("finds an existing user case-insensitively", () => {
    expect(
      findUserByEmail(
        [{ id: "u1", email: "Admin@Demo.Local" }],
        "admin@demo.local"
      )
    ).toEqual({
      id: "u1",
      email: "Admin@Demo.Local"
    });
    expect(findUserByEmail([], "admin@demo.local")).toBeUndefined();
  });
});
