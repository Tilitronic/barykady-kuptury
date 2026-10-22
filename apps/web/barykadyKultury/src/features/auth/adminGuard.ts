/**
 * T-026/T-046 — the admin navigation guard, as a pure factory.
 *
 * Mirrors `createLocaleGuard`: all decisions come from injected
 * dependencies, so the full matrix (anonymous → sign-in with the intended
 * destination preserved, authenticated non-admin → explicit denial page, root
 * → allowed, scoped editor → allowed only in-scope, scoped editor out of scope
 * → explicit denial) is unit-testable without a router or network.
 *
 * Security framing (docs/PRODUCT_REQUIREMENTS.md §6, docs/architecture.md
 * §6.1): this guard is a UX convenience only. Authorization is enforced by
 * Supabase RLS and the capability helper at the data boundary; the guard merely
 * avoids rendering admin chrome for users who cannot use it. It does not
 * "hide by disabling": a route outside the editor's scope is not reachable.
 *
 * Termination: the denial page is a terminal state for non-admins and for
 * scoped admins rejected from a specific route (the `missing` query marks that
 * case); the sign-in page is terminal for anonymous visitors, so no pair of
 * redirects can send each other around — the "no redirect loop" acceptance
 * criterion.
 */

import type {
  NavigationGuard,
  RouteLocationNormalized,
  RouteLocationRaw
} from "vue-router";

import { DEFAULT_LOCALE, isLocale } from "@/features/i18n/locales";

import type { AdminScope } from "./adminClaim";
import type { AuthSnapshot } from "./authStore";

/** Route names of the admin shell — one source of truth for the guard. */
export const ADMIN_SIGN_IN_NAME = "admin-sign-in";
export const ADMIN_DENIED_NAME = "admin-denied";
export const ADMIN_DASHBOARD_NAME = "admin-dashboard";

/** Query key preserving the originally requested admin destination. */
export const REDIRECT_QUERY_KEY = "redirect";

/**
 * Query key recording which capability a scoped editor lacked. Its presence
 * makes the denial page a terminal state for an admin-area session (otherwise
 * the guard would bounce every admin off the denial page to the dashboard and
 * the scoped explanation would never render).
 */
export const CAPABILITY_QUERY_KEY = "missing";

/**
 * Builds a name-based navigation target inside the admin shell.
 *
 * The generated `typed-router.d.ts` derives its names from filenames while
 * this application's route table is explicit (the known T-009 follow-up that
 * `routeMeta.test.ts` also documents). Name-based targets are still the right
 * internal contract — a path literal can drift from the table silently, a
 * name cannot — so the type bridge lives in this one narrow, commented cast
 * instead of being repeated at every call site.
 */
export function adminRouteTarget(
  name:
    | typeof ADMIN_SIGN_IN_NAME
    | typeof ADMIN_DENIED_NAME
    | typeof ADMIN_DASHBOARD_NAME,
  locale: string,
  query?: Record<string, string>
): RouteLocationRaw {
  return {
    name,
    params: { locale },
    ...(query ? { query } : {})
  } as unknown as RouteLocationRaw;
}

export interface AdminGuardDependencies {
  /**
   * Resolves once session restore has completed. The guard awaits it, which
   * is what makes the "loading" state a real, non-flashing state on a hard
   * refresh of a deep admin URL.
   */
  getAuthState: () => Promise<AuthSnapshot>;
}

/** The locale for redirect targets: trusted param, else the default. */
function guardLocale(to: RouteLocationNormalized): string {
  const { locale } = to.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

/** Reads a possibly absent capability gate from route meta. */
function requiredCapability(
  to: RouteLocationNormalized
): AdminScope | undefined {
  return to.meta.requiresCapability;
}

/**
 * Builds the guard. Only three route names plus `meta.requiresAdmin` /
 * `meta.requiresCapability` are considered; every other route (the whole
 * public site) short-circuits without even reading auth state, so public
 * navigation cost is unchanged.
 */
export function createAdminGuard(
  dependencies: AdminGuardDependencies
): NavigationGuard {
  return async to => {
    // `to.name` is typed against the generated filename map (T-009 follow-up);
    // comparing through String() reads the runtime name the explicit table
    // actually installed without fighting the augmentation.
    const name = String(to.name ?? "");
    const isSignIn = name === ADMIN_SIGN_IN_NAME;
    const isDenied = name === ADMIN_DENIED_NAME;
    const capability = requiredCapability(to);
    const isProtected =
      to.meta.requiresAdmin === true || capability !== undefined;

    if (!isSignIn && !isDenied && !isProtected) {
      return true;
    }

    const { status, capabilities } = await dependencies.getAuthState();
    const locale = guardLocale(to);

    if (status === "admin") {
      if (isProtected) {
        // Root carries every scope in the store, so only a scoped editor can
        // reach this branch. Deny with the missing capability recorded; the
        // page explains the role boundary instead of showing a dead route.
        if (capability !== undefined && !capabilities.includes(capability)) {
          return adminRouteTarget(ADMIN_DENIED_NAME, locale, {
            [CAPABILITY_QUERY_KEY]: capability
          });
        }
        return true;
      }

      // Scoped denial is terminal; all other admin chrome pages (sign-in,
      // bare denial) still send an admin-area session to the dashboard.
      if (isDenied && typeof to.query[CAPABILITY_QUERY_KEY] === "string") {
        return true;
      }
      return adminRouteTarget(ADMIN_DASHBOARD_NAME, locale);
    }

    if (status === "authenticated-non-admin") {
      // Sign-in stays reachable: the user may switch to a real admin account.
      // The denial page is terminal — re-redirecting there would loop.
      if (isSignIn || isDenied) {
        return true;
      }
      return adminRouteTarget(ADMIN_DENIED_NAME, locale);
    }

    // `anonymous` — and `loading` fail closed to the same path (the injected
    // reader resolves after restore, so this is defensive only).
    if (isSignIn) {
      return true;
    }
    if (isDenied) {
      // A denial page without a session is meaningless; send them to sign in.
      return adminRouteTarget(ADMIN_SIGN_IN_NAME, locale);
    }
    return adminRouteTarget(ADMIN_SIGN_IN_NAME, locale, {
      [REDIRECT_QUERY_KEY]: to.fullPath
    });
  };
}
