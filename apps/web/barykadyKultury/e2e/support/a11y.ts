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

/**
 * T-032 journey gate: assert zero *critical and serious* violations.
 *
 * The ticket acceptance criterion names the five key surfaces; serious
 * findings (for example a missing form label or an invalid ARIA relationship)
 * are release-blocking under DESIGN_SYSTEM.md §6 even though axe ranks them
 * below "critical". Keeping this helper beside `checkA11y` means a journey
 * cannot accidentally assert only the weaker threshold.
 */
export async function expectNoBlockingViolations(
  page: Page,
  selector?: string
) {
  const results = await checkA11y(page, selector);
  const blocking = results.violations.filter(
    violation =>
      violation.impact === "critical" || violation.impact === "serious"
  );

  expect(
    blocking,
    `axe found ${blocking.length} critical/serious violation(s):\n` +
      blocking
        .map(
          violation =>
            `- ${violation.id} (${violation.impact}): ${violation.help} — ` +
            `${violation.nodes.length} node(s)\n` +
            violation.nodes
              .map(
                node =>
                  `    ${node.target.join(" ")} — ${node.failureSummary ?? ""} ` +
                  `(${node.html.slice(0, 120)})`
              )
              .join("\n")
        )
        .join("\n")
  ).toHaveLength(0);

  return results;
}

/**
 * T-033 — structural landmark/heading proof (docs/DESIGN_SYSTEM.md §6).
 *
 * axe checks relationships inside nodes it knows; it does not enforce the
 * project's own layout contract ("one clear main landmark", exactly one h1 per
 * page, no skipped heading levels when descending). Those are cheap to prove
 * directly and they catch regressions a future refactor could introduce
 * (e.g. a card jumping from h2 to h4).
 */
export async function expectLandmarksAndHeadings(page: Page): Promise<void> {
  const report = await page.evaluate(() => {
    const visible = (element: Element) =>
      !element.closest('[aria-hidden="true"]') &&
      !element.closest("[hidden]") &&
      (element as HTMLElement).offsetParent !== null;

    const headings = Array.from(
      document.querySelectorAll("h1, h2, h3, h4, h5, h6")
    )
      .filter(visible)
      .map(element => ({
        level: Number(element.tagName.slice(1)),
        text: (element.textContent ?? "").trim().slice(0, 60)
      }));

    return {
      mains: document.querySelectorAll("main").length,
      banners: document.querySelectorAll(
        '[role="banner"], body > header, header'
      ).length,
      contentinfos: document.querySelectorAll('[role="contentinfo"], footer')
        .length,
      headings
    };
  });

  expect(report.mains, "page must expose exactly one main landmark").toBe(1);
  expect(
    report.banners,
    "page must expose a banner landmark"
  ).toBeGreaterThanOrEqual(1);
  // DESIGN_SYSTEM.md §6 "semantic landmarks": every public surface ships the
  // AppFooter contentinfo in PublicLayout. Asserted `>= 1` (mirrors the banner
  // check) rather than `=== 1`, because a detail page may nest a section-level
  // <footer> that is not the page contentinfo — the contract is "a contentinfo
  // landmark exists", not "exactly one <footer> tag in the DOM".
  expect(
    report.contentinfos,
    "page must expose a contentinfo (footer) landmark"
  ).toBeGreaterThanOrEqual(1);

  const h1s = report.headings.filter(heading => heading.level === 1);
  expect(
    h1s.length,
    `expected exactly one h1, found ${h1s.length}: ` +
      JSON.stringify(report.headings)
  ).toBe(1);

  // WCAG headings best practice (DESIGN_SYSTEM.md §6 "visible heading
  // hierarchy"): descending is free, but skipping a level upward
  // (h2 → h4) strands the outline structure.
  let lastLevel = 0;
  const skips: string[] = [];
  for (const heading of report.headings) {
    if (lastLevel > 0 && heading.level > lastLevel + 1) {
      skips.push(`h${lastLevel} → h${heading.level} ("${heading.text}")`);
    }
    lastLevel = heading.level;
  }
  expect(skips, `heading levels skip: ${skips.join(", ")}`).toEqual([]);
}
