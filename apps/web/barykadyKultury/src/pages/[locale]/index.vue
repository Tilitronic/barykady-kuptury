<template>
  <div class="home">
    <!-- Above the fold: the identity heading and configured CTA render
         immediately from catalogues/config — no section's remote data can
         block or blank them (PRODUCT_REQUIREMENTS.md §5, T-025 AC). -->
    <h1 class="home__title">{{ t("home.title") }}</h1>
    <!-- M3: the localized description (already in every catalogue) as a
         muted lede — no invented copy. -->
    <p class="home__lede">{{ t("home.description") }}</p>

    <SectionShell class="home-mission" :title="t('home.sections.mission')">
      <div
        v-if="missionResult.kind === 'loading'"
        class="home__state"
        role="status"
      >
        {{ t("content.loading") }}
      </div>
      <!-- M2 (T-025 review): the generic "page not available" copy is wrong
           here — the page IS available, only the story is pending. -->
      <div v-else-if="missionResult.kind === 'empty'" class="home__state">
        {{ t("home.missionEmpty") }}
      </div>
      <div v-else-if="missionResult.kind === 'unavailable'" class="home__state">
        {{ t("content.unavailable") }}
      </div>
      <template v-else-if="page">
        <p v-if="page.isFallback" class="home__fallback" role="note">
          {{
            t("content.fallbackNote", {
              language: t("content.fallbackLanguage")
            })
          }}
        </p>
        <LocalizedRichText
          :content="page.body ?? ''"
          :lang="page.isFallback ? 'en' : currentLocale"
          :new-tab-label="t('content.opensInNewTab')"
          :label-lang="currentLocale"
          :heading-offset="1"
        />
      </template>

      <!-- Primary next step: rendered only while a destination is actually
           configured (AGENTS.md rule 6 — never invented). -->
      <RouterLink
        v-if="cta && !ctaIsExternal(cta.href)"
        class="home__cta home__cta--primary focus-ring"
        :to="ctaInternalPath(cta.href, currentLocale)"
      >
        {{ t(cta.labelKey) }}
      </RouterLink>
      <a
        v-else-if="cta"
        class="home__cta home__cta--primary focus-ring"
        :href="cta.href"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t(cta.labelKey) }}
        <span class="home__cta-new-tab">{{ t("content.opensInNewTab") }}</span>
      </a>
    </SectionShell>

    <SectionShell
      class="home-events"
      :title="t('home.sections.events')"
      :view-all-to="`/${currentLocale}/events`"
      :view-all-label="t('home.allEvents')"
    >
      <div
        v-if="eventsResult.kind === 'loading'"
        class="home__loading"
        role="status"
      >
        <span class="home__sr-only">{{ t("content.loading") }}</span>
        <!-- m1: same card-shaped skeleton as the Events page (title, date,
             location, description, action), SECTION_CAP rows. -->
        <div aria-hidden="true">
          <div v-for="n in SECTION_CAP" :key="n" class="home__skeleton-card">
            <q-skeleton height="1.75rem" width="min(24rem, 80%)" />
            <q-skeleton height="1.25rem" width="min(16rem, 60%)" />
            <q-skeleton height="1rem" width="min(12rem, 50%)" />
            <q-skeleton height="5rem" width="min(36rem, 100%)" />
            <q-skeleton height="2.75rem" width="10rem" />
          </div>
        </div>
      </div>
      <p
        v-else-if="eventsResult.kind === 'empty'"
        class="home__state home-events__state"
      >
        {{ t("home.eventsEmpty") }}
      </p>
      <!-- Compact failure message; the section's "All events" link stays the
           onward route. The full retry control lives on the Events page. -->
      <p
        v-else-if="eventsResult.kind === 'unavailable'"
        class="home__state home-events__state"
      >
        {{ t("events.calendarUnavailable") }}
      </p>
      <ul v-else class="home__stack" role="list">
        <EventCard
          v-for="event in upcomingEvents"
          :key="event.id"
          :event="event"
          :locale="currentLocale"
          :project-href="eventProjectPath(event.project, currentLocale)"
          :heading-level="3"
        />
      </ul>
    </SectionShell>

    <SectionShell
      class="home-projects"
      :title="t('home.sections.projects')"
      :view-all-to="`/${currentLocale}/projects`"
      :view-all-label="t('home.allProjects')"
    >
      <div
        v-if="projectsResult.kind === 'loading'"
        class="home__loading"
        role="status"
      >
        <span class="home__sr-only">{{ t("content.loading") }}</span>
        <div aria-hidden="true">
          <div v-for="n in SECTION_CAP" :key="n" class="home__skeleton-card">
            <q-skeleton height="1.75rem" width="min(20rem, 80%)" />
            <q-skeleton height="2.5rem" width="min(30rem, 100%)" />
          </div>
        </div>
      </div>
      <p
        v-else-if="projectsResult.kind === 'empty'"
        class="home__state home-projects__state"
      >
        {{ t("projects.empty") }}
      </p>
      <p
        v-else-if="projectsResult.kind === 'unavailable'"
        class="home__state home-projects__state"
      >
        {{ t("content.unavailable") }}
      </p>
      <ul v-else class="home__grid" role="list">
        <ProjectCard
          v-for="project in featured"
          :key="project.id"
          :project="project"
          :href="projectPath(project)"
          :locale="currentLocale"
          :heading-level="3"
        />
      </ul>
    </SectionShell>

    <SectionShell class="home-explore" :title="t('home.sections.explore')">
      <ul class="home-explore__list" role="list">
        <li v-for="item in exploreItems" :key="item.routeName">
          <!--
            m3: while no CTA is configured, the Support route is the page's
            only way to reach support, so it takes the filled-accent primary
            treatment once. Once `homeCta` carries a destination, the CTA is
            that single scarlet surface and every explore link stays quiet.
          -->
          <RouterLink
            :to="`/${currentLocale}/${item.path}`"
            class="home-explore__link focus-ring"
            :class="{
              'home-explore__link--primary':
                !cta && item.routeName === 'support'
            }"
          >
            {{ t(`nav.${item.labelKey}`) }}
          </RouterLink>
        </li>
      </ul>
    </SectionShell>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { QSkeleton } from "quasar";
import { useI18n } from "vue-i18n";

import EventCard from "@/components/events/EventCard.vue";
import LocalizedRichText from "@/components/content/LocalizedRichText.vue";
import ProjectCard from "@/components/projects/ProjectCard.vue";
import SectionShell from "@/components/home/SectionShell.vue";
import { mainNavItems } from "@/config/navigation";
import { ctaInternalPath, ctaIsExternal, homeCta } from "@/config/cta";
import { useSitePage } from "@/features/content/useSitePage";
import { eventProjectPath } from "@/features/events/projectLink";
import { useEvents } from "@/features/events/useEvents";
import {
  useProjects,
  type ProjectSummaryView
} from "@/features/projects/useProjects";
import { featuredProjects } from "@/features/projects/ordering";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";

/**
 * Homepage composition (T-025).
 *
 * Four independently-fetched sections (mission, events, projects, explore)
 * framed by `SectionShell`; every section maps its own `ContentResult` state
 * to markup, so one failure — a calendar 502, an unpublished page — can
 * never blank the others (PRODUCT_REQUIREMENTS.md §5). Ordering rules are
 * NOT re-implemented here: featured/recent ordering is
 * `featuredProjects()` (T-015), and the nearest-upcoming sort is the T-024
 * hook's. The project links follow the strict-slug rule through the shared
 * `eventProjectPath`/T-019 precedent. PublicLayout provides the shell — do
 * NOT add AppShell here.
 */
const { t } = useI18n();
const route = useRoute();

/** Nearest upcoming events / featured projects shown on the home page. */
const SECTION_CAP = 3;

const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

const { result: missionResult } = useSitePage("home", currentLocale);
const { result: eventsResult } = useEvents(currentLocale);
const { result: projectsResult } = useProjects(currentLocale);

const page = computed(() =>
  missionResult.value.kind === "ok" ? missionResult.value.items[0] : null
);

// The CTA is static configuration, not reactive data — no computed wrapper.
const cta = homeCta;

const upcomingEvents = computed(() =>
  eventsResult.value.kind === "ok"
    ? eventsResult.value.items.slice(0, SECTION_CAP)
    : []
);

// `featuredProjects` already excludes drafts/archived rows and falls back to
// most-recently-updated published when nothing is featured (T-015 helpers).
const featured = computed<readonly ProjectSummaryView[]>(() =>
  projectsResult.value.kind === "ok"
    ? featuredProjects(projectsResult.value.items).slice(0, SECTION_CAP)
    : []
);

// Explore destinations come from the navigation model (no hard-coded route
// list). m3: About is reachable from the header, and Projects/Events already
// have their own homepage sections with view-all links — repeating them here
// would dilute the section routes, so Explore carries Contact, Support and
// Publications only.
const exploreItems = computed(() =>
  mainNavItems.filter(
    item => !["about", "projects", "events"].includes(item.routeName)
  )
);

function projectPath(project: ProjectSummaryView): string {
  const owningLocale = project.isFallback
    ? DEFAULT_LOCALE
    : currentLocale.value;
  return `/${owningLocale}/projects/${project.slug}`;
}
</script>

<style scoped>
/*
 * M3 (T-025 review): the h1 joins the type scale — the same display tokens
 * `.text-display` uses (typography.css) — instead of ad-hoc clamp/leading,
 * and the margin matches the sibling listing pages.
 */
.home__title {
  max-width: 65ch;
  margin: 0 0 0.5rem;
  font-size: var(--font-size-display);
  font-weight: var(--font-weight-display);
  line-height: var(--line-height-display);
}

.home__lede {
  max-width: 65ch;
  margin: 0 0 1.5rem;
  color: var(--color-text-muted);
  font-size: var(--font-size-h4);
  line-height: var(--line-height-body);
}

.home__state {
  max-width: 65ch;
  margin: 0;
  color: var(--color-text-muted);
}

.home__fallback {
  max-width: 65ch;
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  border-inline-start: 3px solid var(--color-accent);
  background-color: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.home__loading {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.home__skeleton-card {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 1.5rem;
}

/*
 * D6 wiring from the Events page, kept consistent here: the project's
 * skeleton tokens replace Quasar's hard-coded grays in both themes.
 */
.home :deep(.q-skeleton) {
  background-color: var(--color-skeleton);
}

.home :deep(.q-skeleton--anim-wave::after) {
  background: linear-gradient(
    90deg,
    transparent,
    var(--color-skeleton-shine),
    transparent
  );
}

.home__sr-only {
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

/* m6: single readable column, capped so cards do not stretch airily on
   wide desktops. */
.home__stack {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  max-width: 48rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

/** Same fluid rule as the listing pages (D4 rhythm carried to the home). */
.home__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
  gap: 2rem 1.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.home__cta--primary {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  min-height: 2.75rem;
  padding: 0.625rem 1.5rem;
  border: 1px solid var(--color-accent);
  border-radius: 0.375rem;
  background-color: var(--color-accent);
  color: var(--color-accent-text);
  font-weight: 600;
  text-decoration: none;
  overflow-wrap: break-word;
}

.home__cta--primary:hover {
  text-decoration: underline;
}

.home__cta-new-tab {
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

.home-explore__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

/*
 * m4: one pill system — the quiet About-subnav treatment (muted text,
 * neutral border, color shift on hover) instead of a competing bordered-
 * link style. m3: while the CTA is unconfigured, Support carries the
 * filled-accent primary look (the page's single scarlet surface).
 */
.home-explore__link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  padding: 0.375rem 0.875rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  font-size: var(--font-size-small);
  color: var(--color-text-muted);
  text-decoration: none;
  overflow-wrap: break-word;
  transition:
    color var(--motion-duration),
    border-color var(--motion-duration);
}

.home-explore__link:hover,
.home-explore__link:focus-visible {
  color: var(--color-link);
  border-color: var(--color-link);
  text-decoration: underline;
}

.home-explore__link--primary {
  background-color: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-accent-text);
  font-weight: 600;
  text-decoration: none;
}

.home-explore__link--primary:hover,
.home-explore__link--primary:focus-visible {
  color: var(--color-accent-text);
  /* Keep the accent border: a light border on the filled surface would paint
     a ring the events-page primary never shows. */
  border-color: var(--color-accent);
  text-decoration: underline;
}
</style>
