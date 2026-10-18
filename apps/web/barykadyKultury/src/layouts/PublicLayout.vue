<template>
  <!--
    PublicLayout — accessible, responsive page shell (T-011).

    Landmark order (DESIGN_SYSTEM.md §6):
      1. Skip-to-content link — FIRST focusable element in tab order.
      2. <header> landmark with AppHeader.
      3. <main id="main"> — target of the skip link; receives focus on activation.
      4. <footer> landmark with AppFooter.

    The layout is used as a Vue Router layout component: pages render via
    <RouterView /> inside the <main> landmark and must NOT wrap themselves in
    a separate shell. The outer AppShell.vue remains for the global 404 path
    which does not carry a locale segment.

    No <h1> is placed here — each page provides exactly one h1 (T-011 scope
    note, DESIGN_SYSTEM.md §6 "one clear main landmark").
  -->
  <div class="public-layout">
    <!--
      The @click.prevent handler (which also fires on keyboard Enter since
      pressing Enter on a focused <a> dispatches a synthetic click event)
      explicitly focuses <main tabindex="-1">, bypassing Vue Router's history
      interception of hash links (#main would be treated as a route hash push
      and never move DOM focus). WCAG 2.4.1 bypass-blocks pattern.
    -->
    <a
      href="#main"
      class="public-layout__skip-link focus-ring"
      @click.prevent="skipToMain"
      >{{ t("common.skipToContent") }}</a
    >

    <AppHeader />

    <main id="main" class="public-layout__main" tabindex="-1">
      <RouterView />
    </main>

    <AppFooter />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

import AppHeader from "@/components/navigation/AppHeader.vue";
import AppFooter from "@/components/navigation/AppFooter.vue";

/**
 * T-011 — PublicLayout.
 *
 * This is the Quasar route layout component for all locale-prefixed public
 * routes. Pages are rendered via <RouterView /> and must NOT use AppShell.
 *
 * The skip link targets `#main` with `tabindex="-1"` so the <main> element
 * is programmatically focusable when the link is activated. This satisfies
 * WCAG 2.4.1 (bypass blocks).
 */
const { t } = useI18n();

/**
 * Explicitly move focus to the <main> landmark.
 *
 * A bare `href="#main"` in history-mode SPA can be intercepted by Vue Router
 * as a hash push, which navigates but never moves DOM focus. Using
 * element.focus() sidesteps the router entirely and is the correct WCAG 2.4.1
 * implementation pattern.
 */
function skipToMain(): void {
  const main = document.getElementById("main") as HTMLElement | null;
  if (main) {
    main.focus();
    main.scrollIntoView();
  }
}
</script>

<style scoped>
/* ── Shell structure ─────────────────────────────────────────────────────── */

.public-layout {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

/* ── Skip link ───────────────────────────────────────────────────────────── */

/*
  The skip link is visually hidden until focused. This satisfies WCAG 2.4.1
  without permanently occupying header space. Positioned relative to the
  viewport top-left; z-index above the sticky header (z-index 100).

  Contrast on --color-surface-raised (light: #FAFAFA, dark: #353333):
    light → NERO text on #FAFAFA: 14.79:1 AAA ✓
    dark  → GRAY93 text on #353333: 10.72:1 AAA ✓
  (tokens.css contrast table)
*/
.public-layout__skip-link {
  position: absolute;
  left: -9999px;
  z-index: 200;
  padding: 0.625rem 1rem;
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-weight: 600;
  text-decoration: none;
  border-radius: 0 0 0.375rem 0;
  box-shadow: var(--shadow-md);
}

.public-layout__skip-link:focus {
  left: 0;
  top: 0;
}

/* ── Main content ────────────────────────────────────────────────────────── */

.public-layout__main {
  flex: 1;
  /* Remove default focus outline on the main element (it is only programmatically
     focusable via the skip link, not via Tab). */
  outline: none;
  padding: 2rem 1.25rem 4rem;
  max-width: 72rem;
  margin: 0 auto;
  width: 100%;
}

/* ── Responsive: narrow viewports and 200% zoom ──────────────────────────── */

@media (max-width: 480px) {
  .public-layout__main {
    padding: 1.5rem 1rem 3rem;
  }
}
</style>
