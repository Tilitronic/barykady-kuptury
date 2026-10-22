<template>
  <!--
    Shared per-locale tab strip for the admin editors (T-028, TDD step 5).

    It replaces the copy of the T-027 project tab strip with one keyboard-
    operable implementation:
      - roving tabindex (only the active tab is in the tab order);
      - ArrowLeft/ArrowRight and Home/End move selection;
      - focus follows selection after Vue's next paint.

    Each tab renders the shared `TranslationStatus` component, so every editor
    shows the same text verdict and colour is never the only signal
    (DESIGN_SYSTEM.md §6).
  -->
  <div
    :id="`${idPrefix}-tablist`"
    class="admin-locale-tabs"
    role="tablist"
    :aria-label="label"
    @keydown="onKeydown"
  >
    <button
      v-for="locale in locales"
      :id="`${idPrefix}-tab-${locale}`"
      :key="locale"
      type="button"
      role="tab"
      class="admin-locale-tabs__tab focus-ring"
      :class="{ 'admin-locale-tabs__tab--active': active === locale }"
      :aria-selected="active === locale"
      :aria-controls="`${idPrefix}-panel-${locale}`"
      :tabindex="active === locale ? 0 : -1"
      :data-testid="`${testIdPrefix}-tab-${locale}`"
      @click="select(locale)"
    >
      {{ tabLabels[locale] }}
      <TranslationStatus :entry="entries[locale]" :labels="labels" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { nextTick } from "vue";

import TranslationStatus from "@/components/admin/TranslationStatus.vue";
import type {
  CompletenessLabelKeys,
  LocaleCompleteness
} from "@/features/admin/shared/completeness";
import type { Locale } from "@/features/i18n/locales";

/**
 * T-028 — one tab-strip implementation for every scoped editor.
 *
 * The component owns interaction only; the parent owns the mutable translation
 * objects. That split is deliberate: the immutable per-locale update functions
 * are what guarantee one tab cannot overwrite another locale's fields.
 */
const props = defineProps<{
  readonly locales: readonly Locale[];
  readonly active: Locale;
  readonly label: string;
  readonly tabLabels: Record<Locale, string>;
  /** Per-locale completeness verdicts (rendered by TranslationStatus). */
  readonly entries: Record<Locale, LocaleCompleteness>;
  /** Catalogue keys for the calling editor. */
  readonly labels: CompletenessLabelKeys;
  /** Prefix for the tab/panel id pair (`site-page`, `team-member`). */
  readonly idPrefix: string;
  /** Prefix for `data-testid` hooks (kept separate from DOM ids). */
  readonly testIdPrefix: string;
}>();

const emit = defineEmits<{
  "update:active": [locale: Locale];
}>();

function select(locale: Locale): void {
  if (locale !== props.active) emit("update:active", locale);
}

function focusTab(locale: Locale): void {
  void nextTick(() => {
    document.getElementById(`${props.idPrefix}-tab-${locale}`)?.focus();
  });
}

function onKeydown(event: KeyboardEvent): void {
  const keys = ["ArrowLeft", "ArrowRight", "Home", "End"] as const;
  if (!keys.includes(event.key as (typeof keys)[number])) return;

  const current = props.locales.indexOf(props.active);
  if (current === -1) return;

  let next = current;
  if (event.key === "ArrowLeft") {
    next = (current - 1 + props.locales.length) % props.locales.length;
  } else if (event.key === "ArrowRight") {
    next = (current + 1) % props.locales.length;
  } else if (event.key === "Home") {
    next = 0;
  } else if (event.key === "End") {
    next = props.locales.length - 1;
  }

  const locale = props.locales[next];
  if (locale === undefined) return;

  event.preventDefault();
  emit("update:active", locale);
  focusTab(locale);
}
</script>

<style scoped>
.admin-locale-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  border-bottom: 1px solid var(--color-border);
}

.admin-locale-tabs__tab {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.5rem 0.875rem;
  border: none;
  border-bottom: 3px solid transparent;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

/* Active tab: a thick underline in addition to the label — never color alone. */
.admin-locale-tabs__tab--active {
  border-bottom-color: var(--color-accent);
}
</style>
