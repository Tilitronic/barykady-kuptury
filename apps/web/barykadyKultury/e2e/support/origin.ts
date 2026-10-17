/**
 * Single source of truth for the Playwright-managed application origin.
 *
 * `playwright.config.ts` builds its `BASE_URL` from these values and the
 * network guard in `./network-guard.ts` compares request origins against
 * `APP_ORIGIN`, so the port can never drift between the two.
 */

/** Fixed loopback port the E2E harness owns (started/stopped by Playwright). */
export const APP_PORT = 4173;

/** Absolute origin of the built app under test. */
export const APP_ORIGIN = `http://127.0.0.1:${APP_PORT}`;
