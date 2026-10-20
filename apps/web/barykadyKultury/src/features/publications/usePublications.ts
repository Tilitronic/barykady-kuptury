import { inject, ref, watchEffect, type Ref } from "vue";

import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import {
  fetchPublishedPublicationBySlug,
  fetchPublishedPublications,
  type PublicationFile,
  type PublicationSummary
} from "@/features/publications/api";
import { publicationFileUrl } from "@/features/publications/fileUrl";
import type { Locale } from "@/features/i18n/locales";
import type { ContentResult } from "@/shared/content/result";

/**
 * Reactive data sources for public publications.
 *
 * Mirror `useProjects`: inject the Supabase client, expose a reactive
 * `ContentResult`, discard stale responses, re-fetch on locale change — and
 * own the file-URL seam so components receive plain view-model data with a
 * resolved `downloadUrl` per language version.
 */
type MaybeRef<T> = Ref<T> | T;

type SupabaseOrNull = Parameters<typeof publicationFileUrl>[0];

/** A file version plus its resolved public download URL (`null` → omitted). */
export interface PublicationFileView extends PublicationFile {
  readonly downloadUrl: string | null;
}

/** A publication whose files carry resolved download URLs. */
export interface PublicationView extends PublicationSummary {
  readonly files: readonly PublicationFileView[];
}

function toView(
  supabase: SupabaseOrNull,
  publication: PublicationSummary
): PublicationView {
  return {
    ...publication,
    files: publication.files.map(file => ({
      ...file,
      downloadUrl: publicationFileUrl(supabase, file.storagePath)
    }))
  };
}

function withFileUrls(
  supabase: SupabaseOrNull,
  contentResult: ContentResult<PublicationSummary>
): ContentResult<PublicationView> {
  return contentResult.kind === "ok"
    ? {
        kind: "ok",
        items: contentResult.items.map(p => toView(supabase, p))
      }
    : contentResult;
}

/** Published publications for a locale (newest first). */
export function usePublications(locale: MaybeRef<Locale>): {
  readonly publicationsResult: Ref<ContentResult<PublicationView>>;
} {
  const supabase = inject(SUPABASE_CLIENT_KEY, null);
  const publicationsResult = ref<ContentResult<PublicationView>>({
    kind: "loading"
  });

  watchEffect(onInvalidate => {
    const activeLocale = typeof locale === "string" ? locale : locale.value;

    publicationsResult.value = { kind: "loading" };

    let stale = false;
    onInvalidate(() => {
      stale = true;
    });

    void (async () => {
      const fetchedPublications = await fetchPublishedPublications(
        supabase,
        activeLocale
      );
      if (!stale) {
        publicationsResult.value = withFileUrls(supabase, fetchedPublications);
      }
    })();
  });

  return { publicationsResult };
}

/**
 * The one published publication whose own locale carries `slug`.
 * Strict (locale, slug) resolution lives in the data-access module; empty
 * means the page renders 404 content — never another locale's publication.
 */
export function usePublication(
  slug: MaybeRef<string>,
  locale: MaybeRef<Locale>
): { readonly publicationResult: Ref<ContentResult<PublicationView>> } {
  const supabase = inject(SUPABASE_CLIENT_KEY, null);
  const publicationResult = ref<ContentResult<PublicationView>>({
    kind: "loading"
  });

  watchEffect(onInvalidate => {
    const activeSlug = typeof slug === "string" ? slug : slug.value;
    const activeLocale = typeof locale === "string" ? locale : locale.value;

    publicationResult.value = { kind: "loading" };

    let stale = false;
    onInvalidate(() => {
      stale = true;
    });

    void (async () => {
      const fetchedPublication = await fetchPublishedPublicationBySlug(
        supabase,
        activeSlug,
        activeLocale
      );
      if (!stale) {
        publicationResult.value = withFileUrls(supabase, fetchedPublication);
      }
    })();
  });

  return { publicationResult };
}
