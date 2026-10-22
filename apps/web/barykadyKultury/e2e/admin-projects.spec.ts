import { expect, type Page } from "@playwright/test";

import { ADMIN_AUTH_USER, mockSupabaseAuth } from "./support/mocks";
import { test } from "./support/network-guard";
import { createProjectStore, mockProjectApi } from "./support/project-store";

/**
 * T-027 — admin projects journeys (ticket TDD plan steps 4–5).
 *
 * The store is in-memory and deterministic; `mockProjectApi` implements the
 * PostgREST slice the admin module writes through, so "create → publish →
 * appears publicly", "unpublish → disappears" and "draft stays invisible
 * anonymously" are proven end to end without a live Supabase project
 * (docs/TESTING.md §2). Anonymous visibility is checked from a *separate*
 * browser context with no session, which is the honest analogue of an
 * anonymous visitor.
 */

const SLUG = "e2e-spring-workshop";
const TITLE = "E2E Spring Workshop (fictional)";
const SUMMARY = "A deterministic E2E summary.";
const BODY = "## E2E\n\nDeterministic body.";

async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto("/en/admin/sign-in");
  await page.getByLabel("Email").fill("admin@demo.local");
  await page.getByLabel("Password").fill("e2e-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Dashboard" })
  ).toBeVisible();
}

test.describe("admin projects", () => {
  test("create → publish → public, then unpublish removes it; draft never leaks", async ({
    page,
    browser
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    const store = createProjectStore();
    await mockProjectApi(page, store);

    await signInAsAdmin(page);

    // ── Create a draft ────────────────────────────────────────────────────
    await page.goto("/en/admin/projects/new");
    await expect(
      page.getByRole("heading", { level: 1, name: "New project" })
    ).toBeVisible();

    await page.getByTestId("project-slug").fill(SLUG);
    await page.getByTestId("project-title").fill(TITLE);
    await page.getByTestId("project-summary").fill(SUMMARY);
    await page.getByTestId("project-body").fill(BODY);
    await page.getByTestId("project-save").click();

    await expect(page.getByTestId("project-status-message")).toHaveText(
      "Draft saved."
    );
    // Persisted, not optimistic: the editor is now on the record URL.
    await expect(page).toHaveURL(/\/en\/admin\/projects\/[0-9a-f-]+$/);

    const projectId = page.url().split("/").pop() ?? "";

    // ── Draft preview (public component + banner, admin-only route) ───────
    await page.getByTestId("project-preview").click();
    await expect(page).toHaveURL(
      new RegExp(`/en/admin/projects/${projectId}/preview$`)
    );
    await expect(page.getByTestId("preview-banner")).toContainText(
      "not visible to the public"
    );
    await expect(
      page.getByRole("heading", { level: 1, name: TITLE })
    ).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(
      new RegExp(`/en/admin/projects/${projectId}$`)
    );

    // ── Draft is invisible anonymously ────────────────────────────────────
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await mockProjectApi(anonPage, store);

    // The preview route is admin-only: an anonymous visitor is redirected to
    // sign-in, so a draft can never be reached through the preview URL.
    await anonPage.goto(`/en/admin/projects/${projectId}/preview`);
    await expect(anonPage).toHaveURL(/\/en\/admin\/sign-in/);

    await anonPage.goto("/en/projects");
    await expect(anonPage.getByText(TITLE)).toHaveCount(0);
    // The strict public detail read 404s a draft slug.
    await anonPage.goto(`/en/projects/${SLUG}`);
    await expect(
      anonPage.getByRole("heading", { level: 1, name: "Page not found" })
    ).toBeVisible();

    // ── Publish ───────────────────────────────────────────────────────────
    await page.getByTestId("project-publish").click();
    await expect(page.getByTestId("project-status-message")).toHaveText(
      "Published. The project is now public."
    );

    await anonPage.goto("/en/projects");
    await expect(anonPage.getByRole("link", { name: TITLE })).toBeVisible();
    await anonPage.goto(`/en/projects/${SLUG}`);
    await expect(
      anonPage.getByRole("heading", { level: 1, name: TITLE })
    ).toBeVisible();
    await expect(anonPage.getByText("Deterministic body.")).toBeVisible();

    // ── Unpublish ─────────────────────────────────────────────────────────
    await page.getByTestId("project-unpublish").click();
    await expect(page.getByTestId("project-status-message")).toHaveText(
      "Unpublished. The project is no longer public."
    );

    await anonPage.goto("/en/projects");
    await expect(anonPage.getByText(TITLE)).toHaveCount(0);

    await anonContext.close();
  });

  test("publish is blocked with a specific, localized reason when the fallback locale is incomplete", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    const store = createProjectStore();
    await mockProjectApi(page, store);

    await signInAsAdmin(page);

    await page.goto("/en/admin/projects/new");
    await page.getByTestId("project-slug").fill("e2e-incomplete-draft");
    // Deliberately no English title/summary: publishing must be refused.
    await page.getByTestId("project-publish").click();

    await expect(page.getByTestId("project-status-message")).toHaveText(
      "Add an English title and summary before publishing."
    );
    // Focus moved to the offending field (DESIGN_SYSTEM.md §6).
    await expect(page.getByTestId("project-title")).toBeFocused();
    // Nothing was written.
    expect(store.projects).toHaveLength(0);
  });

  test("a duplicate canonical slug is reported as a field error", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    const store = createProjectStore({
      projects: [
        {
          id: "e2e00000-0000-4000-8000-000000000999",
          slug: "e2e-taken-slug",
          status: "published",
          featured_rank: null,
          cover_path: null,
          start_date: null,
          end_date: null,
          published_at: "2026-01-01T00:00:00.000Z",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z"
        }
      ],
      translations: [
        {
          id: "e2e00000-0000-4000-8000-000000001000",
          project_id: "e2e00000-0000-4000-8000-000000000999",
          locale: "en",
          title: "Existing project",
          summary: "Existing summary.",
          body: "Existing body."
        }
      ]
    });
    await mockProjectApi(page, store);

    await signInAsAdmin(page);

    await page.goto("/en/admin/projects/new");
    await page.getByTestId("project-slug").fill("e2e-taken-slug");
    await page.getByTestId("project-title").fill("Another project");
    await page.getByTestId("project-summary").fill("Another summary.");
    await page.getByTestId("project-body").fill("Another body.");
    await page.getByTestId("project-save").click();

    await expect(page.getByTestId("project-status-message")).toHaveText(
      "This URL slug is already used by another project."
    );
    await expect(page.getByTestId("project-slug")).toBeFocused();
  });

  test("delete asks for confirmation, is keyboard operable and removes the project", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    const store = createProjectStore();
    await mockProjectApi(page, store);

    await signInAsAdmin(page);

    await page.goto("/en/admin/projects/new");
    await page.getByTestId("project-slug").fill("e2e-delete-me");
    await page.getByTestId("project-title").fill("Delete me");
    await page.getByTestId("project-summary").fill("Summary.");
    await page.getByTestId("project-body").fill("Body.");
    await page.getByTestId("project-save").click();
    await expect(page.getByTestId("project-status-message")).toHaveText(
      "Draft saved."
    );

    await page.getByTestId("project-delete").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // The safe action owns focus on open.
    await expect(page.getByTestId("confirm-cancel")).toBeFocused();

    // Escape closes and returns focus to the trigger.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("project-delete")).toBeFocused();

    // Confirm for real.
    await page.getByTestId("project-delete").click();
    await page.getByTestId("confirm-accept").click();

    await expect(page).toHaveURL(/\/en\/admin\/projects$/);
    expect(store.projects).toHaveLength(0);
  });

  test("an incomplete locale previews the same English fallback the public detail shows", async ({
    page,
    browser
  }) => {
    // T-027 review finding #1: the preview must resolve a translation with the
    // SAME policy as the public detail page (complete = title + summary + body,
    // English fallback). A title-only Polish translation must therefore preview
    // as English-with-fallback-note — exactly what /pl/projects/<slug> shows.
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    const store = createProjectStore();
    await mockProjectApi(page, store);

    await signInAsAdmin(page);

    await page.goto("/en/admin/projects/new");
    await page.getByTestId("project-slug").fill("e2e-fallback-parity");
    await page.getByTestId("project-title").fill("Parity EN Title");
    await page.getByTestId("project-summary").fill("Parity EN summary.");
    await page.getByTestId("project-body").fill("Parity EN body.");

    // Polish: title only — started but incomplete (no summary/body).
    await page.getByTestId("project-tab-pl").click();
    await page.getByTestId("project-title").fill("Tytuł PL");

    await page.getByTestId("project-save").click();
    await expect(page.getByTestId("project-status-message")).toHaveText(
      "Draft saved."
    );

    const projectId = page.url().split("/").pop() ?? "";

    // Admin preview under /pl resolves English + the fallback note.
    await page.goto(`/pl/admin/projects/${projectId}/preview`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Parity EN Title" })
    ).toBeVisible();
    await expect(
      page.getByText("Ta treść jest dostępna wyłącznie po angielsku.")
    ).toBeVisible();

    // Publish from the /pl editor (UI locale is Polish), then the public /pl
    // detail resolves the SAME fallback.
    await page.goto(`/pl/admin/projects/${projectId}`);
    await page.getByTestId("project-publish").click();
    await expect(page.getByTestId("project-status-message")).toHaveText(
      "Opublikowano. Projekt jest teraz publiczny."
    );

    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await mockProjectApi(anonPage, store);

    await anonPage.goto("/pl/projects/e2e-fallback-parity");
    await expect(
      anonPage.getByRole("heading", { level: 1, name: "Parity EN Title" })
    ).toBeVisible();
    await expect(
      anonPage.getByText("Ta treść jest dostępna wyłącznie po angielsku.")
    ).toBeVisible();

    await anonContext.close();
  });
});
