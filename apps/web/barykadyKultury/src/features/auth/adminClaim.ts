/**
 * T-026/T-046 — the single trusted-claim parser for admin access.
 *
 * Canonical root claim (docs/tickets/DECISIONS.md D-17, docs/architecture.md
 * §6.1): `app_metadata.role === "admin"`. Scoped editors (D-42) carry
 * `app_metadata.scopes: string[]` with the fixed vocabulary below. Both live in
 * `app_metadata`, which is server-controlled and is the exact claim source
 * evaluated by `public.is_admin()` / `public.has_capability()` in SQL — this
 * module is the client-side mirror, and no other component may parse the
 * claim (no duplicated policy logic).
 *
 * `user_metadata` is user-editable and is deliberately not read here at all:
 * a self-granted claim or scope must never look like authorization. Even so,
 * the guard is a UX convenience — the database enforces access independently
 * via RLS.
 */

import type { User } from "@supabase/supabase-js";

/** The four explicit session states the admin UI renders against. */
export type AuthStatus =
  /** Session restore has not resolved yet. Never grants access. */
  | "loading"
  /** No authenticated user. */
  | "anonymous"
  /** Signed in, but without the root claim or any valid scope. */
  | "authenticated-non-admin"
  /**
   * Signed in with `app_metadata.role === "admin"` (root) or at least one
   * valid capability in `app_metadata.scopes` (scoped administrator).
   */
  | "admin";

/** Root claim key inside `app_metadata` (D-17). */
const ADMIN_CLAIM_KEY = "role";

/** Exact root claim value (D-17). Matched with `===`, never case-insensitively. */
const ADMIN_CLAIM_VALUE = "admin";

/** Scoped-administration claim key inside `app_metadata` (D-42). */
const SCOPES_CLAIM_KEY = "scopes";

/**
 * The fixed V1 capability vocabulary (docs/architecture.md §6.1, D-42).
 *
 * Order is the presentation order used by the dashboard's access summary.
 * `importer` is the one action-scope (not `importer:write`), matching the
 * ana002 recommended-flow diagram. Unknown strings are ignored client-side;
 * the database ignores them too because no policy references them.
 */
export const ADMIN_SCOPES = [
  "pages:write",
  "projects:write",
  "publications:write",
  "documents:write",
  "team:write",
  "events:write",
  "media:write",
  "importer"
] as const;

/** A capability the admin UI can gate on. */
export type AdminScope = (typeof ADMIN_SCOPES)[number];

/** Membership test for the fixed vocabulary (exact, case-sensitive). */
const ADMIN_SCOPE_SET: ReadonlySet<string> = new Set(ADMIN_SCOPES);

/** Shared empty result so read-only comparisons do not allocate. */
const NO_SCOPES: readonly AdminScope[] = Object.freeze([]);

/** The metadata shape the parser is allowed to see — app_metadata only. */
type ClaimCarrier = Pick<User, "app_metadata"> | null | undefined;

function appMetadata(
  user: ClaimCarrier
): Record<string, unknown> | null | undefined {
  return user?.app_metadata as Record<string, unknown> | null | undefined;
}

/**
 * True only when the server-controlled `app_metadata` carries the exact
 * canonical root claim. Anything else — missing, wrong type, array, different
 * casing, a `user_metadata` copy — fails closed.
 */
export function isAdminUser(user: ClaimCarrier): boolean {
  return appMetadata(user)?.[ADMIN_CLAIM_KEY] === ADMIN_CLAIM_VALUE;
}

/**
 * Parses `app_metadata.scopes` into the fixed vocabulary.
 *
 * Fail-closed rules mirror `public.has_capability()`: a missing value, a
 * non-array value (e.g. a bare string) or non-string entries grant nothing.
 * Unknown strings are dropped because no policy references them, and duplicates
 * collapse. The result is frozen so a consumer cannot widen it in place.
 */
export function parseAdminScopes(user: ClaimCarrier): readonly AdminScope[] {
  const raw = appMetadata(user)?.[SCOPES_CLAIM_KEY];
  if (!Array.isArray(raw)) {
    return NO_SCOPES;
  }

  const scopes = new Set<AdminScope>();
  for (const value of raw) {
    if (typeof value === "string" && ADMIN_SCOPE_SET.has(value)) {
      scopes.add(value as AdminScope);
    }
  }
  return scopes.size === 0 ? NO_SCOPES : Object.freeze([...scopes]);
}

/**
 * The effective UI capabilities. Root (`role = "admin"`) is a bypass in SQL,
 * so it is represented here as the whole vocabulary; scoped editors get exactly
 * their parsed array. No caller needs a separate root branch.
 */
export function getAdminCapabilities(
  user: ClaimCarrier
): readonly AdminScope[] {
  return isAdminUser(user) ? ADMIN_SCOPES : parseAdminScopes(user);
}

/** True when the user is root or holds the exact scope. */
export function hasCapability(user: ClaimCarrier, scope: AdminScope): boolean {
  return getAdminCapabilities(user).includes(scope);
}

/**
 * True when the account may enter the admin area at all — root or at least one
 * valid scope. A zero-scope account behaves exactly like today's non-admin.
 */
export function isAdminAreaUser(user: ClaimCarrier): boolean {
  return isAdminUser(user) || parseAdminScopes(user).length > 0;
}

/**
 * Derives the non-loading session state from a user.
 *
 * The one place a `User` becomes an `AuthStatus`; the store and every
 * consumer share this function so a state can never disagree with another.
 * `"admin"` means "may enter the admin area", not "root": per-area affordances
 * are gated by `AdminScope`, never by this status alone.
 */
export function deriveAuthStatus(
  user: ClaimCarrier
): Exclude<AuthStatus, "loading"> {
  if (!user) {
    return "anonymous";
  }
  return isAdminAreaUser(user) ? "admin" : "authenticated-non-admin";
}
