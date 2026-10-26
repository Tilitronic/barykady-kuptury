<template>
  <!--
    DocumentsSection — the T-017 documents listing as an anchored About
    section (T-039, D-25). The old `/about/documents` route redirects here;
    the READER route `/about/documents/:slug` is untouched (SEO + sharing).

    Text documents link to the reader under the active locale (D-12: the
    reader itself falls back to English with a note); file documents keep
    their metadata-only state — T-029 owns the file action.
  -->
  <section id="documents" class="documents-section">
    <h2 class="documents-section__heading" tabindex="-1">
      {{ t("aboutDocuments.title") }}
    </h2>

    <p
      v-if="result.kind === 'loading'"
      class="documents-section__state"
      role="status"
    >
      {{ t("content.loading") }}
    </p>
    <p v-else-if="result.kind === 'empty'" class="documents-section__state">
      {{ t("aboutDocuments.empty") }}
    </p>
    <p
      v-else-if="result.kind === 'unavailable'"
      class="documents-section__state"
      role="alert"
    >
      {{ t("content.unavailable") }}
    </p>
    <ul v-else class="documents-section__list">
      <li
        v-for="document in documents"
        :key="document.id"
        class="documents-list__item"
      >
        <h3 class="documents-list__title">
          <RouterLink
            v-if="isTextDocument(document)"
            :to="readerPath(document)"
            class="documents-list__link focus-ring"
          >
            {{ document.title }}
          </RouterLink>
          <a
            v-else-if="fileUrl(document)"
            :href="fileUrl(document)!"
            class="documents-list__link focus-ring"
            data-testid="document-download"
          >
            {{ document.title }}
          </a>
          <template v-else>{{ document.title }}</template>
        </h3>

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
  </section>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";

import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import { type OrganizationDocument } from "@/features/documents/api";
import { documentFileUrl } from "@/features/documents/fileUrl";
import { useDocuments } from "@/features/documents/useDocuments";
import { formatDate } from "@/features/i18n/format";
import type { Locale } from "@/features/i18n/locales";

/**
 * T-039 — extracted from `about-documents.vue` without behavior change
 * (card markup, reader links, type-label fallback, UTC date rule all
 * preserved). Section headings step down to h3: the About page owns h1 and
 * section h2s (heading hierarchy, DESIGN_SYSTEM.md §6).
 */
const { t, te } = useI18n();

const props = defineProps<{ locale: Locale }>();

const supabase = inject(SUPABASE_CLIENT_KEY, null);
const { result } = useDocuments(computed(() => props.locale));

const documents = computed<readonly OrganizationDocument[]>(() =>
  result.value.kind === "ok" ? result.value.items : []
);

/** A text document has at least one locale carrying a readable body. */
function isTextDocument(document: OrganizationDocument): boolean {
  return document.availableLocales.length > 0;
}

function readerPath(document: OrganizationDocument): string {
  return `/${props.locale}/about/documents/${document.slug}`;
}

/**
 * A file document gets an anonymous download link (T-029). The URL resolves
 * through the shared public-object seam and carries the attachment policy;
 * text documents keep their reader link instead.
 */
function fileUrl(document: OrganizationDocument): string | null {
  return documentFileUrl(supabase, document.storagePath);
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
  return formatDate(new Date(value), props.locale, {
    dateStyle: "medium",
    timeZone: "UTC"
  });
}
</script>

<style scoped>
.documents-section__heading {
  margin: 0 0 1.25rem;
  font-size: var(--font-size-h2);
}

.documents-section__state {
  max-width: 65ch;
  margin: 0;
  color: var(--color-text-muted);
}

.documents-section__list {
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
  /* T-033: emphasis TEXT uses the link token (≥4.5:1 on every surface in both
     themes); the accent value fails AA as normal text on dark surfaces. Light
     mode is identical — both tokens are SCARLET there (D-13). */
  color: var(--color-link);
  font-weight: 600;
}
</style>
