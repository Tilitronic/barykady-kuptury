<template>
  <button
    type="button"
    class="theme-toggle focus-ring"
    :aria-pressed="isDark"
    @click="onToggle"
  >
    {{ t("theme.toggleLabel") }}
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { themeController } from "@/features/theme/themeRuntime";

/**
 * Visible, keyboard-operable theme control (docs/PRODUCT_REQUIREMENTS.md §3,
 * docs/DESIGN_SYSTEM.md §5/§6).
 *
 * A native `<button>` is used so keyboard activation, focus and the pressed
 * state come from the platform. `aria-pressed` exposes the *current* resolved
 * state (dark on/off) to assistive technology and drives the visible pressed
 * styling via `[aria-pressed="true"]`, while the accessible name (the visible
 * label) is a constant action phrase that states what the control does — the
 * standard toggle-button pattern (T-010 review finding: the name must state the
 * action, not just name the topic). The label is never icon-only.
 *
 * The control mutates the shared {@link themeController}; it holds no theme
 * state of its own and never writes `localStorage` directly, so a Pinia store
 * and the DOM class can never disagree (T-010 review gate).
 */
const { t } = useI18n();

const isDark = computed(() => themeController.theme.value === "dark");

function onToggle(): void {
  themeController.toggle();
}
</script>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  min-height: 2.25rem;
  padding: 0 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: var(--color-surface-raised);
  color: var(--color-text);
  cursor: pointer;
}

/*
  Visible pressed state: the control reads as "on" when dark mode is active.
  Uses the brand accent + its certified text pair (DESIGN_SYSTEM.md §1) so the
  label keeps AA contrast in both themes.
*/
.theme-toggle[aria-pressed="true"] {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-text);
}
</style>
