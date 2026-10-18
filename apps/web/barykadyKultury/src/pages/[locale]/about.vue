<template>
  <div class="about-page">
    <h1 class="about-page__title">{{ pageTitle }}</h1>

    <!--
      About sub-navigation (PRODUCT_REQUIREMENTS.md §4).
      Placed before the body so keyboard/screen-reader users can reach
      Team/Documents without traversing the whole article.
    -->
    <nav class="about-page__subnav" :aria-label="t('nav.about')">
      <ul class="about-page__subnav-list">
        <li v-for="item in aboutSubNavItems" :key="item.routeName">
          <RouterLink
            :to="`/${currentLocale}/${item.path}`"
            class="about-page__subnav-link focus-ring"
            :aria-current="isActive(item) ? 'page' : undefined"
          >
            {{ t(`nav.${item.labelKey}`) }}
          </RouterLink>
        </li>
      </ul>
    </nav>

    <div v-if="result.kind === 'loading'" class="about-page__state">
      {{ t("content.loading") }}
    </div>
    <div v-else-if="result.kind === 'empty'" class="about-page__state">
      {{ t("content.empty") }}
    </div>
    <div v-else-if="result.kind === 'unavailable'" class="about-page__state">
      {{ t("content.unavailable") }}
    </div>
    <template v-else-if="page">
      <p v-if="page.isFallback" class="about-page__fallback" role="note">
        {{
          t("content.fallbackNote", { language: t("content.fallbackLanguage") })
        }}
      </p>
      <LocalizedRichText
        :content="page.body ?? ''"
        :lang="page.isFallback ? 'en' : currentLocale"
        :new-tab-label="t('content.opensInNewTab')"
        :label-lang="currentLocale"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import { aboutSubNavItems, type NavItem } from "@/config/navigation";
import { useSitePage } from "@/features/content/useSitePage";
import { DEFAULT_LOCALE, isLocale } from "@/features/i18n/locales";
import LocalizedRichText from "@/components/content/LocalizedRichText.vue";

/**
 * About landing page with data-driven organization content.
 *
 * Content is sourced from `site_pages` + translations. Missing translations
 * fall back to English with a visible note (docs/PRODUCT_REQUIREMENTS.md §2.6,
 * DESIGN_SYSTEM.md §6). PublicLayout provides the shell — do NOT add AppShell.
 */
const { t } = useI18n();
const route = useRoute();

const currentLocale = computed(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

const { result } = useSitePage("about", currentLocale);

const page = computed(() =>
  result.value.kind === "ok" ? result.value.items[0] : null
);

const pageTitle = computed(() => {
  if (page.value) return page.value.title;

  return t("about.title");
});

function isActive(item: NavItem): boolean {
  return String(route.name ?? "") === item.routeName;
}
</script>

<style scoped>
.about-page__title {
  max-width: 65ch;
  margin: 0 0 1rem;
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

.about-page__subnav-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  list-style: none;
  margin: 0 0 2rem;
  padding: 0;
}

.about-page__subnav-link {
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
  transition:
    color var(--motion-duration),
    border-color var(--motion-duration);
}

.about-page__subnav-link:hover {
  color: var(--color-link);
  border-color: var(--color-link);
}

.about-page__subnav-link[aria-current="page"] {
  color: var(--color-accent);
  border-color: var(--color-accent);
  font-weight: 600;
}
</style>
