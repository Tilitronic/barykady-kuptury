import type { RouteRecordRaw } from "vue-router";

import { LOCALE_ROUTE_PATTERN } from "@/features/i18n/locales";
import type { LocalePageMeta } from "@/features/i18n/pageMeta";
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
import AboutDocumentPage from "@/pages/[locale]/about-document.vue";
import SupportPage from "@/pages/[locale]/support.vue";
import EventsPage from "@/pages/[locale]/events.vue";
import PublicationsPage from "@/pages/[locale]/publications.vue";

declare module "vue-router" {
  interface RouteMeta {
    /**
     * Localized document metadata for this route (T-011 follow-up defect).
     *
     * The route table is the single source of truth for page metadata; the
     * navigation guard reads `to.meta.pageMeta` instead of a hand-maintained
     * path map, so a route cannot drift out of sync. `routeMeta.test.ts` fails
     * if a real page route is missing it or resolves to the not-found keys.
     */
    pageMeta?: LocalePageMeta;
  }
}

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
        component: HomePage,
        meta: {
          pageMeta: {
            titleKey: "home.title",
            descriptionKey: "home.description"
          }
        }
      },
      // Contact (D-04 OPEN: page exists, content hidden until data supplied)
      {
        path: "contact",
        name: "contact",
        component: ContactPage,
        meta: {
          pageMeta: {
            titleKey: "contact.title",
            descriptionKey: "contact.description"
          }
        }
      },
      // About landing
      {
        path: "about",
        name: "about",
        component: AboutPage,
        meta: {
          pageMeta: {
            titleKey: "about.title",
            descriptionKey: "about.description"
          }
        }
      },
      // About → Team
      {
        path: "about/team",
        name: "about-team",
        component: AboutTeamPage,
        meta: {
          pageMeta: {
            titleKey: "aboutTeam.title",
            descriptionKey: "aboutTeam.description"
          }
        }
      },
      // About → Documents
      {
        path: "about/documents",
        name: "about-documents",
        component: AboutDocumentsPage,
        meta: {
          pageMeta: {
            titleKey: "aboutDocuments.title",
            descriptionKey: "aboutDocuments.description"
          }
        }
      },
      // About → Documents → in-app regulation reader (T-017, D-12).
      // The slug is locale-specific (regulamin/regulations/rehlament); the
      // reader keeps it stable while switching the content language in place.
      {
        path: "about/documents/:slug",
        name: "about-document",
        component: AboutDocumentPage,
        meta: {
          pageMeta: {
            titleKey: "aboutDocuments.title",
            descriptionKey: "aboutDocuments.description"
          }
        }
      },
      // Support us (D-06 OPEN: page exists, options shown when configured)
      {
        path: "support",
        name: "support",
        component: SupportPage,
        meta: {
          pageMeta: {
            titleKey: "support.title",
            descriptionKey: "support.description"
          }
        }
      },
      // Projects (T-016 owns real content)
      {
        path: "projects",
        name: "projects",
        component: ProjectsPage,
        meta: {
          pageMeta: {
            titleKey: "projects.title",
            descriptionKey: "projects.description"
          }
        }
      },
      // Events (T-023/T-024 own real content)
      {
        path: "events",
        name: "events",
        component: EventsPage,
        meta: {
          pageMeta: {
            titleKey: "events.title",
            descriptionKey: "events.description"
          }
        }
      },
      // Publications (T-018/T-019 own real content)
      {
        path: "publications",
        name: "publications",
        component: PublicationsPage,
        meta: {
          pageMeta: {
            titleKey: "publications.title",
            descriptionKey: "publications.description"
          }
        }
      },
      // Locale-prefixed catch-all — unknown sub-paths within a valid locale.
      // Does NOT redirect so the URL is preserved (T-009 acceptance criteria).
      {
        path: ":pathMatch(.*)*",
        name: "locale-not-found",
        component: LocaleNotFoundPage,
        meta: {
          pageMeta: {
            titleKey: "notFound.title",
            descriptionKey: "notFound.description"
          }
        }
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
    component: NotFoundPage,
    meta: {
      pageMeta: {
        titleKey: "notFound.title",
        descriptionKey: "notFound.description"
      }
    }
  }
];
