import { expect, type Page } from "@playwright/test";

import { test } from "./support/network-guard";
import { checkA11y } from "./support/a11y";
import {
  ADMIN_AUTH_USER,
  VIEWER_AUTH_USER,
  mockSupabaseAuth
} from "./support/mocks";
import { createProjectStore, mockProjectApi } from "./support/project-store";
import { readSupabaseAccessToken } from "./support/publication-store";

/**
 * T-026 — admin auth journeys (ticket TDD plan step 3).
 *
 * The built SPA runs against the Playwright-managed origin with
 * `VITE_SUPABASE_URL` pointed at that same origin (playwright.config.ts), so
 * every Supabase Auth call is intercepted by `mockSupabaseAuth` — the real
 * `supabase-js` client persists and restores sessions against fixtures and no
 * test ever touches a live project (docs/TESTING.md §2).
 *
 * The demo users (`admin@demo.local` / `viewer@demo.local`) exist from lane
 * A for MANUAL verification only; the fixture identities here mirror them but
 * are not a dependency on a running stack.
 */

async function signInViaForm(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("admin auth", () => {
  test("an anonymous visit to /en/admin redirects to sign-in preserving the destination", async ({
    page
  }) => {
    await mockSupabaseAuth(page);

    await page.goto("/en/admin");

    // vue-router serializes the preserved path with literal slashes.
    await expect(page).toHaveURL(/\/en\/admin\/sign-in\?redirect=\/en\/admin$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Administrator sign in" })
    ).toBeVisible();
  });

  test("the sign-in page is accessible and offers no registration or password-reset path", async ({
    page
  }) => {
    await mockSupabaseAuth(page);
    await page.goto("/en/admin/sign-in");

    // No self-service account surface (PRODUCT_REQUIREMENTS.md §6).
    await expect(
      page.getByRole("link", { name: /register|sign up|forgot|reset/i })
    ).toHaveCount(0);
    // Password-manager semantics are part of the acceptance criteria.
    await expect(page.locator("#admin-email")).toHaveAttribute(
      "autocomplete",
      "email"
    );
    await expect(page.locator("#admin-password")).toHaveAttribute(
      "autocomplete",
      "current-password"
    );

    await checkA11y(page);
  });

  test("empty submission associates errors with their fields and announces them", async ({
    page
  }) => {
    await mockSupabaseAuth(page);
    await page.goto("/en/admin/sign-in");

    await page.getByRole("button", { name: "Sign in" }).click();

    const email = page.locator("#admin-email");
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAttribute(
      "aria-describedby",
      /admin-email-error/
    );
    await expect(page.locator("#admin-email-error")).toHaveText(
      "Enter your email address."
    );
  });

  test("wrong credentials are reported through the live region, not silently", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { rejectCredentials: true });
    await page.goto("/en/admin/sign-in");

    await signInViaForm(page, "admin@demo.local", "wrong-password");

    await expect(page.locator('[role="status"]')).toHaveText(
      "The email or password is incorrect."
    );
    // Still no session: the URL never leaves the sign-in surface.
    await expect(page).toHaveURL(/\/en\/admin\/sign-in/);
  });

  test("the admin fixture signs in and sees the dashboard", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });

    // Enter through the guard so the preserved redirect is exercised too.
    await page.goto("/en/admin");
    await expect(page).toHaveURL(/sign-in/);

    await signInViaForm(page, "admin@demo.local", "any-password");

    await expect(page).toHaveURL(/\/en\/admin$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" })
    ).toBeVisible();
    await expect(
      page.getByText("Signed in as admin@demo.local.")
    ).toBeVisible();
    // Post-sign-in focus lands on the main landmark (the page swap must not
    // drop the caret to <body> or cut off the polite announcement).
    await expect(page.locator("#admin-main")).toBeFocused();
    // The shell is the admin layout, not the public marketing header.
    await expect(
      page.getByRole("navigation", { name: "Admin navigation" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to public site" })
    ).toBeVisible();
  });

  test("a signed-in admin keeps access across reloads (session restore)", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await page.goto("/en/admin/sign-in");
    await signInViaForm(page, "admin@demo.local", "any-password");
    await expect(page).toHaveURL(/\/en\/admin$/);

    await page.reload();

    // Restore reads the persisted fixture session — no redirect to sign-in.
    await expect(page).toHaveURL(/\/en\/admin$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" })
    ).toBeVisible();
  });

  test("the viewer fixture signs in and lands on the explicit denial page (no loop)", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: VIEWER_AUTH_USER });

    await page.goto("/en/admin");
    await signInViaForm(page, "viewer@demo.local", "any-password");

    // Terminal denial state: the guard allows it and stops redirecting.
    await expect(page).toHaveURL(/\/en\/admin\/access-denied$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Not authorized" })
    ).toBeVisible();
    await expect(
      page.getByText("does not have administrator access")
    ).toBeVisible();
    // The sign-out exit is offered to the non-admin session as well —
    // scoped to the banner because the denial page carries its own exit.
    await expect(
      page.getByRole("banner").getByRole("button", { name: "Sign out" })
    ).toBeVisible();
  });

  test("sign-out clears the session and returns to the public home", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await page.goto("/en/admin/sign-in");
    await signInViaForm(page, "admin@demo.local", "any-password");
    await expect(page).toHaveURL(/\/en\/admin$/);

    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL(/\/en$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Barykady Kultury" })
    ).toBeVisible();

    // Private UI is gone: the admin URL bounces to sign-in again.
    await page.goto("/en/admin");
    await expect(page).toHaveURL(/\/en\/admin\/sign-in/);
  });

  /**
   * T-032 J8 gate fix — the guard's redirect is not authorization by itself
   * (AGENTS.md rule 4: UI guards are not authorization). The mocked project
   * mutation boundary mirrors the RLS/RPC policy: no admin bearer token means
   * 42501 and no write; the same request with the mocked admin token succeeds.
   */
  test("an anonymous project mutation is rejected and writes nothing", async ({
    page,
    browser
  }) => {
    const authorize = (token: string) =>
      token === `e2e-access-token-${ADMIN_AUTH_USER.email}`;
    const store = createProjectStore();
    const saveBody = {
      p_id: null,
      p_slug: "anon-must-not-write",
      p_status: "draft",
      p_featured_rank: null,
      p_cover_path: null,
      p_start_date: null,
      p_end_date: null,
      p_published_at: null,
      p_translations: [
        {
          locale: "en",
          title: "Anonymous write must fail",
          summary: "summary",
          body: "body"
        }
      ]
    };

    // Anonymous context: no session, no bearer token.
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await mockProjectApi(anonPage, store, { authorize });
    await anonPage.goto("/en");

    const anonymous = await anonPage.evaluate(async body => {
      const response = await fetch("/rest/v1/rpc/save_project_v1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      return { status: response.status, payload: await response.json() };
    }, saveBody);

    expect(anonymous.status).toBe(403);
    expect(anonymous.payload.code).toBe("42501");
    expect(store.projects).toHaveLength(0);

    // The UI route is only a guard: it redirects, it does not authorize.
    await anonPage.goto("/en/admin/projects/new");
    await expect(anonPage).toHaveURL(/\/en\/admin\/sign-in/);

    // The same write with the mocked admin token is allowed.
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await mockProjectApi(page, store, { authorize });
    await page.goto("/en/admin/sign-in");
    await signInViaForm(page, "admin@demo.local", "any-password");
    await expect(page).toHaveURL(/\/en\/admin$/);

    const token = await readSupabaseAccessToken(page);
    expect(token).not.toBe("");
    const admin = await page.evaluate(
      async ({ body, bearer }) => {
        const response = await fetch("/rest/v1/rpc/save_project_v1", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${bearer}`
          },
          body: JSON.stringify(body)
        });
        return { status: response.status, payload: await response.json() };
      },
      { body: saveBody, bearer: token }
    );

    expect(admin.status).toBe(200);
    expect(store.projects).toHaveLength(1);
    expect(store.projects[0]?.slug).toBe("anon-must-not-write");

    await anonContext.close();
  });

  test("the Polish locale serves the localized admin shell", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });

    await page.goto("/pl/admin");

    await expect(page).toHaveURL(/\/pl\/admin\/sign-in/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Logowanie administratora" })
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  });

  // Mirrors the public shell suite's narrow-viewport contract (DESIGN_SYSTEM
  // §6: "Layout works at narrow mobile widths") for the admin surface.
  test.describe("at 320 px", () => {
    test("the sign-in page fits without horizontal overflow and stays operable", async ({
      page
    }) => {
      await mockSupabaseAuth(page);
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto("/en/admin/sign-in");

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflow).toBe(false);

      // Controls reachable at the narrow width: language switcher, theme,
      // and the full credential path.
      await expect(
        page.getByRole("button", { name: /Language/ })
      ).toBeVisible();
      await expect(
        page.getByRole("switch", { name: "Dark mode" })
      ).toBeVisible();
      await page.getByLabel("Email").fill("admin@demo.local");
      await page.getByLabel("Password").fill("any-password");
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page).toHaveURL(/\/en\/admin$/);
    });

    test("the signed-in Ukrainian dashboard fits and its chrome stays reachable", async ({
      page
    }) => {
      await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
      await page.setViewportSize({ width: 320, height: 640 });

      await page.goto("/uk/admin/sign-in");
      await page.getByLabel("Електронна пошта").fill("admin@demo.local");
      await page.getByLabel("Пароль").fill("any-password");
      await page.getByRole("button", { name: "Увійти" }).click();
      await expect(page).toHaveURL(/\/uk\/admin$/);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflow).toBe(false);

      // Admin chrome at 320 px: nav (admin session), language + theme +
      // sign-out all present and visible.
      await expect(
        page.getByRole("navigation", { name: "Навігація адміністратора" })
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Мова|Language/ })
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Вийти" })).toBeVisible();
    });
  });
});
