<template>
  <header class="app-header" role="banner" @keydown="handleHeaderEscape">
    <!--
      Brand links to the locale home through a single native navigation
      mechanism (RouterLink): plain clicks stay client-side while modified
      clicks (Ctrl/Cmd+click) pass through to the browser's open-in-new-tab.

      `kind="logotype"` is the documented override of the brandbook
      header→mark rule (DESIGN_SYSTEM.md §1): the bare mark rendered too
      small to read, so the header shows the full lockup. The image stays
      decorative — the link's aria-label carries the name.
    -->
    <RouterLink
      :to="`/${currentLocale}`"
      class="app-header__brand focus-ring"
      :aria-label="t('brand.logoLabel')"
    >
      <BrandLogo
        context="header"
        kind="logotype"
        size="md"
        :decorative="true"
      />
    </RouterLink>

    <!--
      Panel: wraps the nav list + controls in one DOM element that becomes
      the mobile drawer. Desktop: a flex row (nav | controls) inline in the
      header. Mobile: position:fixed, opened by the hamburger.

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
        :aria-label="navLabel"
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
        Controls cluster: the search action and the verified social channels
        lead, the theme/language settings follow. Deliberate order — actions
        before settings. Desktop renders this inline at the right edge; the
        mobile drawer reuses the SAME DOM (CSS swap), so the global "/" and
        Ctrl/Cmd+K shortcuts reach search from either placement, and
        SocialLinks never leaves a dead placeholder when no URL is
        configured (D-05).

        The theme control is a single labelled switch (accessible name ==
        visible "Dark mode" text); the language control is a disclosure
        button that expands on hover/focus/click into per-locale option
        buttons, the current one marked aria-current. Every control's visible
        text is contained in its accessible name (WCAG 2.5.3).
      -->
      <div class="app-header__controls">
        <!-- One SiteSearch instance at a time: in the cluster on tablet
             and desktop, in the slim header strip on phones (below). -->
        <SiteSearch v-if="!isPhoneBand" />
        <SocialLinks :links="organization.socialLinks" variant="icon" />
        <ThemeToggle />
        <LanguageSwitcher />
      </div>
    </div>

    <!-- Phone-band action strip: search (single instance, moved out of the
         drawer) and the hamburger fallback for the full menu. ——————————————— -->
    <div class="app-header__actions">
      <SiteSearch v-if="isPhoneBand" />

      <!-- Mobile hamburger — shown only on small viewports via CSS ———————— -->
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
    </div>

    <MobileBottomNav
      :locale="currentLocale"
      :menu-open="isMenuOpen"
      @open-menu="isMenuOpen = true"
    />
  </header>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import BrandLogo from "@/components/brand/BrandLogo.vue";
import LanguageSwitcher from "@/components/LanguageSwitcher.vue";
import SiteSearch from "@/components/search/SiteSearch.vue";
import MobileBottomNav from "@/components/navigation/MobileBottomNav.vue";
import SocialLinks from "@/components/navigation/SocialLinks.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import { organization } from "@/config/organization";
import { mainNavItems, type NavItem } from "@/config/navigation";
import { DEFAULT_LOCALE, isLocale } from "@/features/i18n/locales";

/**
 * AppHeader — sticky public header: brand, locale-aware nav, search, social
 * channels, theme/language controls, and a mobile drawer.
 *
 * ≥ 1280 px everything renders inline; below that the nav + controls collapse
 * into the hamburger drawer because the inline layout cannot fit brand + six
 * nowrap destinations + controls in the longest locale (uk), and a stacked
 * drawer keeps every accessible name intact at 320 px without CSS
 * workarounds (DESIGN_SYSTEM.md §4, §6).
 *
 * Escape closes the drawer from any focused child and returns focus to the
 * trigger. No focus trap — the spec only requires focus return.
 */

const { t } = useI18n();
const route = useRoute();

/** Resolved locale from the URL, falling back to the default. */
const currentLocale = computed(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

/** Mobile drawer open/close state — never depends on hover. */
const isMenuOpen = ref(false);

/** Reference to the toggle button so focus can be restored on close. */
const triggerRef = ref<HTMLButtonElement | null>(null);

/*
 * Phone band: viewport < 600 px (documented breakpoint of this lane). In
 * it the header becomes a slim brand strip — the section links move to
 * MobileBottomNav, the search trigger rides the strip, and the drawer
 * stays as the FULL menu (its landmark is renamed so the two navs never
 * share one accessible name). Tablet and desktop are untouched.
 */
const PHONE_BAND_QUERY = "(max-width: 599px)";
const isPhoneBand = ref(
  typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(PHONE_BAND_QUERY).matches
);

function onPhoneBandChange(event: MediaQueryListEvent): void {
  isPhoneBand.value = event.matches;
}

let phoneMql: MediaQueryList | null = null;

onMounted(() => {
  if (typeof window.matchMedia !== "function") return;
  phoneMql = window.matchMedia(PHONE_BAND_QUERY);
  isPhoneBand.value = phoneMql.matches;
  phoneMql.addEventListener("change", onPhoneBandChange);
});

onBeforeUnmount(() => {
  phoneMql?.removeEventListener("change", onPhoneBandChange);
});

/** Drawer landmark name: "Main navigation" normally; "Full menu" in the
 *  phone band, where the bottom bar is the main navigation. */
const navLabel = computed(() =>
  isPhoneBand.value ? t("nav.fullMenu") : t("nav.mainNav")
);

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
 * Navigating away — including search-result activation from inside the
 * drawer — must not leave the drawer open over the new page. Only the flag
 * flips: focus belongs to the destination page, so it is deliberately NOT
 * returned to the trigger here (see SiteSearch deep-link focus and
 * DESIGN_SYSTEM.md §6).
 */
watch(
  () => route.fullPath,
  () => {
    isMenuOpen.value = false;
  }
);

/**
 * Escape closes the panel and returns focus to the trigger. Caught on the
 * panel so it works from any focused child (nav link, language option,
 * theme switch) — no focus trap required by the spec.
 */
/*
 * Escape from OUTSIDE the drawer (strip search, burger, bottom-bar More):
 * only meaningful while the drawer is open; the panel keeps its own handler
 * for focus inside the drawer (both paths call closeMenu, idempotent).
 */
function handleHeaderEscape(event: KeyboardEvent): void {
  if (event.key === "Escape" && isMenuOpen.value) {
    // The panel handler already ran for in-drawer focus; avoid double focus
    // churn only matters for the outside-focus case bubbling here first.
    closeMenu();
  }
}

function handleNavKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    closeMenu();
  }
}

/**
 * Whether a nav item corresponds to the current page. Route-name matching
 * keeps the check locale-independent; the document reader (`about-…`)
 * counts as the About section via the prefix test below.
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
  /* Tight padding returns width to the logotype brand; the drawer overrides. */
  padding: 0 0.25rem;
}

.app-header__nav-link {
  display: inline-flex;
  align-items: center;
  padding: 0 0.625rem; /* comfortable value; compressed at 1280–1439 px below */
  height: 3.75rem;
  font-size: var(--font-size-body);
  font-weight: 500;
  color: var(--color-text);
  text-decoration: none;
  /* Brand stroke: same thickness as the logotype's "B" stem (tokens.css). */
  border-bottom: var(--nav-active-stroke) solid transparent;
  transition:
    color var(--motion-duration),
    border-color var(--motion-duration);
  white-space: nowrap;
}

.app-header__nav-link:hover {
  color: var(--color-link);
}

/* Active / current page — the brand-stroke scarlet underline (== the logotype "B" stem) inside the header height.
   T-033: the label TEXT is the link token, never the accent surface value — dark
   #FA4C3C text on the header band measured 4.24:1 (< AA for normal text); the
   underline stays scarlet-accent because a stroke is non-text UI (≥3:1, met).
   Light mode is visually identical: --color-link == --color-accent == SCARLET. */
.app-header__nav-link[aria-current="page"] {
  color: var(--color-link);
  border-bottom-color: var(--color-accent);
  font-weight: 600;
}

/* ── Controls (language + theme) ─────────────────────────────────────────── */

.app-header__controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-left: 0.5rem; /* width budget for the logotype */
  flex: 0 0 auto;
}

/*
  Width budget: brand logotype + six nowrap destinations + controls + bar
  padding do not fit inline below 1280 px in the longest locale, so the
  drawer breakpoint sits at 1280 px (see media query at the end of this
  file). The drawer band only renders brand + hamburger (≈ 270 px), so the
  md logotype shows at every viewport with no size step-down.
*/

/*
  Inline compression for 1280–1439 px: the longest locale (uk) is a few px
  over budget at exactly 1280 px, so this band shaves PURE whitespace only
  (nav padding, list padding, cluster gap/padding). No text, icon, chip or
  brand metric changes; link boxes stay ≥ 24×24 CSS px (WCAG 2.5.8). The
  comfortable paddings return at ≥ 1440 px.
*/
@media (min-width: 1280px) and (max-width: 1439px) {
  .app-header__nav-list {
    padding: 0;
  }

  /*
    The search trigger (2.25rem + gap) joins the cluster at this width;
    these values absorb it while keeping nav links readable — tighter nav
    padding read as a word cloud in uk. uk clearance measures ≈ 26 px.
  */
  .app-header__nav-link {
    padding: 0 0.25rem;
  }

  .app-header__controls {
    gap: 0.125rem;
    padding-left: 0.125rem;
  }
}

/* ── Action strip (search on phones + hamburger) ──────────────────────── */

.app-header__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
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

/* ── Drawer breakpoint (< 1280 px) ───────────────────────────────────────── */

@media (max-width: 1279px) {
  /*
    Drawer-band bar: logo | 1fr gap | hamburger — ≈ 273 px total, inside the
    320 px minimum viewport, so the header-overflow E2E assertion
    (scrollWidth ≤ clientWidth) holds. Nav and controls move into the
    full-width drawer below, stacked and readable (DESIGN_SYSTEM.md §4).
  */
  .app-header {
    grid-template-columns: auto 1fr auto;
  }

  /* Panel hidden by default in the drawer band */
  .app-header__panel {
    display: none;
    position: fixed;
    /* 4rem = the real bar height in this band (logotype cell + clear space,
       taller than the 3.75rem min-height); anchoring the drawer there leaves
       no content sliver between bar and drawer top. */
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
    /* Same brand stroke as the desktop underline (tokens.css chain). */
    border-left: var(--nav-active-stroke) solid transparent;
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
