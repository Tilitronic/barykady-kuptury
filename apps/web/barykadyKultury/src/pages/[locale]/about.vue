<template>
  <!--
    About — one consolidated page (T-039, D-25): Mission / History / Values /
    Aims parsed from the authored body, plus inline Team and Documents
    sections, all navigable through the sticky PageToc. The old `/about/team`
    and `/about/documents` list routes redirect to `#team` / `#documents`;
    the reader route stays canonical.

    Section id contract: positional ids from `shared/content/sections.ts`
    (1st `## ` → mission, 2nd → history, 3rd → values, 4th → aims, overflow
    → section-<n>), stable across locales because the body is localized and
    the ORDER is the shared contract. Headings render as plain-text h2s —
    authored inline markup inside a heading degrades to text by design.
  -->
  <div class="about-page">
    <!--
      Vue-docs rail layout: a full-bleed grid at ≥1440 px with [rail]
      [column] [mirror]. The rail docks at the viewport edge; the mirror
      column mirrors it on the right so the content column (and its h1)
      stays centered at the shell's unchanged max width — the menu never
      shifts or narrows the reading column. Between 1024 and 1439 px the
      rail keeps the in-flow T-039 column (the gutter there cannot host a
      docked rail without overlapping prose); below 1024 PageToc collapses
      to its details disclosure above the content, 320 px safe.
    -->
    <div class="about-page__bleed">
      <PageToc
        class="about-page__rail"
        :items="tocItems"
        :ariaLabel="t('toc.onThisPage')"
      />

      <div class="about-page__column">
        <h1 class="about-page__title">{{ pageTitle }}</h1>

        <div class="about-page__content">
          <!-- Body section: states belong to THIS section only. -->
          <p v-if="page?.isFallback" class="about-page__fallback" role="note">
            {{
              t("content.fallbackNote", {
                language: t("content.fallbackLanguage")
              })
            }}
          </p>

          <div
            v-if="result.kind === 'loading'"
            class="about-page__state"
            role="status"
          >
            {{ t("content.loading") }}
          </div>
          <div v-else-if="result.kind === 'empty'" class="about-page__state">
            {{ t("content.empty") }}
          </div>
          <div
            v-else-if="result.kind === 'unavailable'"
            class="about-page__state"
          >
            {{ t("content.unavailable") }}
          </div>
          <template v-else-if="page">
            <LocalizedRichText
              v-if="intro.length > 0"
              :blocks="intro"
              :lang="bodyLang"
              :new-tab-label="t('content.opensInNewTab')"
              :label-lang="currentLocale"
            />
            <section
              v-for="section in sections"
              :id="section.id"
              :key="section.id"
              class="about-page__section"
            >
              <h2 class="about-page__section-title" tabindex="-1">
                {{ section.title }}
              </h2>
              <LocalizedRichText
                :blocks="section.blocks"
                :lang="bodyLang"
                :new-tab-label="t('content.opensInNewTab')"
                :label-lang="currentLocale"
              />
            </section>
          </template>

          <!-- Independent sections: a team/documents failure never blanks
             the body, and vice versa (T-039 page structure). -->
          <TeamSection :locale="currentLocale" />
          <DocumentsSection :locale="currentLocale" />
        </div>
      </div>

      <!-- Symmetric spacer: keeps the content column viewport-centered
           while the rail is docked at the left edge (≥1440 px only). -->
      <div class="about-page__mirror" aria-hidden="true" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import PageToc from "@/components/navigation/PageToc.vue";
import type { TocItem } from "@/components/navigation/PageToc.vue";
import DocumentsSection from "@/components/documents/DocumentsSection.vue";
import TeamSection from "@/components/team/TeamSection.vue";
import LocalizedRichText from "@/components/content/LocalizedRichText.vue";
import { useSitePage } from "@/features/content/useSitePage";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";
import { watchDeepLink } from "@/shared/content/deepLink";
import { splitRichTextSections } from "@/shared/content/sections";

/**
 * About landing (T-016 → consolidated by T-039). Content is sourced from
 * `site_pages` + translations; missing translations fall back to English
 * with a visible note (PRODUCT_REQUIREMENTS §2, DESIGN_SYSTEM §6).
 * PublicLayout provides the shell — do NOT add AppShell.
 */
const { t } = useI18n();
const route = useRoute();

const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

const { result } = useSitePage("about", currentLocale);

const page = computed(() =>
  result.value.kind === "ok" ? result.value.items[0] : null
);

const pageTitle = computed(() => page.value?.title ?? t("about.title"));

/** The body's language: the fallback note must not mislabel English text. */
const bodyLang = computed(() =>
  page.value?.isFallback ? "en" : currentLocale.value
);

/** Parsed once per body change; ids are positional (see the header comment). */
const parsed = computed(() => splitRichTextSections(page.value?.body ?? ""));

const intro = computed(() => parsed.value.intro);
const sections = computed(() => parsed.value.sections);

/**
 * TOC = authored body sections (when loaded) + Team + Documents. Team and
 * Documents are ALWAYS listed: their headings render even while their own
 * data loads, so every TOC anchor target exists.
 */
const tocItems = computed<readonly TocItem[]>(() => [
  ...sections.value.map(section => ({
    id: section.id,
    label: section.title
  })),
  { id: "team", label: t("aboutTeam.title") },
  { id: "documents", label: t("aboutDocuments.title") }
]);

// Deep links (#mission … #documents) scroll + focus once the body has
// settled; the anchored headings exist before that for team/documents.
watchDeepLink({
  hash: () => route.hash,
  isReady: () => result.value.kind !== "loading"
});
</script>

<style scoped>
.about-page__title {
  max-width: 65ch;
  margin: 0 0 1.5rem;
}

/*
 * Vue-docs rail grid. Bands (owner screenshot pass):
 *  - < 1024 px (tablet/phone): single column; PageToc renders its details
 *    disclosure above the content — 320 px safe, unchanged T-039 fallback.
 *  - ≥ 1024 px (all desktop widths): the wrapper bleeds to the viewport and
 *    the [rail][column][mirror] grid docks the rail at the LEFT EDGE while
 *    the column stays centered at the shell's max width. The rail is never
 *    in-flow on desktop; the mirror column keeps the centering honest.
 *    The bleed overshoots the scrollbar width on classic-scrollbar
 *    platforms; app.scss clips the root horizontally while this page is
 *    mounted.
 */
.about-page__bleed {
  display: grid;
  gap: 2.5rem;
  align-items: start;
}

.about-page__mirror {
  display: none;
}

.about-page__column,
.about-page__content {
  min-width: 0;
}

@media (min-width: 1024px) {
  .about-page__bleed {
    grid-template-columns: minmax(0, 13rem) minmax(0, 72rem) minmax(0, 13rem);
    justify-content: center;
    column-gap: 1.5rem;
    margin-inline: calc(50% - 50vw);
    /* Panel edge sits 1rem off the viewport — reads as docked, leaves room
       for the 3 px focus ring. */
    padding-inline: 1rem;
  }

  .about-page__mirror {
    display: block;
  }

  /*
   * Theme-adaptive rail panel (owner screenshot fix): the About rail is a
   * distinct component surface — surface-raised + border + shadow in BOTH
   * themes (tokens flip with data-theme; nothing hardcoded). The link
   * states (light tint hover, red-text active) are the shared PageToc
   * contract and need no About-specific overrides.
   */
  .about-page__bleed :deep(.page-toc) {
    padding: 1rem 0.625rem 1.25rem;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    background: var(--color-surface-raised);
    box-shadow: var(--shadow-sm);
  }
}

/* Roomier rail once the viewport can afford it without squeezing prose. */
@media (min-width: 1440px) {
  .about-page__bleed {
    grid-template-columns: minmax(0, 14rem) minmax(0, 72rem) minmax(0, 14rem);
  }
}

/*
 * Sticky site header is 3.75rem tall; anchor landings (TOC clicks, deep
 * links, native #hash) must clear it — WCAG 2.4.11 focus-not-obscured.
 */
.about-page__section,
.about-page__content :deep(section) {
  scroll-margin-top: 5rem;
}

.about-page__section + .about-page__section,
.about-page__content > :deep(section) {
  margin-block-start: 0;
}

.about-page__section {
  margin-block-end: 3rem;
}

.about-page__section-title {
  margin: 0 0 0.75rem;
  font-size: var(--font-size-h2);
}

.about-page__state {
  max-width: 65ch;
  margin: 0 0 2rem;
  color: var(--color-text-muted);
}

.about-page__fallback {
  max-width: 65ch;
  margin: 0 0 1.5rem;
  padding: 0.75rem 1rem;
  border-inline-start: 3px solid var(--color-accent);
  background-color: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}
</style>
