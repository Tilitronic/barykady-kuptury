<template>
  <li class="event-card">
    <h2 class="event-card__title">{{ event.title }}</h2>

    <p v-if="when" class="event-card__when">
      <span v-if="when.allDay" class="event-card__all-day">
        {{ t("events.allDay") }}
      </span>
      <time class="event-card__start" :datetime="when.startAttr">
        {{ when.startText }}
      </time>
      <template v-if="when.endText">
        <span class="event-card__when-sep" aria-hidden="true"> – </span>
        <!-- D3: the visible dash is decorative; screen readers hear the
             relation as a translated word ("to"/"do"/"до"). -->
        <span class="event-card__sr event-card__range-to">
          {{ t("events.rangeTo") }}
        </span>
        <time class="event-card__end" :datetime="when.endAttr ?? undefined">
          {{ when.endText }}
        </time>
      </template>
    </p>

    <p v-if="event.location" class="event-card__location">
      {{ event.location }}
    </p>

    <p v-if="excerpt" class="event-card__description">{{ excerpt }}</p>

    <div class="event-card__actions">
      <a
        v-if="event.registrationUrl"
        class="event-card__register event-card__link focus-ring"
        :href="event.registrationUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t("events.register") }}
        <!-- SR-only parts: the accessible name carries the event title and
             the new-tab state change; the visible text stays short
             (WCAG 2.5.3 — the name contains the visible label). -->
        <span class="event-card__sr">
          {{ t("events.registerFor", { title: event.title }) }}
        </span>
        <span class="event-card__sr">{{ t("content.opensInNewTab") }}</span>
      </a>

      <RouterLink
        v-if="event.project && projectHref"
        class="event-card__project event-card__link event-card__link--ghost focus-ring"
        :to="projectHref"
      >
        <span class="event-card__sr">{{ t("events.projectLabel") }}</span>
        {{ event.project.title }}
      </RouterLink>
    </div>

    <!--
      D7: a fallback project title is English text standing in for the
      reader's locale — the same marking PublicationCard applies, so a
      /uk/events page never shows an unmarked English project name.
    -->
    <p
      v-if="event.project?.isFallback"
      class="event-card__fallback"
      role="note"
    >
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

import type { EventView } from "@/features/events/useEvents";
import { excerptText, formatEventWhen } from "@/features/events/formatEvent";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";

/**
 * One upcoming event (T-024).
 *
 * Presentational only: the hook has already joined the published project, so
 * `project === null` simply means "no link" — the published-only rule lives in
 * the T-015 data-access mapper and is deliberately not re-implemented here.
 * Optional fields collapse without empty labels; the all-day badge is text,
 * not a color (docs/DESIGN_SYSTEM.md §6: nothing conveyed by color alone);
 * every rendered date range is a `<time datetime>` element. The wire has no
 * online flag, so a registration URL renders as registration — never as
 * "online".
 */
const props = defineProps<{
  event: EventView;
  locale: Locale;
  /** Precomputed project route (`null` → no project link). */
  projectHref: string | null;
}>();

const { t } = useI18n();

const activeLocale = computed<Locale>(() =>
  isLocale(props.locale) ? props.locale : DEFAULT_LOCALE
);

const when = computed(() => formatEventWhen(props.event, activeLocale.value));

const excerpt = computed(() =>
  props.event.description ? excerptText(props.event.description) : null
);
</script>

<style scoped>
.event-card {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.event-card__title {
  margin: 0;
  font-size: var(--font-size-h3);
  overflow-wrap: break-word;
}

.event-card__when {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.375rem;
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

/**
 * All-day badge: a bordered text chip. The distinction from timed events is
 * carried by the words themselves, never by color alone.
 */
.event-card__all-day {
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  font-weight: 600;
}

.event-card__location {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  overflow-wrap: break-word;
}

.event-card__description {
  margin: 0;
  max-width: 65ch;
  overflow-wrap: break-word;
}

.event-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.event-card__link {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid transparent;
  border-radius: 0.375rem;
  font-weight: 600;
  text-decoration: underline;
  overflow-wrap: break-word;
}

/*
 * D2 (T-024 review): one clear primary per card. Registration is the action
 * the organizer wants taken — the filled accent pill (same surface as
 * ActionLink's `primary`, the single scarlet per view, DESIGN_SYSTEM.md §3).
 * The project link is wayfinding, not the goal: a bordered ghost pill.
 * Both keep `.focus-ring`, whose outline sits outside the fill, so focus
 * stays visible on accent and on surface alike.
 */
.event-card__register {
  background-color: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-accent-text);
}

.event-card__register:hover {
  text-decoration: none;
}

.event-card__link--ghost {
  background-color: transparent;
  border-color: var(--color-link);
  color: var(--color-link);
}

.event-card__link--ghost:hover {
  text-decoration: none;
}

.event-card__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.event-card__fallback {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  font-style: italic;
}
</style>
