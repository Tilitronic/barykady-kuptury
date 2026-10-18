<template>
  <div class="about-documents-page">
    <h1 class="about-documents-page__title">{{ t("aboutDocuments.title") }}</h1>

    <div
      v-if="result.kind === 'loading'"
      class="about-documents-page__state"
      role="status"
    >
      {{ t("content.loading") }}
    </div>
    <div
      v-else-if="result.kind === 'empty'"
      class="about-documents-page__state"
    >
      {{ t("aboutDocuments.empty") }}
    </div>
    <div
      v-else-if="result.kind === 'unavailable'"
      class="about-documents-page__state"
    >
      {{ t("content.unavailable") }}
    </div>
    <ul v-else class="documents-list">
      <li
        v-for="document in documents"
        :key="document.id"
        class="documents-list__item"
      >
        <h2 class="documents-list__title">
          <RouterLink
            v-if="isTextDocument(document)"
            :to="readerPath(document)"
            class="documents-list__link focus-ring"
          >
            {{ document.title }}
          </RouterLink>
          <template v-else>{{ document.title }}</template>
        </h2>

        <p v-if="document.description" class="documents-list__description">
          {{ document.description }}
        </p>

        <!-- Optional metadata collapses: only present values render. -->
        <p class="documents-list__meta">
          <span class="documents-list__type">
            {{ documentTypeLabel(document.documentType) }}
          </span>
          <span v-if="document.publicationDate" class="documents-list__date">
            <time :datetime="document.publicationDate">
              {{ formattedDate(document.publicationDate) }}
            </time>
          </span>
        </p>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import { type OrganizationDocument } from "@/features/documents/api";
import { useDocuments } from "@/features/documents/useDocuments";
import { formatDate } from "@/features/i18n/format";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";

/**
 * About → Documents listing (T-017).
 *
 * A document with readable text links to the in-app reader; a file-based
 * document renders as plain metadata for now (T-029 adds the admin upload and
 * the file action). Optional metadata is omitted rather than rendered empty
 * (docs/PRODUCT_REQUIREMENTS.md §5). PublicLayout provides the shell.
 */
const { t, te } = useI18n();
const route = useRoute();

const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

const { result } = useDocuments(currentLocale);

const documents = computed<readonly OrganizationDocument[]>(() =>
  result.value.kind === "ok" ? result.value.items : []
);

/** A text document has at least one locale carrying a readable body. */
function isTextDocument(document: OrganizationDocument): boolean {
  return document.availableLocales.length > 0;
}

function readerPath(document: OrganizationDocument): string {
  return `/${currentLocale.value}/about/documents/${document.slug}`;
}

/**
 * Resolves the free-form `document_type` to localized copy. An unknown type
 * falls back to the stored label rather than rendering a missing-key marker.
 */
function documentTypeLabel(documentType: string): string {
  const key = `aboutDocuments.types.${documentType}`;
  return te(key) ? t(key) : documentType;
}

function formattedDate(value: string): string {
  // Date-only values are formatted in UTC so the day never shifts by timezone.
  return formatDate(new Date(value), currentLocale.value, {
    dateStyle: "medium",
    timeZone: "UTC"
  });
}
</script>

<style scoped>
.about-documents-page__title {
  max-width: 65ch;
  margin: 0 0 1.5rem;
}

.about-documents-page__state {
  max-width: 65ch;
  margin: 0;
  color: var(--color-text-muted);
}

.documents-list {
  max-width: 65ch;
  margin: 0;
  padding: 0;
  list-style: none;
}

.documents-list__item {
  padding-block: 1.25rem;
  border-block-start: 1px solid var(--color-border);
}

.documents-list__item:first-child {
  border-block-start: 0;
  padding-block-start: 0;
}

.documents-list__title {
  margin: 0 0 0.375rem;
  font-size: var(--font-size-h3);
}

.documents-list__link {
  color: var(--color-link);
  text-decoration: underline;
}

.documents-list__link:hover {
  text-decoration: none;
}

.documents-list__description {
  margin: 0 0 0.5rem;
  color: var(--color-text);
}

.documents-list__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.documents-list__type {
  color: var(--color-accent);
  font-weight: 600;
}
</style>
