import { expect } from "@playwright/test";

import { mockCalendarEvents, mockSupabaseRest } from "./support/mocks";
import {
  ABOUT_PAGE_FIXTURE,
  HOME_EVENTS,
  HOME_PAGE_FIXTURE,
  PROJECTS_FIXTURE
} from "./support/journey-fixtures";
import { test } from "./support/network-guard";

/**
 * T-033 — reduced motion and flash safety (docs/DESIGN_SYSTEM.md §6:
 * "Motion respects prefers-reduced-motion; avoid flashing and unnecessary
 * animation"; PRODUCT_REQUIREMENTS §3).
 *
 * The design system's contract (tokens.css §4): every site transition runs
 * on `var(--motion-duration)`, which flips to 0 ms under
 * `prefers-reduced-motion`, and the QSkeleton shimmer is explicitly frozen.
 * These tests prove the contract on the live render — a source grep cannot
 * prove the computed outcome, and a screenshot cannot prove duration.
 */

/**
 * True when a CSS time string is exactly zero, in any unit.
 *
 * WHY: the production CSS minifier rewrites the authored `0ms` token to `0s`
 * (both serialise the same zero duration). The contract under
 * `prefers-reduced-motion` is "no time", not "no milliseconds", so the proof
 * must accept whichever unit the shipped stylesheet happens to emit —
 * otherwise the test asserts the minifier's formatting, not the design token.
 */
const isZeroDuration = (value: string): boolean => {
  const trimmed = value.trim();
  const match = trimmed.match(/^(-?\d*\.?\d+)(ms|s)$/);
  if (!match) return false;
  const magnitude =
    match[2] === "s" ? Number(match[1]) * 1000 : Number(match[1]);
  return magnitude === 0;
};

/**
 * Assert every entry of an element's computed `transitionDuration` list is a
 * zero duration.
 *
 * WHY not a plain string equality: a `transition` shorthand that lists two
 * properties (e.g. `color`, `border-color`) serialises as `"0s, 0s"` — one
 * value per property — so `toEqual(["0s"])` could never pass. The design
 * contract is "no transition time on any property", which is exactly what
 * this checks. (docs/DESIGN_SYSTEM.md §6.)
 */
const allTransitionsZero = (value: string): boolean =>
  value
    .split(",")
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0)
    .every(isZeroDuration);

/** Running CSS keyframe animations (not short interaction transitions). */
const activeAnimations = () =>
  (
    document as Document & {
      getAnimations: () => Animation[];
    }
  )
    .getAnimations()
    .filter(animation => animation.constructor.name.includes("CSSAnimation"))
    .map(animation => {
      const timing = animation.effect?.getComputedTiming();
      return {
        name:
          (animation as Animation & { animationName?: string }).animationName ??
          "unknown",
        duration: Number(timing?.duration ?? 0)
      };
    });

test.describe("T-033 a11y motion — prefers-reduced-motion", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("the motion token collapses to 0 ms and nothing keyframes on the home page", async ({
    page
  }) => {
    await mockCalendarEvents(page, { events: HOME_EVENTS });
    await mockSupabaseRest(page, {
      responses: {
        site_pages: HOME_PAGE_FIXTURE,
        projects: PROJECTS_FIXTURE,
        calendar_event_links: []
      }
    });
    await page.goto("/en");
    await expect(
      page.getByRole("heading", { level: 1, name: "Barykady Kultury" })
    ).toBeVisible();

    const duration = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue(
        "--motion-duration"
      )
    );
    expect(
      isZeroDuration(duration),
      `--motion-duration must be zero under reduce (got "${duration}")`
    ).toBe(true);

    // Dark theme carries the same collapse (tokens.css reduced block lists
    // both selectors). emulateMedia resets any property it is not given, so
    // the reduced-motion override MUST be re-asserted alongside the colour
    // scheme — otherwise this reload silently restores 200 ms motion and the
    // proof would measure the wrong thing.
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "Barykady Kultury" })
    ).toBeVisible();
    const darkDuration = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue(
        "--motion-duration"
      )
    );
    expect(
      isZeroDuration(darkDuration),
      `--motion-duration must be zero in dark under reduce (got "${darkDuration}")`
    ).toBe(true);
  });

  test("site transitions run at 0 s while reduced motion is set", async ({
    page
  }) => {
    await mockCalendarEvents(page, { events: HOME_EVENTS });
    await mockSupabaseRest(page, {
      responses: {
        site_pages: HOME_PAGE_FIXTURE,
        projects: PROJECTS_FIXTURE,
        calendar_event_links: []
      }
    });
    await page.goto("/en");
    // Wait for the header to hydrate before reading computed styles, otherwise
    // the query runs against the pre-mount HTML shell and the controls are not
    // in the DOM yet.
    await expect(
      page.getByRole("heading", { level: 1, name: "Barykady Kultury" })
    ).toBeVisible();
    await expect(page.locator(".theme-toggle__switch")).toBeVisible();
    // Representative site-owned animated elements: the theme switch track and
    // a header nav link both declare transitions on the token.
    const durations = await page.evaluate(() => {
      const selectors = [".theme-toggle__switch", ".app-header__nav-link"];
      return selectors.map(sel => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`missing ${sel}`);
        return getComputedStyle(el).transitionDuration;
      });
    });
    for (const entry of durations) {
      expect(
        allTransitionsZero(entry),
        `transition not collapsed to zero under reduce (got "${entry}")`
      ).toBe(true);
    }
  });

  test("loading skeletons do not shimmer under reduced motion", async ({
    page
  }) => {
    await mockSupabaseRest(page, {
      responses: { site_pages: ABOUT_PAGE_FIXTURE }
    });
    // Hold the calendar response so the events skeleton is actually on screen
    // when we measure it (mockCalendarEvents delayMs, T-033).
    await mockCalendarEvents(page, { events: HOME_EVENTS, delayMs: 15_000 });
    await page.goto("/en/events");
    const skeleton = page.locator(".q-skeleton").first();
    await expect(skeleton).toBeVisible();
    const animation = await skeleton.evaluate(element => {
      const style = getComputedStyle(element);
      return { name: style.animationName, duration: style.animationDuration };
    });
    expect(
      animation.name,
      `skeleton still animates under reduce (${JSON.stringify(animation)})`
    ).toBe("none");
  });

  test("no keyframe animation of any kind is running while reduced", async ({
    page
  }) => {
    await mockCalendarEvents(page, { events: HOME_EVENTS });
    await mockSupabaseRest(page, {
      responses: {
        site_pages: HOME_PAGE_FIXTURE,
        projects: PROJECTS_FIXTURE,
        calendar_event_links: []
      }
    });
    await page.goto("/en");
    await expect(
      page.getByRole("heading", { level: 1, name: "Barykady Kultury" })
    ).toBeVisible();
    await page.waitForTimeout(400);
    const animations = await page.evaluate(activeAnimations);
    expect(animations).toEqual([]);
  });
});

test.describe("T-033 a11y motion — flash ceiling on the only looping animation", () => {
  test("skeleton shimmer exists only with motion allowed and is far below 3 Hz", async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await mockSupabaseRest(page);
    await mockCalendarEvents(page, { events: HOME_EVENTS, delayMs: 15_000 });
    await page.goto("/en/events");
    const skeleton = page.locator(".q-skeleton").first();
    await expect(skeleton).toBeVisible();

    // WCAG 2.3.1: flashing must be < 3 cycles/second. The QSkeleton wave is
    // an opacity fade (no luminance flash) and its period must stay far
    // above 333 ms — measured, not asserted from documentation.
    const periods = await page.evaluate(activeAnimations);
    expect(
      periods.length,
      "skeleton wave should animate when motion is allowed"
    ).toBeGreaterThan(0);
    for (const animation of periods) {
      expect(
        animation.duration,
        `${animation.name} flashes faster than the 3 Hz ceiling`
      ).toBeGreaterThanOrEqual(333);
    }
  });
});
