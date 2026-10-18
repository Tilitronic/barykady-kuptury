<template>
  <div class="language-switcher">
    <label class="language-switcher__label" for="bk-language">
      {{ t("nav.language") }}
    </label>
    <select
      id="bk-language"
      class="language-switcher__select"
      name="locale"
      :value="activeLocale"
      @change="onChange"
    >
      <option v-for="locale in SUPPORTED_LOCALES" :key="locale" :value="locale">
        {{ LOCALE_LABELS[locale] }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_LABELS,
  SUPPORTED_LOCALES
} from "@/features/i18n/locales";
import { replaceLocaleInPath } from "@/features/i18n/localePath";
import { localeStore } from "@/features/i18n/localeStorage";

/**
 * Visible language selector (docs/PRODUCT_REQUIREMENTS.md §2 item 3).
 *
 * A native `<select>` is used because it is keyboard-operable and exposes the
 * current value and option list to assistive technology without custom ARIA.
 * The associated `<label>` provides the accessible name.
 *
 * Persistence happens *here*, on the explicit user action, and nowhere else —
 * navigation must never rewrite the saved choice. The surrounding route and
 * query are preserved so switching does not lose the user's place.
 *
 * Option labels intentionally use each language's own name (autonyms) rather
 * than catalogue translations — recognised standard exception, recorded in
 * docs/tickets/T-009-locale-routing.md. Do not localise them.
 */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const activeLocale = computed(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

function onChange(event: Event): void {
  const target = event.target as HTMLSelectElement;
  const next = target.value;

  if (!isLocale(next) || next === activeLocale.value) {
    return;
  }

  localeStore.write(next);
  void router.push({
    path: replaceLocaleInPath(route.path, next),
    query: route.query,
    hash: route.hash
  });
}
</script>

<style scoped>
.language-switcher {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.language-switcher__label {
  font-weight: 600;
}

.language-switcher__select {
  min-height: 2.25rem;
}

/* Hide the label on small viewports to keep the header compact at 320 px.
   The select's accessible name is provided by the label; the label is still
   referenced by `for`/`id` so AT reads it even when visually hidden. */
@media (max-width: 767px) {
  .language-switcher__label {
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

  .language-switcher__select {
    max-width: 4.5rem; /* show just the locale code on narrow viewports */
    min-height: 2rem;
  }
}
</style>
