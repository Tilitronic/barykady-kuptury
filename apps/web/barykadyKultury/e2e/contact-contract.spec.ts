import { expect } from "@playwright/test";

import {
  CONFIGURED_CONTACT_FIXTURE,
  seedConfiguredContact
} from "./support/journey-fixtures";
import { test } from "./support/network-guard";

/**
 * T-032 — explicit D-09 contact-form contract.
 *
 * D-09 ("Contact form provider") is still open and the V1 default is
 * mailto-only. The contract is not "there is no form today" by accident: a
 * form must never ship without a real delivery endpoint, because a form that
 * silently drops messages is worse than no form (docs/PRODUCT_REQUIREMENTS.md
 * §4, T-021 scope/guard test).
 *
 * These journeys pin the observable part of that decision in every locale:
 * no form element, no form controls, no submission status, and no fabricated
 * channels. When D-09 names a provider, this spec must be updated together
 * with the server endpoint — the failing assertions are the guard.
 */
const LOCALES = {
  en: {
    heading: "Contact",
    empty: "Contact details have not been published yet.",
    about: "About us",
    support: "Support us"
  },
  pl: {
    heading: "Kontakt",
    empty: "Dane kontaktowe nie zostały jeszcze opublikowane.",
    about: "O nas",
    support: "Wesprzyj nas"
  },
  uk: {
    heading: "Контакти",
    empty: "Контактні дані ще не опубліковано.",
    about: "Про нас",
    support: "Підтримайте нас"
  }
} as const;

test.describe("T-032 D-09 contact-form contract", () => {
  for (const locale of ["en", "pl", "uk"] as const) {
    test(`${locale}: no form ships without a provider and nothing is faked`, async ({
      page
    }) => {
      const copy = LOCALES[locale];
      const submissions: string[] = [];

      // A future form must POST to a server endpoint. Watch for one so this
      // contract cannot silently pass with a client-only "success".
      page.on("request", request => {
        const url = new URL(request.url());
        if (
          request.method() === "POST" &&
          /contact/i.test(url.pathname) &&
          !url.pathname.startsWith("/rest/v1/")
        ) {
          submissions.push(request.url());
        }
      });

      await page.goto(`/${locale}/contact`);

      await expect(
        page.getByRole("heading", { level: 1, name: copy.heading })
      ).toBeVisible();
      await expect(page.getByText(copy.empty)).toBeVisible();

      const main = page.locator("main");
      // The D-09 guard: no form and no control that implies delivery.
      await expect(main.locator("form")).toHaveCount(0);
      await expect(
        main.locator("input, textarea, select, button[type='submit']")
      ).toHaveCount(0);
      // No success/error announcement surface either — nothing can be sent.
      await expect(
        main.locator('[role="status"], [role="alert"], [aria-live]')
      ).toHaveCount(0);
      // No fabricated channels while D-04 is unresolved.
      await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
      await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
      await expect(page.locator("address")).toHaveCount(0);

      // The empty state still routes onward instead of dead-ending.
      const pageBody = page.locator(".contact-page");
      await expect(
        pageBody.getByRole("link", { name: copy.about })
      ).toHaveAttribute("href", `/${locale}/about`);
      await expect(
        pageBody.getByRole("link", { name: copy.support })
      ).toHaveAttribute("href", `/${locale}/support`);

      expect(submissions, "contact form attempted a submission").toEqual([]);
    });
  }
});

test.describe("T-032 D-09 configured-contact branch", () => {
  test("a configured public email renders a functional mailto and still no form", async ({
    page
  }) => {
    await seedConfiguredContact(page);
    await page.goto("/en/contact");

    // Fixture data is fictional; the assertion is about the URI contract.
    const email = page.getByRole("link", {
      name: CONFIGURED_CONTACT_FIXTURE.email
    });
    await expect(email).toBeVisible();
    await expect(email).toHaveAttribute(
      "href",
      `mailto:${CONFIGURED_CONTACT_FIXTURE.email}?subject=${encodeURIComponent("Message from the website")}`
    );

    await expect(
      page.getByRole("link", { name: CONFIGURED_CONTACT_FIXTURE.phone })
    ).toHaveAttribute("href", "tel:+48000000000");
    await expect(
      page.getByText(CONFIGURED_CONTACT_FIXTURE.address)
    ).toBeVisible();

    // D-09 still holds with a channel configured: mailto is the V1 path, not
    // a fake form.
    await expect(page.locator("main form")).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("textbox")).toHaveCount(0);
  });
});
