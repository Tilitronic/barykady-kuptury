import type { SupabaseClient } from "@supabase/supabase-js";
import { ref, watch } from "vue";
import type { Ref } from "vue";
import { useRoute, useRouter, type RouteLocationRaw } from "vue-router";

import type { Locale } from "@/features/i18n/locales";
import type { Database } from "@/types/database.types";

import { fetchReaderDocument } from "./api";
import { resolveReaderLocale } from "./resolveReaderLocale";
import type {
  ReaderDocumentModel,
  ReaderDocumentStatus,
  ReaderEntityKind,
  ReaderTranslation
} from "./types";

/**
 * Unified reader composable (T-040, D-27/D-38).
 *
 * Responsibilities:
 *   - fetch the published row + all translations/assets by canonical slug;
 *   - resolve the content language (`?lang` → UI locale → EN → first);
 *   - normalize an invalid/unavailable `?lang` with `router.replace` while
 *     preserving the path, hash and every other query parameter;
 *   - expose explicit states so a failed document never blanks the shell.
 *
 * The document is fetched once per slug. Switching content language only
 * re-selects a translation, so changing `?lang` never re-downloads the row.
 * `router`/`route` are injectable seams for tests; production callers omit
 * them and the composable uses the active router.
 */

export interface ReaderRouterLike {
  replace(to: RouteLocationRaw): unknown;
}

export interface ReaderRouteLike {
  readonly path: string;
  readonly hash: string;
  readonly query: Readonly<Record<string, unknown>>;
}

export interface UseReaderDocumentOptions {
  readonly kind: ReaderEntityKind;
  readonly slug: Ref<string | null | undefined>;
  /** UI/route locale, never changed by the content-language selector. */
  readonly locale: Ref<Locale>;
  /** Raw `?lang` query value from the route. */
  readonly requestedLang: Ref<string | null | undefined>;
  readonly supabase: SupabaseClient<Database> | null;
  readonly router?: ReaderRouterLike;
  readonly route?: ReaderRouteLike;
}

export interface ReaderDocumentLocation {
  readonly path: string;
  readonly query: Record<string, string | string[]>;
  readonly hash: string;
}

/**
 * Builds the normalized `?lang=` location, dropping only the old `lang` key
 * and preserving path/hash/other query values (D-27: shareable content
 * language, unchanged route locale).
 */
export function buildReaderLangLocation(
  route: ReaderRouteLike,
  locale: Locale
): ReaderDocumentLocation {
  const query: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(route.query)) {
    if (key === "lang") continue;
    if (typeof value === "string") {
      query[key] = value;
    } else if (Array.isArray(value)) {
      const strings = value.filter(
        (entry): entry is string => typeof entry === "string"
      );
      if (strings.length > 0) query[key] = strings;
    }
  }

  query.lang = locale;
  return { path: route.path, query, hash: route.hash };
}

export function useReaderDocument(options: UseReaderDocumentOptions): {
  model: Ref<ReaderDocumentModel | null>;
  selected: Ref<ReaderTranslation | null>;
  /** Resolved content locale (the article `lang`). */
  locale: Ref<Locale>;
  status: Ref<ReaderDocumentStatus>;
  retry: () => void;
} {
  const router = options.router ?? useRouter();
  const route = options.route ?? useRoute();

  const model = ref<ReaderDocumentModel | null>(null);
  const selected = ref<ReaderTranslation | null>(null);
  const contentLocale = ref<Locale>(options.locale.value);
  const status = ref<ReaderDocumentStatus>("idle");

  let generation = 0;

  function applySelection(): void {
    const document = model.value;
    if (!document) return;

    const resolution = resolveReaderLocale({
      requested: options.requestedLang.value,
      uiLocale: options.locale.value,
      available: document.availableLocales
    });

    contentLocale.value = resolution.locale;

    const translation =
      document.translations.find(
        candidate =>
          candidate.locale === resolution.locale && candidate.hasReadableContent
      ) ?? null;

    selected.value = translation;

    if (!translation) {
      // Unsupported version / no readable text: an explicit state, not a blank
      // article. There is no meaningful language to normalize the URL to.
      status.value = "unsupported";
      return;
    }

    status.value = "ready";

    if (resolution.shouldNormalize) {
      const target = buildReaderLangLocation(route, resolution.locale);
      try {
        // Navigation rejection (e.g. duplicated navigation) must not break the
        // reader; the selected translation is already rendered.
        void router.replace(target);
      } catch {
        // Ignore: the URL is cosmetic once the fallback translation is shown.
      }
    }
  }

  async function load(): Promise<void> {
    const canonicalSlug = options.slug.value?.trim() ?? "";
    const currentGeneration = ++generation;

    if (canonicalSlug.length === 0) {
      model.value = null;
      selected.value = null;
      status.value = "empty";
      return;
    }

    status.value = "loading";
    model.value = null;
    selected.value = null;

    let result: Awaited<ReturnType<typeof fetchReaderDocument>>;
    try {
      result = await fetchReaderDocument(
        options.supabase,
        options.kind,
        canonicalSlug
      );
    } catch {
      // `fetchReaderDocument` already converts its own failures; this is a
      // last-resort guard so a rejected transport never escapes the composable.
      if (currentGeneration !== generation) return;
      status.value = "unavailable";
      return;
    }

    // A newer slug/retry owns the state; drop this response.
    if (currentGeneration !== generation) return;

    if (result.kind === "ok") {
      const document = result.items[0] ?? null;
      model.value = document;

      if (!document) {
        status.value = "empty";
        return;
      }

      applySelection();
      return;
    }

    status.value = result.kind === "empty" ? "empty" : "unavailable";
  }

  watch([() => options.kind, options.slug], () => void load(), {
    immediate: true
  });

  // Content-language and UI-locale changes only re-select; no refetch.
  watch([options.locale, options.requestedLang], () => {
    if (model.value) applySelection();
  });

  function retry(): void {
    void load();
  }

  return {
    model,
    selected,
    locale: contentLocale,
    status,
    retry
  };
}
