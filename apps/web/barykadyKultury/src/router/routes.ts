import type { RouteRecordRaw } from "vue-router";

import { LOCALE_ROUTE_PATTERN } from "@/features/i18n/locales";
import { resolveInitialLocale } from "@/features/i18n/resolveInitialLocale";
import HomePage from "@/pages/[locale]/index.vue";
import NotFoundPage from "@/pages/404.vue";
import ProjectsPage from "@/pages/[locale]/projects.vue";

/**
 * Application route table.
 *
 * Explicit and typed rather than filename-derived, because the locale contract
 * is a product requirement, not a file-layout accident:
 *
 * - the locale segment is a **constrained param** (`:locale(en|pl|uk)`), so an
 *   unknown segment never matches a real page and falls through to the 404
 *   route — no redirect loop, no silent fallback
 *   (docs/PRODUCT_REQUIREMENTS.md §2, T-009 acceptance criteria);
 * - the root redirects to the resolved locale via a `redirect` function, which
 *   keeps the "saved → browser → English" precedence (docs/architecture.md §8)
 *   out of the guard and testable through {@link resolveInitialLocale};
 * - every locale URL is authoritative: the route never consults browser
 *   settings, only the guard mirrors the locale onto the document.
 */
const localeSegment = `:locale(${LOCALE_ROUTE_PATTERN})`;

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "root",
    redirect: () => ({ path: `/${resolveInitialLocale()}` })
  },
  {
    path: `/${localeSegment}`,
    name: "home",
    component: HomePage
  },
  {
    path: `/${localeSegment}/projects`,
    name: "projects",
    component: ProjectsPage
  },
  {
    path: `/${localeSegment}/:pathMatch(.*)*`,
    name: "locale-not-found",
    component: NotFoundPage
  },
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    component: NotFoundPage
  }
];
