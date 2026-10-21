<template>
  <!--
    MobileBottomNav — one-handed phone navigation (owner-approved lane).

    Band: viewport < 600 px (documented in AppHeader.vue; the phone band
    where the drawer replaces the inline header controls). The header there
    stays a slim brand strip (logo + search + burger fallback) and the
    sections move here: the first four primary destinations from the
    owner-ordered `mainNavItems` config plus a "More" disclosure that opens
    the SAME header drawer (single menu implementation, existing focus
    behavior intact — no second drawer, no duplicated content).

    Semantics: a plain `nav` landmark (not a `footer` — AppFooter already
    owns contentinfo, the landmarks must not double). Active state is
    aria-current="page" + scarlet label + a top marker bar — never color
    alone. Targets are 48 px tall (WCAG 2.5.8 comfortable / Apple HIG),
    the bar adds `env(safe-area-inset-bottom)` so it clears home indicators.
    Desktop and tablet never render this bar (CSS display swap; display:none
    also removes it from the accessibility tree).
  -->
  <nav
    class="mobile-bottom-nav"
    :aria-label="t('nav.mainNav')"
    data-testid="bottom-nav"
  >
    <ul class="mobile-bottom-nav__list">
      <li v-for="item in primaryItems" :key="item.routeName">
        <RouterLink
          :to="`/${locale}/${item.path}`"
          class="mobile-bottom-nav__item focus-ring"
          :class="{ 'mobile-bottom-nav__item--active': isActive(item) }"
          :aria-current="isActive(item) ? 'page' : undefined"
        >
          <span class="mobile-bottom-nav__icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <component
                :is="shape.tag"
                v-for="(shape, index) in iconFor(item.routeName)"
                :key="index"
                v-bind="shape.attrs"
              />
            </svg>
          </span>
          <span class="mobile-bottom-nav__label">{{
            t(`nav.${item.labelKey}`)
          }}</span>
        </RouterLink>
      </li>

      <li>
        <button
          type="button"
          class="mobile-bottom-nav__item mobile-bottom-nav__more focus-ring"
          data-testid="bottom-nav-more"
          :aria-expanded="menuOpen"
          aria-controls="app-panel"
          @click="emit('open-menu')"
        >
          <span class="mobile-bottom-nav__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </span>
          <span class="mobile-bottom-nav__label">{{ t("nav.more") }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import { mainNavItems, type NavItem } from "@/config/navigation";

/**
 * `menuOpen` mirrors the header drawer state for aria-expanded; the open
 * intent is emitted so the header (drawer owner) keeps single ownership of
 * focus management.
 */
const props = defineProps<{ locale: string; menuOpen: boolean }>();

const emit = defineEmits<{ "open-menu": [] }>();

const { t } = useI18n();
const route = useRoute();

/** First four config entries; the rest stay reachable through the drawer. */
const primaryItems = computed(() => mainNavItems.slice(0, 4));

/** Same matching rule as the header (About sub-routes count as About). */
function isActive(item: NavItem): boolean {
  const name = String(route.name ?? "");
  if (item.routeName === "about") {
    return name === "about" || name.startsWith("about-");
  }
  return name === item.routeName;
}

/** Generic section glyphs — decorative shapes, not brand symbols. */
const ICONS: Record<
  string,
  ReadonlyArray<{ tag: string; attrs: Record<string, string> }>
> = {
  contact: [{ tag: "path", attrs: { d: "M4 6h16v12H4z M4 7l8 6 8-6" } }],
  about: [
    { tag: "circle", attrs: { cx: "12", cy: "8", r: "3.2" } },
    {
      tag: "path",
      attrs: { d: "M5.5 19c1.4-3 3.8-4.4 6.5-4.4S17.1 16 18.5 19" }
    }
  ],
  support: [
    {
      tag: "path",
      attrs: {
        d: "M12 20s-7-4.6-7-9.5C5 7.6 6.8 6 8.8 6 10.2 6 11.3 6.8 12 8c.7-1.2 1.8-2 3.2-2 2 0 3.8 1.6 3.8 4.5 0 4.9-7 9.5-7 9.5Z"
      }
    }
  ],
  projects: [
    {
      tag: "rect",
      attrs: { x: "4", y: "4", width: "7", height: "7", rx: "1.2" }
    },
    {
      tag: "rect",
      attrs: { x: "13", y: "4", width: "7", height: "7", rx: "1.2" }
    },
    {
      tag: "rect",
      attrs: { x: "4", y: "13", width: "7", height: "7", rx: "1.2" }
    },
    {
      tag: "rect",
      attrs: { x: "13", y: "13", width: "7", height: "7", rx: "1.2" }
    }
  ],
  events: [
    {
      tag: "rect",
      attrs: { x: "4", y: "5", width: "16", height: "15", rx: "2" }
    },
    { tag: "path", attrs: { d: "M4 10h16 M9 3v4 M15 3v4" } }
  ],
  publications: [
    { tag: "path", attrs: { d: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3Z" } },
    { tag: "path", attrs: { d: "M5 17h14" } }
  ]
};

function iconFor(routeName: string) {
  return ICONS[routeName] ?? ICONS["projects"]!;
}
</script>

<style scoped>
/* Hidden above the phone band; the media query is the single source of the
   breakpoint (see AppHeader.vue for the documented < 600 px band). */
.mobile-bottom-nav {
  display: none;
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 100;
  /* Home-indicator clearance (notched devices). */
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--color-surface-raised);
  border-top: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
}

@media (max-width: 599px) {
  .mobile-bottom-nav {
    display: block;
  }
}

.mobile-bottom-nav__list {
  display: grid;
  /* 4 sections + More: equal columns cap each target at ≥ 56 px at 320. */
  grid-template-columns: repeat(5, 1fr);
  margin: 0;
  padding: 0;
  list-style: none;
}

.mobile-bottom-nav__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.125rem;
  /* 48 px minimum target height (WCAG 2.5.8 comfortable). */
  min-height: 3rem;
  padding: 0.375rem 0.25rem;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  line-height: 1.2;
  text-decoration: none;
  text-align: center;
  border-top: 2px solid transparent;
  overflow-wrap: anywhere;
}

.mobile-bottom-nav__item:hover {
  color: var(--color-link);
}

/* Active: scarlet label + a top marker bar + aria-current — state is never
   carried by color alone (DESIGN_SYSTEM.md §6). */
.mobile-bottom-nav__item--active {
  color: var(--color-link);
  border-top-color: var(--color-link);
  font-weight: 600;
}

.mobile-bottom-nav__more {
  width: 100%;
  border: 0;
  border-top: 2px solid transparent;
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.mobile-bottom-nav__label {
  max-width: 100%;
}
</style>
