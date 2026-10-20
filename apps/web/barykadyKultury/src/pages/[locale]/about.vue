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
    <h1 class="about-page__title">{{ pageTitle }}</h1>

    <div class="about-page__layout">
      <PageToc :items="tocItems" :ariaLabel="t('toc.onThisPage')" />

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
 * TOC + content grid (T-039): the left column is sticky via PageToc's own
 * `position: sticky`; below 1024 px the TOC collapses to its <details>
 * disclosure above the content, single column, 320 px safe.
 */
.about-page__layout {
  display: grid;
  gap: 2.5rem;
  align-items: start;
}

@media (min-width: 1024px) {
  .about-page__layout {
    grid-template-columns: 14rem minmax(0, 1fr);
  }
}

.about-page__content {
  min-width: 0;
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
