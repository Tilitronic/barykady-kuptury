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
        In-view language switcher: the URL slug stays stable, an unavailable
        locale is disabled, and an explicit switch renders only that locale
        (never a silent substitution).
      -->
      <div
        class="document-reader__languages"
        role="group"
        :aria-label="t('aboutDocuments.reader.languageLabel')"
      >
        <button
          v-for="option in SUPPORTED_LOCALES"
          :key="option"
          type="button"
          class="document-reader__language focus-ring"
          :class="{ 'is-active': option === activeLocale }"
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
import { computed, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
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

/**
 * About → Documents → regulation reader (T-017).
 *
 * One logical document is fetched by its locale-specific URL slug and rendered
 * as in-app text (D-12). Initial load falls back to English with a note; the
 * in-view switcher then renders an explicitly chosen locale with no fallback.
 * PublicLayout provides the shell — do NOT add AppShell here.
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

const { result } = useDocument(requestedSlug, currentLocale);

const reader = computed(() =>
  result.value.kind === "ok" ? result.value.items[0] : null
);

/**
 * `null` means "initial load": the shared requested→English fallback applies.
 * A non-null value is an explicit user choice and always disables fallback so
 * the rendered text can never silently differ from the pressed language.
 */
const explicitLocale = ref<Locale | null>(null);

// A header language switch changes the URL prefix and must re-apply the
// initial-load fallback rules for the new requested locale.
watch(currentLocale, () => {
  explicitLocale.value = null;
});

const selection = computed(() =>
  reader.value
    ? selectReaderTranslation(
        reader.value,
        explicitLocale.value ?? currentLocale.value,
        { allowFallback: explicitLocale.value === null }
      )
    : null
);

const activeLocale = computed(
  () => selection.value?.translation.locale ?? currentLocale.value
);

const headingText = computed(
  () => selection.value?.translation.title ?? t("aboutDocuments.title")
);

const listPath = computed(() => `/${currentLocale.value}/about/documents`);

function isAvailable(locale: Locale): boolean {
  return reader.value?.availableLocales.includes(locale) ?? false;
}

function choose(locale: Locale): void {
  if (!isAvailable(locale)) return;
  explicitLocale.value = locale;
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
  gap: 0.5rem;
  margin-block-end: 2rem;
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
