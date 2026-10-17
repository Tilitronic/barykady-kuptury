/**
 * Default "no live services" network guard for E2E tests.
 *
 * docs/TESTING.md §2 requires tests to be deterministic and to never depend on
 * a real calendar, Supabase project, or any other network timing. A passing
 * suite is not proof of that on its own: today's placeholder app simply makes
 * no calls, so the guarantee would silently rot as features land. This fixture
 * makes the contract structural — any outbound request that is not the app
 * under test and not handled by an explicit mock is aborted and fails the test.
 *
 * How mocks cooperate: the guard registers a catch-all page route during
 * setup, before any test-body mock. Playwright evaluates matching routes
 * in reverse registration order, so mocks registered later in a test (for
 * example `mockCalendarEvents`) are checked first and the guard only ever sees
 * traffic no mock claimed. Same-origin and non-HTTP(S) (data:/blob:) requests
 * are passed through unchanged.
 *
 * T-032 extends this by importing `test` from here instead of `@playwright/test`.
 */

import { expect, test as base } from "@playwright/test";

import { APP_ORIGIN } from "./origin";

export interface NetworkGuard {
  /** URLs aborted because they were neither the app origin nor mocked. */
  readonly violations: string[];
}

export const test = base.extend<{ networkGuard: NetworkGuard }>({
  networkGuard: [
    async ({ page }, use) => {
      const violations: string[] = [];

      await page.route("**/*", async route => {
        const requestUrl = route.request().url();
        const { origin, protocol } = new URL(requestUrl);
        const isHttp = protocol === "http:" || protocol === "https:";

        // Explicit mocks register later and therefore win before we run; by the
        // time a request reaches this handler it is genuinely unmocked.
        if (!isHttp || origin === APP_ORIGIN) {
          await route.fallback();
          return;
        }

        violations.push(requestUrl);
        await route.abort("blockedbyclient");
      });

      await use({ violations });

      expect(
        violations,
        `Blocked ${violations.length} unmocked external request(s). ` +
          `Add a mock from e2e/support/mocks.ts for each:\n${violations.join("\n")}`
      ).toEqual([]);
    },
    { auto: true }
  ]
});
