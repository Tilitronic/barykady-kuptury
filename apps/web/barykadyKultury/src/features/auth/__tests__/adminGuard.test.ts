import { describe, expect, it, vi } from "vitest";
import type { RouteLocationNormalized } from "vue-router";

import {
  ADMIN_DASHBOARD_NAME,
  ADMIN_DENIED_NAME,
  ADMIN_SIGN_IN_NAME,
  createAdminGuard,
  REDIRECT_QUERY_KEY
} from "../adminGuard";
import type { AuthStatus } from "../adminClaim";

/**
 * T-026 — guard matrix (ticket TDD plan step 1).
 *
 * The guard is a pure factory over an injected auth-state reader, mirroring
 * `createLocaleGuard`: every decision — anonymous → sign-in with preserved
 * destination, non-admin → explicit denial, admin → allowed — is testable
 * without a router or a network. UI guards are a convenience, never
 * authorization (docs/PRODUCT_REQUIREMENTS.md §6, docs/architecture.md §6).
 */

interface ToOptions {
  name?: string;
  path: string;
  locale?: string;
  requiresAdmin?: boolean;
  query?: Record<string, string>;
}

function makeTo(options: ToOptions): RouteLocationNormalized {
  return {
    name: options.name,
    path: options.path,
    fullPath:
      options.path +
      (options.query
        ? `?${new URLSearchParams(options.query).toString()}`
        : ""),
    query: options.query ?? {},
    params: options.locale === undefined ? {} : { locale: options.locale },
    meta: options.requiresAdmin ? { requiresAdmin: true } : {}
  } as unknown as RouteLocationNormalized;
}

function guardFor(status: AuthStatus) {
  return createAdminGuard({
    getAuthState: async () => ({ status, user: null })
  });
}

/** Runs the guard and returns its navigation decision. */
async function decide(status: AuthStatus, to: RouteLocationNormalized) {
  const guard = guardFor(status);
  // Vue Router still passes a third `next` callback; the guard returns its
  // decision directly, so this records that the legacy callback stays unused.
  const legacyNextCallback = vi.fn();
  return guard(to, makeTo({ path: "/" }), legacyNextCallback);
}

describe("anonymous visitors", () => {
  it("are redirected to the locale sign-in page with the destination preserved", async () => {
    const decision = await decide(
      "anonymous",
      makeTo({
        name: ADMIN_DASHBOARD_NAME,
        path: "/pl/admin",
        locale: "pl",
        requiresAdmin: true
      })
    );

    expect(decision).toEqual({
      name: ADMIN_SIGN_IN_NAME,
      params: { locale: "pl" },
      query: { [REDIRECT_QUERY_KEY]: "/pl/admin" }
    });
  });

  it("reach the sign-in page itself without a redirect", async () => {
    const decision = await decide(
      "anonymous",
      makeTo({
        name: ADMIN_SIGN_IN_NAME,
        path: "/en/admin/sign-in",
        locale: "en"
      })
    );
    expect(decision).toBe(true);
  });

  it("are bounced from the denial page back to sign-in (no dead end, no loop)", async () => {
    const decision = await decide(
      "anonymous",
      makeTo({
        name: ADMIN_DENIED_NAME,
        path: "/en/admin/access-denied",
        locale: "en"
      })
    );
    expect(decision).toEqual({
      name: ADMIN_SIGN_IN_NAME,
      params: { locale: "en" }
    });
  });
});

describe("authenticated non-admins", () => {
  it("get an explicit denial page, not a redirect loop", async () => {
    const decision = await decide(
      "authenticated-non-admin",
      makeTo({
        name: ADMIN_DASHBOARD_NAME,
        path: "/uk/admin",
        locale: "uk",
        requiresAdmin: true
      })
    );
    expect(decision).toEqual({
      name: ADMIN_DENIED_NAME,
      params: { locale: "uk" }
    });
  });

  it("can stay on the denial page (terminal state — the guard allows it)", async () => {
    const decision = await decide(
      "authenticated-non-admin",
      makeTo({
        name: ADMIN_DENIED_NAME,
        path: "/en/admin/access-denied",
        locale: "en"
      })
    );
    expect(decision).toBe(true);
  });

  it("can still open the sign-in page to try a different account", async () => {
    const decision = await decide(
      "authenticated-non-admin",
      makeTo({
        name: ADMIN_SIGN_IN_NAME,
        path: "/en/admin/sign-in",
        locale: "en"
      })
    );
    expect(decision).toBe(true);
  });
});

describe("admins", () => {
  it("pass every protected admin route", async () => {
    const decision = await decide(
      "admin",
      makeTo({
        name: ADMIN_DASHBOARD_NAME,
        path: "/en/admin",
        locale: "en",
        requiresAdmin: true
      })
    );
    expect(decision).toBe(true);
  });

  it("are sent from the sign-in page to the dashboard (already signed in)", async () => {
    const decision = await decide(
      "admin",
      makeTo({
        name: ADMIN_SIGN_IN_NAME,
        path: "/en/admin/sign-in",
        locale: "en"
      })
    );
    expect(decision).toEqual({
      name: ADMIN_DASHBOARD_NAME,
      params: { locale: "en" }
    });
  });

  it("are sent away from the denial page too", async () => {
    const decision = await decide(
      "admin",
      makeTo({
        name: ADMIN_DENIED_NAME,
        path: "/en/admin/access-denied",
        locale: "en"
      })
    );
    expect(decision).toEqual({
      name: ADMIN_DASHBOARD_NAME,
      params: { locale: "en" }
    });
  });
});

describe("non-admin routes and edge cases", () => {
  it("never touches public routes", async () => {
    const getAuthState = vi.fn(async () => ({
      status: "anonymous" as const,
      user: null
    }));
    const guard = createAdminGuard({ getAuthState });

    const decision = await guard(
      makeTo({ name: "home", path: "/en" }),
      makeTo({ path: "/" }),
      vi.fn()
    );

    expect(decision).toBe(true);
    expect(getAuthState).not.toHaveBeenCalled();
  });

  it("falls back to the default locale when the param is untrusted", async () => {
    const decision = await decide(
      "anonymous",
      makeTo({
        name: ADMIN_DASHBOARD_NAME,
        path: "/xx/admin",
        requiresAdmin: true
      })
    );
    expect(decision).toMatchObject({ params: { locale: "en" } });
  });

  it("treats a still-loading session as anonymous for redirects", async () => {
    // The store's whenAuthReady() resolves before the guard runs in the app;
    // the defensive branch guarantees no "allowed" verdict on unknown state.
    const decision = await decide(
      "loading",
      makeTo({
        name: ADMIN_DASHBOARD_NAME,
        path: "/en/admin",
        locale: "en",
        requiresAdmin: true
      })
    );
    expect(decision).toMatchObject({ name: ADMIN_SIGN_IN_NAME });
  });
});
