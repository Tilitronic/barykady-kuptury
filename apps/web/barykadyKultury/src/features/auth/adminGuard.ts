/**
 * T-026 — the admin navigation guard, as a pure factory.
 *
 * Mirrors `createLocaleGuard`: all decisions come from injected
 * dependencies, so the full matrix (anonymous → sign-in with the intended
 * destination preserved, authenticated non-admin → explicit denial page,
 * admin → allowed) is unit-testable without a router or network.
 *
 * Security framing (docs/PRODUCT_REQUIREMENTS.md §6, docs/architecture.md §6):
 * this guard is a UX convenience only. Authorization is enforced by Supabase
 * RLS at the data boundary; the guard merely avoids rendering admin chrome
 * for users who cannot load data through it.
 *
 * Termination: the denial page is a terminal state for non-admins and the
 * sign-in page is terminal for anonymous visitors, so no pair of redirects
 * can send each other around — the "no redirect loop" acceptance criterion.
 */

import type {
  NavigationGuard,
  RouteLocationNormalized,
  RouteLocationRaw
} from "vue-router";

import { DEFAULT_LOCALE, isLocale } from "@/features/i18n/locales";

import type { AuthSnapshot } from "./authStore";

/** Route names of the admin shell — one source of truth for the guard. */
export const ADMIN_SIGN_IN_NAME = "admin-sign-in";
export const ADMIN_DENIED_NAME = "admin-denied";
export const ADMIN_DASHBOARD_NAME = "admin-dashboard";

/** Query key preserving the originally requested admin destination. */
export const REDIRECT_QUERY_KEY = "redirect";

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

/**
 * Builds the guard. Only three route names plus `meta.requiresAdmin` are
 * considered; every other route (the whole public site) short-circuits
 * without even reading auth state, so public navigation cost is unchanged.
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
    const isProtected = to.meta.requiresAdmin === true;

    if (!isSignIn && !isDenied && !isProtected) {
      return true;
    }

    const { status } = await dependencies.getAuthState();
    const locale = guardLocale(to);

    if (status === "admin") {
      // Signed-in admins never see sign-in/denial chrome.
      return isProtected
        ? true
        : adminRouteTarget(ADMIN_DASHBOARD_NAME, locale);
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
