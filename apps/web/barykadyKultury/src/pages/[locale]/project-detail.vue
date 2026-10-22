<template>
  <!--
    Canonical root slug (T-038/D-24): the URL segment is shared by every
    locale and the requested locale must supply a translation. An unknown,
    former-localized or draft slug — including any draft leaked into the
    payload — renders the same translated 404 content as the locale catch-all.
    RLS already hides drafts anonymously (rls_content_matrix_test.sql); this is
    the app-layer complement.

    The article body lives in `ProjectDetailBody` so the admin preview (T-027)
    renders the identical component instead of a forked copy.
  -->
  <div v-if="projectResult.kind === 'empty'" class="project-not-found">
    <h1 class="project-not-found__title">{{ t("notFound.title") }}</h1>
    <p class="project-not-found__message">{{ t("notFound.message") }}</p>
    <p class="project-not-found__back">
      <RouterLink
        :to="listPath"
        class="project-not-found__back-link focus-ring"
      >
        {{ t("projects.detail.back") }}
      </RouterLink>
    </p>
  </div>

  <article v-else class="project-detail">
    <p class="project-detail__back">
      <RouterLink :to="listPath" class="project-detail__back-link focus-ring">
        {{ t("projects.detail.back") }}
      </RouterLink>
    </p>

    <div
      v-if="projectResult.kind === 'loading'"
      class="project-detail__state"
      role="status"
    >
      {{ t("content.loading") }}
    </div>
    <div
      v-else-if="projectResult.kind === 'unavailable'"
      class="project-detail__state"
    >
      {{ t("content.unavailable") }}
    </div>
    <ProjectDetailBody
      v-else-if="project"
      :project="project"
      :locale="currentLocale"
    />
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import ProjectDetailBody from "@/components/projects/ProjectDetailBody.vue";
import type { ProjectSummaryView } from "@/features/projects/useProjects";
import { useProject } from "@/features/projects/useProjects";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";

/**
 * Project detail page.
 *
 * One logical project resolved by its canonical root slug plus the requested
 * locale's translation (T-038/D-24). PublicLayout provides the shell; the
 * resolved project is rendered by the shared `ProjectDetailBody`.
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

const { projectResult } = useProject(requestedSlug, currentLocale);

const project = computed<ProjectSummaryView | null>(() =>
  projectResult.value.kind === "ok"
    ? (projectResult.value.items[0] ?? null)
    : null
);

const listPath = computed(() => `/${currentLocale.value}/projects`);
</script>

<style scoped>
.project-detail {
  max-width: 65ch;
}

.project-detail__back {
  margin: 0 0 1.5rem;
  font-size: var(--font-size-small);
}

.project-detail__back-link {
  color: var(--color-link);
  text-decoration: none;
}

.project-detail__back-link:hover {
  text-decoration: underline;
}

.project-detail__state {
  color: var(--color-text-muted);
}

.project-not-found {
  max-width: 65ch;
}

.project-not-found__title {
  margin: 0 0 1rem;
}

.project-not-found__message {
  margin: 0;
  color: var(--color-text-muted);
}

.project-not-found__back {
  margin: 1.5rem 0 0;
  font-size: var(--font-size-small);
}

.project-not-found__back-link {
  color: var(--color-link);
  text-decoration: none;
}

.project-not-found__back-link:hover {
  text-decoration: underline;
}
</style>
