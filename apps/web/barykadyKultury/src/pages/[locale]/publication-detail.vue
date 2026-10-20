<template>
  <!--
    Canonical root slug (T-038/D-24): the URL segment is shared by every
    locale and the requested locale must supply a translation. An unknown,
    former-localized or draft slug renders the same translated 404 content as
    the locale catch-all. RLS already hides drafts anonymously; this is the
    app-layer complement.
  -->
  <div v-if="publicationResult.kind === 'empty'" class="publication-not-found">
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
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import PublicationFiles from "@/components/publications/PublicationFiles.vue";
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
</style>
