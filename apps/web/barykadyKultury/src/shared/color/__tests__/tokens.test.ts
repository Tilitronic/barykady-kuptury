/**
 * T-006 rev-2: Token-completeness test.
 *
 * WHY this test exists (DESIGN_SYSTEM.md §5):
 * Every token defined in the light theme (:root) MUST also be defined in the
 * dark theme selector.  A missing token in either selector is an immediate
 * failure — partial dark mode is forbidden.
 *
 * Architecture (rev-2, Finding 2):
 * The dark selector is canonically `[data-theme="dark"]` on `<html>` (D-20).
 * The `.dark` class is NOT used and must not appear here.  This test looks
 * for `[data-theme="dark"]` blocks; if only `.dark` is present the test fails,
 * which is the intended guard against re-introducing the removed selector.
 *
 * Architecture (rev-2, Finding 1):
 * The block-extraction helpers are imported from `parseTokensCss.ts` (shared
 * with `contrast.test.ts`) so the parsing logic is not duplicated.
 *
 * The canonical list of required tokens is imported from `tokenNames.ts` so
 * the CSS file and this test share a single source of truth.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { REQUIRED_TOKENS } from "@/shared/color/tokenNames";
import { CSS_PATH, extractBlock, extractAllBlocks } from "./parseTokensCss";

// ─── Test state ───────────────────────────────────────────────────────────────
let cssText = "";
let rootBlock = "";
let darkBlock = "";

beforeAll(() => {
  cssText = readFileSync(CSS_PATH, "utf-8");

  // ── Light theme (:root) ──────────────────────────────────────────────────
  const root = extractBlock(cssText, ":root");
  if (!root) throw new Error("tokens.css: :root block not found");
  rootBlock = root;

  // ── Dark theme ([data-theme="dark"]) ─────────────────────────────────────
  // D-20: the ONLY valid dark selector is [data-theme="dark"] on <html>.
  // The .dark class has been removed; if it reappears this test will still
  // pass on [data-theme="dark"] — the removed-selector guard is in the
  // separate describe block below.
  const darkBlocks = extractAllBlocks(cssText, '[data-theme="dark"]');
  if (darkBlocks.length === 0) {
    throw new Error(
      'tokens.css: [data-theme="dark"] selector block not found. ' +
        "D-20 requires this selector, not .dark. " +
        'Add the [data-theme="dark"] block to tokens.css.'
    );
  }
  darkBlock = darkBlocks.join("\n");
});

// ════════════════════════════════════════════════════════════════════════════
describe("tokens.css — :root defines every required token", () => {
  for (const token of REQUIRED_TOKENS) {
    it(`defines --${token}`, () => {
      expect(rootBlock).toContain(`--${token}:`);
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════
describe('tokens.css — [data-theme="dark"] selector defines every required token (no partial dark mode)', () => {
  for (const token of REQUIRED_TOKENS) {
    it(`defines --${token}`, () => {
      expect(darkBlock).toContain(`--${token}:`);
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// D-20 guard: the .dark class must NOT appear as a standalone CSS selector.
// Its presence would create a second, unconnected dark trigger — a footgun.
// The only acceptable appearance of ".dark" would be inside a comment.
// ════════════════════════════════════════════════════════════════════════════
describe("D-20 dark-selector contract — .dark class must not be a CSS selector", () => {
  it("tokens.css does not contain a .dark CSS selector rule", () => {
    // Strip all comments, then check that '.dark' does not appear as a selector.
    // We remove /* ... */ block comments first.
    const stripped = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
    // After stripping comments, '.dark' should not appear followed by '{' or ','
    // which would indicate it's used as a selector.
    expect(stripped).not.toMatch(/\.dark\s*[{,]/);
  });
});
