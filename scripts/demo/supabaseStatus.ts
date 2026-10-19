/**
 * Parses `supabase status -o env` without ever persisting the values.
 *
 * The service-role key is read at runtime and kept only in process memory
 * (docs/architecture.md §6: no service key in `.env.local`, `VITE_*`, source,
 * logs, or documentation). This module deliberately has no write path.
 */

export interface LocalSupabaseStatus {
  readonly apiUrl: string;
  readonly serviceRoleKey: string;
  readonly publishableKey: string;
  readonly dbUrl: string;
}

export type StatusEnv = Readonly<Record<string, string>>;

/** Reads `KEY="value"` / `KEY='value'` / `KEY=value` lines; ignores noise. */
export function parseStatusEnv(output: string): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    const trimmed = rawValue!.trim();
    const quoted =
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"));
    parsed[key!] = quoted ? trimmed.slice(1, -1) : trimmed;
  }

  return parsed;
}

/**
 * Selects the values the demo scripts need.
 *
 * `SECRET_KEY` is the newer local CLI name for the same trusted server key;
 * accepting it keeps the scripts working across CLI versions without ever
 * falling back to the browser-safe anon/publishable key.
 */
export function selectLocalStatus(env: StatusEnv): LocalSupabaseStatus {
  const apiUrl = env.API_URL;
  const serviceRoleKey = env.SERVICE_ROLE_KEY || env.SECRET_KEY;

  if (!apiUrl) {
    throw new Error(
      "supabase status did not report API_URL; is the local stack running?"
    );
  }
  if (!serviceRoleKey) {
    throw new Error(
      "supabase status did not report SERVICE_ROLE_KEY/SECRET_KEY; refusing to continue"
    );
  }

  return {
    apiUrl,
    serviceRoleKey,
    publishableKey: env.PUBLISHABLE_KEY || env.ANON_KEY || "",
    dbUrl: env.DB_URL || ""
  };
}
