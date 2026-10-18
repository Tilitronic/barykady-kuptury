/**
 * T-015 Supabase client configuration policy.
 *
 * docs/architecture.md §3 fixes a single initialized browser client, and §6/§9
 * fix that only the browser-safe project URL and the *publishable* key may reach
 * the client bundle. This module implements that boundary as a pure decision so
 * it can be unit-tested even though `src/boot/**` is excluded from vitest:
 *
 * - exactly two environment variables are read — the project URL and the
 *   publishable key;
 * - a missing or blank value is a loud error in development (fail fast on a
 *   misconfigured workstation) and a quiet `unavailable` result in production,
 *   because public pages must keep rendering (docs/PRODUCT_REQUIREMENTS.md §5);
 * - configured values are trimmed so a stray space cannot corrupt a request.
 *
 * The module deliberately names no server-only variable or credential: only the
 * two `VITE_*` publishable values above exist here.
 */

/** Browser-safe Supabase project URL variable (docs/architecture.md §9). */
export const SUPABASE_URL_VAR = "VITE_SUPABASE_URL";

/** Browser-safe Supabase publishable key variable (docs/architecture.md §9). */
export const SUPABASE_PUBLISHABLE_KEY_VAR = "VITE_SUPABASE_PUBLISHABLE_KEY";

/** Raw values read from the bundle's environment. Untrusted. */
export interface SupabaseEnv {
  readonly url: unknown;
  readonly publishableKey: unknown;
}

export interface SupabaseSetupOptions {
  /** True while running `pnpm dev`; false in a production build. */
  readonly isDev: boolean;
}

/**
 * `ready` carries usable credentials; `unavailable` is the production
 * degradation under which feature data-access modules return the
 * `unavailable` content state instead of throwing.
 */
export type SupabaseSetup =
  | {
      readonly kind: "ready";
      readonly url: string;
      readonly publishableKey: string;
    }
  | { readonly kind: "unavailable"; readonly message: string };

/** Normalizes a candidate value to a non-empty string, or `null`. */
function readValue(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolves the browser client setup from the environment.
 *
 * @throws {Error} in development when either variable is missing or blank. A
 *   production build never throws here: it returns `unavailable` so the public
 *   site keeps rendering.
 */
export function resolveSupabaseSetup(
  env: SupabaseEnv,
  options: SupabaseSetupOptions
): SupabaseSetup {
  const url = readValue(env.url);
  const publishableKey = readValue(env.publishableKey);

  if (url === null || publishableKey === null) {
    const missing = [
      url === null ? SUPABASE_URL_VAR : null,
      publishableKey === null ? SUPABASE_PUBLISHABLE_KEY_VAR : null
    ].filter((name): name is string => name !== null);

    const message = `Supabase is not configured: missing ${missing.join(", ")}.`;

    if (options.isDev) {
      throw new Error(message);
    }

    return { kind: "unavailable", message };
  }

  return { kind: "ready", url, publishableKey };
}
