import { expect } from "@playwright/test";

import { ADMIN_AUTH_USER, mockSupabaseAuth } from "./support/mocks";
import { MOBILE_VIEWPORT, signInAsAdmin } from "./support/journey-fixtures";
import { createProjectStore, mockProjectApi } from "./support/project-store";
import { test } from "./support/network-guard";

/**
 * T-032 icon-map safety net.
 *
 * Unit coverage (`src/config/__tests__/quasarIconMap.test.ts`) pins the mapping
 * contract; this journey proves the MOUNTED result: Quasar's internal icons
 * render as SVG with no visible Material-Icons ligature text. The class-based
 * locator is deliberate — `.material-icons` is the exact fallback mechanism
 * being guarded, not a styling detail.
 */
test.describe("T-032 critical icon-map safety net", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("Quasar-internal icons render as SVG, not ligature text", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await mockProjectApi(page, createProjectStore());
    await signInAsAdmin(page);

    await page.goto("/en/admin/projects/new");
    await expect(
      page.getByRole("heading", { level: 1, name: "New project" })
    ).toBeVisible();

    const ligatureText = await page
      .locator(".material-icons")
      .evaluateAll(nodes =>
        nodes
          .map(node => (node.textContent ?? "").trim())
          .filter(text => text.length > 0)
      );
    expect(ligatureText, "Material-Icons ligature fallback is visible").toEqual(
      []
    );

    // User-visible proof at the exact spot that used to overflow: no icon name
    // leaks into the form's text, and the select renders an SVG.
    await expect(page.getByRole("main")).not.toContainText(/arrow_drop/);
    expect(await page.getByRole("main").locator("svg").count()).toBeGreaterThan(
      0
    );
  });
});
