<template>
  <article class="document-reader">
    <p class="document-reader__back">
      <RouterLink :to="listPath" class="document-reader__back-link focus-ring">
        {{ t("aboutDocuments.reader.back") }}
      </RouterLink>
    </p>

    <header class="document-reader__header">
      <h1 class="document-reader__title">{{ headingText }}</h1>
      <p
        v-if="selection?.translation.description"
        class="document-reader__description"
      >
        {{ selection.translation.description }}
      </p>
    </header>

    <div
      v-if="result.kind === 'loading'"
      class="document-reader__state"
      role="status"
    >
      {{ t("content.loading") }}
    </div>
    <div v-else-if="result.kind === 'empty'" class="document-reader__state">
      {{ t("aboutDocuments.reader.notFound") }}
    </div>
    <div
      v-else-if="result.kind === 'unavailable'"
      class="document-reader__state"
    >
      {{ t("content.unavailable") }}
    </div>
    <div v-else-if="!selection" class="document-reader__state">
      {{ t("aboutDocuments.reader.unavailable") }}
    </div>
    <template v-else>
      <!--
        Fallback note: only English may stand in for a missing locale, and the
        reader names the source language (docs/DESIGN_SYSTEM.md §6, D-12).
      -->
      <p
        v-if="selection.isFallback"
        class="document-reader__fallback"
        role="note"
      >
        {{
          t("content.fallbackNote", { language: t("content.fallbackLanguage") })
        }}
      </p>

      <!--
        In-view language switcher: the canonical slug stays stable, an
        unavailable locale is disabled, and choosing a language navigates to
        that locale prefix (preserving query/hash) so the URL never claims a
        locale whose text is not rendered. The visible label names the text
        this control governs for AT via aria-labelledby.
      -->
      <div
        class="document-reader__languages"
        role="group"
        aria-labelledby="document-reader-language-label"
      >
        <span
          id="document-reader-language-label"
          class="document-reader__languages-label"
        >
          {{ t("aboutDocuments.reader.languageLabel") }}
        </span>
        <button
          v-for="option in SUPPORTED_LOCALES"
          :key="option"
          type="button"
          class="document-reader__language focus-ring"
          :lang="option"
          :aria-pressed="option === activeLocale"
          :disabled="!isAvailable(option)"
          @click="choose(option)"
        >
          {{ LOCALE_LABELS[option] }}
        </button>
      </div>

      <LocalizedRichText
        :content="selection.translation.body ?? ''"
        :lang="selection.translation.locale"
        :new-tab-label="t('content.opensInNewTab')"
        :label-lang="currentLocale"
      />
    </template>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import LocalizedRichText from "@/components/content/LocalizedRichText.vue";
import { selectReaderTranslation } from "@/features/documents/api";
import { useDocument } from "@/features/documents/useDocuments";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type Locale
} from "@/features/i18n/locales";
import { replaceLocaleInPath } from "@/features/i18n/localePath";

/**
 * About → Documents → regulation reader (T-017).
 *
 * One logical document is fetched by its canonical root slug (D-24) — the same
 * segment under every locale prefix — and rendered as in-app text (D-12). The
 * requested locale resolves to English with a note when its translation is
 * missing or incomplete; the in-view switcher navigates to the chosen locale
 * prefix (keeping the canonical slug + query/hash) so the URL always matches
 * the rendered text. PublicLayout provides the shell — do NOT add AppShell
 * here.
 */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

const requestedSlug = computed<string>(() => {
  const { slug } = route.params as { slug?: unknown };
  return typeof slug === "string" ? slug : "";
});

const { result } = useDocument(requestedSlug);

const reader = computed(() =>
  result.value.kind === "ok" ? result.value.items[0] : null
);

/**
 * The URL locale is the single source of truth: both the header switcher and
 * this in-view control navigate, so every render is a fresh requested→English
 * resolution (D-12) instead of an in-memory override that could leave the URL
 * claiming a different language than the text.
 */
const selection = computed(() =>
  reader.value
    ? selectReaderTranslation(reader.value, currentLocale.value)
    : null
);

const activeLocale = computed(
  () => selection.value?.translation.locale ?? currentLocale.value
);

const headingText = computed(
  () => selection.value?.translation.title ?? t("aboutDocuments.title")
);

// m8 (T-039 review): point directly at the consolidated About anchor —
// the old list URL is now a redirect hop with no value for the reader.
const listPath = computed(() => `/${currentLocale.value}/about#documents`);

function isAvailable(locale: Locale): boolean {
  return reader.value?.availableLocales.includes(locale) ?? false;
}

function choose(locale: Locale): void {
  if (!isAvailable(locale) || locale === currentLocale.value) return;

  // Pure prefix swap on the same canonical slug: the reader refetches nothing
  // (all translations are already loaded), and query/hash keep the user's place.
  void router.push({
    path: replaceLocaleInPath(route.path, locale),
    query: route.query,
    hash: route.hash
  });
}
</script>

<style scoped>
.document-reader {
  max-width: 65ch;
}

.document-reader__back {
  margin: 0 0 1.5rem;
  font-size: var(--font-size-small);
}

.document-reader__back-link {
  color: var(--color-link);
  text-decoration: none;
}

.document-reader__back-link:hover {
  text-decoration: underline;
}

.document-reader__header {
  margin-block-end: 1.5rem;
}

.document-reader__title {
  margin: 0 0 0.5rem;
}

.document-reader__description {
  margin: 0;
  color: var(--color-text-muted);
}

.document-reader__state {
  color: var(--color-text-muted);
}

.document-reader__fallback {
  margin: 0 0 1.5rem;
  padding: 0.75rem 1rem;
  border-inline-start: 3px solid var(--color-accent);
  background-color: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.document-reader__languages {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-block-end: 2rem;
}

.document-reader__languages-label {
  margin-inline-end: 0.25rem;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  font-weight: 600;
}

.document-reader__language {
  min-height: 2.75rem;
  padding: 0.375rem 0.875rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background-color: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: var(--font-size-small);
  cursor: pointer;
  transition:
    color var(--motion-duration),
    border-color var(--motion-duration);
}

.document-reader__language:hover:not(:disabled) {
  color: var(--color-link);
  border-color: var(--color-link);
}

.document-reader__language[aria-pressed="true"] {
  color: var(--color-accent);
  border-color: var(--color-accent);
  font-weight: 600;
}

.document-reader__language:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
