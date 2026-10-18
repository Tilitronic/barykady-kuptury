<template>
  <div class="about-page">
    <h1 class="about-page__title">{{ t("about.title") }}</h1>
    <p class="about-page__lead">{{ t("about.placeholder") }}</p>

    <!--
      About sub-navigation (PRODUCT_REQUIREMENTS.md §4).
      T-011 provides this as in-page secondary nav; later tickets add content.
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
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import { aboutSubNavItems, type NavItem } from "@/config/navigation";
import { DEFAULT_LOCALE, isLocale } from "@/features/i18n/locales";

/**
 * About landing page stub with sub-navigation.
 * T-011 wires the route; later tickets own the real content.
 * PublicLayout provides the shell — do NOT add AppShell here.
 */
const { t } = useI18n();
const route = useRoute();

const currentLocale = computed(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

function isActive(item: NavItem): boolean {
  return String(route.name ?? "") === item.routeName;
}
</script>

<style scoped>
.about-page__title {
  margin: 0 0 1rem;
}

.about-page__lead {
  margin: 0 0 2rem;
  color: var(--color-text-muted);
}

.about-page__subnav-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.about-page__subnav-link {
  display: inline-block;
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
