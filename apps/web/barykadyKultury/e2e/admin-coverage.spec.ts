import { expect, type Page } from "@playwright/test";

import { checkA11y } from "./support/a11y";
import {
  ADMIN_AUTH_USER,
  mockSupabaseAuth,
  mockSupabaseRest,
  type E2EAuthUser
} from "./support/mocks";
import { test } from "./support/network-guard";

/**
 * T-031 — translation-coverage dashboard journeys.
 *
 * The matrix is read-only and must be usable by any admin-area session, not
 * only root. The fixture deliberately covers all three states in one entity,
 * so a wrong count or a colour-only indicator fails the test
 * (docs/DESIGN_SYSTEM.md §6; docs/PRODUCT_REQUIREMENTS.md §6).
 */

const FIXED = "2026-06-01T12:00:00.000Z";

function coverageTables() {
  return {
    site_pages: [
      {
        id: "page-about",
        page_key: "about",
        status: "published",
        sort_order: 0,
        updated_at: FIXED,
        site_page_translations: [
          {
            locale: "en",
            title: "About us",
            body: "Body",
            needs_review: false
          },
          // Complete Polish metadata but no body: not a usable published page.
          { locale: "pl", title: "O nas", body: null, needs_review: false },
          { locale: "uk", title: "Про нас", body: "Текст", needs_review: true }
        ]
      }
    ],
    projects: [
      {
        id: "project-1",
        slug: "sample-project",
        status: "published",
        updated_at: FIXED,
        project_translations: [
          {
            locale: "en",
            title: "Sample Project",
            summary: "Summary",
            body: "Body",
            needs_review: false
          }
        ]
      }
    ],
    team_members: [
      {
        id: "member-1",
        name: "Sample Member",
        status: "published",
        sort_order: 0,
        updated_at: FIXED,
        team_member_translations: [
          { locale: "en", role: null, bio: null, needs_review: false }
        ]
      }
    ],
    publications: [
      {
        id: "publication-1",
        status: "published",
        sort_order: 0,
        updated_at: FIXED,
        publication_translations: [
          { locale: "en", slug: "report", title: "Report", needs_review: false }
        ]
      }
    ],
    organization_documents: [
      {
        id: "document-1",
        status: "published",
        sort_order: 0,
        updated_at: FIXED,
        organization_document_translations: [
          { locale: "uk", slug: "statut", title: "Статут", needs_review: false }
        ]
      }
    ]
  };
}

/** T-046 fixture: an events editor has no coverage capability — by design. */
const EVENTS_EDITOR: E2EAuthUser = {
  ...ADMIN_AUTH_USER,
  id: "00000000-0000-4000-8000-000000000005",
  email: "events@demo.local",
  app_metadata: {
    provider: "email",
    providers: ["email"],
    role: "editor",
    scopes: ["events:write"]
  },
  user_metadata: { email: "events@demo.local" }
};

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/en/admin/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("e2e-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Dashboard" })
  ).toBeVisible();
}

test.describe("admin coverage", () => {
  test("shows every entity and locale, lists a missing locale and flags needsReview", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await mockSupabaseRest(page, { responses: coverageTables() });

    await signIn(page, "admin@demo.local");
    await page.goto("/en/admin/coverage");

    await expect(
      page.getByRole("heading", { level: 1, name: "Translation coverage" })
    ).toBeVisible();

    // Summary matrix: one page exists; its Polish translation is incomplete.
    await expect(page.getByTestId("coverage-summary-pages-pl")).toHaveText(
      "0 published · 1 missing · 0 needs review"
    );

    // Detail matrix: explicit text states, not colour-only flags.
    await expect(
      page.getByTestId("coverage-state-pages-page-about-pl")
    ).toHaveText("Missing");
    await expect(
      page.getByTestId("coverage-state-pages-page-about-uk")
    ).toHaveText("Needs review");
    await expect(
      page.getByTestId("coverage-state-pages-page-about-en")
    ).toHaveText("Published");

    // All five entity tables render, including the document that exists only
    // in Ukrainian.
    for (const entity of [
      "pages",
      "projects",
      "team",
      "publications",
      "documents"
    ]) {
      await expect(page.getByTestId(`coverage-table-${entity}`)).toBeVisible();
    }
    await expect(
      page.getByTestId("coverage-state-documents-document-1-uk")
    ).toHaveText("Published");
    await expect(
      page.getByTestId("coverage-state-documents-document-1-en")
    ).toHaveText("Missing");

    await checkA11y(page);
  });

  test("is reachable by a scoped editor without any write capability", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: EVENTS_EDITOR });
    await mockSupabaseRest(page, { responses: coverageTables() });

    await signIn(page, "events@demo.local");

    // Event mapping is in scope; coverage has no capability gate at all.
    await expect(page.getByTestId("admin-nav-events")).toBeVisible();
    await page.getByTestId("admin-nav-coverage").click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Translation coverage" })
    ).toBeVisible();

    // The write-scoped routes remain hidden/denied — coverage access must not
    // have widened the session's capabilities.
    await page.goto("/en/admin/projects");
    await expect(page).toHaveURL(/\/en\/admin\/access-denied/);
  });
});
