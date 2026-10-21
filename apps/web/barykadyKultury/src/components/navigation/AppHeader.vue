<template>
  <header class="app-header" role="banner">
    <!--
      Brand logo links back to the locale home (DESIGN_SYSTEM.md §1 clear-space).

      `kind="logotype"` is the documented explicit override of the brandbook
      context rule (header → mark): the user requirement is the justification —
      the bare mark was too small and its text unreadable, so the header now
      shows the full mark + wordmark lockup. The link keeps its aria-label and
      the image stays decorative (name comes from the link, not duplicated).
    -->
    <a
      :href="`/${currentLocale}`"
      class="app-header__brand focus-ring"
      :aria-label="t('brand.logoLabel')"
      @click.prevent="router.push(`/${currentLocale}`)"
    >
      <BrandLogo
        context="header"
        kind="logotype"
        size="md"
        :decorative="true"
      />
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
        Controls: labelled dark-mode switch + language hover disclosure.

        Order is deliberate (user requirement, unchanged by the control
        redesigns): the language switcher sits in the right corner of the
        header and the theme control comes immediately before it. Desktop:
        inline at the right edge of the panel. Mobile: same order in the
        drawer, tapped open — the disclosure trigger (~150 px) and its
        narrow option panel never truncate at 320 px.

        The theme control is a single labelled switch (accessible name ==
        visible "Dark mode" text); the language control is a disclosure
        button ("Language 🇵🇱 PL ▾", name "Język Polski PL") that expands
        on hover/focus/click into per-locale option buttons, the current
        one marked aria-current. Every control's visible text is contained
        in its accessible name (WCAG 2.5.3).
      -->
      <div class="app-header__controls">
        <!--
          T-039 (D-26): site search leads the controls cluster — it is an
          action, the theme/language pair are settings. One instance serves
          BOTH placements because this cluster is the same DOM inline on
          desktop and stacked in the mobile drawer (CSS swap), so the drawer
          requirement holds without a second trigger. The global "/" and
          Ctrl/Cmd+K shortcuts reach it from anywhere, drawer closed included.
        -->
        <SiteSearch />
        <!--
          T-043: the verified social channels sit between the search action
          and the theme/language settings — same DOM inline and in the drawer,
          icon variant only (2.25rem targets). SocialLinks renders nothing
          when no URL is configured, so a misconfigured org never leaves a
          dead placeholder in the bar.
        -->
        <SocialLinks :links="organization.socialLinks" variant="icon" />
        <ThemeToggle />
        <LanguageSwitcher />
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
import { computed, nextTick, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import BrandLogo from "@/components/brand/BrandLogo.vue";
import LanguageSwitcher from "@/components/LanguageSwitcher.vue";
import SiteSearch from "@/components/search/SiteSearch.vue";
import SocialLinks from "@/components/navigation/SocialLinks.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import { organization } from "@/config/organization";
import { mainNavItems, type NavItem } from "@/config/navigation";
import { DEFAULT_LOCALE, isLocale } from "@/features/i18n/locales";

/**
 * T-011 — AppHeader (rev-2) + brand-fixes v3.1
 *
 * Desktop (≥ 1280 px): top navigation bar with all six destinations, the
 * theme + language controls at the right and the full brand LOGOTYPE (mark +
 * wordmark) at the left — the user requirement to make the wordmark readable
 * overrides the brandbook header→mark default via BrandLogo's explicit
 * `kind` escape hatch.
 *
 * Drawer band (≤ 1279 px, raised from ≤ 767 px because the inline layout
 * measures ≈ 1237 px minimum and would otherwise let the nowrap nav list
 * overflow invisibly into the controls): compact bar (logotype + hamburger
 * only). Nav links AND controls live inside a shared panel that opens as a
 * fixed drawer on click, stacked and fully readable.
 *
 * Escape closes the panel from any focused element inside it (nav link,
 * language option, or theme switch) and returns focus to the trigger
 * (DESIGN_SYSTEM.md §4, §6 — no hover dependency, explicit open/close state).
 *
 * Moving the controls into the drawer (vs. a compact header strip) was chosen
 * to:
 *  - Keep every control's full accessible name intact (WCAG 2.5.3) in all
 *    three locales without truncation.
 *  - Keep the theme-switch/language-option names stable for the E2E tests.
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

/*
 * M1 (T-039 review): navigating away — including search-result activation
 * from inside the drawer — must not leave the drawer open over the new page.
 * The watcher only flips the flag: focus is NOT moved to the trigger (the
 * router just moved it to the destination page; stealing it back would
 * break the "focus lands in the new page" contract, see SiteSearch's
 * deep-link focus and DESIGN_SYSTEM.md §6).
 */
watch(
  () => route.fullPath,
  () => {
    isMenuOpen.value = false;
  }
);

/**
 * Handle keyboard events on the panel element.
 * Escape closes the menu and returns focus — no focus trap required (T-011
 * spec: "focus trap not required but focus must return to trigger").
 * Catches events from any focused child: nav links, language options, the
 * theme switch.
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
 * T-039 (D-25): the About list routes are gone; the only remaining sub-route
 * is the document reader (`about-document`), which still marks "About us"
 * active via the `about-` prefix test below.
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
  /* 0.5rem → 0.25rem: returns ~8 px to the width budget the logotype
     brand needs (T-034 follow-up). Mobile drawer overrides this below. */
  padding: 0 0.25rem;
}

.app-header__nav-link {
  display: inline-flex;
  align-items: center;
  padding: 0 0.625rem; /* was 0.875rem — see nav-list budget note */
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
  padding-left: 0.5rem; /* was 0.75rem — width budget for the logotype */
  flex: 0 0 auto;
}

/*
  Width budget (measured in the built app, brand-fixes v3.1/v3.2):
  brand md logotype ≈ 178 px + nav content + controls + bar padding 40 px.
  The 768–1279 px band cannot render brand + 6 nowrap destinations +
  controls without overlap (the old nav-list overflowed its min-width:0 box
  invisibly into the controls — scrollWidth never grew, so the overflow tests
  missed it). The drawer breakpoint is raised to cover that band: below
  1280 px the nav + controls collapse into the hamburger drawer; at ≥ 1280 px
  everything fits inline. No brand size step-down is needed any more — the
  drawer band shows only brand + hamburger (≈ 270 px), so the md logotype
  renders at every viewport.
*/

/*
  Inline compression for 1280–1439 px (brand-fixes v3.2): re-measured at the
  Playwright-default 1280×720 viewport, the worst locale (uk) needs
  brand 178 + nav 591 + controls 497 + padding 40 ≈ 1306 px — 26 px over
  budget (pl +2, en fits). Shave 64 px of PURE whitespace so every locale
  clears the controls with ≥ 16 px at 1280:
    - 6 nav links:  horizontal padding 0.625rem → 0.375rem      (−48 px)
    - nav list:     0.25rem → 0                                  (−8 px)
    - controls:     cluster gap 0.5rem → 0.25rem                 (−4 px)
    - controls:     padding-left 0.5rem → 0.25rem                (−4 px)
  No text, icon, chip metric or brand size changes — the md logotype stays
  at ≥ 1280 px (the point of this series). Resulting clearance at 1280:
  en ≈ 107 px, pl ≈ 62 px, uk ≈ 38 px. At ≥ 1440 px the comfortable paddings
  return (uk total 1306 leaves 134 px). Link boxes remain ≥ 24×24 CSS px, so
  WCAG 2.5.8 target size holds without inter-target spacing.
*/
@media (min-width: 1280px) and (max-width: 1439px) {
  .app-header__nav-list {
    padding: 0;
  }

  /*
    T-039 review m9: the search trigger (+36 px button + ~4 px gap) joins
    the cluster. The first pass compressed nav links to 0.125rem padding,
    which read as a word cloud in uk; this re-tune keeps the v3.2 0.25rem
    half-step (−24 px recovered), tightens the cluster gap to 0.125rem and
    the cluster padding to 0.125rem (−6 px), and the 2.25rem trigger
    (≥ 24 px AA target) costs 40 px. uk clearance at 1280 measures ≈ 26 px
    — above the 16 px requirement without the word-cloud effect.
  */
  .app-header__nav-link {
    padding: 0 0.25rem;
  }

  .app-header__controls {
    gap: 0.125rem;
    padding-left: 0.125rem;
  }
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

/* ── Drawer breakpoint (raised 767 → 1279 px, brand-fixes v3.1) ─────────── */

@media (max-width: 1279px) {
  /*
    Header bar in the drawer band: logo | 1fr gap | hamburger only.
    The panel is removed from the grid flow (position: fixed when open).
    At 320 px: md logotype(~181 px incl. clear space) + hamburger(44 px +
    8 px margin) + padding(40 px) ≈ 273 px — inside the 320 px viewport,
    so the header-overflow E2E assertion (scrollWidth ≤ clientWidth) holds
    with ~47 px to spare. At 768–1279 px the same bar leaves the nav and
    the theme/language controls inside the full-width drawer, where every
    destination renders stacked and readable (DESIGN_SYSTEM.md §4).
  */
  .app-header {
    grid-template-columns: auto 1fr auto;
  }

  /* Panel hidden by default in the drawer band */
  .app-header__panel {
    display: none;
    position: fixed;
    /*
      4rem = the real bar height in this band: the md logotype cell is
      48 px + 2 × 0.5rem clear space = 64 px (taller than the 3.75 rem
      min-height). Anchoring the drawer at 64 px removes the 4–5 px
      content sliver the old 3.75rem inset left between bar and drawer;
      the drawer's 1 px overlap of the header border is hidden behind its
      own z-index (200 > 100).
    */
    inset: 4rem 0 0 0;
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

  /* Controls sit below the nav list in the drawer */
  .app-header__controls {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-border);
    flex-wrap: wrap;
    gap: 0.75rem;
    padding-left: 1.5rem;
  }

  /* Show hamburger across the drawer band */
  .app-header__menu-btn {
    display: inline-flex;
  }
}
</style>
