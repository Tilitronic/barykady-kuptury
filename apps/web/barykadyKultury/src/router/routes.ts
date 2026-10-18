import type { RouteRecordRaw } from "vue-router";

import { LOCALE_ROUTE_PATTERN } from "@/features/i18n/locales";
import { resolveInitialLocale } from "@/features/i18n/resolveInitialLocale";

import PublicLayout from "@/layouts/PublicLayout.vue";
import HomePage from "@/pages/[locale]/index.vue";
import NotFoundPage from "@/pages/404.vue";
import LocaleNotFoundPage from "@/pages/[locale]/not-found.vue";
import ProjectsPage from "@/pages/[locale]/projects.vue";
import ContactPage from "@/pages/[locale]/contact.vue";
import AboutPage from "@/pages/[locale]/about.vue";
import AboutTeamPage from "@/pages/[locale]/about-team.vue";
import AboutDocumentsPage from "@/pages/[locale]/about-documents.vue";
import SupportPage from "@/pages/[locale]/support.vue";
import EventsPage from "@/pages/[locale]/events.vue";
import PublicationsPage from "@/pages/[locale]/publications.vue";

/**
 * Application route table.
 *
 * Route layout (T-011 refactor):
 *   - All locale-prefixed routes are **children** of a `PublicLayout` parent.
 *     The layout provides the skip link, header, main and footer landmarks so
 *     pages only need to supply their own content (no AppShell in pages).
 *   - The global catch-all (`/:pathMatch(.*)*`) renders the legacy NotFoundPage
 *     which uses AppShell directly — this handles `/xx` (unknown locale prefix)
 *     without a redirect loop (T-009) and without double-wrapping.
 *
 * Explicit and typed rather than filename-derived — the locale contract is a
 * product requirement (docs/PRODUCT_REQUIREMENTS.md §2, T-009 acceptance criteria):
 *   - `:locale(en|pl|uk)` rejects unknown segments before reaching a page.
 *   - Root redirect uses `resolveInitialLocale` so saved → browser → English
 *     precedence is testable in isolation (docs/architecture.md §8).
 */
const localeSegment = `:locale(${LOCALE_ROUTE_PATTERN})`;

export const routes: RouteRecordRaw[] = [
  // ── Root redirect ─────────────────────────────────────────────────────────
  {
    path: "/",
    name: "root",
    redirect: () => ({ path: `/${resolveInitialLocale()}` })
  },

  // ── Locale layout wrapper ─────────────────────────────────────────────────
  // All public pages live here so they share the header/footer shell without
  // each page importing AppShell.
  {
    path: `/${localeSegment}`,
    component: PublicLayout,
    children: [
      // Home
      {
        path: "",
        name: "home",
        component: HomePage
      },
      // Contact (D-04 OPEN: page exists, content hidden until data supplied)
      {
        path: "contact",
        name: "contact",
        component: ContactPage
      },
      // About landing
      {
        path: "about",
        name: "about",
        component: AboutPage
      },
      // About → Team
      {
        path: "about/team",
        name: "about-team",
        component: AboutTeamPage
      },
      // About → Documents
      {
        path: "about/documents",
        name: "about-documents",
        component: AboutDocumentsPage
      },
      // Support us (D-06 OPEN: page exists, options shown when configured)
      {
        path: "support",
        name: "support",
        component: SupportPage
      },
      // Projects (T-016 owns real content)
      {
        path: "projects",
        name: "projects",
        component: ProjectsPage
      },
      // Events (T-023/T-024 own real content)
      {
        path: "events",
        name: "events",
        component: EventsPage
      },
      // Publications (T-018/T-019 own real content)
      {
        path: "publications",
        name: "publications",
        component: PublicationsPage
      },
      // Locale-prefixed catch-all — unknown sub-paths within a valid locale.
      // Does NOT redirect so the URL is preserved (T-009 acceptance criteria).
      {
        path: ":pathMatch(.*)*",
        name: "locale-not-found",
        component: LocaleNotFoundPage
      }
    ]
  },

  // ── Global catch-all ──────────────────────────────────────────────────────
  // Handles invalid locale prefixes (e.g. /xx) and any other unmatched paths.
  // Uses NotFoundPage directly with AppShell (the locale layout is not applicable
  // here since there is no valid locale segment in the URL).
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    component: NotFoundPage
  }
];
