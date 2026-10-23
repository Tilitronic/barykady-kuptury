import { expect, type Page } from "@playwright/test";

import {
  ADMIN_AUTH_USER,
  mockCalendarEvents,
  mockSupabaseAuth,
  mockSupabaseRest
} from "./support/mocks";
import { test } from "./support/network-guard";
import {
  createProjectStore,
  mockProjectApi,
  type ProjectStoreRow,
  type ProjectTranslationRow
} from "./support/project-store";

/**
 * T-030 — featured ordering journeys (ticket TDD plan step 3).
 *
 * Proves the two acceptance criteria that need a browser:
 *   - two projects featured in a chosen order appear on the homepage in that
 *     exact order (including a move performed with the keyboard);
 *   - removing every featured project restores the recent-published fallback.
 *
 * The store is in-memory and deterministic (`mockProjectApi`), so the admin and
 * anonymous pages share the same state and no live Supabase project is touched
 * (docs/TESTING.md §2).
 */

const ALPHA = "E2E Alpha Project (fictional)";
const BETA = "E2E Beta Project (fictional)";
const GAMMA = "E2E Gamma Project (fictional)";

const ALPHA_ID = "e2e00000-0000-4000-8000-000000000301";
const BETA_ID = "e2e00000-0000-4000-8000-000000000302";
const GAMMA_ID = "e2e00000-0000-4000-8000-000000000303";

function project(id: string, slug: string, updatedAt: string): ProjectStoreRow {
  return {
    id,
    slug,
    status: "published",
    featured_rank: null,
    cover_path: null,
    start_date: null,
    end_date: null,
    published_at: "2026-01-01T00:00:00.000Z",
    created_at: updatedAt,
    updated_at: updatedAt
  };
}

function translation(
  id: string,
  projectId: string,
  title: string
): ProjectTranslationRow {
  return {
    id,
    project_id: projectId,
    locale: "en",
    title,
    summary: `${title} summary.`,
    body: `${title} body.`
  };
}

function seedStore() {
  return createProjectStore({
    projects: [
      project(ALPHA_ID, "e2e-alpha", "2026-01-01T00:00:00.000Z"),
      project(BETA_ID, "e2e-beta", "2026-02-01T00:00:00.000Z"),
      project(GAMMA_ID, "e2e-gamma", "2026-03-01T00:00:00.000Z")
    ],
    translations: [
      translation("e2e00000-0000-4000-8000-000000000311", ALPHA_ID, ALPHA),
      translation("e2e00000-0000-4000-8000-000000000312", BETA_ID, BETA),
      translation("e2e00000-0000-4000-8000-000000000313", GAMMA_ID, GAMMA)
    ]
  });
}

async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto("/en/admin/sign-in");
  await page.getByLabel("Email").fill("admin@demo.local");
  await page.getByLabel("Password").fill("e2e-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Dashboard" })
  ).toBeVisible();
}

/** Installs every external seam the homepage and admin routes need. */
async function mockAll(page: Page, store: ReturnType<typeof seedStore>) {
  await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
  await mockCalendarEvents(page);
  // Read-only fallback for tables the project mock does not own (site_pages).
  // Registered first so the later, stateful project handler wins for projects.
  await mockSupabaseRest(page, {
    responses: { site_pages: [], calendar_event_links: [] }
  });
  await mockProjectApi(page, store);
}

test.describe("admin featured ordering", () => {
  test("featured order is honoured on the homepage; unfeaturing all restores recent fallback", async ({
    page
  }) => {
    const store = seedStore();
    await mockAll(page, store);

    await signInAsAdmin(page);
    await page.goto("/en/admin/featured");
    await expect(
      page.getByRole("heading", { level: 1, name: "Featured projects" })
    ).toBeVisible();

    // ── Feature two projects in a chosen order ────────────────────────────
    await page.getByTestId(`featured-add-${BETA_ID}`).click();
    await expect(page.getByTestId("featured-status-message")).toHaveText(
      "Project added to the homepage order."
    );

    await page.getByTestId(`featured-add-${ALPHA_ID}`).click();
    await expect(page.getByTestId("featured-status-message")).toHaveText(
      "Project added to the homepage order."
    );

    // Beta was added first, so it starts at position 1; alpha is second.
    const items = page.getByTestId("featured-list").locator("li");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText(BETA);
    await expect(items.nth(1)).toContainText(ALPHA);

    // ── Keyboard reorder: focus + Enter, never drag ───────────────────────
    await page.getByTestId(`featured-up-${ALPHA_ID}`).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("featured-status-message")).toHaveText(
      "Homepage order saved."
    );
    await expect(items.nth(0)).toContainText(ALPHA);
    await expect(items.nth(1)).toContainText(BETA);

    // ── Homepage reflects the admin order exactly ─────────────────────────
    await page.goto("/en");
    const cards = page.locator(".project-card");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText(ALPHA);
    await expect(cards.nth(1)).toContainText(BETA);

    // ── Unfeature both → recent published fallback ────────────────────────
    await page.goto("/en/admin/featured");
    await page.getByTestId(`featured-remove-${ALPHA_ID}`).click();
    await expect(page.getByTestId("featured-status-message")).toHaveText(
      "Project removed from the homepage order."
    );
    await page.getByTestId(`featured-remove-${BETA_ID}`).click();
    await expect(page.getByTestId("featured-empty")).toBeVisible();

    await page.goto("/en");
    await expect(cards).toHaveCount(3);
    // Newest updated first: gamma (March), beta (February), alpha (January).
    await expect(cards.nth(0)).toContainText(GAMMA);
    await expect(cards.nth(1)).toContainText(BETA);
    await expect(cards.nth(2)).toContainText(ALPHA);
  });
});
