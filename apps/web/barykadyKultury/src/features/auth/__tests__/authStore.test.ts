import { afterEach, describe, expect, it, vi } from "vitest";

import type { Session, User } from "@supabase/supabase-js";

import {
  configureAuth,
  getAuthSnapshot,
  signIn,
  signOut,
  whenAuthReady,
  type AuthApi
} from "../authStore";

/**
 * T-026 — session store tests against a fake `AuthApi` seam.
 *
 * The store is a module singleton wired to Supabase Auth through the narrow
 * structural `AuthApi` interface, so these tests exercise the real restore /
 * sign-in / sign-out state machine without any network (docs/TESTING.md §2).
 */

function makeUser(email: string, appMetadata: Record<string, unknown>): User {
  return {
    id: crypto.randomUUID(),
    email,
    app_metadata: appMetadata
  } as unknown as User;
}

function makeSession(user: User): Session {
  return {
    user,
    access_token: "fake",
    refresh_token: "fake"
  } as unknown as Session;
}

interface FakeAuthOptions {
  /** User returned by getSession() on restore (null → signed out). */
  restoreUser?: User | null;
  /** User granted by signInWithPassword when it succeeds. */
  signInUser?: User | null;
  /** When set, signInWithPassword resolves with this error. */
  signInError?: { message: string; code?: string };
  /** When set, getSession rejects (network failure during restore). */
  restoreThrows?: boolean;
}

function createFakeAuth(options: FakeAuthOptions = {}) {
  const listeners: Array<(event: string, session: Session | null) => void> = [];
  let unsubscribed = 0;

  const api: AuthApi = {
    getSession: vi.fn(async () => {
      if (options.restoreThrows) throw new Error("network down");
      const user = options.restoreUser ?? null;
      return {
        data: { session: user ? makeSession(user) : null },
        error: null
      };
    }),
    signInWithPassword: vi.fn(async () => {
      if (options.signInError) {
        return {
          data: { session: null, user: null },
          error: options.signInError
        };
      }
      const user = options.signInUser ?? null;
      const session = user ? makeSession(user) : null;
      for (const listener of listeners) listener("SIGNED_IN", session);
      return { data: { session, user }, error: null };
    }),
    signOut: vi.fn(async () => {
      for (const listener of listeners) listener("SIGNED_OUT", null);
      return { error: null };
    }),
    onAuthStateChange: vi.fn(
      (callback: (event: string, session: Session | null) => void) => {
        listeners.push(callback);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                unsubscribed += 1;
              }
            }
          }
        };
      }
    )
  };

  return {
    api,
    emit: (event: string, session: Session | null) => {
      for (const listener of listeners) listener(event, session);
    },
    unsubscribeCount: () => unsubscribed
  };
}

/** Every test starts from a clean singleton. */
function resetAuth(): void {
  configureAuth(null);
}

afterEach(resetAuth);

describe("configureAuth + restore", () => {
  it("degrades to anonymous immediately when no client is configured", async () => {
    configureAuth(null);

    const snapshot = await whenAuthReady();
    expect(snapshot.status).toBe("anonymous");
    expect(snapshot.user).toBeNull();
  });

  it("restores an admin session from getSession() on configuration", async () => {
    const admin = makeUser("admin@demo.local", { role: "admin" });
    configureAuth(createFakeAuth({ restoreUser: admin }).api);

    const snapshot = await whenAuthReady();
    expect(snapshot.status).toBe("admin");
    expect(snapshot.user?.email).toBe("admin@demo.local");
  });

  it("restores a claimless user as authenticated-non-admin", async () => {
    const viewer = makeUser("viewer@demo.local", {});
    configureAuth(createFakeAuth({ restoreUser: viewer }).api);

    expect((await whenAuthReady()).status).toBe("authenticated-non-admin");
  });

  it("treats a failed restore as anonymous rather than hanging the guard", async () => {
    configureAuth(createFakeAuth({ restoreThrows: true }).api);

    const snapshot = await whenAuthReady();
    expect(snapshot.status).toBe("anonymous");
  });

  it("applies external auth-state changes (sign-out in another tab)", async () => {
    const fake = createFakeAuth({
      restoreUser: makeUser("admin@demo.local", { role: "admin" })
    });
    configureAuth(fake.api);
    await whenAuthReady();

    fake.emit("SIGNED_OUT", null);

    expect(getAuthSnapshot().status).toBe("anonymous");
    expect(getAuthSnapshot().user).toBeNull();
  });

  it("re-configuring unsubscribes the previous subscription", async () => {
    const first = createFakeAuth();
    configureAuth(first.api);
    await whenAuthReady();

    configureAuth(createFakeAuth().api);

    expect(first.unsubscribeCount()).toBe(1);
  });
});

describe("signIn", () => {
  it("reports success and moves the state to admin on a claimed user", async () => {
    configureAuth(
      createFakeAuth({
        signInUser: makeUser("admin@demo.local", { role: "admin" })
      }).api
    );

    const result = await signIn("admin@demo.local", "hunter2");

    expect(result).toEqual({ ok: true });
    expect(getAuthSnapshot().status).toBe("admin");
  });

  it("reports success with authenticated-non-admin for a claimless user", async () => {
    configureAuth(
      createFakeAuth({
        signInUser: makeUser("viewer@demo.local", {})
      }).api
    );

    const result = await signIn("viewer@demo.local", "hunter2");

    expect(result).toEqual({ ok: true });
    expect(getAuthSnapshot().status).toBe("authenticated-non-admin");
  });

  it("maps Supabase's invalid-credentials error to the stable reason", async () => {
    configureAuth(
      createFakeAuth({ signInError: { message: "Invalid login credentials" } })
        .api
    );

    const result = await signIn("admin@demo.local", "wrong");

    expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
    expect(getAuthSnapshot().status).toBe("anonymous");
  });

  it("maps an error code variant to the same reason", async () => {
    configureAuth(
      createFakeAuth({
        signInError: { message: "something", code: "invalid_credentials" }
      }).api
    );

    expect(await signIn("a@b.c", "x")).toEqual({
      ok: false,
      reason: "invalid-credentials"
    });
  });

  it("maps any other failure to the unexpected reason", async () => {
    configureAuth(
      createFakeAuth({ signInError: { message: "rate limited" } }).api
    );

    expect(await signIn("a@b.c", "x")).toEqual({
      ok: false,
      reason: "unexpected"
    });
  });

  it("reports unavailable when no auth client is configured", async () => {
    configureAuth(null);

    expect(await signIn("a@b.c", "x")).toEqual({
      ok: false,
      reason: "unavailable"
    });
  });

  it("passes the exact credentials to the auth API", async () => {
    // Call capture instead of a vi.fn reference: asserting through
    // `expect(api.method)` would trip the unbound-method lint for no gain.
    const calls: Array<{ email: string; password: string }> = [];
    const api = createFakeAuth().api;
    const capture: AuthApi = {
      ...api,
      signInWithPassword: async credentials => {
        calls.push(credentials);
        return api.signInWithPassword(credentials);
      }
    };
    configureAuth(capture);

    await signIn("admin@demo.local", "s3cret");

    expect(calls).toEqual([{ email: "admin@demo.local", password: "s3cret" }]);
  });
});

describe("signOut", () => {
  it("clears the session and the private state", async () => {
    configureAuth(
      createFakeAuth({
        restoreUser: makeUser("admin@demo.local", { role: "admin" })
      }).api
    );
    await whenAuthReady();
    expect(getAuthSnapshot().status).toBe("admin");

    await signOut();

    expect(getAuthSnapshot().status).toBe("anonymous");
    expect(getAuthSnapshot().user).toBeNull();
  });

  it("is safe to call without a configured client", async () => {
    configureAuth(null);

    await expect(signOut()).resolves.toBeUndefined();
  });
});
