import { expect } from "@playwright/test";

import {
  ADMIN_AUTH_USER,
  mockCalendarEvents,
  mockSupabaseAuth,
  mockSupabaseRest
} from "./support/mocks";
import {
  EN_PROJECT_SLUG,
  EVENT_LINKS_FIXTURE,
  HOME_EVENTS,
  MOBILE_VIEWPORT,
  PROJECTS_FIXTURE,
  signInAsAdmin
} from "./support/journey-fixtures";
import {
  expectKeyboardSweep,
  expectVisibleFocus,
  focusBody,
  tabUntilRole
} from "./support/journey-helpers";
import {
  createProjectStore,
  mockProjectApi,
  type ProjectStoreRow,
  type ProjectTranslationRow
} from "./support/project-store";
import { test } from "./support/network-guard";

/**
 * T-033 — keyboard journeys and interaction patterns that T-032's two
 * keyboard journeys do not walk: the mobile drawer, the language picker, both
 * modal surfaces (search dialog, destructive confirm dialog), form-error
 * association/announcement on the two shipped forms, TOC-driven traversal of
 * the events page, and a FULL-TAB-ORDER sweep proving every interactive stop
 * paints a visible focus ring (acceptance boxes 2–4). Keyboard only: no
 * `.click()` anywhere in the journey path.
 */

const SEED_ROW: ProjectStoreRow = {
  id: "e2e00000-0000-4000-8000-0000000000aa",
  slug: "keyboard-journey-project",
  status: "draft",
  featured_rank: null,
  cover_path: null,
  start_date: null,
  end_date: null,
  published_at: null,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-01T00:00:00.000Z"
};

const SEED_TRANSLATION: ProjectTranslationRow = {
  id: "e2e00000-0000-4000-8000-0000000000ab",
  project_id: SEED_ROW.id,
  locale: "en",
  title: "Keyboard Journey Project (Fictional)",
  summary: "A fictional draft used only by the keyboard confirm journey.",
  body: "Fictional body."
};

test.describe("T-033 a11y keyboard — mobile drawer at 360×640", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("burger opens by Enter, links are tabbable with visible focus, Escape closes and restores focus", async ({
    page
  }) => {
    await mockSupabaseRest(page);
    await page.goto("/en");
    await expect(
      page.getByRole("heading", { level: 1, name: "Barykady Kultury" })
    ).toBeVisible();

    const trigger = page.getByTestId("menu-trigger");

    // 1. Reach the burger by Tab alone; its focus ring must be visible.
    await focusBody(page);
    const stops = await tabUntilRole(page, "button", /open navigation menu/i, {
      maxStops: 16
    });
    expect(stops, "burger was not reachable by Tab").toBeGreaterThan(0);
    await expectVisibleFocus(page, "burger trigger");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    // 2. Enter opens; the state is announced through aria-expanded.
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    // The drawer's own navigation. In the phone band (< 600 px) the drawer's
    // landmark is "Full menu" while "Main navigation" is the persistent bottom
    // bar (AppHeader.vue navLabel), so the drawer must be addressed by its
    // test id — otherwise the assertions below hit the always-visible bottom
    // bar instead of the thing that actually opens and closes.
    const drawer = page.getByTestId("main-nav");
    await expect(drawer).toBeVisible();

    // 3. A link inside the drawer receives visible keyboard focus.
    const drawerContact = drawer.getByRole("link", { name: "Contact" });
    await focusBody(page);
    const linkStop = await tabUntilRole(page, "link", "Contact", {
      within: drawer,
      maxStops: 16
    });
    expect(linkStop, "drawer link was not reachable by Tab").toBeGreaterThan(0);
    await expectVisibleFocus(page, "drawer Contact link");

    // 4. Escape closes the drawer and hands focus back to the burger
    //    (DESIGN_SYSTEM §6 "dialogs return focus to their trigger" applied to
    //    the disclosure pattern; AppHeader.closeMenu).
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
    await expect(drawerContact).toBeHidden();
  });
});

test.describe("T-033 a11y keyboard — language switcher", () => {
  test("Enter opens, Tab selects Polski, and switching updates document language metadata", async ({
    page
  }) => {
    await mockSupabaseRest(page);
    await page.goto("/en/about");

    const trigger = page.getByRole("button", { name: /Language/ });
    await focusBody(page);
    const stops = await tabUntilRole(page, "button", /Language/, {
      maxStops: 16
    });
    expect(stops, "language trigger was not reachable by Tab").toBeGreaterThan(
      0
    );
    await expectVisibleFocus(page, "language trigger");

    // Disclosure pattern: Enter toggles open, aria-expanded proves it.
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Options are plain buttons; Tab reaches them and one lands visibly
    // focused on "Polski PL".
    const plOption = page.getByRole("button", { name: "Polski PL" });
    const optionStops = await tabUntilRole(page, "button", "Polski PL", {
      maxStops: 8
    });
    expect(optionStops, "PL option was not reachable by Tab").toBeGreaterThan(
      0
    );
    await expectVisibleFocus(page, "language PL option");
    await plOption.press("Enter");

    // PRD §2.7 / DESIGN_SYSTEM §6: the document language must follow.
    await expect(page).toHaveURL(/\/pl(\/|$)/);
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
    // Re-open the trigger by its stable disclosure attribute, not the English
    // "Language" text: after the switch the visible label is the Polish
    // autonym ("Język"), so the previous name locator no longer resolves.
    await expect(page.locator(".language-switcher__trigger")).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  test("Escape from the open picker returns focus to the trigger", async ({
    page
  }) => {
    await mockSupabaseRest(page);
    await page.goto("/en");
    const trigger = page.getByRole("button", { name: /Language/ });
    await focusBody(page);
    await tabUntilRole(page, "button", /Language/, { maxStops: 16 });
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
  });
});

test.describe("T-033 a11y keyboard — search dialog focus round-trip", () => {
  test("Enter opens with focus in the input; Escape closes and restores the trigger", async ({
    page
  }) => {
    await mockSupabaseRest(page);
    await page.goto("/en");

    const trigger = page.getByRole("button", { name: "Search the site" });
    await focusBody(page);
    const stops = await tabUntilRole(page, "button", "Search the site", {
      maxStops: 20
    });
    expect(stops, "search trigger was not reachable by Tab").toBeGreaterThan(0);
    await expectVisibleFocus(page, "search trigger");

    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Focus starts inside the dialog (combobox input) — never on the page
    // behind it.
    const focusedInDialog = await dialog.evaluate(element =>
      element.contains(document.activeElement)
    );
    expect(focusedInDialog, "dialog did not take focus on open").toBe(true);

    // Escape closes and the trigger keeps focus (no lost place).
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});

test.describe("T-033 a11y keyboard — confirm dialog round-trip (admin)", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("Delete opens with focus on Cancel, Tab wraps inside, Escape restores the trigger", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    const store = createProjectStore({
      projects: [SEED_ROW],
      translations: [SEED_TRANSLATION]
    });
    await mockProjectApi(page, store);
    await signInAsAdmin(page);
    await page.goto(`/en/admin/projects/${SEED_ROW.id}`);

    const deleteButton = page.getByTestId("project-delete");
    // The edit route's <h1> is the section title ("Projects"); the project's
    // own name is an editable field value, not the heading. Wait for the form
    // to finish loading (the `loading` gate keeps the actions out of the DOM
    // until the row resolves) before starting the tab walk.
    await expect(
      page.getByRole("heading", { level: 1, name: "Projects" })
    ).toBeVisible();
    await expect(deleteButton).toBeVisible();

    await focusBody(page);
    const stops = await tabUntilRole(page, "button", "Delete", {
      maxStops: 60
    });
    expect(stops, "delete button was not reachable by Tab").toBeGreaterThan(0);
    await expectVisibleFocus(page, "delete button");

    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Safe action first: focus lands on Cancel (UiConfirmDialog contract).
    await expect(page.getByTestId("confirm-cancel")).toBeFocused();
    await expectVisibleFocus(page, "confirm cancel");

    // Tab wraps inside the dialog (trap for the user's benefit, escape for
    // the keyboard: WCAG 2.1.2 — the user can always leave via Escape).
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("confirm-accept")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(deleteButton).toBeFocused();
  });
});

test.describe("T-033 a11y keyboard — form errors associated and announced", () => {
  test("sign-in: field errors are linked via aria and the failure is announced", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { rejectCredentials: true });
    await page.goto("/en/admin/sign-in");

    // Submit empty with the keyboard only.
    await focusBody(page);
    const submitStops = await tabUntilRole(page, "button", "Sign in", {
      maxStops: 12
    });
    expect(submitStops, "submit was not reachable by Tab").toBeGreaterThan(0);
    await page.keyboard.press("Enter");

    // Field-level error: programmatically associated (SC 3.3.1/1.4.12).
    const email = page.getByLabel("Email");
    const describedBy = await email.getAttribute("aria-describedby");
    expect(
      describedBy,
      "email error is not associated with the field"
    ).toContain("admin-email-error");
    await expect(page.locator("#admin-email-error")).toContainText(
      "Enter your email address."
    );
    const invalid = await email.getAttribute("aria-invalid");
    expect(invalid, "email field must expose aria-invalid on error").toBe(
      "true"
    );

    // Fill valid-looking values, submit again with Enter → credential failure
    // announced through the live status region (not colour, not a dialog).
    await email.fill("admin@demo.local");
    await page.getByLabel("Password").fill("e2e-password");
    await page.getByRole("button", { name: "Sign in" }).focus();
    await page.keyboard.press("Enter");

    await expect(
      page.getByRole("status").filter({ hasText: /incorrect|failed/i })
    ).toBeVisible();
  });

  test("project form: invalid slug links its message and focus moves to the first error", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    const store = createProjectStore();
    await mockProjectApi(page, store);
    await signInAsAdmin(page);
    await page.goto("/en/admin/projects/new");
    // The form is behind a `loading` gate; walk its tab order only once the
    // real controls exist, not against the pre-hydration HTML shell.
    await expect(page.getByTestId("project-slug")).toBeVisible();

    // Keyboard-submit the empty form.
    const saveStops = await tabUntilRole(page, "button", "Save", {
      maxStops: 40
    });
    expect(saveStops, "save button was not reachable by Tab").toBeGreaterThan(
      0
    );
    await page.keyboard.press("Enter");

    // The slug field must expose its error to AT: aria-invalid + the error
    // text reachable through aria-describedby (Quasar links the message
    // element; the assertion proves the rendered association, not the
    // framework's promise).
    const slug = page.getByTestId("project-slug");
    await expect(slug).toHaveAttribute("aria-invalid", "true");
    const describedBy = await slug.getAttribute("aria-describedby");
    expect(
      describedBy,
      "slug error is not programmatically associated"
    ).not.toBeNull();
    const messageIds = describedBy!.trim().split(/\s+/);
    const messageText = await page.evaluate(ids => {
      return ids
        .map(id => document.getElementById(id)?.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" | ");
    }, messageIds);
    expect(messageText).toContain("Enter a URL slug.");

    // Focus moved to the offending field (the admin pattern already shipped
    // by T-027 — this pins it for keyboard users specifically).
    await expect(slug).toBeFocused();
    await expectVisibleFocus(page, "invalid slug field");

    // Submission status is announced through the polite live region.
    await expect(page.getByTestId("project-status-message")).not.toHaveText("");
  });
});

test.describe("T-033 a11y keyboard — events journey and TOC", () => {
  test("skip link → TOC → section heading → project link, all visible focus", async ({
    page
  }) => {
    await mockCalendarEvents(page, { events: HOME_EVENTS });
    await mockSupabaseRest(page, {
      responses: {
        projects: PROJECTS_FIXTURE,
        calendar_event_links: EVENT_LINKS_FIXTURE
      }
    });
    await page.goto("/en/events");
    await expect(
      page.getByRole("heading", { level: 1, name: "Events" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "Sample timed event" })
    ).toBeVisible();

    // 1. Skip link is the first stop and moves focus to main.
    await focusBody(page);
    await page.keyboard.press("Tab");
    const skip = await expectVisibleFocus(page, "events skip link");
    expect(skip.text).toMatch(/skip/i);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();

    // 2. TOC "Upcoming" link is keyboard reachable and activates the section
    //    heading focus pattern.
    const tocStops = await tabUntilRole(page, "link", "Upcoming", {
      within: page.getByRole("main"),
      maxStops: 24
    });
    expect(
      tocStops,
      "TOC Upcoming link was not reachable by Tab"
    ).toBeGreaterThan(0);
    await expectVisibleFocus(page, "TOC Upcoming link");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { level: 2, name: "Upcoming" })
    ).toBeFocused();

    // 3. The event's project link is reachable from the section and operable.
    const projectStops = await tabUntilRole(
      page,
      "link",
      /Sample Community Workshop/,
      {
        within: page.getByRole("main"),
        maxStops: 30
      }
    );
    expect(
      projectStops,
      "event project link was not reachable"
    ).toBeGreaterThan(0);
    await expectVisibleFocus(page, "event project link");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      new RegExp(`/en/projects/${EN_PROJECT_SLUG}$`)
    );
    await expect(
      page.getByRole("heading", { level: 1, name: /Sample Community Workshop/ })
    ).toBeVisible();
  });
});

test.describe("T-033 a11y keyboard — full tab-order sweeps", () => {
  test("public support page: every tab stop paints a visible focus ring", async ({
    page
  }) => {
    await mockSupabaseRest(page);
    await page.goto("/en/support");
    await expect(
      page.getByRole("heading", { level: 1, name: "Support us" })
    ).toBeVisible();
    // Header (skip, brand, 6 nav links, search, 3 social, theme, language) +
    // footer links; a floor of 15 stops keeps the sweep honest.
    await expectKeyboardSweep(page, {
      label: "support (desktop)",
      minStops: 15,
      maxStops: 60
    });
  });

  test("admin sign-in: every tab stop paints a visible focus ring", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await page.goto("/en/admin/sign-in");
    await expect(
      page.getByRole("heading", { level: 1, name: "Administrator sign in" })
    ).toBeVisible();
    await expectKeyboardSweep(page, {
      label: "admin sign-in",
      minStops: 6,
      maxStops: 30
    });
  });

  test("pointer path keeps the QBtn ring-free — hover and a real mouse click paint no focus ring", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await mockProjectApi(page, createProjectStore());
    await signInAsAdmin(page);
    await page.goto("/en/admin/projects/new");
    await expect(page.getByTestId("project-slug")).toBeVisible();

    // Representative QBtn = the same `project-save` control whose KEYBOARD ring
    // A-1 added (proven by the confirm-dialog journey above, where Tab reaches a
    // QBtn and expectVisibleFocus passes). DESIGN_SYSTEM §3/§6 keep the ring for
    // KEYBOARD users only, so a POINTER user must see none — this pins the
    // pointer side of the same A-1 contract. Reads are element-scoped: a raw
    // mouse.down is not a reliable pointer-focus signal for Quasar's button, and
    // programmatic focus is not a pointer proxy, so the discriminator is whether
    // the element itself reports `:focus-visible` / an outline.
    const save = page.getByTestId("project-save");
    const ringOf = (locator: typeof save) =>
      locator.evaluate(element => {
        const style = getComputedStyle(element);
        const width = Number.parseFloat(style.outlineWidth) || 0;
        return {
          focusVisible: element.matches(":focus-visible"),
          hasRing: !(style.outlineStyle === "none" || width === 0)
        };
      });

    // 1. Hover — pointer hover must never trigger the focus ring.
    await save.hover();
    const hovered = await ringOf(save);
    expect(hovered.focusVisible, "hover wrongly matched :focus-visible").toBe(
      false
    );
    expect(hovered.hasRing, "hover painted a focus ring").toBe(false);

    // 2. Real mouse click (pointer mousedown+mouseup). The click must genuinely
    //    operate the control — submitting the empty form fires the slug
    //    validation — yet the button the pointer just activated shows no ring.
    await save.click();
    await expect(page.getByTestId("project-slug")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    const clicked = await ringOf(save);
    expect(
      clicked.focusVisible,
      "mouse click wrongly matched :focus-visible"
    ).toBe(false);
    expect(clicked.hasRing, "mouse click left a focus ring on the QBtn").toBe(
      false
    );
  });
});
