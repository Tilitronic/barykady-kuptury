import { expect, type Locator, type Page } from "@playwright/test";

/**
 * T-032 keyboard helpers.
 *
 * The journey matrix needs one honest definition of "keyboard-only" and
 * "visible focus" instead of per-spec approximations:
 * - `focusBody` resets the tab order to the document start;
 * - `expectVisibleFocus` proves the focused element is `:focus-visible`, has a
 *   computed outline/box-shadow, or sits in a Quasar field that paints its own
 *   focused indicator (`q-field--focused`). A test cannot pass by merely
 *   moving `document.activeElement` while leaving the user unable to see it
 *   (docs/DESIGN_SYSTEM.md §6, WCAG 2.4.7).
 */

/** Signs in through the real form without installing the auth mock. */
export async function signInWithoutMocks(
  page: Page,
  locale: "en" | "pl" | "uk" = "en"
): Promise<void> {
  const labels = {
    en: { email: "Email", password: "Password", submit: "Sign in" },
    pl: {
      email: "E-mail",
      password: "Hasło",
      submit: "Zaloguj się"
    },
    uk: {
      email: "Електронна пошта",
      password: "Пароль",
      submit: "Увійти"
    }
  }[locale];

  await page.goto(`/${locale}/admin/sign-in`);
  await page.getByLabel(labels.email).fill("admin@demo.local");
  await page.getByLabel(labels.password).fill("e2e-password");
  await page.getByRole("button", { name: labels.submit }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: /Dashboard|Pulpit|Панель/ })
  ).toBeVisible();
}

/** Puts focus on the document body so the next Tab starts at the very top. */
export async function focusBody(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.body.setAttribute("tabindex", "-1");
    document.body.focus();
    document.body.removeAttribute("tabindex");
  });
}

export interface FocusStyle {
  tag: string;
  id: string;
  text: string;
  focusVisible: boolean;
  outlineWidth: number;
  outlineStyle: string;
  boxShadow: string;
  quasarFieldFocused: boolean;
}

/** Reads the focused element's visible-focus signals without mutating it. */
export async function focusedStyle(page: Page): Promise<FocusStyle> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element) {
      return {
        tag: "none",
        id: "",
        text: "",
        focusVisible: false,
        outlineWidth: 0,
        outlineStyle: "none",
        boxShadow: "none",
        quasarFieldFocused: false
      };
    }

    const style = getComputedStyle(element);
    return {
      tag: element.tagName,
      id: element.id,
      text: (element.textContent ?? "").trim().slice(0, 80),
      focusVisible: element.matches(":focus-visible"),
      outlineWidth: Number.parseFloat(style.outlineWidth) || 0,
      outlineStyle: style.outlineStyle,
      boxShadow: style.boxShadow,
      quasarFieldFocused:
        element.closest(".q-field")?.classList.contains("q-field--focused") ??
        false
    };
  });
}

/**
 * Asserts the currently focused element has a visible keyboard indicator.
 * Returns the captured style so a caller can also assert identity.
 */
export async function expectVisibleFocus(
  page: Page,
  label: string
): Promise<FocusStyle> {
  const style = await focusedStyle(page);

  expect(style.focusVisible, `${label} is not :focus-visible`).toBe(true);

  const hasOutline = style.outlineStyle !== "none" && style.outlineWidth > 0;
  const hasShadow = style.boxShadow !== "none";
  expect(
    hasOutline || hasShadow || style.quasarFieldFocused,
    `${label} has no visible focus indicator (outline=${style.outlineWidth} ` +
      `${style.outlineStyle}, box-shadow=${style.boxShadow}, ` +
      `q-field--focused=${style.quasarFieldFocused})`
  ).toBe(true);

  return style;
}

/**
 * Tabs forward until the expected control (resolved by accessible role + name)
 * owns focus, returning the number of stops used or -1 when the bounded walk
 * never reached it. Role/name resolution keeps the assertion independent of
 * DOM structure, classes and test ids: a renamed control fails, a restyled one
 * does not.
 */
type AriaRole = Parameters<Page["getByRole"]>[0];

export async function tabUntilRole(
  page: Page,
  role: AriaRole,
  name: string | RegExp,
  options: { maxStops?: number; within?: Locator } = {}
): Promise<number> {
  const { maxStops = 24, within = page } = options;
  const target = within.getByRole(role, { name }).first();

  for (let stop = 1; stop <= maxStops; stop += 1) {
    await page.keyboard.press("Tab");
    const focused = await target
      .evaluate(element => element === document.activeElement)
      .catch(() => false);
    if (focused) return stop;
  }
  return -1;
}
