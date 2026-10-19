/**
 * T-026 — the single trusted-claim parser for admin access.
 *
 * Canonical claim (docs/tickets/DECISIONS.md D-17, docs/architecture.md §6):
 * `app_metadata.role === "admin"`. `app_metadata` is server-controlled and is
 * the exact expression evaluated by the SQL `public.is_admin()` RLS helper —
 * this module is the client-side mirror of that single enforcement point, and
 * no other component may parse the claim (no duplicated policy logic).
 *
 * `user_metadata` is user-editable and is deliberately not read here at all:
 * a self-granted claim must never look like authorization. Even so, the guard
 * is a UX convenience — the database enforces access independently via RLS.
 */

import type { User } from "@supabase/supabase-js";

/** The four explicit session states the admin UI renders against. */
export type AuthStatus =
  /** Session restore has not resolved yet. Never grants access. */
  | "loading"
  /** No authenticated user. */
  | "anonymous"
  /** Signed in, but without the canonical admin claim. */
  | "authenticated-non-admin"
  /** Signed in with `app_metadata.role === "admin"`. */
  | "admin";

/** Claim key inside `app_metadata` (D-17). */
const ADMIN_CLAIM_KEY = "role";

/** Exact claim value (D-17). Matched with `===`, never case-insensitively. */
const ADMIN_CLAIM_VALUE = "admin";

/** The metadata shape the parser is allowed to see — app_metadata only. */
type ClaimCarrier = Pick<User, "app_metadata"> | null | undefined;

/**
 * True only when the server-controlled `app_metadata` carries the exact
 * canonical claim. Anything else — missing, wrong type, array, different
 * casing, a `user_metadata` copy — fails closed.
 */
export function isAdminUser(user: ClaimCarrier): boolean {
  const metadata = user?.app_metadata as
    | Record<string, unknown>
    | null
    | undefined;
  return metadata?.[ADMIN_CLAIM_KEY] === ADMIN_CLAIM_VALUE;
}

/**
 * Derives the non-loading session state from a user.
 *
 * The one place a `User` becomes an `AuthStatus`; the store and every
 * consumer share this function so a state can never disagree with another.
 */
export function deriveAuthStatus(
  user: ClaimCarrier
): Exclude<AuthStatus, "loading"> {
  if (!user) {
    return "anonymous";
  }
  return isAdminUser(user) ? "admin" : "authenticated-non-admin";
}
