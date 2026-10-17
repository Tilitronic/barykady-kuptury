import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveTheme } from "@/features/theme/theme";

/**
 * Parity guard between the pure resolver and the CSP pre-paint script.
 *
 * `public/theme-init.js` cannot import the TypeScript resolver, so it
 * re-implements the same precedence in plain ES5. This test executes the real
 * shipped script in a controlled DOM and asserts it produces exactly the theme
 * `resolveTheme` would — so the no-flash path can never silently drift from the
 * runtime contract (T-010 "pre-paint source stays in sync" requirement).
 */
// Vitest's `import.meta.url` is rewritten to an http URL under happy-dom, so the
// script is located relative to the app root (the Vitest/Vite root = cwd).
const prePaintSource = readFileSync(
  resolve(process.cwd(), "public/theme-init.js"),
  "utf8"
);

interface Scenario {
  stored: string | null;
  systemPrefersDark: boolean;
  readThrows?: boolean;
}

/** Runs the pre-paint script and returns the `[data-theme]` it applied. */
function runPrePaint(scenario: Scenario): string | null {
  const doc = document.implementation.createHTMLDocument("theme-init");

  const windowLike = {
    localStorage: {
      getItem() {
        if (scenario.readThrows) {
          throw new Error("SecurityError: storage is blocked");
        }
        return scenario.stored;
      }
    },
    matchMedia: () => ({
      matches: scenario.systemPrefersDark,
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    })
  };

  // The script is an IIFE over `window`/`document`; injecting both keeps the
  // test hermetic and lets us read the attribute it applied. Using
  // the Function constructor is deliberate: it executes the real shipped script.
  // oxlint-disable-next-line typescript/no-implied-eval
  const run = new Function("window", "document", prePaintSource) as (
    win: unknown,
    doc: unknown
  ) => void;
  run(windowLike, doc);

  return doc.documentElement.getAttribute("data-theme");
}

describe("pre-paint script parity with resolveTheme", () => {
  const scenarios: Scenario[] = [
    { stored: "dark", systemPrefersDark: false },
    { stored: "light", systemPrefersDark: true },
    { stored: null, systemPrefersDark: true },
    { stored: null, systemPrefersDark: false },
    { stored: "blue", systemPrefersDark: true },
    { stored: "", systemPrefersDark: false },
    { stored: "dark", systemPrefersDark: false, readThrows: true }
  ];

  it.each(scenarios)(
    "resolves stored=$stored systemPrefersDark=$systemPrefersDark like the pure resolver",
    scenario => {
      const effectiveStored = scenario.readThrows ? null : scenario.stored;

      expect(runPrePaint(scenario)).toBe(
        resolveTheme({
          systemPrefersDark: scenario.systemPrefersDark,
          stored: effectiveStored
        })
      );
    }
  );

  it("does not throw when storage access is blocked", () => {
    expect(() =>
      runPrePaint({ stored: null, systemPrefersDark: false, readThrows: true })
    ).not.toThrow();
  });
});
