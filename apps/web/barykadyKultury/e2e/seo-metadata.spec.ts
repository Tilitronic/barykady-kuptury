import { expect, type Page } from "@playwright/test";

import { APP_ORIGIN } from "./support/origin";
import { test } from "./support/network-guard";

/**
 * T-034 — SEO metadata acceptance (docs/tickets/T-034-seo-deploy.md).
 *
 * These assertions run against the *built* SPA, so they cover the real head
 * management rather than a unit-test DOM stub:
 *   - every public route × every locale has a localized title/description;
 *   - canonical points at the locale-prefixed URL of the current route;
 *   - hreflang advertises en/pl/uk plus x-default → English;
 *   - document lang matches the URL prefix after client-side navigation;
 *   - admin routes are noindex and carry no canonical;
 *   - robots.txt / sitemap.xml are real files served by the build.
 *
 * The canonical origin comes from `VITE_SITE_URL`, which the Playwright
 * webServer pins to APP_ORIGIN (see playwright.config.ts). Production supplies
 * its own origin through the same documented variable
 * (docs/environment.md), so the test never has to know the real domain.
 */

const LOCALES = ["en", "pl", "uk"] as const;

/** Indexable, statically-known public routes (locale-less form). */
const PUBLIC_PATHS = [
  "",
  "/about",
  "/contact",
  "/events",
  "/projects",
  "/publications",
  "/support"
] as const;

function canonicalFor(path: string): string {
  return `${APP_ORIGIN}${path}`;
}

function alternateFor(path: string, locale: string): string {
  const segments = path.split("/").filter(Boolean);
  segments[0] = locale;
  return canonicalFor(`/${segments.join("/")}`);
}

async function expectCanonical(page: Page, href: string): Promise<void> {
  await expect(
    page.locator('link[rel="canonical"]'),
    `canonical for ${href}`
  ).toHaveAttribute("href", href);
}

test.describe("seo metadata", () => {
  test("every public route exposes locale-correct metadata", async ({
    page
  }) => {
    for (const locale of LOCALES) {
      for (const route of PUBLIC_PATHS) {
        const path = `/${locale}${route}`;
        await page.goto(path);

        await expect(page.locator("html")).toHaveAttribute("lang", locale);

        const title = await page.title();
        expect(title.trim(), `${path} title`).not.toBe("");
        expect(title, `${path} must not use the 404 title`).not.toBe(
          "Page not found"
        );

        const description = page.locator('meta[name="description"]');
        await expect(description, `${path} description`).toHaveAttribute(
          "content",
          /\S/
        );

        const canonical = canonicalFor(path);
        await expectCanonical(page, canonical);

        await expect(
          page.locator('meta[property="og:url"]'),
          `${path} og:url`
        ).toHaveAttribute("content", canonical);
        await expect(
          page.locator('meta[property="og:title"]'),
          `${path} og:title`
        ).toHaveAttribute("content", title);

        for (const alternate of LOCALES) {
          await expect(
            page.locator(`link[rel="alternate"][hreflang="${alternate}"]`),
            `${path} hreflang ${alternate}`
          ).toHaveAttribute("href", alternateFor(path, alternate));
        }
        await expect(
          page.locator('link[rel="alternate"][hreflang="x-default"]'),
          `${path} x-default`
        ).toHaveAttribute("href", alternateFor(path, "en"));

        // Public pages must stay indexable (review gate: no noindex on public).
        await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
      }
    }
  });

  test("admin routes are noindex and carry no canonical graph", async ({
    page
  }) => {
    await page.goto("/en/admin/sign-in");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.locator('meta[name="robots"]'),
      "admin sign-in robots"
    ).toHaveAttribute("content", "noindex, nofollow");
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(
      0
    );

    // A protected route redirects anonymous visitors to sign-in; the
    // destination must still be noindex (the admin parent declares it, so no
    // child can forget it).
    await page.goto("/pl/admin");
    await expect(page).toHaveURL(/\/pl\/admin\/sign-in/);
    await expect(
      page.locator('meta[name="robots"]'),
      "redirected admin robots"
    ).toHaveAttribute("content", "noindex, nofollow");
  });

  test("robots.txt and sitemap.xml describe the public site", async ({
    request
  }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.status(), "robots.txt status").toBe(200);
    const robotsBody = await robots.text();
    expect(robotsBody, "robots.txt body").toContain("User-agent: *");
    expect(robotsBody, "robots.txt admin rule").toContain("Disallow: /*/admin");
    expect(robotsBody, "robots.txt sitemap").toContain(
      `Sitemap: ${APP_ORIGIN}/sitemap.xml`
    );

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status(), "sitemap.xml status").toBe(200);
    const sitemapBody = await sitemap.text();
    expect(sitemapBody, "sitemap root").toContain(
      `<loc>${APP_ORIGIN}/en</loc>`
    );
    for (const locale of LOCALES) {
      for (const route of PUBLIC_PATHS) {
        expect(sitemapBody, `sitemap entry ${locale}${route || "/"}`).toContain(
          `<loc>${APP_ORIGIN}/${locale}${route}</loc>`
        );
      }
    }
    expect(sitemapBody, "sitemap must exclude admin").not.toContain("/admin");
    expect(sitemapBody, "sitemap hreflang").toContain(`hreflang="x-default"`);
  });

  test("favicons and the web app manifest are served from brand assets", async ({
    page,
    request
  }) => {
    await page.goto("/en");

    await expect(
      page.locator('link[rel="icon"][type="image/svg+xml"]')
    ).toHaveAttribute("href", /favicon\.svg/);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/manifest.webmanifest"
    );

    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.status(), "manifest status").toBe(200);
    const body = (await manifest.json()) as {
      name: string;
      icons: { src: string }[];
    };
    expect(body.name).toBe("Barykady Kultury");
    expect(body.icons.length).toBeGreaterThan(0);
    for (const icon of body.icons) {
      expect((await request.get(icon.src)).status(), icon.src).toBe(200);
    }

    expect((await request.get("/favicon.svg")).status()).toBe(200);
    expect((await request.get("/icons/favicon-128x128.png")).status()).toBe(
      200
    );
  });
});
