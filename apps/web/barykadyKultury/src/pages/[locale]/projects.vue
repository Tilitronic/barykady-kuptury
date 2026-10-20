<template>
  <div class="projects-page">
    <h1 class="projects-page__title">{{ t("projects.title") }}</h1>

    <div
      v-if="projectsResult.kind === 'loading'"
      class="projects-page__state"
      role="status"
    >
      {{ t("content.loading") }}
    </div>
    <div
      v-else-if="projectsResult.kind === 'empty'"
      class="projects-page__state"
    >
      {{ t("projects.empty") }}
    </div>
    <div
      v-else-if="projectsResult.kind === 'unavailable'"
      class="projects-page__state"
    >
      {{ t("content.unavailable") }}
    </div>
    <!--
      T-039 (D-25): one page, two anchored sections behind a TOC.
      `#featured` — homepage-ranked projects by featured rank, only when any
      exist; `#all` — every published project in the listing order. Detail
      pages are unchanged (canonical slug + owning-locale rule preserved).
      Pagination/"load more" stays deferred (T-019 scope).
    -->
    <div v-else class="projects-page__layout">
      <PageToc :items="tocItems" :ariaLabel="t('toc.onThisPage')" />

      <div class="projects-page__content">
        <section
          v-if="featured.length > 0"
          id="featured"
          class="projects-page__section"
        >
          <h2 class="projects-page__section-title" tabindex="-1">
            {{ t("projects.featured") }}
          </h2>
          <ul class="projects-grid">
            <ProjectCard
              v-for="project in featured"
              :key="project.id"
              :project="project"
              :href="detailPath(project)"
              :locale="currentLocale"
              :heading-level="3"
            />
          </ul>
        </section>

        <section id="all" class="projects-page__section">
          <h2 class="projects-page__section-title" tabindex="-1">
            {{ t("projects.all") }}
          </h2>
          <ul class="projects-grid">
            <ProjectCard
              v-for="project in projects"
              :key="project.id"
              :project="project"
              :href="detailPath(project)"
              :locale="currentLocale"
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
import ProjectCard from "@/components/projects/ProjectCard.vue";
import {
  useProjects,
  type ProjectSummaryView
} from "@/features/projects/useProjects";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";
import { watchDeepLink } from "@/shared/content/deepLink";

/**
 * Projects listing (T-019 → sectioned by T-039).
 *
 * Published projects only, newest-updated first; drafts are excluded by RLS
 * and again by the data-access mapping (docs/PRODUCT_REQUIREMENTS.md §8).
 * Cards link with the canonical slug under the rendering text's owning locale
 * prefix (D-24): strict detail resolution only resolves a locale that has a
 * translation, so English fallback rows link under /en while same-locale rows
 * stay on the active prefix. PublicLayout provides the shell.
 */
const { t } = useI18n();
const route = useRoute();

const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

const { projectsResult } = useProjects(currentLocale);

const projects = computed<readonly ProjectSummaryView[]>(() =>
  projectsResult.value.kind === "ok" ? projectsResult.value.items : []
);

/** Homepage-ranked projects, lowest rank first (null ranks are not featured). */
const featured = computed(() =>
  projects.value
    .filter(project => project.featuredRank !== null)
    .sort((a, b) => (a.featuredRank ?? 0) - (b.featuredRank ?? 0))
);

const tocItems = computed<readonly TocItem[]>(() => [
  ...(featured.value.length > 0
    ? [{ id: "featured", label: t("projects.featured") }]
    : []),
  { id: "all", label: t("projects.all") }
]);

watchDeepLink({
  hash: () => route.hash,
  isReady: () => projectsResult.value.kind !== "loading"
});

function detailPath(project: ProjectSummaryView): string {
  // Owning-locale rule: the slug stays canonical, but the prefix follows the
  // language whose text is actually rendered. Without this an English fallback
  // card on /pl would link to a /pl detail that strict resolution 404s.
  const owningLocale = project.isFallback
    ? DEFAULT_LOCALE
    : currentLocale.value;
  return `/${owningLocale}/projects/${project.slug}`;
}
</script>

<style scoped>
.projects-page__title {
  max-width: 65ch;
  margin: 0 0 1.5rem;
}

.projects-page__state {
  max-width: 65ch;
  margin: 0;
  color: var(--color-text-muted);
}

/* TOC grid + anchor offset — see the About page comment for the contract. */
.projects-page__layout {
  display: grid;
  gap: 2.5rem;
  align-items: start;
}

@media (min-width: 1024px) {
  .projects-page__layout {
    grid-template-columns: 14rem minmax(0, 1fr);
  }
}

.projects-page__content {
  min-width: 0;
}

.projects-page__section {
  scroll-margin-top: 5rem;
  margin-block-end: 3rem;
}

.projects-page__section-title {
  margin: 0 0 1.25rem;
  font-size: var(--font-size-h2);
}

/**
 * Fluid grid: one column on a 320 px phone (the `min(100%, 20rem)` floor
 * prevents horizontal overflow), two to three columns on wider containers.
 */
.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
  gap: 2rem 1.5rem;
  max-width: 75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
