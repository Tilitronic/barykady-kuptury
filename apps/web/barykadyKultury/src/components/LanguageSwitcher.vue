<template>
  <fieldset class="language-switcher">
    <legend class="language-switcher__legend">{{ t("nav.language") }}</legend>
    <div class="language-switcher__options">
      <label
        v-for="locale in SUPPORTED_LOCALES"
        :key="locale"
        class="language-switcher__option"
      >
        <input
          class="language-switcher__input focus-ring"
          type="radio"
          name="locale"
          :value="locale"
          :checked="locale === activeLocale"
          @change="onSelect(locale)"
        />
        <!--
          Accessible name = autonym + display code (e.g. "Українська UA"):
          contains the visible text "UA" (WCAG 2.5.3) and keeps the T-009
          autonym principle. Both the flag and the visible code are drawn
          aria-hidden and folded into this single sr-only name, so the name
          is read once ("English EN") rather than concatenated without a
          separator.
        -->
        <span class="sr-only"
          >{{ LOCALE_LABELS[locale] }} {{ LOCALE_DISPLAY_CODE[locale] }}</span
        >
        <span class="language-switcher__flag" aria-hidden="true">{{
          LOCALE_FLAGS[locale]
        }}</span>
        <span class="language-switcher__code" aria-hidden="true">{{
          LOCALE_DISPLAY_CODE[locale]
        }}</span>
      </label>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_DISPLAY_CODE,
  LOCALE_FLAGS,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type Locale
} from "@/features/i18n/locales";
import { replaceLocaleInPath } from "@/features/i18n/localePath";
import { localeStore } from "@/features/i18n/localeStorage";

/**
 * Visible language picker (docs/PRODUCT_REQUIREMENTS.md §2 item 3).
 *
 * Three native radios in one fieldset: the checked radio announces the
 * current locale, arrow keys move between languages, and the group name
 * comes from the `<legend>` (`nav.language`) — all platform semantics, no
 * custom ARIA. Flags + short codes (🇬🇧 EN / 🇵🇱 PL / 🇺🇦 UA) are the
 * requested visible form; codes are display strings only, the locale value
 * behind them stays the `uk` routing/storage identifier (see
 * LOCALE_DISPLAY_CODE in features/i18n/locales.ts).
 *
 * Persistence happens *here*, on the explicit user action, and nowhere else —
 * navigation must never rewrite the saved choice. The surrounding route and
 * query are preserved so switching does not lose the user's place.
 */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const activeLocale = computed(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

function onSelect(next: Locale): void {
  if (next === activeLocale.value) {
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
/* Fieldset reset: the chips carry the visual grouping, not a UA border. */
.language-switcher {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.language-switcher__legend {
  padding: 0;
  margin-bottom: 0.375rem;
  font-weight: 600;
  color: var(--color-text);
}

.language-switcher__options {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/*
  Chip = radio dot + flag + short code. Border uses --color-form-border
  (certified ≥ 3:1 control boundary in both themes, DESIGN_SYSTEM.md §1);
  the checked chip gets the accent ring and the accent-filled dot via
  `accent-color`, so the state differs in shape as well as colour
  (DESIGN_SYSTEM.md §6: never colour alone).
*/
.language-switcher__option {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 2.25rem;
  padding: 0 0.625rem;
  border: 1px solid var(--color-form-border);
  border-radius: 0.375rem;
  background: var(--color-surface-raised);
  color: var(--color-text);
  cursor: pointer;
  transition:
    border-color var(--motion-duration),
    box-shadow var(--motion-duration);
}

.language-switcher__option:has(:checked) {
  border-color: var(--color-accent);
  box-shadow: inset 0 0 0 1px var(--color-accent);
}

.language-switcher__input {
  margin: 0;
  accent-color: var(--color-accent);
}

.language-switcher__flag {
  font-size: 1.125rem;
  line-height: 1;
}

.language-switcher__code {
  font-weight: 600;
  letter-spacing: 0.03em;
}

/* Screen-reader only helper (same pattern as AppHeader's `.sr-only`). */
.sr-only {
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

/*
  Desktop header bar (≥ 1280 px, the inline-controls band): legend visually
  hidden (still the accessible group name) to keep the cluster inside the
  header's measured width budget — the flags + codes are self-explanatory.
  In the drawer (≤ 1279 px — AppHeader's raised drawer breakpoint) the legend
  is visible; chips never truncate and wrap instead (DESIGN_SYSTEM.md §4, §6).
*/
@media (min-width: 1280px) {
  .language-switcher__legend {
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
}
</style>
