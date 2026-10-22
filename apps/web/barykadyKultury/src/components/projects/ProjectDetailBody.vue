<template>
  <!--
    ProjectDetailBody — the presentational project article (T-027 REFACTOR).

    Extracted from the public detail page so the admin PREVIEW can render the
    exact same component (docs/tickets/T-027-admin-projects.md: "preview renders
    the public detail component with a draft banner"). One renderer means the
    preview cannot drift from what visitors will see.

    The public page owns loading/empty/404 states; this component only renders a
    resolved project. The admin preview supplies the draft banner around it.
  -->
  <div class="project-detail__body">
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

    <h1 class="project-detail__title">{{ project.title }}</h1>

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
      :label-lang="locale"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import LocalizedRichText from "@/components/content/LocalizedRichText.vue";
import { formatDate } from "@/features/i18n/format";
import { DEFAULT_LOCALE, type Locale } from "@/features/i18n/locales";
import type { ProjectSummaryView } from "@/features/projects/useProjects";

/**
 * Renders one resolved project. The body goes through the sanitised rich-text
 * renderer (no `v-html`; T-016 primitive reused, never forked — AGENTS.md rule
 * about untrusted rich text). The cover is informative here — unlike the card
 * it is not wrapped in a named link — so its alt is the project title, and
 * explicit dimensions prevent layout shift.
 */
const props = defineProps<{
  project: ProjectSummaryView;
  /** The URL locale, used as the label-language for the rich text. */
  locale: Locale;
}>();

const { t } = useI18n();

/** The language of the rendered body: the selection's own locale, not the URL's. */
const contentLang = computed(() =>
  props.project.isFallback ? DEFAULT_LOCALE : props.locale
);

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
</script>

<style scoped>
.project-detail__body {
  max-width: 65ch;
}

.project-detail__title {
  margin: 0 0 1rem;
  overflow-wrap: break-word;
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
</style>
