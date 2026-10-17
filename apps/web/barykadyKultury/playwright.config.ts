import { defineConfig, devices } from "@playwright/test";

import { APP_ORIGIN, APP_PORT } from "./e2e/support/origin";

/**
 * Playwright E2E configuration (T-003).
 *
 * Determinism rules from docs/TESTING.md §2 are enforced here:
 * - the harness starts and stops its own production build server (`webServer`),
 *   so no server must be running beforehand;
 * - a fixed loopback port and baseURL remove environment coupling;
 * - only chromium is enabled by default because its browser revision is the one
 *   already present in the local Playwright cache; firefox/webkit stay commented
 *   for CI where they can be installed explicitly.
 */

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: APP_ORIGIN,
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
    // Optional CI coverage — enable once the CI image installs them:
    // { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    // { name: "webkit", use: { ...devices["Desktop Safari"] } }
  ],
  webServer: {
    command: `pnpm build && node scripts/serve-spa.mjs --port ${APP_PORT}`,
    url: APP_ORIGIN,
    // The harness owns the server: it must start and stop it. Reuse is disabled
    // by default so a stale local server can never mask a broken build; opt in
    // explicitly with PW_REUSE_SERVER=1 only when iterating on specs.
    reuseExistingServer: process.env.PW_REUSE_SERVER === "1",
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe"
  }
});
