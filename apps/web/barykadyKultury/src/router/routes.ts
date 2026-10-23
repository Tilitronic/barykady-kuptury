import type { RouteRecordRaw } from "vue-router";

import type { AdminScope } from "@/features/auth/adminClaim";
import { LOCALE_ROUTE_PATTERN } from "@/features/i18n/locales";
import type { LocalePageMeta } from "@/features/i18n/pageMeta";
import { resolveInitialLocale } from "@/features/i18n/resolveInitialLocale";

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
    /**
     * T-026 — the route renders admin-only content and requires the canonical
     * admin claim (`app_metadata.role === "admin"`, D-17). Read exclusively by
     * `createAdminGuard`; it is a UX gate, never authorization
     * (docs/PRODUCT_REQUIREMENTS.md §6 — RLS enforces independently).
     */
    requiresAdmin?: boolean;
    /**
     * T-046 — the exact capability required for this route (D-42). Read by
     * `createAdminGuard`; a satisfied `requiresAdmin`/root session still fails
     * this gate when the scope is absent. Root carries the whole vocabulary in
     * the client mirror. UX gating only — RLS and RPC re-checks enforce.
     */
    requiresCapability?: AdminScope;
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

/**
 * T-044 F1: every route component is a lazy loader.
 *
 * WHY: the app previously emitted one ~557 KB entry chunk containing the
 * public site, the admin subtree and every page. Route-level splitting keeps
 * the first paint to the current page and moves admin/reader/search code into
 * separate chunks. Keep `component` values as functions; a static import here
 * silently re-merges code into the entry chunk (guarded by routes.test.ts).
 */
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
    component: () => import("@/layouts/PublicLayout.vue"),
    children: [
      // Home
      {
        path: "",
        name: "home",
        component: () => import("@/pages/[locale]/index.vue"),
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
        component: () => import("@/pages/[locale]/contact.vue"),
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
        component: () => import("@/pages/[locale]/about.vue"),
        meta: {
          pageMeta: {
            titleKey: "about.title",
            descriptionKey: "about.description"
          }
        }
      },
      // About → Team / Documents: the list routes are GONE (T-039, D-25) —
      // both redirect to the consolidated About page's anchored section,
      // preserving the locale. Unnamed redirect records: `routeMeta.test.ts`
      // skips records with `redirect`, so no pageMeta is required (the
      // destination owns the document metadata).
      {
        path: "about/team",
        redirect: to => ({
          // The record is a child of the locale parent, so `locale` is
          // always present at runtime; the cast only feeds the union type.
          path: `/${String((to.params as Record<string, unknown>).locale)}/about`,
          hash: "#team"
        })
      },
      {
        path: "about/documents",
        redirect: to => ({
          path: `/${String((to.params as Record<string, unknown>).locale)}/about`,
          hash: "#documents"
        })
      },
      // About → Documents → in-app regulation reader (T-017, D-12).
      // Canonical root slug (D-24): one slug is shared by every locale, so a
      // language switch is a pure prefix swap. The reader resolves the
      // published row by slug regardless of which translations exist, then
      // renders the requested locale or English with the D-12 fallback note;
      // unknown and draft slugs still 404.
      {
        path: "about/documents/:slug",
        name: "about-document",
        component: () => import("@/pages/[locale]/about-document.vue"),
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
        component: () => import("@/pages/[locale]/support.vue"),
        meta: {
          pageMeta: {
            titleKey: "support.title",
            descriptionKey: "support.description"
          }
        }
      },
      // Projects (T-019 real content)
      {
        path: "projects",
        name: "projects",
        component: () => import("@/pages/[locale]/projects.vue"),
        meta: {
          pageMeta: {
            titleKey: "projects.title",
            descriptionKey: "projects.description"
          }
        }
      },
      // Projects → detail (T-019, D-24). One canonical slug is shared by every
      // locale; language switching only swaps the prefix. Resolution is strict:
      // the row must be published and have a translation for the requested
      // locale, otherwise the page renders 404 content in-page — never a
      // cross-locale match.
      {
        path: "projects/:slug",
        name: "project-detail",
        component: () => import("@/pages/[locale]/project-detail.vue"),
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
        component: () => import("@/pages/[locale]/events.vue"),
        meta: {
          pageMeta: {
            titleKey: "events.title",
            descriptionKey: "events.description"
          }
        }
      },
      // Publications (T-020 real content)
      {
        path: "publications",
        name: "publications",
        component: () => import("@/pages/[locale]/publications.vue"),
        meta: {
          pageMeta: {
            titleKey: "publications.title",
            descriptionKey: "publications.description"
          }
        }
      },
      // Publications → detail (T-020, D-24). One canonical slug is shared by
      // every locale; language switching only swaps the prefix. Resolution is
      // strict: the row must be published and have a translation for the
      // requested locale, otherwise the page renders 404 content in-page —
      // never a cross-locale match.
      {
        path: "publications/:slug",
        name: "publication-detail",
        component: () => import("@/pages/[locale]/publication-detail.vue"),
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
        component: () => import("@/pages/[locale]/not-found.vue"),
        meta: {
          pageMeta: {
            titleKey: "notFound.title",
            descriptionKey: "notFound.description"
          }
        }
      }
    ]
  },

  // ── Admin shell (T-026) ───────────────────────────────────────────────────
  // Its own layout — PublicLayout's marketing header/footer must not leak into
  // the operational surface, and vice versa. The static `admin` segment
  // out-scores the locale layout's catch-all child, so `/en/admin/...` can
  // never be swallowed by the public 404. Guard policy lives in
  // `src/features/auth/adminGuard.ts`; these records only declare the shape.
  {
    path: `/${localeSegment}/admin`,
    component: () => import("@/layouts/AdminLayout.vue"),
    children: [
      // Sign-in: reachable for anonymous and non-admins (switch-account
      // path); admins are bounced to the dashboard by the guard.
      {
        path: "sign-in",
        name: "admin-sign-in",
        component: () => import("@/pages/admin/AdminSignInPage.vue"),
        meta: {
          pageMeta: {
            titleKey: "admin.signIn.title",
            descriptionKey: "admin.signIn.description"
          }
        }
      },
      // Terminal state for authenticated non-admins — no redirect loop.
      {
        path: "access-denied",
        name: "admin-denied",
        component: () => import("@/pages/admin/AdminDeniedPage.vue"),
        meta: {
          pageMeta: {
            titleKey: "admin.denied.title",
            descriptionKey: "admin.denied.description"
          }
        }
      },
      // The only protected route so far; feature panels (T-027…T-031) join
      // this children list and inherit the guard through `requiresAdmin`.
      {
        path: "",
        name: "admin-dashboard",
        component: () => import("@/pages/admin/AdminDashboardPage.vue"),
        meta: {
          requiresAdmin: true,
          pageMeta: {
            titleKey: "admin.dashboardPage.title",
            descriptionKey: "admin.dashboardPage.description"
          }
        }
      },
      {
        path: "import",
        name: "admin-import",
        component: () => import("@/pages/admin/AdminImportPage.vue"),
        meta: {
          requiresAdmin: true,
          requiresCapability: "importer",
          pageMeta: {
            titleKey: "admin.import.title",
            descriptionKey: "admin.import.description"
          }
        }
      },
      // ── T-027 project management ──────────────────────────────────────────
      // `projects/new` precedes `projects/:id` so the static segment is
      // unambiguous; `:id/preview` renders the public detail component behind
      // the admin guard, so a draft can be reviewed without being reachable
      // publicly (docs/PRODUCT_REQUIREMENTS.md §6).
      {
        path: "projects",
        name: "admin-projects",
        component: () => import("@/pages/admin/AdminProjectsPage.vue"),
        meta: {
          requiresAdmin: true,
          requiresCapability: "projects:write",
          pageMeta: {
            titleKey: "admin.projects.title",
            descriptionKey: "admin.projects.description"
          }
        }
      },
      {
        path: "projects/new",
        name: "admin-project-new",
        component: () => import("@/pages/admin/AdminProjectEditPage.vue"),
        meta: {
          requiresAdmin: true,
          requiresCapability: "projects:write",
          pageMeta: {
            titleKey: "admin.projects.title",
            descriptionKey: "admin.projects.description"
          }
        }
      },
      {
        path: "projects/:id",
        name: "admin-project-edit",
        component: () => import("@/pages/admin/AdminProjectEditPage.vue"),
        meta: {
          requiresAdmin: true,
          requiresCapability: "projects:write",
          pageMeta: {
            titleKey: "admin.projects.title",
            descriptionKey: "admin.projects.description"
          }
        }
      },
      {
        path: "projects/:id/preview",
        name: "admin-project-preview",
        component: () => import("@/pages/admin/AdminProjectPreviewPage.vue"),
        meta: {
          requiresAdmin: true,
          requiresCapability: "projects:write",
          pageMeta: {
            titleKey: "admin.projects.preview.title",
            descriptionKey: "admin.projects.preview.description"
          }
        }
      },
      // ── T-028 site pages & team ──────────────────────────────────────────
      // `pages:write` / `team:write` are the fixed D-42 scopes from
      // docs/architecture.md §6.1. The preview route sits before the editor
      // list so `pages/:pageKey/preview` can never be read as a page key.
      {
        path: "pages/:pageKey/preview",
        name: "admin-page-preview",
        component: () => import("@/pages/admin/AdminSitePagePreviewPage.vue"),
        meta: {
          requiresAdmin: true,
          requiresCapability: "pages:write",
          pageMeta: {
            titleKey: "admin.content.preview.title",
            descriptionKey: "admin.content.preview.description"
          }
        }
      },
      {
        path: "pages",
        name: "admin-pages",
        component: () => import("@/pages/admin/AdminSitePagesPage.vue"),
        meta: {
          requiresAdmin: true,
          requiresCapability: "pages:write",
          pageMeta: {
            titleKey: "admin.content.title",
            descriptionKey: "admin.content.description"
          }
        }
      },
      {
        path: "team",
        name: "admin-team",
        component: () => import("@/pages/admin/AdminTeamPage.vue"),
        meta: {
          requiresAdmin: true,
          requiresCapability: "team:write",
          pageMeta: {
            titleKey: "admin.team.title",
            descriptionKey: "admin.team.description"
          }
        }
      },
      // ── T-029 publications & documents ───────────────────────────────────
      // `publications/new` precedes `publications/:id` so the static segment
      // is unambiguous. The URL xor file invariant and file uploads live in
      // these pages; the RPC re-checks `publications:write` at the boundary.
      {
        path: "publications",
        name: "admin-publications",
        component: () => import("@/pages/admin/AdminPublicationsPage.vue"),
        meta: {
          requiresAdmin: true,
          requiresCapability: "publications:write",
          pageMeta: {
            titleKey: "admin.publications.title",
            descriptionKey: "admin.publications.description"
          }
        }
      },
      {
        path: "publications/new",
        name: "admin-publication-new",
        component: () => import("@/pages/admin/AdminPublicationEditPage.vue"),
        meta: {
          requiresAdmin: true,
          requiresCapability: "publications:write",
          pageMeta: {
            titleKey: "admin.publications.title",
            descriptionKey: "admin.publications.description"
          }
        }
      },
      {
        path: "publications/:id",
        name: "admin-publication-edit",
        component: () => import("@/pages/admin/AdminPublicationEditPage.vue"),
        meta: {
          requiresAdmin: true,
          requiresCapability: "publications:write",
          pageMeta: {
            titleKey: "admin.publications.title",
            descriptionKey: "admin.publications.description"
          }
        }
      },
      {
        path: "documents",
        name: "admin-documents",
        component: () => import("@/pages/admin/AdminDocumentsPage.vue"),
        meta: {
          requiresAdmin: true,
          requiresCapability: "documents:write",
          pageMeta: {
            titleKey: "admin.documents.title",
            descriptionKey: "admin.documents.description"
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
    component: () => import("@/pages/404.vue"),
    meta: {
      pageMeta: {
        titleKey: "notFound.title",
        descriptionKey: "notFound.description"
      }
    }
  }
];
