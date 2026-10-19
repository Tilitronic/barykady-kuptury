/**
 * T-026 — the single admin session store.
 *
 * One module-level reactive state machine with four explicit states
 * (`loading | anonymous | authenticated-non-admin | admin`) drives every
 * admin surface. Session restore, sign-in and sign-out all funnel through
 * `deriveAuthStatus`, so the trusted claim is parsed in exactly one place
 * (`adminClaim.ts`, D-17) and no consumer re-implements it.
 *
 * The store talks to Supabase Auth only through the narrow structural
 * `AuthApi` seam, which the real `supabase.auth` satisfies and unit tests
 * fake — components never import the boot file and tests never hit network
 * (docs/TESTING.md §2). Wiring happens once in `src/router/index.ts`, before
 * any navigation, because the route guard must be able to await restore.
 */

import { reactive, readonly, computed } from "vue";
import type { Session, User } from "@supabase/supabase-js";

import { deriveAuthStatus, type AuthStatus } from "./adminClaim";

/**
 * Minimal error shape Supabase's `AuthError` satisfies. The explicit
 * `| undefined` is required by `exactOptionalPropertyTypes` (the provider
 * may carry `code: undefined` literally).
 */
export interface AuthErrorLike {
  message: string;
  code?: string | undefined;
}

/** The auth surface the store uses; `SupabaseClient["auth"]` conforms. */
export interface AuthApi {
  getSession(): Promise<{
    data: { session: Session | null };
    error: AuthErrorLike | null;
  }>;
  signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{
    data: { session: Session | null; user: User | null };
    error: AuthErrorLike | null;
  }>;
  signOut(): Promise<{ error: AuthErrorLike | null }>;
  onAuthStateChange(
    callback: (event: string, session: Session | null) => void
  ): { data: { subscription: { unsubscribe: () => void } } };
}

/** Stable, translatable sign-in failure reasons (no raw provider strings). */
export type SignInFailureReason =
  | "invalid-credentials"
  | "unavailable"
  | "unexpected";

export type SignInResult =
  | { ok: true }
  | { ok: false; reason: SignInFailureReason };

/** Snapshot handed to the guard and the UI. */
export interface AuthSnapshot {
  status: AuthStatus;
  user: User | null;
}

const state = reactive<AuthSnapshot>({ status: "loading", user: null });

let api: AuthApi | null = null;
let ready: Promise<void> = Promise.resolve();
let resolveReady: () => void = () => undefined;
let unsubscribe: (() => void) | null = null;

/** Applies a user (or its absence) as the single state transition. */
function applyUser(user: User | null): void {
  state.user = user;
  state.status = deriveAuthStatus(user);
}

/**
 * Maps a provider error to a stable reason. "Invalid login credentials" is
 * Supabase's fixed wording for a wrong email/password pair; the `code`
 * variant is checked too so a message reword upstream cannot leak the
 * distinction between "wrong password" and a transport failure.
 */
export function mapSignInFailure(error: AuthErrorLike): SignInFailureReason {
  if (
    error.code === "invalid_credentials" ||
    /invalid login credentials/i.test(error.message)
  ) {
    return "invalid-credentials";
  }
  return "unexpected";
}

/**
 * (Re)binds the store to an auth API and starts restoring the session.
 *
 * Called once by the router boot wiring with the real client (or `null` when
 * the project is unconfigured — every admin surface then degrades to
 * anonymous and sign-in reports "unavailable"). Calling it again fully resets
 * state and the previous subscription, which is also the test seam.
 */
export function configureAuth(nextApi: AuthApi | null): void {
  unsubscribe?.();
  unsubscribe = null;
  api = nextApi;

  state.status = "loading";
  state.user = null;
  ready = new Promise<void>(resolve => {
    resolveReady = resolve;
  });

  if (!api) {
    applyUser(null);
    resolveReady();
    return;
  }

  const subscription = api.onAuthStateChange((_event, session) => {
    // Cross-tab and provider-driven changes keep the single state truthful.
    applyUser(session?.user ?? null);
  });
  unsubscribe = () => subscription.data.subscription.unsubscribe();

  ready = api
    .getSession()
    .then(({ data }) => {
      applyUser(data.session?.user ?? null);
    })
    .catch(() => {
      // A failed restore is anonymous, never "allowed": the guard must not
      // hang and must not grant on uncertainty. RLS stays the backstop.
      applyUser(null);
    })
    .finally(() => {
      resolveReady();
    });
}

/** Current snapshot (only meaningful once `whenAuthReady` has resolved). */
export function getAuthSnapshot(): AuthSnapshot {
  return { status: state.status, user: state.user };
}

/** Resolves after session restore finished — what the guard awaits. */
export async function whenAuthReady(): Promise<AuthSnapshot> {
  await ready;
  return getAuthSnapshot();
}

/**
 * Email + password sign-in. Returns a stable result; the caller (sign-in
 * page) owns translation and announcement. State updates flow through the
 * store's own transition, not the response shape, so a provider that also
 * fires `onAuthStateChange` cannot double-apply.
 */
export async function signIn(
  email: string,
  password: string
): Promise<SignInResult> {
  if (!api) {
    return { ok: false, reason: "unavailable" };
  }

  try {
    const { data, error } = await api.signInWithPassword({ email, password });
    if (error) {
      return { ok: false, reason: mapSignInFailure(error) };
    }
    applyUser(data.session?.user ?? data.user ?? null);
    return { ok: true };
  } catch {
    return { ok: false, reason: "unexpected" };
  }
}

/**
 * Signs out and clears the session plus every private UI state derived from
 * it (the reactive status alone hides admin chrome; the provider clears the
 * stored token). Navigation to the public home is the caller's concern.
 */
export async function signOut(): Promise<void> {
  try {
    await api?.signOut();
  } finally {
    // Local state is cleared even if the provider call failed — a stale
    // "signed in" UI over a dead session is the worse outcome; RLS is the
    // enforcement layer regardless.
    applyUser(null);
  }
}

/** Reactive view for components (mirrors the `useEvents` composable style). */
export function useAuth() {
  return {
    status: computed(() => state.status),
    user: computed(() => state.user),
    isAuthenticated: computed(
      () => state.status !== "loading" && state.status !== "anonymous"
    ),
    isAdmin: computed(() => state.status === "admin"),
    signIn,
    signOut,
    whenAuthReady
  };
}

/** Read-only state for tests and non-component consumers. */
export const authState = readonly(state);
