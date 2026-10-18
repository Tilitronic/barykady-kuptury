<template>
  <li class="project-card">
    <RouterLink :to="href" class="project-card__link focus-ring">
      <img
        v-if="project.coverUrl"
        class="project-card__cover"
        :src="project.coverUrl"
        alt=""
        loading="lazy"
        width="640"
        height="360"
      />
      <h2 class="project-card__title">{{ project.title }}</h2>
    </RouterLink>

    <p v-if="project.summary" class="project-card__summary">
      {{ project.summary }}
    </p>

    <p v-if="dates.length > 0" class="project-card__dates">
      <template v-for="(date, index) in dates" :key="date">
        <span v-if="index > 0" aria-hidden="true"> – </span>
        <time :datetime="date">{{ formatted(date) }}</time>
      </template>
    </p>

    <p v-if="project.isFallback" class="project-card__fallback" role="note">
      {{
        t("content.fallbackNote", { language: t("content.fallbackLanguage") })
      }}
    </p>
  </li>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";

import type { ProjectSummaryView } from "@/features/projects/useProjects";
import { formatDate } from "@/features/i18n/format";
import type { Locale } from "@/features/i18n/locales";

/**
 * One published-project card (T-019).
 *
 * Presentational only: the feature layer resolves the cover URL and the page
 * computes the detail href (strict (locale, slug) linking lives there), so the
 * card builds no requests and stays prop-driven. The cover sits inside the
 * link with an empty alt — the link's accessible name is the title, so a
 * descriptive alt would announce it twice (DESIGN_SYSTEM.md §6). Explicit
 * width/height plus the CSS aspect ratio keep the grid shift-free while the
 * image loads. Optional fields collapse; nothing is truncated.
 */
const props = defineProps<{
  project: ProjectSummaryView;
  href: string;
  locale: Locale;
}>();

const { t } = useI18n();

const dates = computed(() =>
  [props.project.startDate, props.project.endDate].filter(
    (date): date is string => date !== null
  )
);

function formatted(date: string): string {
  // Date-only values are formatted in UTC so the day never shifts by timezone.
  return formatDate(new Date(date), props.locale, {
    dateStyle: "medium",
    timeZone: "UTC"
  });
}

// Lifecycle status is deliberately not shown here (T-019 review, Spec
// finding 1): the listing is published-only, so a per-card badge would be
// uniform noise. The detail page surfaces the localized status instead.
</script>

<style scoped>
.project-card {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.project-card__link {
  display: block;
  text-decoration: none;
  color: inherit;
}

.project-card__cover {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 0.5rem;
  background-color: var(--color-surface);
}

.project-card__title {
  margin: 0.75rem 0 0;
  font-size: var(--font-size-h3);
  color: var(--color-link);
  text-decoration: underline;
  overflow-wrap: break-word;
}

.project-card__link:hover .project-card__title {
  text-decoration: none;
}

.project-card__summary {
  margin: 0;
  overflow-wrap: break-word;
}

.project-card__dates {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.project-card__fallback {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  font-style: italic;
}
</style>
