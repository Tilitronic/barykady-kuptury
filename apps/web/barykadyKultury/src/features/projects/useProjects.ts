import { inject, ref, watchEffect, type Ref } from "vue";

import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import {
  fetchPublishedProjectBySlug,
  fetchPublishedProjects,
  type ProjectSummary
} from "@/features/projects/api";
import { projectCoverUrl } from "@/features/projects/cover";
import type { Locale } from "@/features/i18n/locales";
import type { ContentResult } from "@/shared/content/result";

/**
 * Reactive data sources for public projects (T-019).
 *
 * Both hooks mirror `useDocuments`: inject the single Supabase client provided
 * by `src/boot/supabase.ts` (or a fake in tests), expose a reactive
 * `ContentResult`, discard stale responses, and re-fetch when the locale
 * changes. The hooks also own the cover-URL seam — `projectCoverUrl` runs
 * here so components receive plain view-model data and never touch the client
 * (the rule the T-018 review enforced).
 */
type MaybeRef<T> = Ref<T> | T;

/** A project plus the resolved cover URL (`null` → no image rendered). */
export interface ProjectSummaryView extends ProjectSummary {
  readonly coverUrl: string | null;
}

type SupabaseOrNull = Parameters<typeof projectCoverUrl>[0];

function toView(
  supabase: SupabaseOrNull,
  project: ProjectSummary
): ProjectSummaryView {
  return { ...project, coverUrl: projectCoverUrl(supabase, project.coverPath) };
}

function withCoverUrls(
  supabase: SupabaseOrNull,
  result: ContentResult<ProjectSummary>
): ContentResult<ProjectSummaryView> {
  return result.kind === "ok"
    ? {
        kind: "ok",
        items: result.items.map(project => toView(supabase, project))
      }
    : result;
}

/** Published projects for a locale (newest-updated first). */
export function useProjects(locale: MaybeRef<Locale>): {
  readonly result: Ref<ContentResult<ProjectSummaryView>>;
} {
  const supabase = inject(SUPABASE_CLIENT_KEY, null);
  const result = ref<ContentResult<ProjectSummaryView>>({ kind: "loading" });

  watchEffect(onInvalidate => {
    const activeLocale = typeof locale === "string" ? locale : locale.value;

    result.value = { kind: "loading" };

    let stale = false;
    onInvalidate(() => {
      stale = true;
    });

    void (async () => {
      const next = await fetchPublishedProjects(supabase, activeLocale);
      if (!stale) result.value = withCoverUrls(supabase, next);
    })();
  });

  return { result };
}

/**
 * The one published project whose own locale carries `slug`.
 *
 * Strict (locale, slug) resolution lives in the data-access module; empty
 * means the page must render 404 content — never another locale's project.
 */
export function useProject(
  slug: MaybeRef<string>,
  locale: MaybeRef<Locale>
): { readonly result: Ref<ContentResult<ProjectSummaryView>> } {
  const supabase = inject(SUPABASE_CLIENT_KEY, null);
  const result = ref<ContentResult<ProjectSummaryView>>({ kind: "loading" });

  watchEffect(onInvalidate => {
    const activeSlug = typeof slug === "string" ? slug : slug.value;
    const activeLocale = typeof locale === "string" ? locale : locale.value;

    result.value = { kind: "loading" };

    let stale = false;
    onInvalidate(() => {
      stale = true;
    });

    void (async () => {
      const next = await fetchPublishedProjectBySlug(
        supabase,
        activeSlug,
        activeLocale
      );
      if (!stale) result.value = withCoverUrls(supabase, next);
    })();
  });

  return { result };
}
