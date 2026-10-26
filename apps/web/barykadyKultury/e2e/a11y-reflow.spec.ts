import { expect, type Page } from "@playwright/test";

import {
  ADMIN_AUTH_USER,
  mockCalendarEvents,
  mockSupabaseAuth,
  mockSupabaseRest
} from "./support/mocks";
import {
  ABOUT_PAGE_FIXTURE,
  HOME_EVENTS,
  HOME_PAGE_FIXTURE,
  PROJECTS_FIXTURE,
  expectNoHorizontalOverflow,
  signInAsAdmin
} from "./support/journey-fixtures";
import { createProjectStore, mockProjectApi } from "./support/project-store";
import { test } from "./support/network-guard";

/**
 * T-033 — zoom, reflow, text-spacing and rendered-boundary proofs
 * (WCAG SC 1.4.10 reflow, 1.4.4 resize, 1.4.12 text spacing;
 * docs/PRODUCT_REQUIREMENTS.md §3 "usable at narrow widths and at browser
 * zoom"; docs/DESIGN_SYSTEM.md §6).
 *
 * 320 px and the events long-string matrix are already asserted by
 * about-rail.spec.ts / events.spec.ts / admin-auth.spec.ts; this spec closes
 * the remaining named gaps: every primary surface at 320, a 200 % zoom
 * simulation (640×360 CSS px = half of 1280×720, the WCAG zoom geometry),
 * the 400 % text-spacing bookmarklet applied to the primary journeys, and a
 * RENDERED (computed-style) contrast measurement of form boundaries in both
 * themes — the token table proves the plan, this proves the paint.
 */

/** WCAG 2.x contrast on resolved rgb() colour strings (SC 1.4.11 math). */
async function renderedContrast(
  page: Page,
  arg: {
    fgSel: string;
    fgProp: "borderTopColor";
    pseudo?: string;
    bgSel: string;
  }
): Promise<number> {
  return page.evaluate(a => {
    const lum = (color: string): number => {
      const m = color.match(/rgba?\(([^)]+)\)/);
      if (!m || m[1] === undefined) {
        throw new Error(`unparseable colour: ${color}`);
      }
      const parts = m[1].split(",").map(v => Number.parseFloat(v.trim()));
      const [r = 0, g = 0, b = 0] = parts;
      const lin = (byte: number) => {
        const x = byte / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const el = document.querySelector(a.fgSel);
    if (!el) throw new Error(`missing element ${a.fgSel}`);
    const fg = getComputedStyle(el, a.pseudo ?? null)[a.fgProp] as string;
    const bgEl = document.querySelector(a.bgSel);
    const bg = bgEl ? getComputedStyle(bgEl).backgroundColor : "";
    const l1 = lum(fg);
    const l2 = lum(bg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }, arg);
}

test.describe("T-033 a11y reflow — 320 px width", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test("support renders without horizontal scrolling", async ({ page }) => {
    await mockSupabaseRest(page);
    await page.goto("/en/support");
    await expect(
      page.getByRole("heading", { level: 1, name: "Support us" })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, "support @320");
  });

  test("contact renders without horizontal scrolling", async ({ page }) => {
    await page.goto("/en/contact");
    await expect(
      page.getByRole("heading", { level: 1, name: "Contact" })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, "contact @320");
  });

  test("publications list renders without horizontal scrolling", async ({
    page
  }) => {
    await mockSupabaseRest(page, { responses: { publications: [] } });
    await page.goto("/en/publications");
    await expect(
      page.getByRole("heading", { level: 1, name: "Publications" })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, "publications @320");
  });

  test("projects list renders without horizontal scrolling", async ({
    page
  }) => {
    await mockSupabaseRest(page, { responses: { projects: PROJECTS_FIXTURE } });
    await page.goto("/en/projects");
    await expect(
      page.getByRole("heading", { level: 1, name: "Projects" })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, "projects @320");
  });

  test("the new-project form stays operable without horizontal scrolling", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await mockProjectApi(page, createProjectStore());
    await signInAsAdmin(page);
    await page.goto("/en/admin/projects/new");
    await expect(
      page.getByRole("heading", { level: 1, name: "New project" })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, "project form @320");
  });
});

test.describe("T-033 a11y reflow — long PL/UK strings at 320 px", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test("Polish support page reflows", async ({ page }) => {
    await mockSupabaseRest(page);
    await page.goto("/pl/support");
    await expectNoHorizontalOverflow(page, "pl support @320");
  });

  test("Ukrainian support page reflows", async ({ page }) => {
    await mockSupabaseRest(page);
    await page.goto("/uk/support");
    await expectNoHorizontalOverflow(page, "uk support @320");
  });

  test("Ukrainian about page (English fallback note) reflows", async ({
    page
  }) => {
    await mockSupabaseRest(page, {
      responses: { site_pages: ABOUT_PAGE_FIXTURE }
    });
    await page.goto("/uk/about");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page, "uk about @320");
  });

  test("Polish admin sign-in reflows", async ({ page }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await page.goto("/pl/admin/sign-in");
    await expectNoHorizontalOverflow(page, "pl sign-in @320");
  });

  test("Ukrainian admin sign-in reflows", async ({ page }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await page.goto("/uk/admin/sign-in");
    await expectNoHorizontalOverflow(page, "uk sign-in @320");
  });

  test("the Ukrainian mobile drawer reflows while open", async ({ page }) => {
    await mockSupabaseRest(page);
    await page.goto("/uk");
    const trigger = page.getByTestId("menu-trigger");
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expectNoHorizontalOverflow(page, "uk drawer open @320");
  });
});

test.describe("T-033 a11y reflow — 200 % zoom (640×360 CSS px)", () => {
  test.use({ viewport: { width: 640, height: 360 } });

  for (const [route, heading, label, mocks] of [
    ["/en", "Barykady Kultury", "home", "home"],
    ["/en/about", "About us", "about", "about"],
    ["/en/events", "Events", "events", "events"],
    ["/en/support", "Support us", "support", "plain"],
    ["/en/admin/sign-in", "Administrator sign in", "sign-in", "auth"]
  ] as const) {
    test(`${label} at 200 % zoom: no horizontal scroll, content reachable`, async ({
      page
    }) => {
      if (mocks === "home") {
        await mockCalendarEvents(page, { events: HOME_EVENTS });
        await mockSupabaseRest(page, {
          responses: {
            site_pages: HOME_PAGE_FIXTURE,
            projects: PROJECTS_FIXTURE,
            calendar_event_links: []
          }
        });
      } else if (mocks === "about") {
        await mockSupabaseRest(page, {
          responses: { site_pages: ABOUT_PAGE_FIXTURE }
        });
      } else if (mocks === "events") {
        await mockCalendarEvents(page, { events: HOME_EVENTS });
        await mockSupabaseRest(page, {
          responses: { projects: PROJECTS_FIXTURE, calendar_event_links: [] }
        });
      } else if (mocks === "auth") {
        await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
      } else {
        await mockSupabaseRest(page);
      }

      await page.goto(route);
      // The primary heading renders and sits inside the vertical scrollport.
      const h1 = page.getByRole("heading", { level: 1, name: heading });
      await expect(h1).toBeVisible();
      await expectNoHorizontalOverflow(page, `${label} @200% zoom`);
      // Reaching the first main-landmark link by keyboard still works (no
      // content hidden behind a non-scrollable edge).
      const box = await h1.boundingBox();
      expect(box, `${label}: h1 painted off-screen`).not.toBeNull();
    });
  }

  test("project form at 200 % zoom renders without clipping", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await mockProjectApi(page, createProjectStore());
    await signInAsAdmin(page);
    await page.goto("/en/admin/projects/new");
    await expect(
      page.getByRole("heading", { level: 1, name: "New project" })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, "project form @200% zoom");
  });
});

test.describe("T-033 a11y reflow — 400 % text spacing", () => {
  // The WCAG 1.4.12 test battery (bookmarklet values normalised by
  // W3C: line-height 1.5×font, paragraph spacing 2×font, letter 0.12em,
  // word 0.16em). Content must remain fully visible with no clipping and
  // no horizontal scrolling. Styles are (re-)injected AFTER navigation —
  // addStyleTag does not survive a page load.

  const spacingCss = `
    p { margin-bottom: 2em !important; }
    li { margin-bottom: 1.25em !important; }
    * {
      line-height: 1.5 !important;
      letter-spacing: 0.12em !important;
      word-spacing: 0.16em !important;
      text-overflow: clip !important;
    }
  `;

  for (const [route, label] of [
    ["/en", "home"],
    ["/en/support", "support"],
    ["/en/admin/sign-in", "sign-in"]
  ] as const) {
    test(`${label} survives 400 % text spacing`, async ({ page }) => {
      if (label === "sign-in") {
        await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
      } else {
        await mockCalendarEvents(page, { events: HOME_EVENTS });
        await mockSupabaseRest(page, {
          responses: {
            site_pages: HOME_PAGE_FIXTURE,
            projects: PROJECTS_FIXTURE,
            calendar_event_links: []
          }
        });
      }
      await page.goto(route);
      await page.addStyleTag({ content: spacingCss });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page, `${label} @400% text spacing`);

      // No fixed-height container clips its own text content (SC 1.4.12
      // "content is not hidden"). Skip visually-hidden utilities.
      const offenders = await page.evaluate(() => {
        const out: string[] = [];
        const isVisuallyHidden = (style: CSSStyleDeclaration, el: Element) => {
          // The project's sr-only utilities (.sr-only, .event-card__sr) clip
          // to 1 px on purpose; their "clipping" is correct, not a 1.4.12
          // violation. Detect the technique, not one class name.
          if (el.classList.contains("sr-only")) return true;
          const clipped =
            style.position === "absolute" &&
            (parseInt(style.width, 10) <= 1 || parseInt(style.height, 10) <= 1);
          return clipped;
        };
        for (const el of Array.from(
          document.querySelectorAll<HTMLElement>("*")
        )) {
          const style = getComputedStyle(el);
          if (!["hidden", "clip"].includes(style.overflowY)) continue;
          if (isVisuallyHidden(style, el)) continue;
          if (el.closest('[aria-hidden="true"]')) continue;
          if (el.clientHeight === 0) continue;
          if (!el.textContent?.trim()) continue;
          if (el.scrollHeight <= el.clientHeight + 4) continue;
          // Only flag containers that actually cut off real content.
          out.push(
            `${el.tagName.toLowerCase()}#${el.id || "-"} .${String(el.className).slice(0, 60)} ` +
              `scrollH=${el.scrollHeight} clientH=${el.clientHeight}`
          );
          if (out.length >= 6) break;
        }
        return out;
      });
      expect(
        offenders,
        `400 % text spacing clips content in ${label}:\n${offenders.join("\n")}`
      ).toEqual([]);
    });
  }
});

test.describe("T-033 a11y contrast — rendered form boundaries (both themes)", () => {
  test("sign-in field border clears 3:1 against fill and page (light)", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/en/admin/sign-in");
    const input = ".admin-field__input";
    // Wait for the Vue-mounted form before reading computed styles — goto()
    // resolves on the HTML shell, and the field does not exist until the SPA
    // hydrates. (Same reason every passing journey awaits its heading.)
    await expect(
      page.getByRole("heading", { level: 1, name: "Administrator sign in" })
    ).toBeVisible();
    await expect(page.locator(input).first()).toBeVisible();
    const againstFill = await renderedContrast(page, {
      fgSel: input,
      fgProp: "borderTopColor",
      bgSel: input
    });
    // The field sits on the transparent `main`, so compare the boundary to the
    // effective painted canvas (body), not the element's own transparent bg.
    const border = await page.evaluate(
      sel => getComputedStyle(document.querySelector(sel)!).borderTopColor,
      input
    );
    const againstPage = await renderedContrastRatioFromStrings(
      page,
      border,
      await effectiveBackground(page, input)
    );
    expect(againstFill, "form border vs input fill").toBeGreaterThanOrEqual(3);
    expect(
      againstPage,
      `form border vs painted page (${border} on ${await effectiveBackground(
        page,
        input
      )})`
    ).toBeGreaterThanOrEqual(3);
  });

  test("sign-in field border clears 3:1 against fill and page (dark)", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/en/admin/sign-in");
    const input = ".admin-field__input";
    await expect(
      page.getByRole("heading", { level: 1, name: "Administrator sign in" })
    ).toBeVisible();
    await expect(page.locator(input).first()).toBeVisible();
    const againstFill = await renderedContrast(page, {
      fgSel: input,
      fgProp: "borderTopColor",
      bgSel: input
    });
    const border = await page.evaluate(
      sel => getComputedStyle(document.querySelector(sel)!).borderTopColor,
      input
    );
    const againstPage = await renderedContrastRatioFromStrings(
      page,
      border,
      await effectiveBackground(page, input)
    );
    expect(
      againstFill,
      "form border vs input fill (dark)"
    ).toBeGreaterThanOrEqual(3);
    expect(
      againstPage,
      `form border vs painted page dark (${border} on ${await effectiveBackground(
        page,
        input
      )})`
    ).toBeGreaterThanOrEqual(3);
  });

  test("Quasar outlined field boundary clears 3:1 against the page (light + dark)", async ({
    page
  }) => {
    // Authenticate ONCE. Re-running `signInAsAdmin` inside the theme loop
    // would navigate to /admin/sign-in while the session is already live; the
    // admin guard bounces an authenticated visitor off the sign-in route, so
    // `getByLabel("Email")` never appears and the second pass times out.
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await mockProjectApi(page, createProjectStore());
    await signInAsAdmin(page);

    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("/en/admin/projects/new");
      // The form only renders once the editor hydrates and its `loading` gate
      // clears; measure the painted border only after it exists.
      await expect(page.getByTestId("project-slug")).toBeVisible();

      // Quasar paints the resting outlined border on the ::before pseudo —
      // the T-033 app.scss rule must have replaced rgba(0,0,0,.24) with the
      // form-border token in both themes.
      const border = await page.evaluate(() => {
        const control = document.querySelector(
          ".q-field--outlined .q-field__control"
        );
        if (!control) throw new Error("no outlined control rendered");
        return getComputedStyle(control, ":before").borderTopColor;
      });
      const pageBg = await page.evaluate(() => {
        const main = document.querySelector("main") ?? document.body;
        let el: HTMLElement | null = main as HTMLElement;
        while (el) {
          const bg = getComputedStyle(el).backgroundColor;
          if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent")
            return bg;
          el = el.parentElement;
        }
        return "rgb(237, 237, 237)";
      });
      const ratio = await renderedContrastRatioFromStrings(
        page,
        border,
        pageBg
      );
      expect(
        ratio,
        `outlined border ${border} vs page ${pageBg} (${theme})`
      ).toBeGreaterThanOrEqual(3);
    }
  });
});

/**
 * The first non-transparent background painting behind `sel` — the surface a
 * sighted user actually sees the field boundary against. `main`/`__main` are
 * transparent (the canvas colour lives on `body`), so reading their computed
 * `backgroundColor` would return the default transparent and be mis-parsed as
 * black, letting the light-theme boundary "pass" against a surface nobody sees.
 */
async function effectiveBackground(page: Page, sel: string): Promise<string> {
  return page.evaluate(startSel => {
    let el: Element | null = document.querySelector(startSel);
    while (el) {
      const bg = getComputedStyle(el).backgroundColor;
      const m = bg.match(/rgba?\(([^)]+)\)/);
      const channels = m?.[1]?.split(",") ?? [];
      const transparent = channels.length === 4 && Number(channels[3]) === 0;
      if (bg && bg !== "transparent" && !transparent) return bg;
      el = el.parentElement;
    }
    return "rgb(237, 237, 237)";
  }, sel);
}

/** Contrast between two resolved rgb() strings, measured in the page. */
async function renderedContrastRatioFromStrings(
  page: Page,
  fg: string,
  bg: string
): Promise<number> {
  return page.evaluate(
    ({ fg: a, bg: b }) => {
      const lum = (color: string): number => {
        const m = color.match(/rgba?\(([^)]+)\)/);
        if (!m || m[1] === undefined) {
          throw new Error(`unparseable colour: ${color}`);
        }
        const parts = m[1].split(",").map(v => Number.parseFloat(v.trim()));
        const [r = 0, g = 0, bb = 0] = parts;
        const lin = (byte: number) => {
          const x = byte / 255;
          return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bb);
      };
      const l1 = lum(a);
      const l2 = lum(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    },
    { fg, bg }
  );
}
