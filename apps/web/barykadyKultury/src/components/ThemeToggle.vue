<template>
  <label class="theme-toggle">
    <span class="theme-toggle__text">{{ t("theme.darkMode") }}</span>
    <input
      type="checkbox"
      role="switch"
      class="theme-toggle__switch focus-ring"
      :checked="isDark"
      :aria-checked="isDark"
      @change="onToggle"
    />
  </label>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { themeController } from "@/features/theme/themeRuntime";

/**
 * Visible, keyboard-operable theme control as a labelled ON/OFF switch
 * (docs/PRODUCT_REQUIREMENTS.md §3, docs/DESIGN_SYSTEM.md §5/§6).
 *
 * User decision (brand-fixes series): replace the Light/Dark radio pair with
 * the settings-toggle pattern — one control, one question: "Dark mode?"
 *
 * Semantics (all native, no custom focus handling):
 *  - `input[type=checkbox]` + `role="switch"`: a single control whose state
 *    is announced as on/off. `aria-checked` mirrors the native checked state
 *    explicitly so AT sees the switch semantics, and Playwright can target
 *    `getByRole("switch")`.
 *  - The whole control sits inside its `<label>`, so the accessible name is
 *    exactly the visible text ("Dark mode" / "Tryb ciemny" / "Темний режим")
 *    — WCAG 2.5.3 "Label in Name" holds by construction, and clicking the
 *    words toggles the switch (one big ≥ 36 px tall target, WCAG 2.5.8).
 *  - State is never colour-only: the handle is LEFT/off, RIGHT/on (shape +
 *    position), the accent-filled track is a reinforcement.
 *  - `appearance: none` restyles the native checkbox itself into the track —
 *    the focusable element IS the switch, so `.focus-ring` stays visible.
 *
 * The checked state mirrors the **resolved** theme (`themeController.theme`),
 * not the stored override, so while the page follows the system preference
 * the switch shows what is actually painted — and a live
 * `prefers-color-scheme` change re-renders it, because the controller owns
 * that reactive value. Activating the switch pins the opposite explicit
 * override via `setOverride()`; the component never touches `localStorage`
 * itself (T-010 review gate: one source of truth).
 */
const { t } = useI18n();

const isDark = computed(() => themeController.theme.value === "dark");

function onToggle(event: Event): void {
  const target = event.target as HTMLInputElement;
  themeController.setOverride(target.checked ? "dark" : "light");
}
</script>

<style scoped>
/*
  Wrapper label: text + track side by side, generous hit area.
  Tokens only (DESIGN_SYSTEM.md §5); transitions use --motion-duration so
  prefers-reduced-motion collapses everything instantly (tokens.css §4).
*/
.theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.25rem;
  padding: 0 0.5rem;
  color: var(--color-text);
  cursor: pointer;
  user-select: none;
}

.theme-toggle__text {
  font-weight: 500;
  white-space: nowrap;
}

/*
  Track: the native checkbox restyled (appearance: none). 44×24 CSS px —
  above the 24×24 WCAG 2.5.8 minimum. Off state: mid surface with the
  certified control-boundary border (--color-form-border, ≥ 3:1 in both
  themes). The handle (::after) sits left when off.
*/
.theme-toggle__switch {
  appearance: none;
  position: relative;
  flex: 0 0 auto;
  width: 2.75rem;
  height: 1.5rem;
  margin: 0;
  border: 1px solid var(--color-form-border);
  border-radius: 9999px;
  background: var(--color-surface-raised);
  cursor: pointer;
  transition:
    background-color var(--motion-duration),
    border-color var(--motion-duration);
}

.theme-toggle__switch::after {
  content: "";
  position: absolute;
  /* 3 px inset centres the 16 px handle in the 42×22 inner track; the
     20 px travel below lands it symmetrically on the opposite side. */
  top: 3px;
  left: 3px;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: var(--color-text-muted);
  transition:
    transform var(--motion-duration),
    background-color var(--motion-duration);
}

/*
  On state (dark active): accent track + accent-text handle pushed right.
  Certified pairs (DESIGN_SYSTEM.md §1): white-on-SCARLET 6.17:1 light,
  NERO-on-#FA4C3C 4.53:1 dark; the 44→20 px handle travel is the non-colour
  state cue.
*/
.theme-toggle__switch:checked {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.theme-toggle__switch:checked::after {
  transform: translateX(1.25rem);
  background: var(--color-accent-text);
}
</style>
