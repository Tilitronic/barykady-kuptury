/**
 * Shared axe-core accessibility helper.
 *
 * docs/DESIGN_SYSTEM.md §6 targets WCAG 2.2 AA and docs/TESTING.md §4 requires
 * automated accessibility assertions inside key Playwright journeys. This
 * wrapper scans the whole page (or a selector subtree) against the WCAG 2.x A/AA
 * tag set and fails the calling test when any *critical* violation is present.
 *
 * Severity choice: the ticket acceptance criterion is "no critical violations".
 * Non-critical findings are returned to the caller so a journey can make a
 * deliberate, documented assertion rather than silently ignoring them.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** WCAG 2.0/2.1 A+AA and WCAG 2.2 AA rules (the project's target level). */
const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Runs an axe audit against the page (or the `selector` subtree) and asserts
 * that no critical violations were found. Returns the raw results for callers
 * that want to inspect serious/moderate findings.
 */
export async function checkA11y(page: Page, selector?: string) {
  const builder = new AxeBuilder({ page }).withTags(WCAG_AA_TAGS);

  if (selector) {
    builder.include(selector);
  }

  const results = await builder.analyze();

  const critical = results.violations.filter(
    violation => violation.impact === "critical"
  );

  const summary = critical
    .map(
      violation =>
        `- ${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes.length} node(s)\n` +
        violation.nodes.map(node => `    ${node.target.join(" ")}`).join("\n")
    )
    .join("\n");

  expect(
    critical,
    `axe found ${critical.length} critical violation(s):\n${summary}`
  ).toHaveLength(0);

  return results;
}
