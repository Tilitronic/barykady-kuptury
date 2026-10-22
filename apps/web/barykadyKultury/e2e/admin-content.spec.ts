import { expect, type Page } from "@playwright/test";

import {
  createContentStore,
  mockContentApi,
  type ContentStore
} from "./support/content-store";
import {
  ADMIN_AUTH_USER,
  mockSupabaseAuth,
  mockSupabaseRest
} from "./support/mocks";
import { test } from "./support/network-guard";

/**
 * T-028 — admin site pages & team journeys (ticket TDD plan step 4).
 *
 * The in-memory `content-store` implements the PostgREST/RPC slice the admin
 * modules use, shared with an anonymous context, so "edit/publish → public
 * About reflects it" and "unpublish → hidden" are proven end to end without a
 * live Supabase project (docs/TESTING.md §2).
 */

const ABOUT_ID = "00000000-0000-4000-8000-000000000101";
const ABOUT_TITLE = "About us";
const ABOUT_BODY = "## Mission\n\nSeed mission text for E2E.";

function seedAbout(status: "draft" | "published" = "published"): ContentStore {
  return createContentStore({
    sitePages: [
      {
        id: ABOUT_ID,
        page_key: "about",
        status,
        sort_order: 1,
        published_at: status === "published" ? "2026-01-05T12:00:00Z" : null,
        created_at: "2026-01-05T12:00:00Z",
        updated_at: "2026-01-05T12:00:00Z"
      }
    ],
    sitePageTranslations: [
      {
        id: "00000000-0000-4000-8000-000000000102",
        page_id: ABOUT_ID,
        locale: "en",
        title: ABOUT_TITLE,
        body: ABOUT_BODY,
        meta_description: "About the association.",
        needs_review: false
      },
      {
        id: "00000000-0000-4000-8000-000000000103",
        page_id: ABOUT_ID,
        locale: "pl",
        title: "O nas",
        // Deliberately incomplete: the admin indicator must say "Missing: Body".
        body: null,
        meta_description: null,
        needs_review: true
      },
      {
        id: "00000000-0000-4000-8000-000000000104",
        page_id: ABOUT_ID,
        locale: "uk",
        title: "Про нас",
        body: null,
        meta_description: null,
        needs_review: true
      }
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

async function installApi(page: Page, store: ContentStore): Promise<void> {
  // Catch-all empty REST fixtures first; the content routes registered later
  // win for their tables/RPCs (Playwright's reverse registration order).
  await mockSupabaseRest(page);
  await mockContentApi(page, store);
}

test.describe("admin content", () => {
  test("edit mission text → publish → public About updates; unpublish hides it", async ({
    page,
    browser
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    const store = seedAbout("draft");
    await installApi(page, store);

    await signInAsAdmin(page);
    await page.goto("/en/admin/pages");

    await expect(
      page.getByRole("heading", { level: 1, name: "Site pages" })
    ).toBeVisible();

    await page.getByTestId("site-page-title").fill("About us — updated");
    await page
      .getByTestId("site-page-body")
      .fill("## Mission\n\nUpdated mission text for E2E.");
    await page.getByTestId("site-page-save").click();
    await expect(page.getByTestId("site-page-status-message")).toHaveText(
      "Page saved."
    );

    await page.getByTestId("site-page-publish").click();
    await expect(page.getByTestId("site-page-status-message")).toHaveText(
      "Published. The page is now public."
    );

    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await installApi(anonPage, store);

    await anonPage.goto("/en/about");
    await expect(
      anonPage.getByRole("heading", { level: 1, name: "About us — updated" })
    ).toBeVisible();
    await expect(
      anonPage.getByText("Updated mission text for E2E.")
    ).toBeVisible();

    // ── Unpublish ─────────────────────────────────────────────────────────
    await page.getByTestId("site-page-unpublish").click();
    await expect(page.getByTestId("site-page-status-message")).toHaveText(
      "Unpublished. The page is no longer public."
    );

    await anonPage.goto("/en/about");
    await expect(
      anonPage.getByText("Updated mission text for E2E.")
    ).toHaveCount(0);

    await anonContext.close();
  });

  test("editing one locale preserves the others, and publish needs a complete English fallback", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    const store = seedAbout("draft");
    await installApi(page, store);

    await signInAsAdmin(page);
    await page.goto("/en/admin/pages");

    // Missing-translation indicator (T-027 shared formatter) on the PL tab.
    await expect(page.getByTestId("site-page-tab-pl")).toContainText(
      "Missing: Body"
    );

    // Edit Polish only, then return to English: the English draft must be
    // intact (cross-locale data loss is the review-gate blocker).
    await page.getByTestId("site-page-tab-pl").click();
    await page.getByTestId("site-page-title").fill("O nas — zaktualizowane");
    await page.getByTestId("site-page-tab-en").click();
    await expect(page.getByTestId("site-page-title")).toHaveValue(ABOUT_TITLE);

    // Publishing a draft without a complete English fallback is refused with a
    // localized reason, and nothing is written.
    await page.getByTestId("site-page-title").fill("");
    await page.getByTestId("site-page-body").fill("");
    await page.getByTestId("site-page-publish").click();

    await expect(page.getByTestId("site-page-status-message")).toHaveText(
      "Add an English title and body before publishing."
    );
    await expect(page.getByTestId("site-page-title")).toBeFocused();
    expect(store.sitePages[0]?.status).toBe("draft");
  });

  test("add members → appear publicly; reorder reflects publicly; unpublish hides", async ({
    page,
    browser
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    const store = seedAbout();
    await installApi(page, store);

    await signInAsAdmin(page);
    await page.goto("/en/admin/team");

    await expect(
      page.getByRole("heading", { level: 1, name: "Team" })
    ).toBeVisible();

    // ── Member one ────────────────────────────────────────────────────────
    await page.getByTestId("team-new").click();
    await page.getByTestId("team-name").fill("E2E Member One");
    await page.getByTestId("team-role").fill("E2E Role One");
    await page.getByTestId("team-bio").fill("E2E biography one.");
    await page.getByTestId("team-save").click();
    await expect(page.getByTestId("team-status-message")).toHaveText(
      "Team member saved."
    );

    const firstId = store.teamMembers[0]?.id ?? "";
    expect(firstId).not.toBe("");
    await page.getByTestId(`team-toggle-${firstId}`).click();
    await expect(page.getByTestId("team-status-message")).toHaveText(
      "Published. The member is now public."
    );

    // ── Member two ────────────────────────────────────────────────────────
    await page.getByTestId("team-new").click();
    await page.getByTestId("team-name").fill("E2E Member Two");
    await page.getByTestId("team-role").fill("E2E Role Two");
    await page.getByTestId("team-save").click();
    await expect(page.getByTestId("team-status-message")).toHaveText(
      "Team member saved."
    );

    const secondId = store.teamMembers[1]?.id ?? "";
    await page.getByTestId(`team-toggle-${secondId}`).click();
    await expect(page.getByTestId("team-status-message")).toHaveText(
      "Published. The member is now public."
    );

    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await installApi(anonPage, store);

    await anonPage.goto("/en/about");
    await expect(anonPage.locator(".team-card__name")).toHaveText([
      "E2E Member One",
      "E2E Member Two"
    ]);

    // ── Reorder with an explicit button (keyboard operable, not drag-only) ─
    await page.getByTestId(`team-down-${firstId}`).click();
    await expect(page.getByTestId("team-status-message")).toHaveText(
      "Display order saved."
    );

    await anonPage.reload();
    await expect(anonPage.locator(".team-card__name")).toHaveText([
      "E2E Member Two",
      "E2E Member One"
    ]);

    // ── Unpublish one member ──────────────────────────────────────────────
    await page.getByTestId(`team-toggle-${firstId}`).click();
    await expect(page.getByTestId("team-status-message")).toHaveText(
      "Unpublished. The member is no longer public."
    );

    await anonPage.reload();
    await expect(anonPage.getByText("E2E Member One")).toHaveCount(0);
    await expect(anonPage.getByText("E2E Member Two")).toBeVisible();

    await anonContext.close();
  });

  test("portrait upload renders publicly and removal clears the reference", async ({
    page,
    browser
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    const store = seedAbout();
    await installApi(page, store);

    await signInAsAdmin(page);
    await page.goto("/en/admin/team");

    await page.getByTestId("team-new").click();
    await page.getByTestId("team-name").fill("E2E Portrait Member");
    await page.getByTestId("team-role").fill("E2E Portrait Role");
    await page.getByTestId("team-save").click();
    await expect(page.getByTestId("team-status-message")).toHaveText(
      "Team member saved."
    );

    const memberId = store.teamMembers[0]?.id ?? "";
    await page.getByTestId(`team-toggle-${memberId}`).click();
    await expect(page.getByTestId("team-status-message")).toHaveText(
      "Published. The member is now public."
    );

    // Edit + upload a portrait.
    await page.getByTestId(`team-edit-${memberId}`).click();
    await page.getByTestId("team-portrait").setInputFiles({
      name: "portrait.png",
      mimeType: "image/png",
      buffer: Buffer.from("e2e-portrait")
    });
    await page.getByTestId("team-save").click();
    await expect(page.getByTestId("team-status-message")).toHaveText(
      "Team member saved."
    );
    expect(store.teamMembers[0]?.portrait_path).toBe("team/portrait.png");

    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await installApi(anonPage, store);

    await anonPage.goto("/en/about");
    await expect(anonPage.locator(".team-card__portrait-img")).toHaveCount(1);

    // Remove the portrait: the database reference must be cleared.
    await page.getByTestId(`team-edit-${memberId}`).click();
    await page.getByTestId("team-portrait-remove").click();
    await page.getByTestId("team-save").click();
    await expect(page.getByTestId("team-status-message")).toHaveText(
      "Team member saved."
    );
    expect(store.teamMembers[0]?.portrait_path).toBeNull();

    await anonPage.reload();
    await expect(anonPage.locator(".team-card__portrait-img")).toHaveCount(0);
    await expect(anonPage.locator(".team-card__monogram")).toHaveCount(1);

    await anonContext.close();
  });
});
