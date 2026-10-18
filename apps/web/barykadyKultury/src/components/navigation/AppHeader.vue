<template>
  <header class="app-header" role="banner">
    <!-- Brand logo links back to the locale home (DESIGN_SYSTEM.md §1 clear-space). -->
    <a
      :href="`/${currentLocale}`"
      class="app-header__brand focus-ring"
      :aria-label="t('brand.logoLabel')"
      @click.prevent="router.push(`/${currentLocale}`)"
    >
      <BrandLogo context="header" size="md" :decorative="true" />
    </a>

    <!--
      Panel: wraps the nav list + controls so they share a single DOM element
      that becomes the mobile drawer. On desktop the panel is a flex row
      (nav links | controls) inline in the header. On mobile it is
      position:fixed and opens on hamburger click.

      Escape is caught here (bubbles from any focused child — nav link or
      language/theme control) so closing works from every interactive element
      inside the drawer (DESIGN_SYSTEM.md §4).
    -->
    <div
      id="app-panel"
      class="app-header__panel"
      :class="{ 'app-header__panel--open': isMenuOpen }"
      @keydown="handleNavKeydown"
    >
      <nav
        id="app-nav"
        data-testid="main-nav"
        class="app-header__nav"
        :aria-label="t('nav.mainNav')"
      >
        <ul class="app-header__nav-list">
          <li
            v-for="item in mainNavItems"
            :key="item.routeName"
            class="app-header__nav-item"
          >
            <RouterLink
              :to="`/${currentLocale}/${item.path}`"
              class="app-header__nav-link focus-ring"
              :aria-current="isActivePage(item) ? 'page' : undefined"
              @click="closeMenu"
            >
              {{ t(`nav.${item.labelKey}`) }}
            </RouterLink>
          </li>
        </ul>
      </nav>

      <!--
        Controls: language switcher + theme toggle.

        Desktop: displayed inline in the header bar after the nav links.
        Mobile:  inside the drawer — the full accessible name of every control
                 is preserved (no truncation), so the theme E2E name assertion
                 ("Toggle dark theme") still passes at desktop width unchanged.

        The choice to move rather than shorten was made to avoid WCAG 2.5.3
        "Label in Name" conflicts: the Polish/Ukrainian action labels
        ("Przełącz tryb ciemny" / "Перемкнути темну тему") share no common
        substring with a natural short-form word in those languages.
      -->
      <div class="app-header__controls">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </div>

    <!-- Mobile hamburger — shown only on small viewports via CSS ————————— -->
    <button
      ref="triggerRef"
      type="button"
      data-testid="menu-trigger"
      class="app-header__menu-btn focus-ring"
      :aria-expanded="isMenuOpen"
      aria-controls="app-panel"
      @click="toggleMenu"
    >
      <span class="app-header__menu-icon" aria-hidden="true">
        {{ isMenuOpen ? "✕" : "☰" }}
      </span>
      <span class="sr-only">
        {{ isMenuOpen ? t("nav.closeMenu") : t("nav.openMenu") }}
      </span>
    </button>
  </header>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import BrandLogo from "@/components/brand/BrandLogo.vue";
import LanguageSwitcher from "@/components/LanguageSwitcher.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import { mainNavItems, type NavItem } from "@/config/navigation";
import { DEFAULT_LOCALE, isLocale } from "@/features/i18n/locales";

/**
 * T-011 — AppHeader (rev-2)
 *
 * Desktop: top navigation bar with all six destinations, language and theme
 * controls and the brand logo.
 *
 * Mobile: compact bar (logo + hamburger only). Nav links AND controls live
 * inside a shared panel that opens as a fixed drawer on click.
 *
 * Escape closes the panel from any focused element inside it (nav link,
 * language select, or theme button) and returns focus to the trigger
 * (DESIGN_SYSTEM.md §4, §6 — no hover dependency, explicit open/close state).
 *
 * Moving the controls into the drawer (vs. a compact label) was chosen to:
 *  - Avoid WCAG 2.5.3 "Label in Name" violations across PL/UK locales.
 *  - Keep the ThemeToggle accessible name intact for the theme E2E test.
 *  - Eliminate the 320 px overflow at its root without CSS workarounds.
 */

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

/** Resolved locale from the URL, falling back to the default. */
const currentLocale = computed(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

/** Mobile drawer open/close state — never depends on hover. */
const isMenuOpen = ref(false);

/** Reference to the toggle button so focus can be restored on close. */
const triggerRef = ref<HTMLButtonElement | null>(null);

/** Open or close the mobile panel. */
function toggleMenu(): void {
  isMenuOpen.value = !isMenuOpen.value;
}

/**
 * Close the mobile panel and return focus to the trigger button.
 * Called by the Escape key handler and by nav link clicks on mobile.
 */
function closeMenu(): void {
  isMenuOpen.value = false;
  // Return focus to the trigger; nextTick ensures the DOM has settled.
  void nextTick(() => {
    triggerRef.value?.focus();
  });
}

/**
 * Handle keyboard events on the panel element.
 * Escape closes the menu and returns focus — no focus trap required (T-011
 * spec: "focus trap not required but focus must return to trigger").
 * Catches events from any focused child: nav links, language select, theme
 * button.
 */
function handleNavKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    closeMenu();
  }
}

/**
 * Determines whether a nav item corresponds to the current page.
 *
 * Uses route.name for matching so the check is independent of locale prefix.
 * About-family routes (about, about-team, about-documents) all mark the
 * "About us" top-level link as active when any About sub-route is current.
 */
function isActivePage(item: NavItem): boolean {
  const name = String(route.name ?? "");

  if (item.routeName === "about") {
    // Active for any About sub-route
    return name === "about" || name.startsWith("about-");
  }

  return name === item.routeName;
}
</script>

<style scoped>
/* ── Desktop layout ──────────────────────────────────────────────────────── */

/*
  3-column grid: brand logo | panel (nav + controls) | hamburger (hidden on
  desktop). The panel is the single responsive container — on desktop it is
  a flex row; on mobile it becomes the position:fixed drawer.
*/
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0;
  padding: 0 1.25rem;
  min-height: 3.75rem;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}

/* ── Brand logo ───────────────────────────────────────────────────────────── */

.app-header__brand {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  color: inherit;
  /* Clear-space token from DESIGN_SYSTEM.md §1 is applied inside BrandLogo */
}

/* ── Panel (desktop: inline flex row) ───────────────────────────────────── */

.app-header__panel {
  display: flex;
  flex-direction: row;
  align-items: center;
  min-width: 0;
}

/* ── Desktop nav ──────────────────────────────────────────────────────────── */

.app-header__nav {
  display: flex;
  align-items: stretch;
  flex: 1 1 auto;
  min-width: 0;
}

.app-header__nav-list {
  display: flex;
  align-items: center;
  gap: 0;
  list-style: none;
  margin: 0;
  padding: 0 0.5rem;
}

.app-header__nav-link {
  display: inline-flex;
  align-items: center;
  padding: 0 0.875rem;
  height: 3.75rem;
  font-size: var(--font-size-body);
  font-weight: 500;
  color: var(--color-text);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition:
    color var(--motion-duration),
    border-color var(--motion-duration);
  white-space: nowrap;
}

.app-header__nav-link:hover {
  color: var(--color-link);
}

/* Active / current page — a 2 px scarlet underline inside the header height */
.app-header__nav-link[aria-current="page"] {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
  font-weight: 600;
}

/* ── Controls (language + theme) ─────────────────────────────────────────── */

.app-header__controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-left: 0.75rem;
  flex: 0 0 auto;
}

/* ── Mobile hamburger ────────────────────────────────────────────────────── */

.app-header__menu-btn {
  display: none; /* hidden on desktop; shown via media query below */
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  margin-left: 0.5rem;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 1.25rem;
  transition: background-color var(--motion-duration);
}

.app-header__menu-btn:hover {
  background: var(--color-surface-raised);
}

/* Screen-reader only helper */
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

/* ── Mobile breakpoint ───────────────────────────────────────────────────── */

@media (max-width: 767px) {
  /*
    Header bar on mobile: logo | 1fr gap | hamburger only.
    The panel is removed from the grid flow (position: fixed when open).
    At 320 px: logo(~64 px) + hamburger(44 px) + padding(40 px) ≈ 148 px —
    well within the 320 px viewport with no risk of horizontal overflow.
  */
  .app-header {
    grid-template-columns: auto 1fr auto;
  }

  /* Panel hidden by default on mobile */
  .app-header__panel {
    display: none;
    position: fixed;
    inset: 3.75rem 0 0 0;
    z-index: 200;
    flex-direction: column;
    align-items: stretch;
    overflow-y: auto;
    background: var(--color-surface-raised);
    box-shadow: var(--shadow-lg);
  }

  /* JS-controlled open state */
  .app-header__panel--open {
    display: flex;
  }

  .app-header__nav {
    flex-direction: column;
    align-items: stretch;
    flex: 0 0 auto;
    padding: 1rem 0;
  }

  .app-header__nav-list {
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    padding: 0;
  }

  .app-header__nav-link {
    height: auto;
    padding: 0.875rem 1.5rem;
    border-bottom: none;
    border-left: 3px solid transparent;
  }

  .app-header__nav-link[aria-current="page"] {
    border-left-color: var(--color-accent);
    border-bottom-color: transparent;
    background: var(--color-surface);
  }

  /* Controls sit below the nav list in the mobile drawer */
  .app-header__controls {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-border);
    flex-wrap: wrap;
    gap: 0.75rem;
    padding-left: 1.5rem;
  }

  /* Show hamburger on mobile */
  .app-header__menu-btn {
    display: inline-flex;
  }
}
</style>
