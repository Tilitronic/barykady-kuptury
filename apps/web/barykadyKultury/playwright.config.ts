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
    // T-032 acceptance criterion: every failing journey must leave a
    // screenshot and a trace artifact under `test-results/`, even locally
    // with retries disabled. `retain-on-failure` keeps the trace only when a
    // test fails (no artifact noise on green runs); `only-on-failure` does the
    // same for screenshots. CI retries still produce a trace for the first
    // failing attempt.
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
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
    stderr: "pipe",
    // Provide dummy Supabase credentials so the production build initializes the
    // browser client. The URL points at the Playwright-managed app origin so
    // requests are same-origin; E2E specs intercept /rest/v1/* with deterministic
    // fixtures and never talk to a real project (docs/TESTING.md §2).
    env: {
      VITE_SUPABASE_URL: APP_ORIGIN,
      VITE_SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e2e",
      // T-032 J7: enable the contact fixture seam only in the Playwright build.
      // Tests seed clearly fictional channels through localStorage; the
      // shipped configuration stays empty (D-04, AGENTS.md rule 6).
      VITE_E2E_CONTACT_FIXTURE: "1",
      // T-034: deterministic canonical origin for sitemap/canonical assertions.
      // Production supplies the real public origin through the same variable.
      VITE_SITE_URL: APP_ORIGIN,
      // T-034 gate fix: the local function runtime executes the real calendar
      // binding. Empty credentials force its deterministic fail-closed branch
      // (500 calendar_unavailable) instead of a live Google call, even when the
      // developer's shell exports real values.
      GOOGLE_CALENDAR_ID: "",
      GOOGLE_CALENDAR_API_KEY: ""
    }
  }
});
