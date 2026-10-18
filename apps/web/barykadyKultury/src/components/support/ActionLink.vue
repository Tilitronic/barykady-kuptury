<template>
  <a
    :href="href"
    class="action-link focus-ring"
    :class="`action-link--${variant}`"
    :target="newTab ? '_blank' : undefined"
    :rel="newTab ? 'noopener noreferrer' : undefined"
  >
    {{ label }}
    <!-- SR-only announcement: "opens in a new tab" is a state change that
         visual-only cues cannot carry (DESIGN_SYSTEM.md §6). -->
    <span v-if="newTab" class="action-link__new-tab-hint">{{
      t("content.opensInNewTab")
    }}</span>
  </a>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

/**
 * Shared primary/secondary action link (T-022 REFACTOR step).
 *
 * One anchor, two visual weights: `primary` is the single scarlet surface on
 * the page (DESIGN_SYSTEM.md §3: restrained accent; §4: a visible route to
 * Support that does not dominate), `secondary` is the bordered pill used
 * elsewhere. `min-height: 2.75rem` meets the ≥44 px tap-target requirement
 * on mobile. `newTab` adds the safe external-link attributes plus the
 * SR-only announcement; same-context links (`mailto:`, internal routes)
 * must not set it.
 *
 * Reuse note: the Homepage "Support us" CTA (T-025) renders this component
 * so the primary action looks and behaves identically on both pages.
 */
withDefaults(
  defineProps<{
    href: string;
    label: string;
    variant?: "primary" | "secondary";
    newTab?: boolean;
  }>(),
  { variant: "primary", newTab: false }
);

const { t } = useI18n();
</script>

<style scoped>
.action-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  padding: 0.625rem 1.5rem;
  border-radius: 0.375rem;
  border: 1px solid transparent;
  font-weight: 600;
  text-decoration: none;
  transition:
    background-color var(--motion-duration),
    border-color var(--motion-duration),
    color var(--motion-duration);
}

.action-link--primary {
  background-color: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-accent-text);
}

.action-link--primary:hover {
  text-decoration: underline;
}

.action-link--secondary {
  background-color: transparent;
  border-color: var(--color-link);
  color: var(--color-link);
}

.action-link--secondary:hover {
  text-decoration: underline;
}

.action-link__new-tab-hint {
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
</style>
