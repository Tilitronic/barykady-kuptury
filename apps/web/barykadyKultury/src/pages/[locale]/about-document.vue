<template>
  <!--
    Document reader — T-040: the page is now thin glue around the shared
    `LongFormReader`. Data + language resolution come from `useReaderDocument`
    (D-38: requested `?lang` → UI locale → EN → first available, URL
    normalized); the route locale and site chrome never change with the
    content language (D-27). Legacy plain-text rows keep working through the
    reader's documented legacy path. PublicLayout provides the shell.
  -->
  <div class="document-reader">
    <p class="document-reader__back">
      <RouterLink :to="listPath" class="document-reader__back-link focus-ring">
        {{ t("aboutDocuments.reader.back") }}
      </RouterLink>
    </p>

    <LongFormReader
      :title="headingText"
      :description="reader.selected.value?.description ?? null"
      :body-ast="reader.selected.value?.bodyAst ?? null"
      :body="reader.selected.value?.body ?? null"
      :content-locale="reader.locale.value"
      :ui-locale="currentLocale"
      :available-locales="reader.model.value?.availableLocales ?? []"
      :assets="reader.model.value?.assets ?? []"
      :status="reader.status.value"
      :storage-key="storageKey"
      :is-fallback="isFallback"
      @change-locale="chooseContentLocale"
      @retry="reader.retry"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import LongFormReader from "@/components/reader/LongFormReader.vue";
import { readerSettingsKey } from "@/components/reader/readerSettings";
import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import { useReaderDocument } from "@/features/reader/useReaderDocument";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const supabase = inject(SUPABASE_CLIENT_KEY, null);

const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

const requestedSlug = computed<string>(() => {
  const { slug } = route.params as { slug?: unknown };
  return typeof slug === "string" ? slug : "";
});

const requestedLang = computed<string | null>(() => {
  const { lang } = route.query as { lang?: unknown };
  return typeof lang === "string" ? lang : null;
});

const reader = useReaderDocument({
  kind: "document",
  slug: requestedSlug,
  locale: currentLocale,
  requestedLang,
  supabase
});

/**
 * The fallback note names English only when the reader substituted it on the
 * user's behalf (no explicit `?lang` + resolved ≠ UI). An explicit content
 * choice is not a fallback and never gets the note.
 */
const isFallback = computed(
  () =>
    requestedLang.value === null &&
    reader.status.value === "ready" &&
    reader.locale.value !== currentLocale.value
);

const headingText = computed(
  () => reader.selected.value?.title ?? t("aboutDocuments.title")
);

const storageKey = computed(() =>
  readerSettingsKey("document", requestedSlug.value)
);

// m8 (T-039 review): the back link targets the consolidated About anchor.
const listPath = computed(() => `/${currentLocale.value}/about#documents`);

/**
 * D-27: content language is a query change on the SAME route — push (not
 * replace) so the browser back button walks through reading-language history.
 */
function chooseContentLocale(locale: Locale): void {
  if (locale === reader.locale.value) return;
  void router.push({
    path: route.path,
    query: { ...route.query, lang: locale },
    hash: route.hash
  });
}
</script>

<style scoped>
/* No measure cap here: the reader article owns the measure (D-34 control). */
.document-reader {
  min-width: 0;
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
</style>
