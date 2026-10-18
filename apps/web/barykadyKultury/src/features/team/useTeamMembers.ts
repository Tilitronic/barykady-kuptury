import { inject, ref, watchEffect, type Ref } from "vue";

import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import {
  fetchPublishedTeamMembers,
  type TeamMember
} from "@/features/team/api";
import type { Locale } from "@/features/i18n/locales";
import type { ContentResult } from "@/shared/content/result";

/**
 * Reactive data source for the team listing (T-018).
 *
 * Mirrors `useDocuments`: it injects the single Supabase client provided by
 * `src/boot/supabase.ts` (or a fake in tests), exposes a reactive
 * `ContentResult` so the page can switch on loading / empty / unavailable /
 * success, and re-fetches when the requested locale changes — for example
 * when the header language switcher navigates to another locale prefix. The
 * `sort_order` ranking is locale-independent; only role/bio text localizes.
 */
type MaybeRef<T> = Ref<T> | T;

export function useTeamMembers(locale: MaybeRef<Locale>): {
  readonly result: Ref<ContentResult<TeamMember>>;
} {
  const supabase = inject(SUPABASE_CLIENT_KEY, null);
  const result = ref<ContentResult<TeamMember>>({ kind: "loading" });

  watchEffect(onInvalidate => {
    const activeLocale = typeof locale === "string" ? locale : locale.value;

    result.value = { kind: "loading" };

    let stale = false;
    onInvalidate(() => {
      stale = true;
    });

    void (async () => {
      const next = await fetchPublishedTeamMembers(supabase, activeLocale);
      if (!stale) result.value = next;
    })();
  });

  return { result };
}
