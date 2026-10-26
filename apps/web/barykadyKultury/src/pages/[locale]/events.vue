<template>
  <div class="events-page">
    <h1 class="events-page__title">{{ t("events.title") }}</h1>

    <!--
      M1: one persistent sr-only live region announces every outcome —
      loading, empty, unavailable, and success with the count. The visible
      state blocks below are plain (the skeleton list is aria-hidden), so a
      screen reader hears each outcome exactly once.
    -->
    <p class="sr-only events-page__live" role="status">
      {{ liveMessage }}
    </p>

    <!--
      Loading: fixed-height skeletons mirroring the card rhythm; an exact
      match is impossible with variable content, but the swap stays close to
      shift-free. Shown only on the initial load — a retry keeps the failure
      block mounted (M1) so the focused button is never destroyed.
    -->
    <div
      v-if="result.kind === 'loading' && !retrying"
      class="events-page__state"
    >
      <ul class="events-list events-list--skeleton" aria-hidden="true">
        <li
          v-for="n in SKELETON_CARDS"
          :key="n"
          class="events-page__skeleton-card"
        >
          <BkSkeleton height="1.75rem" width="min(24rem, 80%)" />
          <BkSkeleton height="1.25rem" width="min(16rem, 60%)" />
          <BkSkeleton height="1rem" width="min(12rem, 50%)" />
          <BkSkeleton height="5rem" width="min(36rem, 100%)" />
          <BkSkeleton height="2.75rem" width="10rem" />
        </li>
      </ul>
    </div>

    <!--
      Calendar failure is isolated to this section: the layout's header, nav
      and footer stay functional, and the page offers both a retry and the
      contact fallback link (docs/PRODUCT_REQUIREMENTS.md §5). While a retry
      is in flight this block stays mounted with the button disabled and
      aria-busy — the user's focus survives the round trip (M1).
    -->
    <div
      v-else-if="result.kind === 'unavailable' || retrying"
      class="events-page__state events-page__unavailable"
    >
      <p class="events-page__unavailable-text">
        {{ t("events.calendarUnavailable") }}
      </p>
      <p class="events-page__unavailable-actions">
        <button
          type="button"
          class="events-page__retry events-page__action--primary focus-ring"
          :disabled="retrying"
          :aria-busy="retrying ? 'true' : undefined"
          @click="onRetry"
        >
          {{ t("events.retry") }}
        </button>
        <RouterLink
          class="events-page__contact events-page__action--ghost focus-ring"
          :to="contactPath"
        >
          {{ t("events.contactFallback") }}
        </RouterLink>
      </p>
    </div>

    <!--
      T-039 (D-25): three anchored sections behind the TOC.
        #upcoming  — the sorted upcoming list; cards carry stable
                     `event-<googleEventId>` ids for search deep links.
        #past      — honest state: the reviewed calendar adapter is
                     upcoming-only (past `from` clamps to now), so past
                     events are not available on this site yet. The section
                     and its anchor exist for the search contract.
        #calendar  — what the list is fed from + the contact route for
                     questions (no invented calendar URL, D-07 open).
    -->
    <div v-else class="events-page__layout">
      <PageToc :items="tocItems" :ariaLabel="t('toc.onThisPage')" />

      <div class="events-page__content">
        <section id="upcoming" class="events-page__section">
          <h2 class="events-page__section-title" tabindex="-1">
            {{ t("events.upcoming") }}
          </h2>

          <!--
            D-14 (open) default: calendar content is shown as-is because the
            wire carries no language field; this note — once for the whole
            list, never per event — tells readers details come from the
            organizer.
          -->
          <p class="events-page__note" role="note">
            {{ t("events.languageNote") }}
          </p>

          <p v-if="events.length === 0" class="events-page__state">
            {{ t("events.empty") }}
          </p>
          <!-- D8: role="list" restores VoiceOver's list semantics after
               `list-style: none`. tabindex="-1" lets a successful retry move
               focus here so keyboard users land on the result (M1). -->
          <ul
            v-else
            ref="listRef"
            class="events-list"
            role="list"
            tabindex="-1"
          >
            <EventCard
              v-for="event in events"
              :key="event.id"
              :event="event"
              :locale="currentLocale"
              :project-href="projectPath(event)"
              :heading-level="3"
              :anchor-id="`event-${event.id}`"
            />
          </ul>
        </section>

        <section id="past" class="events-page__section">
          <h2 class="events-page__section-title" tabindex="-1">
            {{ t("events.past") }}
          </h2>
          <p class="events-page__state">{{ t("events.pastEmpty") }}</p>
        </section>

        <section id="calendar" class="events-page__section">
          <h2 class="events-page__section-title" tabindex="-1">
            {{ t("events.calendar") }}
          </h2>
          <p class="events-page__state">
            {{ t("events.calendarNote") }}
            <RouterLink
              class="events-page__calendar-link focus-ring"
              :to="contactPath"
            >
              {{ t("events.contactFallback") }}
            </RouterLink>
          </p>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { BkSkeleton } from "@/components/bk";
import { useI18n } from "vue-i18n";

import EventCard from "@/components/events/EventCard.vue";
import PageToc from "@/components/navigation/PageToc.vue";
import type { TocItem } from "@/components/navigation/PageToc.vue";
import { eventProjectPath } from "@/features/events/projectLink";
import { useEvents, type EventView } from "@/features/events/useEvents";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";
import { watchDeepLink } from "@/shared/content/deepLink";

/**
 * Events listing (T-024 → sectioned by T-039).
 *
 * The `useEvents` hook owns the calendar fetch, the Supabase link query and
 * their join; this page only maps states to markup and computes the project
 * link path. Under D-24 the project slug is canonical across locales, so the
 * link always uses the active locale prefix — switching language only swaps
 * that prefix. PublicLayout provides the shell — do NOT add AppShell here.
 */
const { t } = useI18n();
const route = useRoute();

const SKELETON_CARDS = 3;

// Route-param locale, exactly like the publications/projects pages: the URL
// owns the locale, the i18n instance is kept in sync by the boot guard.
const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

const { result, retry } = useEvents(currentLocale);

// M1: a retry must neither destroy the focused button (no skeleton swap)
// nor end silently (live region + focus move). `retrying` spans exactly the
// in-flight round trip started from the failure block.
const retrying = ref(false);
const listRef = ref<HTMLElement | null>(null);

function onRetry(): void {
  retrying.value = true;
  retry();
}

watch(result, value => {
  if (value.kind === "loading" || !retrying.value) return;

  retrying.value = false;
  if (value.kind === "ok") {
    // After the DOM swap, land the keyboard user on the recovered list.
    void nextTick(() => listRef.value?.focus());
  }
});

const events = computed<readonly EventView[]>(() =>
  result.value.kind === "ok" ? result.value.items : []
);

const liveMessage = computed(() => {
  const value = result.value;
  switch (value.kind) {
    case "loading":
      return t("content.loading");
    case "empty":
      return t("events.empty");
    case "unavailable":
      return t("events.calendarUnavailable");
    default:
      return t("events.loaded", { count: value.items.length });
  }
});

/*
 * m10 (T-039 review): `#past` stays a rendered section (the search contract
 * links to it), but it is NOT in the TOC while it can only ever show the
 * "not published yet" state — a TOC entry that leads to a permanent notice
 * is a dead affordance. When the adapter ships past events, add the entry.
 */
const tocItems = computed<readonly TocItem[]>(() => [
  { id: "upcoming", label: t("events.upcoming") },
  { id: "calendar", label: t("events.calendar") }
]);

watchDeepLink({
  hash: () => route.hash,
  isReady: () => result.value.kind !== "loading"
});

const contactPath = computed(() => `/${currentLocale.value}/contact`);

function projectPath(event: EventView): string | null {
  // Strict-slug rule lives in one place (shared with the homepage, T-025).
  return eventProjectPath(event.project, currentLocale.value);
}
</script>

<style scoped>
.events-page__title {
  max-width: 65ch;
  margin: 0 0 1.5rem;
}

.events-page__state {
  max-width: 65ch;
  margin: 0;
  color: var(--color-text-muted);
}

/* TOC grid + anchor offset — see the About page comment for the contract. */
.events-page__layout {
  display: grid;
  gap: 2.5rem;
  align-items: start;
}

@media (min-width: 1024px) {
  .events-page__layout {
    grid-template-columns: 14rem minmax(0, 1fr);
  }
}

.events-page__content {
  min-width: 0;
}

.events-page__section {
  scroll-margin-top: 5rem;
  margin-block-end: 3rem;
}

.events-page__section-title {
  margin: 0 0 1rem;
  font-size: var(--font-size-h2);
}

.events-page__calendar-link {
  color: var(--color-link);
  text-decoration: underline;
}

.events-page__calendar-link:hover {
  text-decoration: none;
}

/**
 * Same fluid rule as the projects/publications grids (D4: one rhythm across
 * the sibling listing pages, no media-query ladder): one column on a 320 px
 * phone, auto-fill columns from `20rem` up.
 */
.events-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
  gap: 2rem 1.5rem;
  max-width: 65rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Focus target for the M1 recovery jump: no visible ring on mouse users,
   focus-visible keeps the outline for keyboard arrivals. */
.events-list:focus {
  outline: none;
}

.events-list:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

/* D5: bar heights mirror the card rhythm (title, date, location,
   description, action pill) with the card's own 0.375rem gap. */
.events-page__skeleton-card {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

/*
 * D6: wire the skeleton tokens. Quasar hard-codes `background:#0000001f` on
 * `.q-skeleton` and a white gradient on the wave `::after`; the project's
 * light/dark `--color-skeleton`/`--color-skeleton-shine` tokens (tokens.css,
 * prepared for exactly this) are re-pointed here so the placeholder matches
 * the theme instead of Quasar's default gray. The reduced-motion kill switch
 * lives in tokens.css (B1).
 */
.events-page :deep(.q-skeleton) {
  background-color: var(--color-skeleton);
}

.events-page :deep(.q-skeleton--anim-wave::after) {
  background: linear-gradient(
    90deg,
    transparent,
    var(--color-skeleton-shine),
    transparent
  );
}

.events-page__note {
  max-width: 65ch;
  margin: 0 0 1.5rem;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  font-style: italic;
}

.events-page__unavailable {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.events-page__unavailable-text {
  margin: 0;
}

.events-page__unavailable-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0;
}

.events-page__action--primary,
.events-page__action--ghost {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0.375rem 1rem;
  border: 1px solid transparent;
  border-radius: 0.375rem;
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
  overflow-wrap: break-word;
}

/* D2: retry is the primary action (filled accent, as on the support page);
   the contact fallback stays the bordered ghost so the two read as one
   choice, not two equal buttons. */
.events-page__action--primary {
  background-color: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-accent-text);
}

.events-page__action--ghost {
  background-color: transparent;
  border-color: var(--color-link);
  color: var(--color-link);
}

.events-page__action--primary:hover,
.events-page__action--ghost:hover {
  text-decoration: none;
}

.events-page__action--primary[disabled] {
  opacity: 0.6;
  cursor: progress;
}
</style>
