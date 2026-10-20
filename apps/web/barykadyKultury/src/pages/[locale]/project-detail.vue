<template>
  <!--
    Canonical root slug (T-038/D-24): the URL segment is shared by every
    locale and the requested locale must supply a translation. An unknown,
    former-localized or draft slug — including any draft leaked into the
    payload — renders the same translated 404 content as the locale catch-all.
    RLS already hides drafts anonymously (rls_content_matrix_test.sql); this is
    the app-layer complement.
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

    <h1 class="project-detail__title">{{ headingText }}</h1>

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
    <template v-else-if="project">
      <!--
        Fallback note: shown only when English text is actually substituted —
        on the detail a fallback selection always replaces visible title and
        body (PROJECT_REQUIRED_FIELDS), so `isFallback` alone is the right
        condition here (docs/DESIGN_SYSTEM.md §6, T-018 review rule).
      -->
      <p v-if="project.isFallback" class="project-detail__fallback" role="note">
        {{
          t("content.fallbackNote", { language: t("content.fallbackLanguage") })
        }}
      </p>

      <p v-if="project.summary" class="project-detail__summary">
        {{ project.summary }}
      </p>

      <img
        v-if="project.coverUrl"
        class="project-detail__cover"
        :src="project.coverUrl"
        :alt="project.title"
        width="1280"
        height="720"
      />

      <div class="project-detail__meta">
        <!--
          Localized lifecycle status (docs/PRODUCT_REQUIREMENTS.md §4): the
          detail is where a status is news. The published-only listing would
          repeat one uniform badge on every card, so the card omits it.
        -->
        <p class="project-detail__status">
          {{ t(`projects.status.${project.status}`) }}
        </p>

        <p v-if="dates.length > 0" class="project-detail__dates">
          <template v-for="(date, index) in dates" :key="date">
            <span v-if="index > 0" aria-hidden="true"> – </span>
            <time :datetime="date">{{ formatted(date) }}</time>
          </template>
        </p>
      </div>

      <LocalizedRichText
        :content="project.body ?? ''"
        :lang="contentLang"
        :new-tab-label="t('content.opensInNewTab')"
        :label-lang="currentLocale"
      />
    </template>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import LocalizedRichText from "@/components/content/LocalizedRichText.vue";
import type { ProjectSummaryView } from "@/features/projects/useProjects";
import { useProject } from "@/features/projects/useProjects";
import { formatDate } from "@/features/i18n/format";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";

/**
 * Project detail page.
 *
 * One logical project resolved by its canonical root slug plus the requested
 * locale's translation (T-038/D-24); full description through the sanitised
 * rich-text renderer (no `v-html`, T-016 primitive reused, not forked). Cover
 * is informative here — unlike the card it is not wrapped in a named link — so
 * its alt is the project title, and explicit dimensions prevent layout shift.
 * PublicLayout provides the shell.
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

const headingText = computed(() => project.value?.title ?? t("projects.title"));

/** The language of the rendered body: the selection's own locale, not the URL's. */
const contentLang = computed(() =>
  project.value?.isFallback ? DEFAULT_LOCALE : currentLocale.value
);

const listPath = computed(() => `/${currentLocale.value}/projects`);

const dates = computed(() => {
  if (!project.value) return [];
  return [project.value.startDate, project.value.endDate].filter(
    (date): date is string => date !== null
  );
});

function formatted(date: string): string {
  // Date-only values are formatted in UTC so the day never shifts by timezone.
  return formatDate(new Date(date), currentLocale.value, {
    dateStyle: "medium",
    timeZone: "UTC"
  });
}
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

.project-detail__title {
  margin: 0 0 1rem;
  overflow-wrap: break-word;
}

.project-detail__state {
  color: var(--color-text-muted);
}

.project-detail__fallback {
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  border-inline-start: 3px solid var(--color-accent);
  background-color: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.project-detail__summary {
  margin: 0 0 1.5rem;
  color: var(--color-text-muted);
}

.project-detail__cover {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  margin-block-end: 1rem;
  border-radius: 0.5rem;
  background-color: var(--color-surface);
}

.project-detail__meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-block-end: 2rem;
}

.project-detail__status {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  font-weight: 600;
}

.project-detail__dates {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
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
