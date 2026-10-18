import { inject, ref, watchEffect, type Ref } from "vue";

import {
  fetchPublishedPage,
  type SitePageContent
} from "@/features/content/api";
import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import type { Locale } from "@/features/i18n/locales";
import type { ContentResult } from "@/shared/content/result";

/**
 * Reactive data source for a single published site page.
 *
 * Injects the Supabase client provided by `src/boot/supabase.ts` (or a fake
 * supplied by tests) and keeps a reactive `ContentResult` that the page can
 * switch on for loading / empty / error / success states.
 */
export function useSitePage(
  pageKey: string,
  locale: Ref<Locale> | Locale
): { readonly result: Ref<ContentResult<SitePageContent>> } {
  const supabase = inject(SUPABASE_CLIENT_KEY, null);
  const result = ref<ContentResult<SitePageContent>>({ kind: "loading" });

  watchEffect(onInvalidate => {
    const activeLocale = typeof locale === "string" ? locale : locale.value;

    result.value = { kind: "loading" };

    let stale = false;
    onInvalidate(() => {
      stale = true;
    });

    void (async () => {
      const next = await fetchPublishedPage(supabase, pageKey, activeLocale);
      if (!stale) {
        result.value = next;
      }
    })();
  });

  return { result };
}
