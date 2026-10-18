import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { defineBoot } from "#q-app";

import { resolveSupabaseSetup } from "@/features/content/supabaseConfig";
import type { Database } from "@/types/database.types";

/**
 * The single browser Supabase client (docs/architecture.md §3).
 *
 * Which environment variables are read and how a missing configuration is
 * handled lives in the pure `resolveSupabaseSetup` helper so it is unit-tested
 * (`src/features/content/__tests__/supabaseConfig.test.ts`); this file is only
 * the thin consumer that turns that decision into a client.
 *
 * Failure contract (T-015): a development build throws on a missing
 * configuration so a misconfigured workstation fails fast; a production build
 * gets `null`, and every feature data-access module degrades to the
 * `unavailable` content state instead of crashing a public page.
 *
 * Only the browser-safe project URL and publishable key are referenced. No
 * service-role or other server-only credential exists anywhere in this module
 * (docs/architecture.md §6).
 */
const setup = resolveSupabaseSetup(
  {
    url: import.meta.env.VITE_SUPABASE_URL,
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  },
  { isDev: import.meta.env.DEV }
);

/**
 * The initialized client, or `null` when the project is not configured. Feature
 * modules accept this nullable value and map `null` to `{ kind: "unavailable" }`.
 */
export const supabase: SupabaseClient<Database> | null =
  setup.kind === "ready"
    ? createClient<Database>(setup.url, setup.publishableKey)
    : null;

if (setup.kind === "unavailable") {
  // Production-only path: development throws inside the helper. The message is
  // a developer diagnostic, never user-facing copy.
  console.warn(setup.message);
}

export default defineBoot(() => {
  // The client is created when this module is evaluated, before the app mounts.
  // The boot body is intentionally empty: creating the client is the side
  // effect, and a development misconfiguration has already thrown above.
});
