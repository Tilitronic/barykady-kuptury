<template>
  <!--
    AdminLayout — operational shell for the invited-admin area (T-026).

    Deliberately the same design system as the public site (same tokens, same
    brand mark, same focus ring, same theme control) but clearly a different
    room: a compact surface-bar header with a text "Admin" badge — never
    color alone (DESIGN_SYSTEM.md §6) — instead of the public logotype
    navigation, and no marketing footer (an admin is oriented by the
    persistent "Back to public site" route, not by page furniture).

    Landmark order mirrors PublicLayout (DESIGN_SYSTEM.md §6):
      1. skip link (first focusable element),
      2. <header role="banner"> with brand + admin nav + controls,
      3. <main id="admin-main" tabindex="-1> — the skip target,
    The admin nav links ONLY destinations that exist today (the dashboard);
    feature entries arrive with their own tickets (T-027…T-031).
  -->
  <div class="admin-layout">
    <a
      href="#admin-main"
      class="admin-layout__skip-link focus-ring"
      @click.prevent="skipToMain"
      >{{ t("common.skipToContent") }}</a
    >

    <header class="admin-header" role="banner">
      <div class="admin-header__brand">
        <!--
          The mark links back to the public home. It is not decorative: the
          link's accessible name is "Back to public site", so keyboard and
          screen-reader users always have a named route out of the admin.
        -->
        <RouterLink
          :to="`/${currentLocale}`"
          class="admin-header__home focus-ring"
          :aria-label="t('admin.backToSite')"
        >
          <BrandLogo
            context="compact"
            kind="logo"
            size="sm"
            :decorative="true"
          />
        </RouterLink>
        <span class="admin-header__badge">{{ t("admin.badge") }}</span>
      </div>

      <!--
        The nav exists only where its link is reachable: the dashboard is the
        guard's protected surface, so on the sign-in and denial pages a
        "Dashboard" link would be a dead affordance. Review des-2 fix.
      -->
      <nav
        v-if="isAdmin"
        class="admin-header__nav"
        :aria-label="t('admin.navLabel')"
      >
        <ul class="admin-header__nav-list">
          <li>
            <RouterLink
              :to="`/${currentLocale}/admin`"
              class="admin-header__nav-link focus-ring"
              :aria-current="isDashboard ? 'page' : undefined"
            >
              {{ t("admin.dashboard") }}
            </RouterLink>
          </li>
          <!--
            T-027/T-046: only destinations the session can use are linked.
            A scoped editor must not see an affordance for a denied area
            (hiding, not disabling). Root carries every capability, so this
            renders all built destinations for a root admin.
          -->
          <li v-if="can('pages:write')">
            <RouterLink
              :to="`/${currentLocale}/admin/pages`"
              class="admin-header__nav-link focus-ring"
              :aria-current="isPages ? 'page' : undefined"
              data-testid="admin-nav-pages"
            >
              {{ t("admin.content.title") }}
            </RouterLink>
          </li>
          <li v-if="can('projects:write')">
            <RouterLink
              :to="`/${currentLocale}/admin/projects`"
              class="admin-header__nav-link focus-ring"
              :aria-current="isProjects ? 'page' : undefined"
              data-testid="admin-nav-projects"
            >
              {{ t("admin.projects.title") }}
            </RouterLink>
          </li>
          <li v-if="can('team:write')">
            <RouterLink
              :to="`/${currentLocale}/admin/team`"
              class="admin-header__nav-link focus-ring"
              :aria-current="isTeam ? 'page' : undefined"
              data-testid="admin-nav-team"
            >
              {{ t("admin.team.title") }}
            </RouterLink>
          </li>
          <li v-if="can('publications:write')">
            <RouterLink
              :to="`/${currentLocale}/admin/publications`"
              class="admin-header__nav-link focus-ring"
              :aria-current="isPublications ? 'page' : undefined"
              data-testid="admin-nav-publications"
            >
              {{ t("admin.publications.title") }}
            </RouterLink>
          </li>
          <li v-if="can('documents:write')">
            <RouterLink
              :to="`/${currentLocale}/admin/documents`"
              class="admin-header__nav-link focus-ring"
              :aria-current="isDocuments ? 'page' : undefined"
              data-testid="admin-nav-documents"
            >
              {{ t("admin.documents.title") }}
            </RouterLink>
          </li>
          <li v-if="can('importer')">
            <RouterLink
              :to="`/${currentLocale}/admin/import`"
              class="admin-header__nav-link focus-ring"
              :aria-current="isImport ? 'page' : undefined"
              data-testid="admin-nav-import"
            >
              {{ t("admin.import.title") }}
            </RouterLink>
          </li>
        </ul>
      </nav>

      <div class="admin-header__controls">
        <!--
          Language control first, then theme — the same control order as the
          public header (controls cluster right edge: language outermost).
          The switcher rewrites only the leading locale segment of the raw
          path, so it is admin-route-safe by construction.
        -->
        <LanguageSwitcher />
        <ThemeToggle />
        <!--
          Sign-out is offered whenever a session exists — including an
          authenticated non-admin sitting on the denial page, whose only
          useful action is leaving the session.
        -->
        <button
          v-if="isAuthenticated"
          type="button"
          class="admin-layout__sign-out focus-ring"
          :aria-busy="signingOut"
          :disabled="signingOut"
          @click="onSignOut"
        >
          {{ t("admin.signOut") }}
        </button>
      </div>
    </header>

    <main id="admin-main" class="admin-layout__main" tabindex="-1">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import BrandLogo from "@/components/brand/BrandLogo.vue";
import LanguageSwitcher from "@/components/LanguageSwitcher.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import { ADMIN_DASHBOARD_NAME } from "@/features/auth/adminGuard";
import { useAuth } from "@/features/auth/authStore";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";

/**
 * T-026 — admin route layout. Pages render via <RouterView /> inside the main
 * landmark; the sign-in page shares this shell so the whole admin surface
 * reads as one room. The guard (features/auth/adminGuard) has already resolved
 * the session state by the time this layout mounts.
 */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { isAuthenticated, isAdmin, can, signOut } = useAuth();

const signingOut = ref(false);

const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

const isDashboard = computed(
  () => String(route.name ?? "") === ADMIN_DASHBOARD_NAME
);

/** True for the T-028 site page editor/preview routes (nav highlight). */
const isPages = computed(() =>
  String(route.name ?? "").startsWith("admin-page")
);

/** True for the T-027 project list/editor/preview routes (nav highlight). */
const isProjects = computed(() =>
  String(route.name ?? "").startsWith("admin-project")
);

/** True for the T-028 team editor (nav highlight). */
const isTeam = computed(() => String(route.name ?? "") === "admin-team");

/** True for the T-029 publication list/editor routes (nav highlight). */
const isPublications = computed(() =>
  String(route.name ?? "").startsWith("admin-publication")
);

/** True for the T-029 document editor (nav highlight). */
const isDocuments = computed(
  () => String(route.name ?? "") === "admin-documents"
);

/** True for the T-041 import surface (nav highlight). */
const isImport = computed(() => String(route.name ?? "") === "admin-import");

/** WCAG 2.4.1 bypass: focus the main landmark explicitly (see PublicLayout). */
function skipToMain(): void {
  const main = document.getElementById("admin-main") as HTMLElement | null;
  if (main) {
    main.focus();
    main.scrollIntoView();
  }
}

/**
 * Sign out, then leave the private surface entirely (ticket: sign-out clears
 * session + private UI and navigates to the public home). The reactive status
 * flips to anonymous first, so admin chrome is gone even mid-navigation.
 */
async function onSignOut(): Promise<void> {
  signingOut.value = true;
  try {
    await signOut();
    await router.push(`/${currentLocale.value}`);
  } finally {
    signingOut.value = false;
  }
}
</script>

<style scoped>
.admin-layout {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

/* ── Skip link (same contract as PublicLayout) ─────────────────────────── */

.admin-layout__skip-link {
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

.admin-layout__skip-link:focus {
  left: 0;
  top: 0;
}

/* ── Header bar ─────────────────────────────────────────────────────────── */

.admin-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.admin-header__brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.admin-header__home {
  display: inline-flex;
  border-radius: 0.25rem;
}

/*
 * The "Admin" badge is a bordered chip with text — the surface identity of
 * the area never depends on color alone (DESIGN_SYSTEM.md §6). Scarlet border
 * + nero text on surface: decorative emphasis only, the text carries meaning.
 */
.admin-header__badge {
  padding: 0.125rem 0.625rem;
  border: 1px solid var(--color-accent);
  border-radius: 999px;
  color: var(--color-text);
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.admin-header__nav {
  flex: 1;
  min-width: 0;
}

.admin-header__nav-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.admin-header__nav-link {
  display: inline-block;
  padding: 0.25rem 0.125rem;
  color: var(--color-text);
  font-weight: 600;
  text-decoration: none;
  border-bottom: 2px solid transparent;
}

.admin-header__nav-link:hover {
  text-decoration: underline;
}

/* aria-current="page" gets a scarlet underline — plus the underline itself
   is a non-color indicator (DESIGN_SYSTEM.md §6). */
.admin-header__nav-link[aria-current="page"] {
  border-bottom-color: var(--color-accent);
}

.admin-header__controls {
  display: flex;
  /*
   * The control cluster must wrap: at 320 px the Ukrainian strings
   * ("Мова" + "Темний режим" + "Вийти") exceed the row width, and a clipped
   * or overflowing control is a WCAG 1.4.10 failure (proven by the admin
   * 320 px E2E case).
   */
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  margin-left: auto;
}

/* ── Sign-out button ────────────────────────────────────────────────────── */

.admin-layout__sign-out {
  padding: 0.375rem 0.875rem;
  border: 1px solid var(--color-form-border);
  border-radius: 0.375rem;
  background: var(--color-form-bg);
  color: var(--color-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.admin-layout__sign-out:hover {
  border-color: var(--color-accent);
}

.admin-layout__sign-out:disabled {
  color: var(--color-disabled-text);
  cursor: wait;
}

/* ── Main content ───────────────────────────────────────────────────────── */

.admin-layout__main {
  flex: 1;
  outline: none;
  width: 100%;
  max-width: 60rem;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
}

/* ── Narrow viewports / 200% zoom (DESIGN_SYSTEM.md §6) ─────────────────── */

@media (max-width: 480px) {
  .admin-header {
    padding: 0.75rem 1rem;
  }

  .admin-layout__main {
    padding: 1.5rem 1rem 3rem;
  }

  /* Controls drop below the nav row instead of squeezing the badge. */
  .admin-header__controls {
    margin-left: 0;
  }
}
</style>
