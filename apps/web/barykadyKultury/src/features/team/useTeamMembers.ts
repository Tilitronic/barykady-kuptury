import { inject, ref, watchEffect, type Ref } from "vue";

import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import {
  fetchPublishedTeamMembers,
  type TeamMember
} from "@/features/team/api";
import { teamPortraitUrl } from "@/features/team/portrait";
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
 *
 * Review fix (T-018 rev-1, Standards): the hook resolves the portrait public
 * URL through `teamPortraitUrl` so components receive plain view-model data —
 * Supabase access stays behind the feature layer (AGENTS.md coding
 * conventions) and `PersonCard` needs no client at all.
 */
type MaybeRef<T> = Ref<T> | T;

/** A member plus the resolved portrait URL (`null` → monogram fallback). */
export interface TeamMemberView extends TeamMember {
  readonly portraitUrl: string | null;
}

export function useTeamMembers(locale: MaybeRef<Locale>): {
  readonly result: Ref<ContentResult<TeamMemberView>>;
} {
  const supabase = inject(SUPABASE_CLIENT_KEY, null);
  const result = ref<ContentResult<TeamMemberView>>({ kind: "loading" });

  watchEffect(onInvalidate => {
    const activeLocale = typeof locale === "string" ? locale : locale.value;

    result.value = { kind: "loading" };

    let stale = false;
    onInvalidate(() => {
      stale = true;
    });

    void (async () => {
      const next = await fetchPublishedTeamMembers(supabase, activeLocale);
      if (stale) return;

      result.value =
        next.kind === "ok"
          ? {
              kind: "ok",
              items: next.items.map(member => ({
                ...member,
                portraitUrl: teamPortraitUrl(supabase, member.portraitPath)
              }))
            }
          : next;
    })();
  });

  return { result };
}
