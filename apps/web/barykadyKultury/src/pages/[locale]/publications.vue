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
      T-039 (D-25): grouped by publication year, newest first; rows without
      a date land in `#undated` (id literal, stable across locales). Year
      labels are digits — locale-neutral by design; only `undated` is
      translated. No `#all`: the grouping IS the value here (ticket rule).
      Detail pages unchanged. Pagination stays deferred (T-019 scope).
    -->
    <div v-else class="publications-page__layout">
      <PageToc :items="tocItems" :ariaLabel="t('toc.onThisPage')" />

      <div class="publications-page__content">
        <section
          v-for="group in yearGroups"
          :id="group.id"
          :key="group.id"
          class="publications-page__section"
        >
          <h2 class="publications-page__section-title" tabindex="-1">
            {{ group.label }}
          </h2>
          <ul class="publications-grid">
            <PublicationCard
              v-for="publication in group.items"
              :key="publication.id"
              :publication="publication"
              :href="detailPath(publication)"
              :heading-level="3"
            />
          </ul>
        </section>

        <section
          v-if="undated.length > 0"
          id="undated"
          class="publications-page__section"
        >
          <h2 class="publications-page__section-title" tabindex="-1">
            {{ t("publications.undated") }}
          </h2>
          <ul class="publications-grid">
            <PublicationCard
              v-for="publication in undated"
              :key="publication.id"
              :publication="publication"
              :href="detailPath(publication)"
              :heading-level="3"
            />
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import PageToc from "@/components/navigation/PageToc.vue";
import type { TocItem } from "@/components/navigation/PageToc.vue";
import PublicationCard from "@/components/publications/PublicationCard.vue";
import {
  usePublications,
  type PublicationView
} from "@/features/publications/usePublications";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";
import { watchDeepLink } from "@/shared/content/deepLink";

/**
 * Publications listing (T-020 → year-sectioned by T-039).
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

interface YearGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly PublicationView[];
}

/**
 * Groups dated publications by year, descending. The year is taken from the
 * ISO `publication_date` prefix (no Date parsing — the value is a date-only
 * string whose year is locale- and timezone-independent).
 */
const yearGroups = computed<readonly YearGroup[]>(() => {
  const byYear = new Map<string, PublicationView[]>();

  for (const publication of publications.value) {
    const year = publication.publicationDate?.slice(0, 4) ?? null;
    if (!year) continue;
    const bucket = byYear.get(year) ?? [];
    bucket.push(publication);
    byYear.set(year, bucket);
  }

  return [...byYear.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, items]) => ({ id: year, label: year, items }));
});

const undated = computed(() =>
  publications.value.filter(publication => {
    const year = publication.publicationDate?.slice(0, 4);
    return !year;
  })
);

const tocItems = computed<readonly TocItem[]>(() => [
  ...yearGroups.value.map(group => ({ id: group.id, label: group.label })),
  ...(undated.value.length > 0
    ? [{ id: "undated", label: t("publications.undated") }]
    : [])
]);

watchDeepLink({
  hash: () => route.hash,
  isReady: () => publicationsResult.value.kind !== "loading"
});

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

/* TOC grid + anchor offset — see the About page comment for the contract. */
.publications-page__layout {
  display: grid;
  gap: 2.5rem;
  align-items: start;
}

@media (min-width: 1024px) {
  .publications-page__layout {
    grid-template-columns: 14rem minmax(0, 1fr);
  }
}

.publications-page__content {
  min-width: 0;
}

.publications-page__section {
  scroll-margin-top: 5rem;
  margin-block-end: 3rem;
}

.publications-page__section-title {
  margin: 0 0 1.25rem;
  font-size: var(--font-size-h2);
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
