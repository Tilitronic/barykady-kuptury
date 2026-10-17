<template>
  <div class="app-shell">
    <a class="app-shell__skip-link" href="#main-content">
      {{ t("common.skipToContent") }}
    </a>
    <header class="app-shell__header">
      <LanguageSwitcher />
      <ThemeToggle />
    </header>
    <main id="main-content" class="app-shell__main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

import LanguageSwitcher from "@/components/LanguageSwitcher.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";

/**
 * Minimal page shell: a skip link, the language and theme controls and a single
 * `main` landmark. T-011 grows the real navigation; this shell exists so every
 * locale page exposes the controls and satisfies the a11y landmark rules
 * (docs/DESIGN_SYSTEM.md §6).
 */
const { t } = useI18n();
</script>

<style scoped>
.app-shell__skip-link {
  position: absolute;
  left: -9999px;
}

.app-shell__skip-link:focus {
  left: 0.5rem;
  top: 0.5rem;
  z-index: 1000;
  padding: 0.5rem;
  /* T-006 token (tokens.css). Paired with --color-text below so the focused
     skip link keeps WCAG AA contrast in both themes:
     light #262424 on #FAFAFA = 14.79:1, dark #EDEDED on #353333 = 10.72:1
     (DESIGN_SYSTEM.md §1 measured pairs). */
  background: var(--color-surface-raised);
  color: var(--color-text);
}

.app-shell__header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
}

.app-shell__main {
  max-width: 68ch;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
}
</style>
