import type { InjectionKey } from "vue";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/**
 * Injection key for the browser Supabase client.
 *
 * `src/boot/supabase.ts` provides the real client at app boot time. Unit and
 * component tests provide a typed fake via `mountWithPlugins` so pages and
 * composables never import the boot file directly (that would run boot-time
 * side effects and throw in a test environment).
 */
export const SUPABASE_CLIENT_KEY: InjectionKey<SupabaseClient<Database> | null> =
  Symbol("supabase-client");
