/**
 * Shared CSS-parsing helpers consumed by both `tokens.test.ts` and
 * `contrast.test.ts`.
 *
 * WHY this module exists (T-006 rev-2, Finding 1):
 * The contrast gate must derive its hex values from the actual
 * `src/css/tokens.css` at test time.  If a token hex changes in the CSS the
 * test must automatically fail — hard-coded copies in the test file would allow
 * silent drift.  Centralising the parser here means both test files share one
 * implementation and there is no duplication.
 *
 * Parsing strategy: we read the CSS as plain text and walk brace depth so that
 * nested @media blocks are handled correctly without a full CSS parser.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

// ─── File path ────────────────────────────────────────────────────────────────

/**
 * Absolute path to `src/css/tokens.css`, resolved from the Vitest cwd (the
 * app root).  Both test files import this constant so the path is never
 * duplicated.
 */
export const CSS_PATH = join(process.cwd(), "src/css/tokens.css");

// ─── Block extraction ─────────────────────────────────────────────────────────

/**
 * Extract the _first_ block body (text between `{` and the matching `}`)
 * whose selector region contains `selectorSearch`.
 *
 * Uses a brace-depth counter so nested @media blocks are handled correctly.
 * Returns `null` when no matching block is found.
 */
export function extractBlock(
  css: string,
  selectorSearch: string
): string | null {
  const idx = css.indexOf(selectorSearch);
  if (idx === -1) return null;

  const braceStart = css.indexOf("{", idx);
  if (braceStart === -1) return null;

  let depth = 0;
  let i = braceStart;
  while (i < css.length) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(braceStart + 1, i);
    }
    i++;
  }
  return null;
}

/**
 * Collect ALL block bodies whose selector region contains `selectorSearch`.
 *
 * Used when a selector appears both as a standalone rule and nested inside an
 * @media block (e.g. `[data-theme="dark"]` appears standalone and inside the
 * `prefers-color-scheme: dark` media query).
 */
export function extractAllBlocks(
  css: string,
  selectorSearch: string
): string[] {
  const results: string[] = [];
  let searchFrom = 0;

  while (true) {
    const idx = css.indexOf(selectorSearch, searchFrom);
    if (idx === -1) break;

    const braceStart = css.indexOf("{", idx);
    if (braceStart === -1) break;

    let depth = 0;
    let i = braceStart;
    while (i < css.length) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") {
        depth--;
        if (depth === 0) {
          results.push(css.slice(braceStart + 1, i));
          break;
        }
      }
      i++;
    }
    searchFrom = idx + selectorSearch.length;
  }

  return results;
}

// ─── Hex extraction ───────────────────────────────────────────────────────────

/**
 * Extract the 6-digit hex value of a CSS custom property from a block body.
 *
 * Matches `--<tokenName>: #RRGGBB` (whitespace-tolerant, case-insensitive hex).
 * Returns the hex string with `#` prefix (upper-cased) or `null` when the
 * token is absent or its value is not a simple 6-digit hex (e.g. `rgba(…)`,
 * multi-value shadows, and `0ms` durations all return null).
 */
export function parseHex(block: string, tokenName: string): string | null {
  const re = new RegExp(`--${tokenName}:\\s*(#[0-9a-fA-F]{6})\\b`, "i");
  const match = block.match(re);
  const hex = match?.[1];
  return hex ? hex.toUpperCase() : null;
}

// ─── Theme hex maps ───────────────────────────────────────────────────────────

/**
 * Read `tokens.css` and return hex maps for the `:root` (light) and
 * `[data-theme="dark"]` themes.
 *
 * - Keys are bare token names WITHOUT the leading `--` (e.g. `"color-text"`).
 * - Values are `#RRGGBB` strings or `null` when the property is not a plain hex
 *   (shadow strings, `rgba(…)`, `0ms`, etc.).
 *
 * The dark map is built from ALL blocks that match `[data-theme="dark"]`
 * (standalone + inside @media) joined together, so any token defined in either
 * location is found.
 */
export function parseThemeHexes(cssText: string): {
  light: Record<string, string | null>;
  dark: Record<string, string | null>;
} {
  const rootBlock = extractBlock(cssText, ":root") ?? "";

  // Collect standalone [data-theme="dark"] blocks and any inside @media.
  const darkBlocks = extractAllBlocks(cssText, '[data-theme="dark"]');
  const darkBlock = darkBlocks.join("\n");

  // Enumerate every custom property name mentioned in either block.
  const tokenRe = /--([a-z][a-z0-9-]*):/g;
  const names = new Set<string>();
  for (const m of (rootBlock + darkBlock).matchAll(tokenRe)) {
    const name = m[1];
    if (name) names.add(name);
  }

  const mapBlock = (block: string): Record<string, string | null> => {
    const out: Record<string, string | null> = {};
    for (const name of names) {
      out[name] = parseHex(block, name);
    }
    return out;
  };

  return { light: mapBlock(rootBlock), dark: mapBlock(darkBlock) };
}

// ─── Convenience loader ───────────────────────────────────────────────────────

/**
 * Read tokens.css from disk and return parsed theme hex maps.
 * Throws if the file cannot be read.
 */
export function loadThemeHexes(): {
  cssText: string;
  light: Record<string, string | null>;
  dark: Record<string, string | null>;
} {
  const cssText = readFileSync(CSS_PATH, "utf-8");
  const { light, dark } = parseThemeHexes(cssText);
  return { cssText, light, dark };
}
