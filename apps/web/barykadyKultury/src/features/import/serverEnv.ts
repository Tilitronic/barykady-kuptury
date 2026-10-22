import type { ServerSupabaseConfig } from "./serverSupabase";

/**
 * D-41/T-042 review fix — server-only environment boundary.
 *
 * Netlify functions run on the server. Reading `VITE_*` names here would make a
 * browser-inlined variable look like a server secret and previously let a
 * function silently fall back to a publishable URL. Functions therefore call
 * this helper and fail closed unless the server names are present.
 */
export interface ServerEnv {
  readonly SUPABASE_URL?: string | undefined;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string | undefined;
}

function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

export function readServerSupabaseConfig(
  env: ServerEnv
): ServerSupabaseConfig | null {
  const url = nonEmpty(env.SUPABASE_URL);
  const serviceKey = nonEmpty(env.SUPABASE_SERVICE_ROLE_KEY);
  if (url === null || serviceKey === null) return null;
  return { url, serviceKey };
}
