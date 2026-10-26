import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * SCSS-only styling gate (T-049 §2, owner instruction 2026-10-26).
 *
 * WHY this must be a test: the visual audit that produced the earlier inventory
 * looked for utility tokens but nothing enforced the rule, so utility classes
 * kept appearing in new markup (AdminImportPage accumulated 66 of them). A
 * written convention that CI does not check rots; this scan makes the next
 * `class="q-pa-md"` a red test instead of a review comment.
 *
 * The rule applies to AUTHORED markup. Classes Quasar generates (`q-btn`,
 * `q-card`, `q-item`, …) are never written in templates, so they cannot appear
 * here; component props (`color="primary"`, `flat`, `dense`) are also allowed.
 * Spacing, typography, colour helpers, the flex/grid helper family and the
 * visibility/decoration helpers are all class-to-style syntax and must be
 * replaced with BEM rules in the component's scoped SCSS using our tokens.
 */

/** One banned class-to-style family, kept separate so it can be reviewed. */
export interface BannedUtilityClass {
  /** Human-readable family name used in failure output. */
  readonly label: string;
  /** Matches a complete class token, never a BEM fragment. */
  readonly pattern: RegExp;
}

/**
 * The single reviewable list of Quasar class-to-style syntax.
 *
 * Each pattern matches a complete class token (^…$), so a semantic BEM class
 * such as `admin-import__row` or `page-toc__column-title` is not mistaken for
 * the Quasar helper `row` / `column`.
 */
export const BANNED_UTILITY_CLASSES: readonly BannedUtilityClass[] = [
  {
    label: "spacing helpers (q-p*, q-m*, q-gutter-*)",
    pattern:
      /^(?:q-(?:p|m)[trblaxy]?-(?:none|auto|xs|sm|md|lg|xl)|q-gutter(?:-[xy])?-(?:xs|sm|md|lg|xl)|q-col-gutter(?:-[xy])?-(?:xs|sm|md|lg|xl)|no-margin|no-padding)$/u
  },
  {
    label: "typography helpers (text-h*/subtitle*/body*/caption/overline)",
    pattern: /^text-(?:h[1-6]|subtitle[12]|body[12]|caption|overline)$/u
  },
  {
    label: "font helpers (text-weight-*, text-bold/italic/…)",
    pattern:
      /^text-(?:weight-(?:thin|light|regular|medium|bold|bolder)|center|left|right|justify|uppercase|lowercase|capitalize|no-wrap|strike|italic|bold)$/u
  },
  {
    label: "colour helpers (text-<colour>, bg-<colour>)",
    pattern:
      /^(?:text|bg)-(?:primary|secondary|accent|positive|negative|warning|info|dark|white|black|transparent|red|pink|purple|deep-purple|indigo|blue|light-blue|cyan|teal|green|light-green|lime|yellow|amber|orange|deep-orange|brown|grey|blue-grey)(?:-\d+)?$/u
  },
  {
    label:
      "flex/grid helpers (row, column, col-*, offset-*, items-*, justify-*, self-*)",
    pattern:
      /^(?:row|column|col(?:-(?:\d+|(?:xs|sm|md|lg|xl)(?:-\d+)?|auto|grow|shrink))?|offset-\d+|items-(?:start|end|center|baseline|stretch)|justify-(?:start|end|center|between|around|evenly)|self-(?:start|end|center|baseline|stretch)|order-(?:first|last)|flex-center|no-wrap)$/u
  },
  {
    label: "visibility/shape/decoration helpers",
    pattern:
      /^(?:shadow-\d+|rounded-borders|ellipsis|full-width|absolute(?:-(?:top|bottom|left|right|center|full|fit))?|cursor-pointer|non-selectable)$/u
  }
];

/** Matches static and bound class attributes, including multi-line values. */
const CLASS_ATTRIBUTE_PATTERN =
  /(?::|v-bind:)?class\s*=\s*(?:"([^"]*)"|'([^']*)')/gsu;

/**
 * Extracts candidate class names from a static or bound attribute value.
 *
 * Bound values contain JavaScript (`cond ? "bg-negative" : "bg-positive"`),
 * so the scan works on identifier-shaped tokens and matches each one against
 * a full-token pattern. That keeps BEM names such as `…__row` or `…__file-row`
 * legal while still catching the Quasar helper `row`.
 */
const CLASS_TOKEN_PATTERN = /[A-Za-z][\w-]*/gu;

/** Removes script/style blocks and template comments before scanning markup. */
function templateOnly(source: string): string {
  return source
    .replace(/<script[\s\S]*?<\/script>/gu, "")
    .replace(/<style[\s\S]*?<\/style>/gu, "")
    .replace(/<!--[\s\S]*?-->/gu, "");
}

/** Recursively collects every Vue SFC under src/. */
function* walkVueFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      yield* walkVueFiles(full);
    } else if (entry.endsWith(".vue")) {
      yield full;
    }
  }
}

/** Returns every banned class token found in a class attribute value. */
export function findBannedUtilityClasses(value: string): string[] {
  const tokens = value.match(CLASS_TOKEN_PATTERN) ?? [];
  const hits: string[] = [];

  for (const token of tokens) {
    const banned = BANNED_UTILITY_CLASSES.some(({ pattern }) =>
      pattern.test(token)
    );
    if (banned) hits.push(token);
  }

  return hits;
}

interface Offender {
  readonly file: string;
  readonly line: number;
  readonly tokens: readonly string[];
  readonly value: string;
}

/** Scans one SFC and reports every banned class attribute usage. */
function scanFile(file: string, relativeTo: string): Offender[] {
  const source = readFileSync(file, "utf8");
  const template = templateOnly(source);
  const offenders: Offender[] = [];

  for (const match of template.matchAll(CLASS_ATTRIBUTE_PATTERN)) {
    const value = match[1] ?? match[2] ?? "";
    const tokens = findBannedUtilityClasses(value);
    if (tokens.length === 0) continue;

    const line = template.slice(0, match.index).split("\n").length;
    offenders.push({
      file: relative(relativeTo, file),
      line,
      tokens,
      value: value.trim().replace(/\s+/gu, " ")
    });
  }

  return offenders;
}

describe("SCSS-only styling policy", () => {
  it("detects the banned families (the gate itself is not vacuous)", () => {
    expect(
      findBannedUtilityClasses(
        "row q-pa-md q-col-gutter-md col-12 col-sm-6 text-h5 text-subtitle1 text-body2 text-grey-7 bg-negative bg-blue-5 text-deep-orange-9 shadow-2 absolute cursor-pointer"
      )
    ).toEqual(
      expect.arrayContaining([
        "row",
        "q-pa-md",
        "q-col-gutter-md",
        "col-12",
        "col-sm-6",
        "text-h5",
        "text-subtitle1",
        "text-body2",
        "text-grey-7",
        "bg-negative",
        "bg-blue-5",
        "text-deep-orange-9",
        "shadow-2",
        "absolute",
        "cursor-pointer"
      ])
    );

    // BEM fragments are not utility classes and must stay legal.
    expect(
      findBannedUtilityClasses(
        "admin-import__row page-toc__column-title site-search__option--active text-display sr-only"
      )
    ).toEqual([]);
  });

  it("every authored .vue class attribute is SCSS/BEM, not a Quasar helper", () => {
    const srcRoot = join(__dirname, "..", "..", "..");
    const offenders = [...walkVueFiles(srcRoot)].flatMap(file =>
      scanFile(file, srcRoot)
    );

    const report = offenders.map(
      ({ file, line, tokens, value }) =>
        `${file}:${line}: ${tokens.join(", ")} in class="${value}"`
    );

    expect(offenders, `\n${report.join("\n")}\n`).toEqual([]);
  });
});
