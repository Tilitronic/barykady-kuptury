import { inject, ref, watchEffect, type Ref } from "vue";

import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import {
  fetchPublishedDocumentBySlug,
  fetchPublishedDocuments,
  type OrganizationDocument,
  type OrganizationDocumentReader
} from "@/features/documents/api";
import type { Locale } from "@/features/i18n/locales";
import type { ContentResult } from "@/shared/content/result";

/**
 * Reactive data sources for organization documents (T-017).
 *
 * Both hooks inject the single Supabase client provided by
 * `src/boot/supabase.ts` (or a fake in tests) and expose a reactive
 * `ContentResult` so a page can switch on loading / empty / unavailable /
 * success (docs/TESTING.md §2). The reader hook re-fetches when the slug
 * changes: one canonical document carries every translation, so a locale-prefix
 * switch re-resolves the rendered text locally (D-12) without another request.
 */
type MaybeRef<T> = Ref<T> | T;

/** Published documents for a locale, for the listing page. */
export function useDocuments(locale: MaybeRef<Locale>): {
  readonly result: Ref<ContentResult<OrganizationDocument>>;
} {
  const supabase = inject(SUPABASE_CLIENT_KEY, null);
  const result = ref<ContentResult<OrganizationDocument>>({ kind: "loading" });

  watchEffect(onInvalidate => {
    const activeLocale = typeof locale === "string" ? locale : locale.value;

    result.value = { kind: "loading" };

    let stale = false;
    onInvalidate(() => {
      stale = true;
    });

    void (async () => {
      const next = await fetchPublishedDocuments(supabase, activeLocale);
      if (!stale) result.value = next;
    })();
  });

  return { result };
}

/** The published document reachable at `slug`, for the reader page. */
export function useDocument(slug: MaybeRef<string>): {
  readonly result: Ref<ContentResult<OrganizationDocumentReader>>;
} {
  const supabase = inject(SUPABASE_CLIENT_KEY, null);
  const result = ref<ContentResult<OrganizationDocumentReader>>({
    kind: "loading"
  });

  watchEffect(onInvalidate => {
    const activeSlug = typeof slug === "string" ? slug : slug.value;

    result.value = { kind: "loading" };

    let stale = false;
    onInvalidate(() => {
      stale = true;
    });

    void (async () => {
      const next = await fetchPublishedDocumentBySlug(supabase, activeSlug);
      if (!stale) result.value = next;
    })();
  });

  return { result };
}
