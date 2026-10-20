<template>
  <div class="publications-page">
    <h1 class="publications-page__title">{{ t("publications.title") }}</h1>

    <div
      v-if="publicationsResult.kind === 'loading'"
      class="publications-page__state"
      role="status"
    >
      {{ t("content.loading") }}
    </div>
    <div
      v-else-if="publicationsResult.kind === 'empty'"
      class="publications-page__state"
    >
      {{ t("publications.empty") }}
    </div>
    <div
      v-else-if="publicationsResult.kind === 'unavailable'"
      class="publications-page__state"
    >
      {{ t("content.unavailable") }}
    </div>
    <!--
      Pagination/"load more" is deferred (same T-019 call): the published
      publication set is small; revisit when volume justifies it.
    -->
    <ul v-else class="publications-grid">
      <PublicationCard
        v-for="publication in publications"
        :key="publication.id"
        :publication="publication"
        :href="detailPath(publication)"
      />
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import PublicationCard from "@/components/publications/PublicationCard.vue";
import {
  usePublications,
  type PublicationView
} from "@/features/publications/usePublications";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";

/**
 * Publications listing.
 *
 * Published publications only, newest-first; drafts are excluded by RLS and
 * again by the data-access mapping (docs/PRODUCT_REQUIREMENTS.md §8).
 * Cards link with the canonical slug under the rendering text's owning locale
 * prefix (D-24): strict detail resolution only resolves a locale that has a
 * translation, so English fallback rows link under /en while same-locale rows
 * stay on the active prefix. PublicLayout provides the shell — do NOT add
 * AppShell here.
 */
const { t } = useI18n();
const route = useRoute();

const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

const { publicationsResult } = usePublications(currentLocale);

const publications = computed<readonly PublicationView[]>(() =>
  publicationsResult.value.kind === "ok" ? publicationsResult.value.items : []
);

function detailPath(publication: PublicationView): string {
  // Owning-locale rule: the slug stays canonical, but the prefix follows the
  // language whose text is actually rendered. Without this an English fallback
  // card on /pl would link to a /pl detail that strict resolution 404s.
  const owningLocale = publication.isFallback
    ? DEFAULT_LOCALE
    : currentLocale.value;
  return `/${owningLocale}/publications/${publication.slug}`;
}
</script>

<style scoped>
.publications-page__title {
  max-width: 65ch;
  margin: 0 0 1.5rem;
}

.publications-page__state {
  max-width: 65ch;
  margin: 0;
  color: var(--color-text-muted);
}

/**
 * Fluid grid: one column on a 320 px phone, two to three on wider
 * containers; cards stretch to equal columns without clipping text.
 */
.publications-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
  gap: 2rem 1.5rem;
  max-width: 65rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
