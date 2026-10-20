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
      Pagination/"load more" is deliberately deferred (T-019 scope): the
      published project set is small by construction; revisit when volume
      justifies it.
    -->
    <ul v-else class="projects-grid">
      <ProjectCard
        v-for="project in projects"
        :key="project.id"
        :project="project"
        :href="detailPath(project)"
        :locale="currentLocale"
      />
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import ProjectCard from "@/components/projects/ProjectCard.vue";
import {
  useProjects,
  type ProjectSummaryView
} from "@/features/projects/useProjects";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";

/**
 * Projects listing.
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
