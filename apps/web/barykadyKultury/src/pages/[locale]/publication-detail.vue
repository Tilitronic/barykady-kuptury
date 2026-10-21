<template>
  <!--
    Canonical root slug (T-038/D-24). T-040: when the row carries readable
    long-form content (AST v1, or legacy text until T-041 retires it) the page
    renders through the shared LongFormReader — content language is `?lang=`,
    the route locale and chrome never change (D-27), and an unavailable
    requested translation falls back via the D-38 chain instead of 404ing.
    Without body data the page keeps its T-020 metadata/files view (publications
    are metadata-only until T-041 imports), reader controls absent there.
    An unknown or draft slug renders the translated 404 content. RLS already
    hides drafts anonymously; this is the app-layer complement.
  -->
  <div v-if="useReaderView || applying" class="publication-reader">
    <p class="publication-detail__back">
      <RouterLink
        :to="listPath"
        class="publication-detail__back-link focus-ring"
      >
        {{ t("publications.detail.back") }}
      </RouterLink>
    </p>

    <ContentUpdateBanner
      :visible="updateAvailable"
      :applying="applying"
      @show="showUpdate"
    />

    <div
      v-if="applying"
      class="publication-reader__refreshing"
      role="status"
      aria-live="polite"
      :aria-label="t('content.updating')"
    >
      <span
        class="publication-reader__skeleton publication-reader__skeleton--title"
      />
      <span class="publication-reader__skeleton" />
      <span class="publication-reader__skeleton" />
      <span
        class="publication-reader__skeleton publication-reader__skeleton--short"
      />
    </div>

    <LongFormReader
      v-else
      :title="readerTitle"
      :description="reader.selected.value?.description ?? null"
      :body-ast="reader.selected.value?.bodyAst ?? null"
      :body="reader.selected.value?.body ?? null"
      :content-locale="reader.locale.value"
      :ui-locale="currentLocale"
      :available-locales="reader.model.value?.availableLocales ?? []"
      :assets="reader.model.value?.assets ?? []"
      :status="reader.status.value"
      :storage-key="readerStorageKey"
      :is-fallback="readerIsFallback"
      :offers-download="readerOffersDownload"
      :original-download-url="originalDownloadUrl"
      @change-locale="chooseContentLocale"
      @retry="reader.retry"
    >
      <!--
        rev-1 E: bibliographic identity must never disappear from the reader.
        Authors/date/files come from `fetchPublicationDetail` — the same D-38
        resolution chain as the body — so the metadata shown always matches
        the language actually being read (a strict per-locale read could
        otherwise 404 while the reader renders English).
      -->
      <p v-if="detail?.publication.authors" class="publication-detail__authors">
        {{ detail.publication.authors }}
      </p>
      <p
        v-if="detail?.publication.publicationDate"
        class="publication-detail__date"
      >
        <time :datetime="detail.publication.publicationDate">{{
          detailFormattedDate
        }}</time>
      </p>
      <template v-if="detailFiles.length > 0">
        <h2 class="publication-detail__files-heading">
          {{ t("publications.detail.filesHeading") }}
        </h2>
        <PublicationFiles
          :files="detailFiles"
          :external-url="detail?.publication.externalUrl ?? null"
        />
      </template>
    </LongFormReader>
  </div>

  <div
    v-else-if="publicationResult.kind === 'empty'"
    class="publication-not-found"
  >
    <h1 class="publication-not-found__title">{{ t("notFound.title") }}</h1>
    <p class="publication-not-found__message">{{ t("notFound.message") }}</p>
    <p class="publication-not-found__back">
      <RouterLink
        :to="listPath"
        class="publication-not-found__back-link focus-ring"
      >
        {{ t("publications.detail.back") }}
      </RouterLink>
    </p>
  </div>

  <article v-else class="publication-detail">
    <p class="publication-detail__back">
      <RouterLink
        :to="listPath"
        class="publication-detail__back-link focus-ring"
      >
        {{ t("publications.detail.back") }}
      </RouterLink>
    </p>

    <h1 class="publication-detail__title">{{ headingText }}</h1>

    <div
      v-if="publicationResult.kind === 'loading'"
      class="publication-detail__state"
      role="status"
    >
      {{ t("content.loading") }}
    </div>
    <div
      v-else-if="publicationResult.kind === 'unavailable'"
      class="publication-detail__state"
    >
      {{ t("content.unavailable") }}
    </div>
    <template v-else-if="publication">
      <!--
        No fallback note here: strict (locale, slug) resolution means the
        rendered row is always the requested locale's own translation, so
        `isFallback` is unreachable on this page. Visible fallback surfacing
        lives on the listing card, where the resolver can substitute English.
      -->
      <p v-if="publication.abstract" class="publication-detail__abstract">
        {{ publication.abstract }}
      </p>

      <p v-if="publication.authors" class="publication-detail__authors">
        {{ publication.authors }}
      </p>

      <p v-if="publication.publicationDate" class="publication-detail__date">
        <time :datetime="publication.publicationDate">{{ formattedDate }}</time>
      </p>

      <h2
        v-if="publication.files.length > 0"
        class="publication-detail__files-heading"
      >
        {{ t("publications.detail.filesHeading") }}
      </h2>

      <PublicationFiles
        :files="publication.files"
        :external-url="publication.externalUrl"
      />
    </template>
  </article>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import ContentUpdateBanner from "@/components/content/ContentUpdateBanner.vue";
import LongFormReader from "@/components/reader/LongFormReader.vue";
import { contentOriginalUrl } from "@/features/reader/originalUrl";
import { readerSettingsKey } from "@/components/reader/readerSettings";
import { useContentRevalidation } from "@/features/import/useContentRevalidation";
import PublicationFiles from "@/components/publications/PublicationFiles.vue";
import {
  fetchPublicationDetail,
  type PublicationDetail
} from "@/features/publications/api";
import { publicationFileUrl } from "@/features/publications/fileUrl";
import type { PublicationFileView } from "@/features/publications/usePublications";
import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import { useReaderDocument } from "@/features/reader/useReaderDocument";
import type { PublicationView } from "@/features/publications/usePublications";
import { usePublication } from "@/features/publications/usePublications";
import { formatDate } from "@/features/i18n/format";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";

/**
 * Publication detail page.
 *
 * One logical publication resolved by its canonical root slug plus the
 * requested locale's translation (T-038/D-24): full abstract, authors, date,
 * then each `publication_files` row as a distinct language/version download
 * (labelled with language, type and size) or the single external URL — and NO
 * action when there is neither. The abstract is plain authored text (PRD §4
 * metadata), so it renders in a paragraph; rich text is not needed and was not
 * added (AGENTS.md rule 7). PublicLayout provides the shell.
 */
const { t } = useI18n();
const route = useRoute();

const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

const requestedSlug = computed<string>(() => {
  const { slug } = route.params as { slug?: unknown };
  return typeof slug === "string" ? slug : "";
});

const { publicationResult } = usePublication(requestedSlug, currentLocale);

/* ── Reader state (T-040) ────────────────────────────────────────────────── */

const router = useRouter();
const supabase = inject(SUPABASE_CLIENT_KEY, null);

const requestedLang = computed<string | null>(() => {
  const { lang } = route.query as { lang?: unknown };
  return typeof lang === "string" ? lang : null;
});

const reader = useReaderDocument({
  kind: "publication",
  slug: requestedSlug,
  locale: currentLocale,
  requestedLang,
  supabase
});

const { updateAvailable, applying, applyUpdate } = useContentRevalidation({
  kind: "publication",
  slug: requestedSlug
});

async function showUpdate(): Promise<void> {
  await applyUpdate(async () => {
    reader.refresh();
    const deadline = Date.now() + 5_000;
    while (reader.status.value === "loading" && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  });
}

/** Reader view only when the selected translation actually has body data. */
const useReaderView = computed(() => {
  const selected = reader.selected.value;
  return (
    reader.status.value === "ready" &&
    selected !== null &&
    (selected.bodyAst !== null || (selected.body?.trim().length ?? 0) > 0)
  );
});

const readerTitle = computed(() => reader.selected.value?.title ?? "");

const readerIsFallback = computed(
  () =>
    requestedLang.value === null && reader.locale.value !== currentLocale.value
);

const readerStorageKey = computed(() =>
  readerSettingsKey("publication", requestedSlug.value)
);

/** Owner opt-in gate for the original-file affordance (T-041 S4). */
const originalDownloadUrl = computed<string | null>(() =>
  useReaderView.value && reader.model.value?.allowOriginalDownload === true
    ? contentOriginalUrl("publication", requestedSlug.value)
    : null
);

/* ── D-38 metadata for the reader branch (rev-1 E) ────────────────────────── */

const detail = ref<PublicationDetail | null>(null);

watch(
  [() => reader.locale.value, requestedSlug, useReaderView],
  ([locale, slug, readerView], _previous, onCleanup) => {
    detail.value = null;
    if (!readerView || !supabase || slug.length === 0) return;

    let stale = false;
    onCleanup(() => {
      stale = true;
    });

    void fetchPublicationDetail(supabase, slug, locale).then(result => {
      if (stale) return;
      detail.value = result.kind === "ok" ? (result.items[0] ?? null) : null;
    });
  },
  { immediate: true }
);

const detailFormattedDate = computed(() => {
  const value = detail.value?.publication.publicationDate;
  if (!value) return "";
  // Content dates read in the CONTENT language (the article's locale).
  return formatDate(new Date(value), reader.locale.value, {
    dateStyle: "medium",
    timeZone: "UTC"
  });
});

/** Raw detail files → download-URL views (the PublicationFiles contract). */
const detailFiles = computed<readonly PublicationFileView[]>(() =>
  (detail.value?.files ?? []).map(file => ({
    ...file,
    downloadUrl: publicationFileUrl(supabase, file.storagePath)
  }))
);

/** The unsupported-state download sentence only when a file exists (F). */
const readerOffersDownload = computed(
  () =>
    detailFiles.value.length > 0 ||
    detail.value?.publication.externalUrl != null
);

function chooseContentLocale(locale: Locale): void {
  if (locale === reader.locale.value) return;
  void router.push({
    path: route.path,
    query: { ...route.query, lang: locale },
    hash: route.hash
  });
}

const publication = computed<PublicationView | null>(() =>
  publicationResult.value.kind === "ok"
    ? (publicationResult.value.items[0] ?? null)
    : null
);

const headingText = computed(
  () => publication.value?.title ?? t("publications.title")
);

const listPath = computed(() => `/${currentLocale.value}/publications`);

const formattedDate = computed(() => {
  if (!publication.value?.publicationDate) return "";
  // Date-only values are formatted in UTC so the day never shifts by timezone.
  return formatDate(
    new Date(publication.value.publicationDate),
    currentLocale.value,
    {
      dateStyle: "medium",
      timeZone: "UTC"
    }
  );
});
</script>

<style scoped>
.publication-detail {
  max-width: 65ch;
}

.publication-detail__back {
  margin: 0 0 1.5rem;
  font-size: var(--font-size-small);
}

.publication-detail__back-link {
  color: var(--color-link);
  text-decoration: none;
}

.publication-detail__back-link:hover {
  text-decoration: underline;
}

.publication-detail__title {
  margin: 0 0 1rem;
  overflow-wrap: break-word;
}

.publication-detail__state {
  color: var(--color-text-muted);
}

.publication-detail__abstract {
  margin: 0 0 1rem;
  overflow-wrap: break-word;
}

.publication-detail__authors {
  margin: 0 0 1rem;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.publication-detail__date {
  margin: 0 0 2rem;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.publication-detail__files-heading {
  margin: 0 0 0.75rem;
  font-size: var(--font-size-h3);
}

.publication-not-found {
  max-width: 65ch;
}

.publication-not-found__title {
  margin: 0 0 1rem;
}

.publication-not-found__message {
  margin: 0;
  color: var(--color-text-muted);
}

.publication-not-found__back {
  margin: 1.5rem 0 0;
  font-size: var(--font-size-small);
}

.publication-not-found__back-link {
  color: var(--color-link);
  text-decoration: none;
}

.publication-not-found__back-link:hover {
  text-decoration: underline;
}

.publication-reader__refreshing {
  display: grid;
  gap: 0.75rem;
  padding: 1rem 0;
}

.publication-reader__skeleton {
  display: block;
  height: 1rem;
  border-radius: 0.25rem;
  background: var(--color-surface-raised);
  animation: publication-reader-pulse 1.2s ease-in-out infinite;
}

.publication-reader__skeleton--title {
  height: 2rem;
  width: min(60%, 28rem);
}

.publication-reader__skeleton--short {
  width: min(40%, 18rem);
}

@keyframes publication-reader-pulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .publication-reader__skeleton {
    animation: none;
  }
}
</style>
